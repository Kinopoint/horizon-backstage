import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const pages = ['index.html', 'around-ballybunion/index.html', 'privacy/index.html', 'photo-usage/index.html'];

test('every public page has one H1, metadata and structured data', async () => {
  for (const page of pages) {
    const html = await readFile(join(root, page), 'utf8');
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${page} must contain one H1`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta name="description" content="[^"].+">/);
    assert.match(html, /<link rel="canonical" href="https:\/\//);
    assert.match(html, /<script type="application\/ld\+json">/);
    for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(block[1]), `${page} contains invalid JSON-LD`);
    }
  }
});

test('all fragment links target an existing id', async () => {
  for (const page of pages) {
    const html = await readFile(join(root, page), 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const [, fragment] of html.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.has(fragment), `${page} links to missing #${fragment}`);
    }
  }
});

test('gallery records point to optimized, downloadable media', async () => {
  const gallery = JSON.parse(await readFile(join(root, 'assets/data/gallery.json'), 'utf8'));
  assert.ok(gallery.some((item) => item.type === 'photo'));
  assert.equal(gallery.filter((item) => item.type === 'video').length, 3);
  assert.equal(new Set(gallery.map((item) => item.id)).size, gallery.length);
  for (const item of gallery) {
    assert.ok(item.title.length > 6);
    assert.ok(item.alt.length > 20);
    assert.ok(item.width > 0 && item.height > 0);
    assert.ok((await stat(join(root, item.src))).size > 0);
    assert.ok((await stat(join(root, item.download))).size > 0);
    if (item.type === 'video') assert.ok((await stat(join(root, item.poster))).size > 0);
  }
});

test('privacy-safe release contains no third-party analytics scripts', async () => {
  const source = await Promise.all(pages.map((page) => readFile(join(root, page), 'utf8')));
  const html = source.join('\n');
  assert.doesNotMatch(html, /googletagmanager|google-analytics|facebook\.net\/.*pixel|segment\.com/i);
  assert.match(await readFile(join(root, 'assets/js/site.js'), 'utf8'), /window\.dataLayer/);
});

test('gallery layout preserves media proportions and exposes complete controls', async () => {
  const css = await readFile(join(root, 'assets/css/styles.css'), 'utf8');
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const gallery = await readFile(join(root, 'assets/js/gallery.js'), 'utf8');

  assert.match(css, /\.gallery-grid\s*\{\s*columns:\s*4/);
  assert.match(css, /\.media-open img\s*\{[^}]*height:\s*auto/s);
  assert.match(css, /\.media-card\s*\{[^}]*break-inside:\s*avoid/s);
  assert.match(html, /data-dialog-previous/);
  assert.match(html, /data-dialog-next/);
  assert.match(gallery, /new URLSearchParams\(location\.hash\.slice\(1\)\)/);
  assert.match(gallery, /data-share=/);
});

test('preview content is explicitly labelled and excluded from structured claims', async () => {
  const home = await readFile(join(root, 'index.html'), 'utf8');
  const around = await readFile(join(root, 'around-ballybunion/index.html'), 'utf8');

  assert.match(home, /Partner area preview/);
  assert.match(home, /Demo content/);
  assert.match(around, /Accommodation preview/);
  assert.match(around, /Preview only:/);
  assert.doesNotMatch(
    [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n'),
    /Heineken|White Claw|Orchard Thieves/,
  );
});
