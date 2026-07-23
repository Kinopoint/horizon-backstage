import { track, showToast } from './site.js';

const galleryElement = document.querySelector('[data-gallery]');
const dayFilterButtons = [...document.querySelectorAll('[data-day-filter]')];
const typeFilterButtons = [...document.querySelectorAll('[data-type-filter]')];
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
const dayOrder = ['day-1', 'day-2', 'day-3', 'setup'];

let media = [];
let activeDay = 'all';
let activeType = 'all';
let activeItem = null;
let sharedItem = null;
let shareLocation = 'card';
let swipeStart = null;
let preparedFile = null;
let sharePreparationId = 0;
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
          <button class="button button-primary" type="button" data-share="${item.id}">Share this moment</button>
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
