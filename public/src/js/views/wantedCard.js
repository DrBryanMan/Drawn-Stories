/**
 * wantedCard.js — картка для сторінки /wanted.
 * Підтримує всі типи: volumes, collections, issues, characters, personnel, publishers.
 */
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

const BADGE_ICON = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

const PLACEHOLDER_IMG = `
  <div class="wanted-card-poster-placeholder">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
    </svg>
  </div>`;

const PERSON_PLACEHOLDER = `
  <div class="wanted-card-poster-placeholder">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`;

/**
 * Визначає посилання та зображення залежно від типу елемента.
 */
function resolveCardMeta(item) {
  const type = item._type;

  switch (type) {
    case 'collection':
      return {
        href:     `/#/collections/${item.id}`,
        imageUrl: comicVineImageUrl(item.cv_img),
        subtitle: item.publisher_name || null,
        placeholder: PLACEHOLDER_IMG,
      };
    case 'issue':
      return {
        href:     `/#/issues/${item.id}`,
        imageUrl: comicVineImageUrl(item.cv_img || item.volume_img),
        subtitle: item.volume_name || null,
        placeholder: PLACEHOLDER_IMG,
      };
    case 'character':
      return {
        href:     `/#/characters/${item.id}`,
        imageUrl: comicVineImageUrl(item.image),
        subtitle: item.name_uk || null,
        placeholder: PERSON_PLACEHOLDER,
      };
    case 'person':
      return {
        href:     `/#/personnel/${item.id}`,
        imageUrl: comicVineImageUrl(item.image),
        subtitle: item.name_uk || null,
        placeholder: PERSON_PLACEHOLDER,
      };
    case 'publisher':
      return {
        href:     `/#/publishers/${item.id}`,
        imageUrl: comicVineImageUrl(item.image),
        subtitle: item.country || item.place || null,
        placeholder: PLACEHOLDER_IMG,
      };
    default: // volume
      return {
        href:     `/#/volumes/${item.id}`,
        imageUrl: comicVineImageUrl(item.cv_img || item.hikka_img || item.cover_img),
        subtitle: item.name_uk || null,
        placeholder: PLACEHOLDER_IMG,
      };
  }
}

/**
 * Створює DOM-елемент картки для wanted-сторінки.
 * @param {object} item — запис з БД з полем missing_fields та _type
 * @returns {HTMLElement}
 */
export function createWantedCard(item) {
  const { href, imageUrl, subtitle, placeholder } = resolveCardMeta(item);
  const title  = escapeHtmlAttribute(item.name || 'Без назви');
  const missingFields = Array.isArray(item.missing_fields) ? item.missing_fields : [];

  const a = document.createElement('a');
  a.className = 'wanted-card';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';

  const posterHTML = imageUrl
    ? `<img src="${escapeHtmlAttribute(imageUrl)}" alt="${title}" loading="lazy">`
    : placeholder;

  const subtitleHTML = subtitle
    ? `<div class="wanted-card-uk-name">${escapeHtmlAttribute(subtitle)}</div>`
    : '';

  const badgesHTML = missingFields.length
    ? missingFields.map(f => `<span class="wanted-badge">${BADGE_ICON} ${escapeHtmlAttribute(f)}</span>`).join('')
    : '';

  a.innerHTML = `
    <div class="wanted-card-poster">${posterHTML}</div>
    <div class="wanted-card-body">
      <div class="wanted-card-title">${title}</div>
      ${subtitleHTML}
      ${badgesHTML ? `<div class="wanted-card-badges">${badgesHTML}</div>` : ''}
    </div>
  `;

  return a;
}
