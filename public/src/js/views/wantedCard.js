/**
 * wantedCard.js — картка для сторінки /wanted.
 * Підтримує всі типи: volumes, collections, issues, characters, personnel, publishers.
 */
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { icon } from '../helpers/icons.js';

const BADGE_ICON = icon('warning', 9, { strokeWidth: 2.5 });

const PLACEHOLDER_IMG = `
  <div class="wanted-card-poster-placeholder">
    ${icon('imagePlaceholder', 28, { strokeWidth: 1.5 })}
  </div>`;

const PERSON_PLACEHOLDER = `
  <div class="wanted-card-poster-placeholder">
    ${icon('character', 28, { strokeWidth: 1.5 })}
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
        imageUrl: normalizeImageUrl(item.image),
        subtitle: item.publisher_name || null,
        placeholder: PLACEHOLDER_IMG,
      };
    case 'issue':
      return {
        href:     `/#/issues/${item.id}`,
        imageUrl: normalizeImageUrl(item.image || item.volume_img),
        subtitle: item.volume_name || null,
        placeholder: PLACEHOLDER_IMG,
      };
    case 'character':
      return {
        href:     `/#/characters/${item.id}`,
        imageUrl: normalizeImageUrl(item.image),
        subtitle: item.name_uk || null,
        placeholder: PERSON_PLACEHOLDER,
      };
    case 'person':
      return {
        href:     `/#/persons/${item.id}`,
        imageUrl: normalizeImageUrl(item.image),
        subtitle: item.name_uk || null,
        placeholder: PERSON_PLACEHOLDER,
      };
    case 'publisher':
      return {
        href:     `/#/publishers/${item.id}`,
        imageUrl: normalizeImageUrl(item.image),
        subtitle: item.country || item.place || null,
        placeholder: PLACEHOLDER_IMG,
      };
    default: // volume
      return {
        href:     `/#/volumes/${item.id}`,
        imageUrl: normalizeImageUrl(item.image || item.cover_img),
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
