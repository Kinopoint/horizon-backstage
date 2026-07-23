import { track, showToast } from './site.js';

const galleryElement = document.querySelector('[data-gallery]');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const showMoreButton = document.querySelector('[data-show-more]');
const dialog = document.querySelector('[data-dialog]');
const dialogMedia = document.querySelector('[data-dialog-media]');
const dialogTitle = document.querySelector('[data-dialog-title]');
const dialogType = document.querySelector('[data-dialog-type]');
const dialogDownload = document.querySelector('[data-dialog-download]');
const dialogShare = document.querySelector('[data-dialog-share]');
const toast = document.querySelector('[data-toast]');
const pageSize = 20;
let media = [];
let activeFilter = 'all';
let visibleLimit = pageSize;
let activeItem = null;

function itemMarkup(item) {
  const ratio = `${item.width} / ${item.height}`;
  const source = item.type === 'video' ? item.poster : item.src;
  const typeLabel = item.type === 'video' ? `Video · ${Math.round(item.duration)} sec` : 'Photograph';
  return `
    <article class="media-card" data-type="${item.type}">
      <button class="media-open" type="button" style="--ratio:${ratio}" data-open="${item.id}" aria-label="Open ${item.alt}">
        <img src="${source}" width="${item.width}" height="${item.height}" alt="${item.alt}" loading="lazy" decoding="async">
        <span class="media-badge">${typeLabel}</span>
        ${item.type === 'video' ? '<span class="play-mark" aria-hidden="true">▶</span>' : ''}
      </button>
      <div class="media-meta">
        <h3>${item.title}</h3>
        <a href="${item.download}" download data-download="${item.id}">Download</a>
      </div>
    </article>`;
}

function render() {
  const filtered = activeFilter === 'all' ? media : media.filter((item) => item.type === activeFilter);
  const visible = filtered.slice(0, visibleLimit);
  galleryElement.innerHTML = visible.map(itemMarkup).join('');
  document.querySelector('[data-visible-count]').textContent = String(visible.length);
  document.querySelector('[data-total-count]').textContent = String(filtered.length);
  showMoreButton.hidden = visible.length >= filtered.length;
  showMoreButton.textContent = `Show more · ${Math.min(pageSize, filtered.length - visible.length)}`;
}

function openItem(item) {
  activeItem = item;
  dialogTitle.textContent = item.title;
  dialogType.textContent = item.type === 'video' ? `Official film · ${Math.round(item.duration)} seconds` : 'Official photograph';
  dialogDownload.href = item.download;
  dialogDownload.download = '';
  dialogDownload.textContent = item.type === 'video' ? 'Download MP4' : 'Download high-resolution JPEG';
  dialogMedia.innerHTML = item.type === 'video'
    ? `<video src="${item.src}" poster="${item.poster}" controls playsinline preload="metadata" aria-label="${item.alt}"></video>`
    : `<img src="${item.src}" width="${item.width}" height="${item.height}" alt="${item.alt}">`;
  dialog.showModal();
  track('media_opened', { media_id: item.id, media_type: item.type, media_title: item.title });
}

galleryElement.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-open]');
  if (openButton) {
    const item = media.find((candidate) => candidate.id === openButton.dataset.open);
    if (item) openItem(item);
  }
  const downloadLink = event.target.closest('[data-download]');
  if (downloadLink) {
    const item = media.find((candidate) => candidate.id === downloadLink.dataset.download);
    track('media_downloaded', { media_id: item?.id, media_type: item?.type, media_title: item?.title, location: 'card' });
  }
});

filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  visibleLimit = pageSize;
  filterButtons.forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle('is-active', active);
    candidate.setAttribute('aria-pressed', String(active));
  });
  render();
  track('gallery_filtered', { filter_name: activeFilter });
}));

showMoreButton.addEventListener('click', () => {
  visibleLimit += pageSize;
  render();
  track('gallery_more_loaded', { filter_name: activeFilter, visible_count: visibleLimit });
});

document.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { dialogMedia.innerHTML = ''; activeItem = null; });
dialogDownload.addEventListener('click', () => {
  if (activeItem) track('media_downloaded', { media_id: activeItem.id, media_type: activeItem.type, media_title: activeItem.title, location: 'dialog' });
});
dialogShare.addEventListener('click', async () => {
  if (!activeItem) return;
  const shareData = { title: activeItem.title, text: `${activeItem.title} — Horizon Backstage 2026`, url: location.href.split('#')[0] };
  if (navigator.share) {
    await navigator.share(shareData);
    track('media_shared', { media_id: activeItem.id, share_method: 'native' });
    return;
  }
  await navigator.clipboard.writeText(shareData.url);
  showToast('Gallery link copied');
  track('media_shared', { media_id: activeItem.id, share_method: 'clipboard' });
});

async function initialize() {
  const response = await fetch('assets/data/gallery.json');
  if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
  media = await response.json();
  render();
  track('gallery_loaded', { media_count: media.length });
}

initialize().catch((error) => {
  console.error(error);
  galleryElement.innerHTML = '<p class="gallery-loading">The gallery could not be loaded. Please refresh the page.</p>';
});
