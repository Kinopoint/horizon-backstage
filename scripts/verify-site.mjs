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
    const [localPath, fragment] = href.split('#');
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
for (const item of gallery) {
  for (const key of ['src', 'download']) {
    try { await access(join(root, item[key])); } catch { failures.push(`${item.id}: missing ${key}`); }
  }
  if (!item.alt || !item.title) failures.push(`${item.id}: missing accessible metadata`);
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

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Verified ${htmlFiles.length} pages and ${gallery.length} media records`);
