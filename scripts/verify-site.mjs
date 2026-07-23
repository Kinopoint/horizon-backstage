import { access, readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve('.');
const htmlFiles = ['index.html', 'around-ballybunion/index.html', 'privacy/index.html', 'photo-usage/index.html'];
const failures = [];

for (const relative of htmlFiles) {
  const html = await readFile(join(root, relative), 'utf8');
  for (const required of ['<title>', 'name="description"', 'rel="canonical"', 'property="og:title"', 'application/ld+json', 'lang="en"']) {
    if (!html.includes(required)) failures.push(`${relative}: missing ${required}`);
  }
  const hrefs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (/^(?:https?:|mailto:|data:)/.test(href) || href.includes('${')) continue;
    const [pathAndQuery, fragment] = href.split('#');
    const [localPath] = pathAndQuery.split('?');
    if (!localPath) continue;
    const target = localPath.startsWith('/') ? join(root, localPath) : resolve(join(root, relative, '..'), localPath);
    const candidates = extname(target) ? [target] : [target, join(target, 'index.html')];
    let found = false;
    let resolvedTarget;
    for (const candidate of candidates) {
      try { await access(candidate); found = true; resolvedTarget = candidate; break; } catch {}
    }
    if (!found) failures.push(`${relative}: missing local target ${href}`);
    if (found && fragment && resolvedTarget?.endsWith('.html')) {
      const destination = await readFile(resolvedTarget, 'utf8');
      if (!destination.includes(`id="${fragment}"`)) failures.push(`${relative}: ${href} targets a missing fragment`);
    }
  }
}

const gallery = JSON.parse(await readFile(join(root, 'assets/data/gallery.json'), 'utf8'));
if (gallery.length < 3) failures.push('gallery contains fewer than three media records');
if (new Set(gallery.map((item) => item.id)).size !== gallery.length) failures.push('gallery contains duplicate ids');
if (new Set(gallery.map((item) => item.title)).size !== gallery.length) failures.push('gallery contains duplicate titles');
const dayOrder = { 'day-1': 1, 'day-2': 2, 'day-3': 3, setup: 4 };
let previousSortKey = '';
for (const item of gallery) {
  for (const key of ['src', 'shareSrc']) {
    try { await access(join(root, item[key].split('?')[0])); } catch { failures.push(`${item.id}: missing ${key}`); }
  }
  if (!item.alt || !item.title || !item.description) failures.push(`${item.id}: missing accessible metadata`);
  if (/frame \d+|backstage vertical film/i.test(item.title)) failures.push(`${item.id}: title is not curated`);
  if (!dayOrder[item.festivalDay] || !item.dayLabel || !item.dayDate) failures.push(`${item.id}: missing festival day metadata`);
  if (!['metadata', 'curated'].includes(item.dateSource) || Number.isNaN(Date.parse(item.capturedAt))) failures.push(`${item.id}: invalid capture metadata`);
  const expectedOrientation = item.width === item.height ? 'square' : item.width > item.height ? 'landscape' : 'portrait';
  if (item.orientation !== expectedOrientation) failures.push(`${item.id}: orientation does not match output dimensions`);
  const sortKey = `${dayOrder[item.festivalDay]}-${item.capturedAt}-${item.id}`;
  if (previousSortKey && sortKey.localeCompare(previousSortKey) < 0) failures.push(`${item.id}: gallery data is not chronologically sorted`);
  previousSortKey = sortKey;
  const sharePage = join(root, item.sharePath, 'index.html');
  try {
    const html = await readFile(sharePage, 'utf8');
    const canonical = `https://kinopoint.github.io/horizon-backstage/${item.sharePath}`;
    if (!html.includes(`<link rel="canonical" href="${canonical}">`)) failures.push(`${item.id}: share page canonical mismatch`);
    if (!html.includes(`<meta property="og:url" content="${canonical}">`)) failures.push(`${item.id}: share page Open Graph URL mismatch`);
  } catch {
    failures.push(`${item.id}: missing share page`);
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

for (const file of await walk(join(root, 'assets/media'))) {
  const size = (await stat(file)).size;
  if (/\/web\//.test(file) && size > 900_000) failures.push(`${file}: web image exceeds 900 KB`);
  if (/\/video\//.test(file) && size > 40_000_000) failures.push(`${file}: video exceeds 40 MB`);
}

const publicSource = await Promise.all([
  'index.html',
  'privacy/index.html',
  'photo-usage/index.html',
  'assets/js/gallery.js',
  'docs/tracking-plan.md'
].map((file) => readFile(join(root, file), 'utf8')));
if (/\bdownload(?:ed|ing|s)?\b|data-download/i.test(publicSource.join('\n'))) {
  failures.push('public experience still contains file-saving controls or copy');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Verified ${htmlFiles.length} pages and ${gallery.length} media records`);
