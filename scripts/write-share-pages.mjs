import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const productionRoot = 'https://kinopoint.github.io/horizon-backstage/';
const gallery = JSON.parse(await readFile('assets/data/gallery.json', 'utf8'));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function absolute(path) {
  return new URL(path, productionRoot).href;
}

await rm('media', { recursive: true, force: true });

for (const item of gallery) {
  const pageDirectory = join('media', item.id);
  const canonical = absolute(item.sharePath);
  const contentUrl = absolute(item.shareSrc);
  const previewUrl = absolute(item.type === 'video' ? item.poster : item.shareSrc);
  const galleryUrl = `${productionRoot}#media=${encodeURIComponent(item.id)}`;
  const type = item.type === 'video' ? 'VideoObject' : 'ImageObject';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': type,
    name: item.title,
    description: item.description,
    contentUrl,
    thumbnailUrl: previewUrl,
    uploadDate: item.capturedAt,
    width: item.width,
    height: item.height,
    isPartOf: {
      '@type': 'ImageGallery',
      name: 'Horizon Backstage 2026',
      url: productionRoot
    },
    about: {
      '@type': 'Event',
      name: 'Horizon Festival Ballybunion 2026',
      startDate: '2026-07-10',
      endDate: '2026-07-12'
    }
  };
  if (item.type === 'video') structuredData.duration = `PT${Math.round(item.duration)}S`;

  const videoMeta = item.type === 'video'
    ? `
  <meta property="og:video" content="${escapeHtml(contentUrl)}">
  <meta property="og:video:secure_url" content="${escapeHtml(contentUrl)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="${item.width}">
  <meta property="og:video:height" content="${item.height}">`
    : '';
  const mediaMarkup = item.type === 'video'
    ? `<video src="../../${escapeHtml(item.src)}" poster="../../${escapeHtml(item.poster)}" controls playsinline preload="metadata" aria-label="${escapeHtml(item.alt)}"></video>`
    : `<img src="../../${escapeHtml(item.shareSrc)}" width="${item.width}" height="${item.height}" alt="${escapeHtml(item.alt)}">`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(item.title)} — Horizon Backstage</title>
  <meta name="description" content="${escapeHtml(item.description)}">
  <meta name="theme-color" content="#04342c">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="../../assets/brand/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../assets/css/styles.css?v=9">
  <meta property="og:type" content="${item.type === 'video' ? 'video.other' : 'article'}">
  <meta property="og:site_name" content="Horizon Backstage">
  <meta property="og:title" content="${escapeHtml(item.title)}">
  <meta property="og:description" content="${escapeHtml(item.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(previewUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(item.alt)}">${videoMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(item.title)}">
  <meta name="twitter:description" content="${escapeHtml(item.description)}">
  <meta name="twitter:image" content="${escapeHtml(previewUrl)}">
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
</head>
<body class="media-share-page">
  <header class="share-page-header">
    <a class="brand" href="../../"><span>Horizon</span><i>·</i><strong>Backstage</strong></a>
  </header>
  <main class="share-page-main">
    <div class="share-page-media">${mediaMarkup}</div>
    <div class="share-page-copy">
      <p class="eyebrow dark">${escapeHtml(item.dayLabel)} · ${escapeHtml(item.dayDate)}</p>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(item.description)}</p>
      <a class="button button-primary" href="${escapeHtml(galleryUrl)}">Open in the full gallery</a>
    </div>
  </main>
</body>
</html>
`;
  await mkdir(pageDirectory, { recursive: true });
  await writeFile(join(pageDirectory, 'index.html'), html);
}

const staticPages = [
  productionRoot,
  `${productionRoot}around-ballybunion/`,
  `${productionRoot}photo-usage/`,
  `${productionRoot}privacy/`
];
const sitemapUrls = [
  ...staticPages,
  ...gallery.map((item) => absolute(item.sharePath))
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
await writeFile('sitemap.xml', sitemap);
console.log(`Wrote ${gallery.length} media share pages and ${sitemapUrls.length} sitemap URLs`);
