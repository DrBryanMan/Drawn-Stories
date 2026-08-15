import { t } from './i18n.js';

// ── Theme Manager ────────────────────────────────────
// Керує темою оформлення: localStorage, data-theme, синхронізація з сервером

const STORAGE_KEY = 'site_theme';
const VALID_THEMES = ['light', 'dark'];

/** Повертає збережену тему з localStorage або 'light' за замовчуванням */
export function getTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.includes(stored) ? stored : 'light';
}

/** Встановлює тему: data-theme на <html> + збереження в localStorage */
export function setTheme(theme) {
  if (!VALID_THEMES.includes(theme)) theme = 'light';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  updateToggleIcon();
  const select = document.getElementById('theme-select');
  if (select && select.value !== theme) {
    select.value = theme;
  }
}

/** Перемикає між light/dark, повертає нову тему */
export function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

/** Синхронізація з відповіддю сервера (при login / checkAuth) */
export function syncThemeFromServer(serverTheme) {
  if (VALID_THEMES.includes(serverTheme) && serverTheme !== getTheme()) {
    setTheme(serverTheme);
  }
}

/** Ініціалізація теми при завантаженні (до першого рендеру) */
export function initTheme() {
  setTheme(getTheme());
}

// ── Іконки для кнопки ──────────────────────────────────
const ICON_SUN = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

function buildIcon(d) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/** Оновлює іконку кнопки-перемикача (Sun у темній, Moon у світлій) */
function updateToggleIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = getTheme() === 'dark';
  btn.innerHTML = buildIcon(isDark ? ICON_SUN : ICON_MOON);
  btn.title = isDark ? (t('theme_toggle_tip_light') || 'Увімкнути світлу тему') : (t('theme_toggle_tip_dark') || 'Увімкнути темну тему');
}

/** Створює HTML кнопки для вставки у хедер */
export function getToggleButtonHtml() {
  const isDark = getTheme() === 'dark';
  const tip = isDark ? (t('theme_toggle_tip_light') || 'Увімкнути світлу тему') : (t('theme_toggle_tip_dark') || 'Увімкнути темну тему');
  return `<button class="theme-toggle-btn" id="theme-toggle-btn" title="${tip}" aria-label="${tip}">
    ${buildIcon(isDark ? ICON_SUN : ICON_MOON)}
  </button>`;
}

