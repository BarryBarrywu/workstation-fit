const cards = Array.from(document.querySelectorAll<HTMLElement>('.evidence-card'));
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-evidence-index]'));
const deck = document.querySelector<HTMLElement>('.evidence-deck');
const progress = document.querySelector<HTMLElement>('#evidence-progress');
const previous = document.querySelector<HTMLButtonElement>('#previous-evidence');
const next = document.querySelector<HTMLButtonElement>('#next-evidence');
const keepsEvidenceHash = import.meta.env.PUBLIC_SITE_EDITION !== 'toy';

let activeIndex = 0;
let touchStartX = 0;

function activate(index: number, focusTab = false) {
  activeIndex = (index + cards.length) % cards.length;
  cards.forEach((card, cardIndex) => {
    card.hidden = cardIndex !== activeIndex;
    card.classList.toggle('is-entering', cardIndex === activeIndex);
  });
  tabs.forEach((tab, tabIndex) => {
    const selected = tabIndex === activeIndex;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  progress!.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  previous!.disabled = activeIndex === 0;
  next!.disabled = activeIndex === cards.length - 1;
  const tablist = tabs[activeIndex].parentElement;
  if (tablist && tablist.scrollWidth > tablist.clientWidth) {
    const left = tabs[activeIndex].offsetLeft - (tablist.clientWidth - tabs[activeIndex].offsetWidth) / 2;
    tablist.scrollTo({ left, behavior: 'smooth' });
  }
  if (focusTab) tabs[activeIndex].focus();
}

function activateFromHash(scroll = false) {
  if (!keepsEvidenceHash) return;
  const index = cards.findIndex((card) => `#${card.id}` === window.location.hash);
  if (index < 0) return;
  activate(index);
  if (scroll) requestAnimationFrame(() => cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    activate(index);
    if (keepsEvidenceHash) history.replaceState(null, '', `#${cards[index].id}`);
  });
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    activate(activeIndex + (event.key === 'ArrowRight' ? 1 : -1), true);
  });
});

previous?.addEventListener('click', () => activate(activeIndex - 1));
next?.addEventListener('click', () => activate(activeIndex + 1));

document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#evidence-"]');
  if (!link) return;
  const index = cards.findIndex((card) => `#${card.id}` === link.getAttribute('href'));
  if (index < 0) return;
  event.preventDefault();
  activate(index);
  if (keepsEvidenceHash) history.replaceState(null, '', `#${cards[index].id}`);
  requestAnimationFrame(() => cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' }));
});

deck?.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

deck?.addEventListener('touchend', (event) => {
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) < 48) return;
  activate(activeIndex + (distance < 0 ? 1 : -1));
}, { passive: true });

if (keepsEvidenceHash) window.addEventListener('hashchange', () => activateFromHash(true));
activateFromHash();
activate(activeIndex);
