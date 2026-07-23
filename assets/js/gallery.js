import { track, showToast } from './site.js';

const galleryElement = document.querySelector('[data-gallery]');
const dayFilterButtons = [...document.querySelectorAll('[data-day-filter]')];
const typeFilterButtons = [...document.querySelectorAll('[data-type-filter]')];
const sortButtons = [...document.querySelectorAll('[data-sort]')];
const popularityControl = document.querySelector('[data-popularity-control]');
const dialog = document.querySelector('[data-dialog]');
const dialogStage = dialog.querySelector('.dialog-stage');
const dialogMedia = document.querySelector('[data-dialog-media]');
const dialogTitle = document.querySelector('[data-dialog-title]');
const dialogType = document.querySelector('[data-dialog-type]');
const dialogPosition = document.querySelector('[data-dialog-position]');
const dialogPrevious = document.querySelector('[data-dialog-previous]');
const dialogNext = document.querySelector('[data-dialog-next]');
const shareDialog = document.querySelector('[data-share-dialog]');
const shareTitle = document.querySelector('[data-share-title]');
const shareStatus = document.querySelector('[data-share-status]');
const shareFileButtons = [...shareDialog.querySelectorAll('[data-share-file]')];
const dialogShareCount = document.querySelector('[data-dialog-share-count]');
const configuredPopularityApi = document.querySelector('meta[name="popularity-api"]')?.content.replace(/\/$/, '');
const popularityApi = /^(?:https:\/\/|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$)/.test(configuredPopularityApi || '')
  ? configuredPopularityApi
  : null;
const dayOrder = ['day-1', 'day-2', 'day-3', 'setup'];

let media = [];
let activeDay = 'all';
let activeType = 'all';
let activeSort = 'chronological';
let activeItem = null;
let sharedItem = null;
let shareLocation = 'card';
let swipeStart = null;
let preparedFile = null;
let sharePreparationId = 0;
let popularityReady = false;
let volatileVisitorToken = null;
const shareCounts = new Map();
const galleryResizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) sizeGridCard(target);
});

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
  const count = shareCounts.get(item.id) || 0;
  const countHidden = popularityReady ? '' : ' hidden';
  return `
    <article class="media-card" data-type="${item.type}" data-day="${item.festivalDay}">
      <button class="media-open" type="button" style="--ratio:${ratio}" data-open="${item.id}" aria-label="Open ${alt}">
        ${mediaPreview}
        <span class="media-badges"><span class="media-badge">${day}</span><span class="media-badge media-kind">${item.type === 'video' ? 'Video' : 'Photo'}</span></span>
        ${play}${duration}
      </button>
      <div class="media-body">
        <div><p class="media-date">${date}</p><h3>${title}</h3><p class="share-count" data-share-count="${item.id}" aria-label="${shareCountLabel(count)}"${countHidden}>↗ ${shareCountLabel(count)}</p></div>
        <div class="media-actions">
          <button class="button button-primary" type="button" data-share="${item.id}">Share this moment</button>
        </div>
      </div>
    </article>`;
}

function filteredMedia() {
  const filtered = media.filter((item) =>
    (activeDay === 'all' || item.festivalDay === activeDay)
    && (activeType === 'all' || item.type === activeType)
  );
  if (activeSort === 'popular') {
    filtered.sort((a, b) =>
      (shareCounts.get(b.id) || 0) - (shareCounts.get(a.id) || 0)
      || b.capturedAt.localeCompare(a.capturedAt)
      || a.id.localeCompare(b.id)
    );
  }
  return filtered;
}

function groupMarkup(items) {
  if (activeSort === 'popular') {
    return `<section class="gallery-day" aria-labelledby="gallery-popular">
      <div class="gallery-day-heading">
        <h3 id="gallery-popular">Most shared moments</h3>
        <span>Based on unique share clicks</span>
      </div>
      <div class="gallery-grid">${items.map(itemMarkup).join('')}</div>
    </section>`;
  }
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
  galleryResizeObserver.disconnect();
  const filtered = filteredMedia();
  galleryElement.innerHTML = filtered.length
    ? groupMarkup(filtered)
    : '<p class="gallery-loading">No moments match these filters.</p>';
  bindVideoPreviews();
  bindGridLayout();
  document.querySelector('[data-visible-count]').textContent = String(filtered.length);
  document.querySelector('[data-total-count]').textContent = String(media.length);
}

function sizeGridCard(card) {
  const grid = card.closest('.gallery-grid');
  if (!grid) return;
  const styles = getComputedStyle(grid);
  const rowHeight = Number.parseFloat(styles.gridAutoRows);
  const rowGap = Number.parseFloat(styles.rowGap);
  const height = card.getBoundingClientRect().height;
  card.style.gridRowEnd = `span ${Math.ceil((height + rowGap) / (rowHeight + rowGap))}`;
}

function bindGridLayout() {
  for (const card of galleryElement.querySelectorAll('.media-card')) {
    galleryResizeObserver.observe(card);
    sizeGridCard(card);
  }
}

function galleryItemUrl(item) {
  const url = new URL(location.href);
  url.hash = `media=${encodeURIComponent(item.id)}`;
  return url.href;
}

function shareUrl(item) {
  return new URL(item.sharePath, document.baseURI).href;
}

function shareCountLabel(count) {
  return `${count} share ${count === 1 ? 'click' : 'clicks'}`;
}

function visitorToken() {
  const key = 'horizon-share-visitor';
  if (volatileVisitorToken) return volatileVisitorToken;
  try {
    let token = localStorage.getItem(key);
    if (!/^[a-f0-9-]{20,80}$/i.test(token || '')) {
      token = createVisitorToken();
      localStorage.setItem(key, token);
    }
    return token;
  } catch {
    volatileVisitorToken = createVisitorToken();
    return volatileVisitorToken;
  }
}

function createVisitorToken() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function updateShareCount(itemId, count) {
  popularityReady = true;
  shareCounts.set(itemId, count);
  if (activeSort === 'popular') {
    render();
  } else {
    for (const element of document.querySelectorAll(`[data-share-count="${itemId}"]`)) {
      element.hidden = false;
      element.textContent = `↗ ${shareCountLabel(count)}`;
      element.setAttribute('aria-label', shareCountLabel(count));
    }
  }
  if (activeItem?.id === itemId) {
    dialogShareCount.hidden = false;
    dialogShareCount.textContent = shareCountLabel(count);
  }
}

async function loadShareCounts() {
  if (!popularityApi) return;
  const response = await fetch(`${popularityApi}/v1/share-counts`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Share counts request failed: ${response.status}`);
  const { counts } = await response.json();
  for (const [itemId, count] of Object.entries(counts)) {
    if (media.some((item) => item.id === itemId) && Number.isInteger(count) && count >= 0) {
      shareCounts.set(itemId, count);
    }
  }
  popularityReady = true;
  popularityControl.hidden = false;
  render();
}

async function recordShare(item, platform) {
  if (!popularityApi) return;
  const response = await fetch(`${popularityApi}/v1/share-events`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mediaId: item.id,
      platform,
      visitorToken: visitorToken()
    })
  });
  if (!response.ok) throw new Error(`Share count request failed: ${response.status}`);
  const result = await response.json();
  updateShareCount(result.mediaId, result.shareCount);
  track('share_count_recorded', {
    media_id: item.id,
    media_type: item.type,
    share_platform: platform,
    counted: result.counted
  });
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

function shareCaption(item, platform = 'native') {
  const mention = platform === 'instagram' || platform === 'native'
    ? '\n@horizonfestivalballyb'
    : '';
  return `${item.title}\nHorizon Festival 2026 · Ballybunion, County Kerry${mention}\n#HorizonFestival #HorizonFestival2026 #Ballybunion`;
}

async function mediaFile(item) {
  const response = await fetch(item.shareSrc);
  if (!response.ok) throw new Error(`Media request failed: ${response.status}`);
  const blob = await response.blob();
  const extension = item.type === 'video' ? 'mp4' : 'jpg';
  return new File(
    [blob],
    `horizon-festival-${item.id}.${extension}`,
    { type: blob.type || (item.type === 'video' ? 'video/mp4' : 'image/jpeg') }
  );
}

async function nativeFileShare(item, platform) {
  if (!preparedFile || !navigator.share || !navigator.canShare) return false;
  if (!navigator.canShare({ files: [preparedFile] })) return false;
  const caption = shareCaption(item, platform);
  const captionCopy = copyText(`${caption}\n${shareUrl(item)}`);
  showToast(`Caption copied · choose ${platform === 'native' ? 'your app' : platform}`);
  const nativeResult = navigator.share({
    files: [preparedFile],
    title: item.title,
    text: caption
  });
  const [nativeOutcome] = await Promise.allSettled([nativeResult, captionCopy]);
  if (nativeOutcome.status === 'rejected') throw nativeOutcome.reason;
  return true;
}

async function nativeLinkShare(item) {
  if (!navigator.share) return false;
  await navigator.share({
    title: item.title,
    text: shareCaption(item),
    url: shareUrl(item)
  });
  return true;
}

async function prepareShareFile(item, preparationId) {
  preparedFile = null;
  shareStatus.textContent = 'Preparing the high-quality file…';
  for (const button of shareFileButtons) button.disabled = true;
  const file = await mediaFile(item);
  if (preparationId !== sharePreparationId || sharedItem?.id !== item.id) return;
  preparedFile = file;
  shareStatus.textContent = `${item.type === 'video' ? 'Video' : 'Photo'} ready · caption will be copied`;
  for (const button of shareFileButtons) button.disabled = false;
}

function openShare(item, locationName) {
  sharedItem = item;
  shareLocation = locationName;
  shareTitle.textContent = `${item.dayLabel} · ${item.title}`;
  if (!shareDialog.open) shareDialog.showModal();
  const preparationId = ++sharePreparationId;
  prepareShareFile(item, preparationId).catch(() => {
    if (preparationId !== sharePreparationId || sharedItem?.id !== item.id) return;
    shareStatus.textContent = 'File hand-off is unavailable · link sharing is ready';
    for (const button of shareFileButtons) button.disabled = false;
  });
  track('share_menu_opened', {
    media_id: item.id,
    media_type: item.type,
    location: locationName
  });
}

async function desktopPlatformFallback(item, platform) {
  const captionAndLink = `${shareCaption(item, platform)}\n${shareUrl(item)}`;
  if (platform === 'facebook') {
    open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl(item))}`,
      '_blank',
      'noopener,noreferrer'
    );
  } else {
    const destination = platform === 'instagram'
      ? 'https://www.instagram.com/'
      : 'https://www.tiktok.com/upload';
    open(destination, '_blank', 'noopener,noreferrer');
  }
  await copyText(captionAndLink);
  showToast('Caption and link copied');
}

async function shareToPlatform(platform) {
  if (!sharedItem) return;
  const item = sharedItem;
  try {
    if (platform === 'copy') {
      await copyText(`${shareCaption(item)}\n${shareUrl(item)}`);
      showToast('Caption and link copied');
    } else if (platform === 'native') {
      const shared = await nativeFileShare(item, platform) || await nativeLinkShare(item);
      if (!shared) {
        await copyText(`${shareCaption(item)}\n${shareUrl(item)}`);
        showToast('Sharing unavailable · caption and link copied');
      }
    } else {
      const shared = await nativeFileShare(item, platform);
      if (!shared) await desktopPlatformFallback(item, platform);
    }
    track('media_shared', {
      media_id: item.id,
      media_type: item.type,
      share_platform: platform,
      location: shareLocation
    });
    shareDialog.close();
    recordShare(item, platform).catch(() => {
      track('share_count_failed', {
        media_id: item.id,
        media_type: item.type,
        share_platform: platform
      });
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      track('share_cancelled', {
        media_id: item.id,
        media_type: item.type,
        share_platform: platform,
        location: shareLocation
      });
      return;
    }
    showToast('Sharing could not be completed');
    track('share_failed', {
      media_id: item.id,
      media_type: item.type,
      share_platform: platform,
      location: shareLocation
    });
  }
}

function openItem(item) {
  activeItem = item;
  const items = filteredMedia();
  const position = items.findIndex((candidate) => candidate.id === item.id);
  dialogTitle.textContent = item.title;
  dialogType.textContent = `${item.dayLabel} · ${item.dayDate} · ${item.type === 'video' ? `${Math.round(item.duration)} sec film` : 'Photograph'}`;
  dialogPosition.textContent = `${position + 1} of ${items.length}`;
  dialogShareCount.hidden = !popularityReady;
  dialogShareCount.textContent = shareCountLabel(shareCounts.get(item.id) || 0);
  dialogMedia.innerHTML = item.type === 'video'
    ? `<video src="${item.src}" poster="${item.poster}" controls playsinline preload="metadata" aria-label="${escapeHtml(item.alt)}"></video>`
    : `<img src="${item.shareSrc}" width="${item.width}" height="${item.height}" alt="${escapeHtml(item.alt)}">`;
  history.replaceState(null, '', galleryItemUrl(item));
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
  render();
}

async function previewVideo(video, play) {
  const card = video.closest('.media-card');
  if (play) {
    video.preload = 'auto';
    await video.play();
    card.classList.add('is-playing');
  } else {
    video.pause();
    video.currentTime = 0;
    card.classList.remove('is-playing');
  }
}

function bindVideoPreviews() {
  for (const video of galleryElement.querySelectorAll('.media-preview')) {
    const card = video.closest('.media-card');
    const start = () => previewVideo(video, true).catch(() => card.classList.remove('is-playing'));
    const stop = () => previewVideo(video, false);
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', (event) => {
      if (!card.contains(event.relatedTarget)) stop();
    });
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

sortButtons.forEach((button) => button.addEventListener('click', () => {
  activeSort = button.dataset.sort;
  for (const candidate of sortButtons) {
    const active = candidate === button;
    candidate.classList.toggle('is-active', active);
    candidate.setAttribute('aria-pressed', String(active));
  }
  render();
  track('gallery_sorted', { sort_name: activeSort });
}));

document.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => {
  dialogMedia.innerHTML = '';
  activeItem = null;
  if (location.hash.startsWith('#media=')) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
});
dialogPrevious.addEventListener('click', () => moveDialog(-1));
dialogNext.addEventListener('click', () => moveDialog(1));
dialogStage.addEventListener('pointerdown', (event) => {
  swipeStart = { x: event.clientX, y: event.clientY };
});
dialogStage.addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const horizontal = event.clientX - swipeStart.x;
  const vertical = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(horizontal) > 55 && Math.abs(vertical) < 70) {
    moveDialog(horizontal > 0 ? -1 : 1);
  }
});
document.addEventListener('keydown', (event) => {
  if (!dialog.open || shareDialog.open) return;
  if (event.key === 'ArrowLeft') moveDialog(-1);
  if (event.key === 'ArrowRight') moveDialog(1);
});
addEventListener('hashchange', openHashItem);

document.querySelector('[data-dialog-share]').addEventListener('click', () => {
  if (activeItem) openShare(activeItem, 'dialog');
});
document.querySelector('[data-share-close]').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('click', (event) => {
  if (event.target === shareDialog) shareDialog.close();
});
shareDialog.querySelectorAll('[data-share-platform]').forEach((button) => {
  button.addEventListener('click', () => shareToPlatform(button.dataset.sharePlatform));
});
shareDialog.addEventListener('close', () => {
  sharePreparationId += 1;
  sharedItem = null;
  preparedFile = null;
});

async function initialize() {
  const response = await fetch('assets/data/gallery.json');
  if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
  media = await response.json();
  render();
  openHashItem();
  if (popularityApi) {
    loadShareCounts().catch(() => {
      popularityControl.hidden = true;
      track('share_counts_failed', { endpoint: 'initial_load' });
    });
  }
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
