import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const port = 8791;
const api = `http://127.0.0.1:${port}`;
const origin = 'https://kinopoint.github.io';

async function waitForWorker(process, output) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`Wrangler exited before startup:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Wrangler did not start:\n${output.join('')}`);
}

async function stopWorker(process) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await new Promise((resolve) => {
    process.once('exit', resolve);
    setTimeout(() => {
      if (process.exitCode === null) process.kill('SIGKILL');
      resolve();
    }, 3000);
  });
}

test('popularity API persists counts and deduplicates a visitor per media/day', { timeout: 40_000 }, async () => {
  const persistence = await mkdtemp(join(tmpdir(), 'horizon-popularity-'));
  const output = [];
  const worker = spawn(
    join(root, 'node_modules/.bin/wrangler'),
    ['dev', '--local', '--port', String(port), '--persist-to', persistence],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  worker.stdout.on('data', (chunk) => output.push(chunk.toString()));
  worker.stderr.on('data', (chunk) => output.push(chunk.toString()));

  try {
    await waitForWorker(worker, output);

    const initialResponse = await fetch(`${api}/v1/share-counts`, {
      headers: { Origin: origin }
    });
    assert.equal(initialResponse.status, 200);
    assert.deepEqual(await initialResponse.json(), { counts: {}, total: 0 });
    assert.equal(initialResponse.headers.get('access-control-allow-origin'), origin);

    const share = (visitorToken, mediaId = 'img-9480', platform = 'instagram') => fetch(
      `${api}/v1/share-events`,
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mediaId, platform, visitorToken })
      }
    );

    const first = await share('11111111-1111-4111-8111-111111111111');
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), {
      mediaId: 'img-9480',
      shareCount: 1,
      counted: true
    });

    const duplicate = await share('11111111-1111-4111-8111-111111111111');
    assert.equal(duplicate.status, 200);
    assert.deepEqual(await duplicate.json(), {
      mediaId: 'img-9480',
      shareCount: 1,
      counted: false
    });

    const secondVisitor = await share('22222222-2222-4222-8222-222222222222');
    assert.equal(secondVisitor.status, 200);
    assert.deepEqual(await secondVisitor.json(), {
      mediaId: 'img-9480',
      shareCount: 2,
      counted: true
    });

    const totals = await fetch(`${api}/v1/share-counts`, {
      headers: { Origin: origin }
    });
    assert.deepEqual(await totals.json(), {
      counts: { 'img-9480': 2 },
      total: 2
    });

    assert.equal((await share('33333333-3333-4333-8333-333333333333', 'not-real')).status, 400);
    assert.equal((await share('33333333-3333-4333-8333-333333333333', 'img-9480', 'unknown')).status, 400);

    const malformed = await fetch(`${api}/v1/share-events`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{'
    });
    assert.equal(malformed.status, 400);

    const blocked = await fetch(`${api}/v1/share-counts`, {
      headers: { Origin: 'https://example.com' }
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  } finally {
    await stopWorker(worker);
    await rm(persistence, { recursive: true, force: true });
  }
});
