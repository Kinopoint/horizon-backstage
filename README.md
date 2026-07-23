# Horizon Backstage

Production-ready static media archive for Horizon Festival Ballybunion 2026.

## What is included

- Responsive gallery with real photo and video downloads
- Optimized WebP previews, high-resolution JPEG downloads and H.264 MP4 films
- Ballybunion guide, privacy and photo-usage pages
- Metadata, Open Graph, JSON-LD, sitemap and robots rules
- Privacy-safe data-layer measurement events
- Automated structural, media and link checks
- GitHub Pages deployment directly from the tested `main` branch

## Commands

```sh
npm test
npm run verify
npm run media:build -- "/absolute/path/to/horizon foto"
```

The media build prefers edited JPEG/HEIC files, adds top-level drone JPEGs, and then includes RAW CR3 files only when no edited file with the same stem already exists. Camera originals are never modified. Generated previews are capped at 1600 px; downloadable JPEGs are capped at 2400 px. Videos are H.264/AAC MP4 with `faststart` and separate WebP posters.

## Deployment

The site is published directly from the root of `main` through GitHub Pages. Before pushing a release, run `npm test && npm run verify`. The canonical preview URL is:

`https://kinopoint.github.io/horizon-backstage/`

## Rollback

Identify the last known-good commit, create a new commit that reverts the faulty change, run the tests, and push it to `main`. GitHub Pages will publish the restored branch state. GitHub Pages deployment history provides a second audit trail for the active release.

## Analytics

See [`docs/tracking-plan.md`](docs/tracking-plan.md). No third-party analytics is enabled until an approved ID and consent implementation are available.
