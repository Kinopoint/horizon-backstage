import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

test('gallery records are curated, unique and point to share-ready media', async () => {
  const gallery = JSON.parse(await readFile(join(root, 'assets/data/gallery.json'), 'utf8'));
  assert.equal(gallery.length, 82);
  assert.ok(gallery.some((item) => item.type === 'photo'));
  assert.equal(gallery.filter((item) => item.type === 'video').length, 3);
  assert.equal(new Set(gallery.map((item) => item.id)).size, gallery.length);
  assert.equal(new Set(gallery.map((item) => item.title)).size, gallery.length);
  assert.deepEqual(
    [...new Set(gallery.map((item) => item.festivalDay))],
    ['day-1', 'day-2', 'day-3', 'setup'],
  );
  assert.equal(gallery.some((item) => item.id === 'tezza-2439'), false, 'duplicate image must stay excluded');
  assert.equal(gallery.some((item) => item.id === 'untitled-frame'), false, 'blank-named duplicate must stay excluded');
  for (const id of [
    '995edbaf-bcee-40a5-895a-868f6dfc3e72',
    'b0794460-8ad2-4dd3-8b2c-9ec16d52dd3c',
    'img-0506',
    'img-0507'
  ]) {
    assert.equal(gallery.some((item) => item.id === id), false, `${id} duplicate burst frame must stay excluded`);
  }
  const contentHashes = new Set();
  for (const item of gallery) {
    assert.ok(item.title.length > 6);
    assert.doesNotMatch(item.title, /frame \d+|backstage vertical film/i);
    assert.ok(item.description.length > item.title.length);
    assert.ok(item.alt.length > 20);
    assert.ok(item.width > 0 && item.height > 0);
    assert.ok(['day-1', 'day-2', 'day-3', 'setup'].includes(item.festivalDay));
    assert.ok(['metadata', 'curated'].includes(item.dateSource));
    assert.ok(['portrait', 'landscape', 'square'].includes(item.orientation));
    assert.equal(item.orientation, item.width === item.height ? 'square' : item.width > item.height ? 'landscape' : 'portrait');
    assert.ok(Number.isFinite(Date.parse(item.capturedAt)));
    assert.ok((await stat(join(root, item.src.split('?')[0]))).size > 0);
    const shareFile = await readFile(join(root, item.shareSrc.split('?')[0]));
    assert.ok(shareFile.length > 0);
    const hash = createHash('sha256').update(shareFile).digest('hex');
    assert.equal(contentHashes.has(hash), false, `${item.id} repeats an identical share file`);
    contentHashes.add(hash);
    assert.equal(item.sharePath, `media/${item.id}/`);
    assert.ok((await stat(join(root, item.sharePath, 'index.html'))).size > 0);
    if (item.type === 'video') assert.ok((await stat(join(root, item.poster.split('?')[0]))).size > 0);
  }
  assert.equal(gallery.find((item) => item.id === '5436c355-3518-4794-be64-4d0451139ed7').festivalDay, 'day-2');
  assert.equal(gallery.find((item) => item.id === 'img-6197').festivalDay, 'day-2');
  assert.equal(gallery.find((item) => item.id === '9e5ad0f8-7c67-4e3c-92a7-ed202af33d76').festivalDay, 'day-2');
  assert.equal(gallery.find((item) => item.id === 'copy-a4569cdf-5d61-4df1-91cd-585cf915354a').festivalDay, 'day-2');
  assert.equal(gallery.find((item) => item.id === 'copy-8d45bb47-ef95-4c2f-9942-51df6b0bc12d').festivalDay, 'day-2');
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

  assert.match(css, /\.gallery-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4/s);
  assert.match(css, /\.gallery-grid\s*\{[^}]*grid-auto-rows:\s*8px/s);
  assert.match(css, /\.media-open img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.media-preview\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(gallery, /new ResizeObserver/);
  assert.match(gallery, /style\.gridRowEnd/);
  assert.match(css, /\.media-dialog\s*\{[^}]*width:\s*min\(900px/s);
  assert.match(css, /\.media-dialog\s*\{[^}]*height:\s*min\(86dvh,\s*780px\)/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.media-dialog\s*\{[^}]*height:\s*calc\(100dvh - 16px\)/);
  assert.match(css, /\.dialog-stage\s*\{[^}]*flex:\s*1 1 auto/s);
  assert.match(css, /\.dialog-media img,\s*\.dialog-media video\s*\{[^}]*position:\s*absolute;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain/s);
  assert.match(html, /data-dialog-previous/);
  assert.match(html, /data-dialog-next/);
  assert.match(html, /data-day-filter="day-1"/);
  assert.match(html, /data-share-platform="instagram"/);
  assert.match(html, /data-share-platform="tiktok"/);
  assert.match(html, /data-share-platform="facebook"/);
  assert.match(gallery, /new URLSearchParams\(location\.hash\.slice\(1\)\)/);
  assert.match(gallery, /data-share=/);
  assert.match(gallery, /video\.play\(\)/);
  assert.match(gallery, /addEventListener\('mouseenter'/);
  assert.match(gallery, /addEventListener\('mouseleave'/);
  assert.match(gallery, /navigator\.canShare/);
  assert.match(gallery, /files:\s*\[preparedFile\]/);
  assert.match(gallery, /@horizonfestivalballyb/);
  assert.match(gallery, /#HorizonFestival2026/);
  assert.match(gallery, /Caption copied/);
  assert.doesNotMatch(gallery, /filtered\.slice/);
  assert.doesNotMatch(gallery, /reducedMotion\.matches/);
  assert.doesNotMatch(gallery, /data-download|media_downloaded|\.download\b/i);
  assert.doesNotMatch(html, /\bdownload\b|data-share-download/i);
});

test('every media item has a crawlable social sharing page', async () => {
  const gallery = JSON.parse(await readFile(join(root, 'assets/data/gallery.json'), 'utf8'));
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
  for (const item of gallery) {
    const html = await readFile(join(root, item.sharePath, 'index.html'), 'utf8');
    const canonical = `https://kinopoint.github.io/horizon-backstage/${item.sharePath}`;
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}">`));
    assert.match(html, new RegExp(`<meta property="og:url" content="${canonical}">`));
    assert.match(html, /<meta property="og:image" content="https:\/\//);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.match(sitemap, new RegExp(`<loc>${canonical}</loc>`));
    if (item.type === 'video') {
      assert.match(html, /<meta property="og:video" content="https:\/\//);
      assert.match(html, /<video /);
    } else {
      assert.match(html, /<img /);
    }
  }
});

test('public experience contains no file-saving control or copy', async () => {
  const publicFiles = [
    'index.html',
    'privacy/index.html',
    'photo-usage/index.html',
    'assets/js/gallery.js',
    'docs/tracking-plan.md'
  ];
  const source = (await Promise.all(publicFiles.map((file) => readFile(join(root, file), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /\bdownload(?:ed|ing|s)?\b|data-download/i);
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
