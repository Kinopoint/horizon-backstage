import { track, showToast } from './site.js';

const galleryElement = document.querySelector('[data-gallery]');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const showMoreButton = document.querySelector('[data-show-more]');
const dialog = document.querySelector('[data-dialog]');
const dialogMedia = document.querySelector('[data-dialog-media]');
const dialogTitle = document.querySelector('[data-dialog-title]');
const dialogType = document.querySelector('[data-dialog-type]');
const dialogPosition = document.querySelector('[data-dialog-position]');
const dialogDownload = document.querySelector('[data-dialog-download]');
const dialogShare = document.querySelector('[data-dialog-share]');
const dialogPrevious = document.querySelector('[data-dialog-previous]');
const dialogNext = document.querySelector('[data-dialog-next]');
const toast = document.querySelector('[data-toast]');
const pageSize = 20;
let media = [];
let activeFilter = 'all';
let visibleLimit = pageSize;
let activeItem = null;

function itemMarkup(item) {
  const ratio = `${item.width} / ${item.height}`;
  const source = item.type === 'video' ? item.poster : item.src;
  const typeLabel = item.type === 'video' ? 'Video' : 'Photograph';
  const duration = item.type === 'video' ? `<span class="media-duration">${Math.round(item.duration)} sec</span>` : '';
  const play = item.type === 'video' ? '<span class="play-mark" aria-hidden="true">▶</span>' : '';
  return `
    <article class="media-card" data-type="${item.type}">
      <button class="media-open" type="button" style="--ratio:${ratio}" data-open="${item.id}" aria-label="Open ${item.alt}">
        <img src="${source}" width="${item.width}" height="${item.height}" alt="${item.alt}" loading="lazy" decoding="async">
        <span class="media-badge">${typeLabel}</span>
        ${play}${duration}
      </button>
      <div class="media-body">
        <h3>${item.title}</h3>
        <div class="media-actions">
          <button class="button button-outline" type="button" data-share="${item.id}">Share</button>
          <a class="button button-primary" href="${item.download}" download data-download="${item.id}">Download</a>
        </div>
      </div>
    </article>`;
}

function filteredMedia() {
  return activeFilter === 'all' ? media : media.filter((item) => item.type === activeFilter);
}

function render() {
  const filtered = filteredMedia();
  const visible = filtered.slice(0, visibleLimit);
  galleryElement.innerHTML = visible.map(itemMarkup).join('');
  document.querySelector('[data-visible-count]').textContent = String(visible.length);
  document.querySelector('[data-total-count]').textContent = String(filtered.length);
  showMoreButton.hidden = visible.length >= filtered.length;
  showMoreButton.textContent = `Show more · ${Math.min(pageSize, filtered.length - visible.length)}`;
}

function itemUrl(item) {
  const url = new URL(location.href);
  url.hash = `media=${encodeURIComponent(item.id)}`;
  return url.href;
}

async function copyText(value) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

async function shareItem(item, locationName) {
  const url = itemUrl(item);
  const shareData = { title: item.title, text: `${item.title} — Horizon Backstage 2026`, url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      track('media_shared', { media_id: item.id, share_method: 'native', location: locationName });
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Sharing is unavailable on this device');
    }
    return;
  }
  try {
    await copyText(url);
    showToast('Direct media link copied');
    track('media_shared', { media_id: item.id, share_method: 'clipboard', location: locationName });
  } catch {
    showToast('Could not copy the link');
  }
}

function openItem(item) {
  activeItem = item;
  const items = filteredMedia();
  const position = items.findIndex((candidate) => candidate.id === item.id);
  dialogTitle.textContent = item.title;
  dialogType.textContent = item.type === 'video' ? `Official film · ${Math.round(item.duration)} seconds` : 'Official photograph';
  dialogPosition.textContent = `${position + 1} of ${items.length}`;
  dialogDownload.href = item.download;
  dialogDownload.download = '';
  dialogDownload.textContent = item.type === 'video' ? 'Download MP4' : 'Download high-resolution JPEG';
  dialogMedia.innerHTML = item.type === 'video'
    ? `<video src="${item.src}" poster="${item.poster}" controls playsinline preload="metadata" aria-label="${item.alt}"></video>`
    : `<img src="${item.src}" width="${item.width}" height="${item.height}" alt="${item.alt}">`;
  history.replaceState(null, '', itemUrl(item));
  if (!dialog.open) dialog.showModal();
  track('media_opened', { media_id: item.id, media_type: item.type, media_title: item.title });
}

function moveDialog(direction) {
  if (!activeItem) return;
  const items = filteredMedia();
  const currentIndex = items.findIndex((item) => item.id === activeItem.id);
  const nextIndex = (currentIndex + direction + items.length) % items.length;
  openItem(items[nextIndex]);
}

function openHashItem() {
  if (!location.hash.startsWith('#media=')) return;
  const id = new URLSearchParams(location.hash.slice(1)).get('media');
  const item = media.find((candidate) => candidate.id === id);
  if (item && item.id !== activeItem?.id) openItem(item);
}

galleryElement.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-open]');
  if (openButton) {
    const item = media.find((candidate) => candidate.id === openButton.dataset.open);
    if (item) openItem(item);
  }
  const shareButton = event.target.closest('[data-share]');
  if (shareButton) {
    const item = media.find((candidate) => candidate.id === shareButton.dataset.share);
    if (item) shareItem(item, 'card');
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
dialog.addEventListener('close', () => {
  dialogMedia.innerHTML = '';
  activeItem = null;
  if (location.hash.startsWith('#media=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
});
dialogPrevious.addEventListener('click', () => moveDialog(-1));
dialogNext.addEventListener('click', () => moveDialog(1));
document.addEventListener('keydown', (event) => {
  if (!dialog.open) return;
  if (event.key === 'ArrowLeft') moveDialog(-1);
  if (event.key === 'ArrowRight') moveDialog(1);
});
addEventListener('hashchange', openHashItem);
dialogDownload.addEventListener('click', () => {
  if (activeItem) track('media_downloaded', { media_id: activeItem.id, media_type: activeItem.type, media_title: activeItem.title, location: 'dialog' });
});
dialogShare.addEventListener('click', () => {
  if (activeItem) shareItem(activeItem, 'dialog');
});

async function initialize() {
  const response = await fetch('assets/data/gallery.json');
  if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
  media = await response.json();
  render();
  openHashItem();
  track('gallery_loaded', { media_count: media.length });
}

initialize().catch((error) => {
  console.error(error);
  galleryElement.innerHTML = '<p class="gallery-loading">The gallery could not be loaded. Please refresh the page.</p>';
});
