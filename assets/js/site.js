window.dataLayer = window.dataLayer || [];
let toastTimer;

export function track(event, properties = {}) {
  window.dataLayer.push({ event, ...properties, page_path: location.pathname });
}

export function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

const menuButton = document.querySelector('[data-menu-button]');
const navigation = document.querySelector('[data-nav]');
if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  });
}

const header = document.querySelector('[data-header]');
if (header) addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 20), { passive: true });

document.addEventListener('click', (event) => {
  const tracked = event.target.closest('[data-track]');
  if (tracked) track('cta_clicked', { cta_name: tracked.dataset.track, cta_text: tracked.textContent.trim() });
});

