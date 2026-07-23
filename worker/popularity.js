import gallery from '../assets/data/gallery.json';

const mediaIds = new Set(gallery.map(({ id }) => id));
const allowedPlatforms = new Set(['instagram', 'tiktok', 'facebook', 'native', 'copy']);
const productionOrigin = 'https://kinopoint.github.io';
let databaseReady;

const schema = [
  `CREATE TABLE IF NOT EXISTS api_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS share_counts (
    media_id TEXT PRIMARY KEY,
    share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0),
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS share_dedupe (
    media_id TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    day TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (media_id, visitor_hash, day)
  )`,
  `CREATE TRIGGER IF NOT EXISTS increment_share_count
    AFTER INSERT ON share_dedupe
    BEGIN
      INSERT INTO share_counts (media_id, share_count, updated_at)
      VALUES (NEW.media_id, 1, NEW.created_at)
      ON CONFLICT(media_id) DO UPDATE SET
        share_count = share_count + 1,
        updated_at = NEW.created_at;
    END`
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === productionOrigin) return true;
  return /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Cache-Control': status === 200 ? 'no-store' : 'private, no-store'
    }
  });
}

async function prepareDatabase(db) {
  await db.batch(schema.map((statement) => db.prepare(statement)));
}

async function installationSalt(db) {
  const existing = await db.prepare(
    `SELECT value FROM api_settings WHERE key = 'visitor_hash_salt'`
  ).first('value');
  if (existing) return existing;
  const salt = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await db.prepare(
    `INSERT OR IGNORE INTO api_settings (key, value) VALUES ('visitor_hash_salt', ?)`
  ).bind(salt).run();
  return db.prepare(
    `SELECT value FROM api_settings WHERE key = 'visitor_hash_salt'`
  ).first('value');
}

async function hashVisitor(request, token, day, db) {
  const salt = await installationSalt(db);
  const address = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    || 'local';
  const bytes = new TextEncoder().encode(`${salt}|${day}|${address}|${token}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readCounts(db) {
  const { results } = await db.prepare(
    `SELECT media_id, share_count FROM share_counts ORDER BY share_count DESC, media_id ASC`
  ).all();
  return Object.fromEntries(
    results
      .filter(({ media_id: id }) => mediaIds.has(id))
      .map(({ media_id: id, share_count: count }) => [id, count])
  );
}

async function recordShare(request, db, origin) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type must be application/json' }, 415, origin);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400, origin);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Request body must be a JSON object' }, 400, origin);
  }
  if (!mediaIds.has(body.mediaId)) return json({ error: 'Unknown media item' }, 400, origin);
  if (!allowedPlatforms.has(body.platform)) return json({ error: 'Unknown share platform' }, 400, origin);
  if (!/^[a-f0-9-]{20,80}$/i.test(body.visitorToken || '')) {
    return json({ error: 'Invalid visitor token' }, 400, origin);
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const day = timestamp.slice(0, 10);
  const visitorHash = await hashVisitor(request, body.visitorToken, day, db);
  await db.prepare(
    `DELETE FROM share_dedupe WHERE day < date('now', '-8 days')`
  ).run();
  const inserted = await db.prepare(
    `INSERT OR IGNORE INTO share_dedupe
      (media_id, visitor_hash, day, platform, created_at)
      VALUES (?, ?, ?, ?, ?)`
  ).bind(body.mediaId, visitorHash, day, body.platform, timestamp).run();
  const count = await db.prepare(
    `SELECT share_count FROM share_counts WHERE media_id = ?`
  ).bind(body.mediaId).first('share_count');

  return json({
    mediaId: body.mediaId,
    shareCount: count || 0,
    counted: inserted.meta.changes > 0
  }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!isAllowedOrigin(origin)) return json({ error: 'Origin is not allowed' }, 403, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    await (databaseReady ||= prepareDatabase(env.DB));

    if (request.method === 'GET' && url.pathname === '/v1/share-counts') {
      const counts = await readCounts(env.DB);
      return json({
        counts,
        total: Object.values(counts).reduce((sum, count) => sum + count, 0)
      }, 200, origin);
    }
    if (request.method === 'POST' && url.pathname === '/v1/share-events') {
      return recordShare(request, env.DB, origin);
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok' }, 200, origin);
    }
    return json({ error: 'Not found' }, 404, origin);
  }
};
