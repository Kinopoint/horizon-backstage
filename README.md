# Horizon Backstage

Production-ready static media archive for Horizon Festival Ballybunion 2026.

## What is included

- Responsive gallery with 36 curated photo/video moments from the approved phone-edit folder
- Optimized WebP previews, share-ready JPEG files and H.264 MP4 films
- Ballybunion guide, privacy and photo-usage pages
- Metadata, Open Graph, JSON-LD, sitemap and robots rules
- Privacy-safe data-layer measurement events
- Automated structural, media and link checks
- GitHub Pages deployment directly from the tested `main` branch

## Commands

```sh
npm test
npm run verify
npm run media:build -- "/absolute/path/to/horiz foto video phone edit"
```

The media build reads only the exact source directory passed to it. It prefers edited JPEG/HEIC files and includes a RAW CR3 only when no edited file with the same stem exists. Camera originals are never modified. Old generated media is removed before each build so files from earlier source folders cannot remain in production. Generated previews are capped at 1600 px; share-ready JPEGs are capped at 2400 px. Videos are H.264/AAC MP4 with `faststart` and separate WebP posters. `assets/data/source-manifest.json` records the approved filenames and SHA-256 hashes used by the release.

## Deployment

The site is published directly from the root of `main` through GitHub Pages. Before pushing a release, run `npm test && npm run verify`. The canonical preview URL is:

`https://kinopoint.github.io/horizon-backstage/`

## Rollback

Identify the last known-good commit, create a new commit that reverts the faulty change, run the tests, and push it to `main`. GitHub Pages will publish the restored branch state. GitHub Pages deployment history provides a second audit trail for the active release.

## Analytics

See [`docs/tracking-plan.md`](docs/tracking-plan.md). No third-party marketing analytics is enabled until an approved ID and consent implementation are available. The Cloudflare Worker in `worker/popularity.js` is implemented and tested but remains disabled until its permanent endpoint and privacy terms are approved.
