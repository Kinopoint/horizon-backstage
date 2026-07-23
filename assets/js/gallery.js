import { track, showToast } from './site.js';

const galleryElement = document.querySelector('[data-gallery]');
const dayFilterButtons = [...document.querySelectorAll('[data-day-filter]')];
const typeFilterButtons = [...document.querySelectorAll('[data-type-filter]')];
const showMoreButton = document.querySelector('[data-show-more]');
const dialog = document.querySelector('[data-dialog]');
const dialogMedia = document.querySelector('[data-dialog-media]');
const dialogTitle = document.querySelector('[data-dialog-title]');
const dialogType = document.querySelector('[data-dialog-type]');
const dialogPosition = document.querySelector('[data-dialog-position]');
const dialogDownload = document.querySelector('[data-dialog-download]');
const dialogPrevious = document.querySelector('[data-dialog-previous]');
const dialogNext = document.querySelector('[data-dialog-next]');
const shareDialog = document.querySelector('[data-share-dialog]');
const shareTitle = document.querySelector('[data-share-title]');
const shareDownload = document.querySelector('[data-share-download]');
const pageSize = 24;
const dayOrder = ['day-1', 'day-2', 'day-3', 'setup'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hoverPlayback = matchMedia('(hover: hover) and (pointer: fine)');

let media = [];
let activeDay = 'all';
let activeType = 'all';
let visibleLimit = pageSize;
let activeItem = null;
let sharedItem = null;
let shareLocation = 'card';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function itemMarkup(item) {
  const ratio = `${item.width} / ${item.height}`;
  const title = escapeHtml(item.title);
  const alt = escapeHtml(item.alt);
  const day = escapeHtml(item.dayLabel);
  const date = escapeHtml(item.dayDate);
  const mediaPreview = item.type === 'video'
    ? `<video class="media-preview" src="${item.src}" poster="${item.poster}" muted loop playsinline preload="metadata" aria-hidden="true"></video>`
    : `<img src="${item.src}" width="${item.width}" height="${item.height}" alt="${alt}" loading="lazy" decoding="async">`;
  const duration = item.type === 'video' ? `<span class="media-duration">${Math.round(item.duration)} sec</span>` : '';
  const play = item.type === 'video' ? '<span class="play-mark" aria-hidden="true">▶</span>' : '';
  return `
    <article class="media-card" data-type="${item.type}" data-day="${item.festivalDay}">
      <button class="media-open" type="button" style="--ratio:${ratio}" data-open="${item.id}" aria-label="Open ${alt}">
        ${mediaPreview}
        <span class="media-badges"><span class="media-badge">${day}</span><span class="media-badge media-kind">${item.type === 'video' ? 'Video' : 'Photo'}</span></span>
        ${play}${duration}
      </button>
      <div class="media-body">
        <div><p class="media-date">${date}</p><h3>${title}</h3></div>
        <div class="media-actions">
          <button class="button button-outline" type="button" data-share="${item.id}">Share</button>
          <a class="button button-primary" href="${item.download}" download data-download="${item.id}">Download</a>
        </div>
      </div>
    </article>`;
}

function filteredMedia() {
  return media.filter((item) =>
    (activeDay === 'all' || item.festivalDay === activeDay)
    && (activeType === 'all' || item.type === activeType)
  );
}

function groupMarkup(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.festivalDay)) groups.set(item.festivalDay, []);
    groups.get(item.festivalDay).push(item);
  }
  return dayOrder
    .filter((day) => groups.has(day))
    .map((day) => {
      const group = groups.get(day);
      const sample = group[0];
      const heading = day === 'setup'
        ? 'Before the gates opened'
        : `${sample.dayLabel} · ${sample.dayDate}`;
      return `<section class="gallery-day" aria-labelledby="gallery-${day}">
        <div class="gallery-day-heading">
          <h3 id="gallery-${day}">${escapeHtml(heading)}</h3>
          <span>${group.length} ${group.length === 1 ? 'moment' : 'moments'}</span>
        </div>
        <div class="gallery-grid">${group.map(itemMarkup).join('')}</div>
      </section>`;
    }).join('');
}

function render() {
  const filtered = filteredMedia();
  const visible = filtered.slice(0, visibleLimit);
  galleryElement.innerHTML = visible.length
    ? groupMarkup(visible)
    : '<p class="gallery-loading">No moments match these filters.</p>';
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

function shareCaption(item) {
  return `${item.title} — Horizon Festival Ballybunion 2026\n#HorizonFestival #Ballybunion`;
}

async function mediaFile(item) {
  const response = await fetch(item.type === 'video' ? item.src : item.download);
  if (!response.ok) throw new Error(`Media request failed: ${response.status}`);
  const blob = await response.blob();
  const extension = item.type === 'video' ? 'mp4' : 'jpg';
  return new File([blob], `${item.id}.${extension}`, { type: blob.type || (item.type === 'video' ? 'video/mp4' : 'image/jpeg') });
}

async function nativeShare(item, platform = 'native') {
  if (!navigator.share) return false;
  const shareData = { title: item.title, text: shareCaption(item), url: itemUrl(item) };
  if (platform !== 'native') {
    const file = await mediaFile(item);
    const fileData = { files: [file], title: item.title, text: shareCaption(item) };
    if (navigator.canShare?.(fileData)) {
      showToast(`Choose ${platform === 'instagram' ? 'Instagram' : 'TikTok'} in the share menu`);
      await navigator.share(fileData);
      return true;
    }
  }
  if (platform === 'native') {
    await navigator.share(shareData);
    return true;
  }
  return false;
}

function openShare(item, locationName) {
  sharedItem = item;
  shareLocation = locationName;
  shareTitle.textContent = `${item.dayLabel} · ${item.title}`;
  shareDownload.href = item.download;
  shareDownload.download = '';
  if (!shareDialog.open) shareDialog.showModal();
  track('share_menu_opened', { media_id: item.id, media_type: item.type, location: locationName });
}

async function shareToPlatform(platform) {
  if (!sharedItem) return;
  const item = sharedItem;
  const url = itemUrl(item);
  try {
    if (platform === 'copy') {
      await copyText(url);
      showToast('Direct media link copied');
    } else if (platform === 'facebook') {
      open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    } else if (platform === 'native') {
      if (!await nativeShare(item)) {
        await copyText(url);
        showToast('Sharing is unavailable; link copied instead');
      }
    } else {
      const shouldShareFile = hoverPlayback.matches === false;
      const shared = shouldShareFile && await nativeShare(item, platform);
      if (!shared) {
        const destination = platform === 'instagram' ? 'https://www.instagram.com/' : 'https://www.tiktok.com/upload';
        open(destination, '_blank', 'noopener,noreferrer');
        await copyText(`${shareCaption(item)}\n${url}`);
        showToast('Caption and link copied');
      }
    }
    track('media_shared', {
      media_id: item.id,
      media_type: item.type,
      share_platform: platform,
      location: shareLocation
    });
    if (platform !== 'native') shareDialog.close();
  } catch (error) {
    if (error.name !== 'AbortError') showToast('Sharing could not be completed');
  }
}

function openItem(item) {
  activeItem = item;
  const items = filteredMedia();
  const position = items.findIndex((candidate) => candidate.id === item.id);
  dialogTitle.textContent = item.title;
  dialogType.textContent = `${item.dayLabel} · ${item.dayDate} · ${item.type === 'video' ? `${Math.round(item.duration)} sec film` : 'Photograph'}`;
  dialogPosition.textContent = `${position + 1} of ${items.length}`;
  dialogDownload.href = item.download;
  dialogDownload.download = '';
  dialogDownload.textContent = item.type === 'video' ? 'Download MP4' : 'Download JPEG';
  dialogMedia.innerHTML = item.type === 'video'
    ? `<video src="${item.src}" poster="${item.poster}" controls playsinline preload="metadata" aria-label="${escapeHtml(item.alt)}"></video>`
    : `<img src="${item.src}" width="${item.width}" height="${item.height}" alt="${escapeHtml(item.alt)}">`;
  history.replaceState(null, '', itemUrl(item));
  if (!dialog.open) dialog.showModal();
  track('media_opened', {
    media_id: item.id,
    media_type: item.type,
    media_title: item.title,
    festival_day: item.festivalDay
  });
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

function setFilter(buttons, selected, property) {
  for (const button of buttons) {
    const active = button.dataset[property] === selected;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  visibleLimit = pageSize;
  render();
}

function previewVideo(card, play) {
  if (!hoverPlayback.matches || reducedMotion.matches) return;
  const video = card?.querySelector('[data-type="video"] .media-preview, .media-preview');
  if (!video) return;
  if (play) {
    video.play().catch(() => undefined);
  } else {
    video.pause();
    video.currentTime = 0;
  }
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
    if (item) openShare(item, 'card');
  }
  const downloadLink = event.target.closest('[data-download]');
  if (downloadLink) {
    const item = media.find((candidate) => candidate.id === downloadLink.dataset.download);
    track('media_downloaded', { media_id: item?.id, media_type: item?.type, media_title: item?.title, location: 'card' });
  }
});

galleryElement.addEventListener('pointerover', (event) => {
  const card = event.target.closest('.media-card');
  if (card && !card.contains(event.relatedTarget)) previewVideo(card, true);
});
galleryElement.addEventListener('pointerout', (event) => {
  const card = event.target.closest('.media-card');
  if (card && !card.contains(event.relatedTarget)) previewVideo(card, false);
});
galleryElement.addEventListener('focusin', (event) => previewVideo(event.target.closest('.media-card'), true));
galleryElement.addEventListener('focusout', (event) => {
  const card = event.target.closest('.media-card');
  if (card && !card.contains(event.relatedTarget)) previewVideo(card, false);
});

dayFilterButtons.forEach((button) => button.addEventListener('click', () => {
  activeDay = button.dataset.dayFilter;
  setFilter(dayFilterButtons, activeDay, 'dayFilter');
  track('gallery_filtered', { filter_dimension: 'festival_day', filter_name: activeDay });
}));
typeFilterButtons.forEach((button) => button.addEventListener('click', () => {
  activeType = button.dataset.typeFilter;
  setFilter(typeFilterButtons, activeType, 'typeFilter');
  track('gallery_filtered', { filter_dimension: 'media_type', filter_name: activeType });
}));

showMoreButton.addEventListener('click', () => {
  visibleLimit += pageSize;
  render();
  track('gallery_more_loaded', { festival_day: activeDay, media_type: activeType, visible_count: visibleLimit });
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
  if (!dialog.open || shareDialog.open) return;
  if (event.key === 'ArrowLeft') moveDialog(-1);
  if (event.key === 'ArrowRight') moveDialog(1);
});
addEventListener('hashchange', openHashItem);
dialogDownload.addEventListener('click', () => {
  if (activeItem) track('media_downloaded', { media_id: activeItem.id, media_type: activeItem.type, media_title: activeItem.title, location: 'dialog' });
});
document.querySelector('[data-dialog-share]').addEventListener('click', () => {
  if (activeItem) openShare(activeItem, 'dialog');
});

document.querySelector('[data-share-close]').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('click', (event) => { if (event.target === shareDialog) shareDialog.close(); });
shareDialog.querySelectorAll('[data-share-platform]').forEach((button) => {
  button.addEventListener('click', () => shareToPlatform(button.dataset.sharePlatform));
});
shareDownload.addEventListener('click', () => {
  if (sharedItem) {
    track('media_downloaded', { media_id: sharedItem.id, media_type: sharedItem.type, media_title: sharedItem.title, location: 'share_menu' });
    shareDialog.close();
  }
});
shareDialog.addEventListener('close', () => { sharedItem = null; });

async function initialize() {
  const response = await fetch('assets/data/gallery.json');
  if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
  media = await response.json();
  render();
  openHashItem();
  track('gallery_loaded', {
    media_count: media.length,
    day_1_count: media.filter((item) => item.festivalDay === 'day-1').length,
    day_2_count: media.filter((item) => item.festivalDay === 'day-2').length,
    day_3_count: media.filter((item) => item.festivalDay === 'day-3').length
  });
}

initialize().catch((error) => {
  console.error(error);
  galleryElement.innerHTML = '<p class="gallery-loading">The gallery could not be loaded. Please refresh the page.</p>';
});
