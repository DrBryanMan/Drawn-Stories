import { escapeHtmlAttribute, normalizeImageUrl } from '../../helpers/image.js';
import { formatDate } from '../../helpers/lang.js';
import { t } from '../../helpers/i18n.js';

/**
 * Creates the HTML string for a manga chapter card.
 * @param {object} ch - Chapter data from API
 * @returns {string} HTML markup for the card
 */
export function renderMangaChapterCard(ch) {
  const cover = normalizeImageUrl(ch.image || ch.volume_cv_img || ch.volume_cover_img);
  const displayTitle = ch.name_uk || ch.name_en || ch.name || t('chapter_badge_label').replace('{num}', ch.chapter_number);
  const title = escapeHtmlAttribute(displayTitle);
  
  const chNum = ch.chapter_number ? `<span class="manga-chapter-card__badge">${t('chapter_badge_label').replace('{num}', escapeHtmlAttribute(ch.chapter_number))}</span>` : '';
  const volumeName = escapeHtmlAttribute(ch.volume_name_uk || ch.volume_name || t('no_title'));
  const date = ch.release_date ? `<div class="manga-chapter-card__date">${formatDate(ch.release_date)}</div>` : '';

  return `
    <a href="#/manga-chapters/${ch.id}" class="manga-chapter-card">
      <div class="manga-chapter-card__cover-wrap">
        ${cover ? `<img class="manga-chapter-card__cover" src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="manga-chapter-card__cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
        ${chNum}
      </div>
      <div class="manga-chapter-card__body">
        <h4 class="manga-chapter-card__title" title="${title}">${title}</h4>
        <div class="manga-chapter-card__volume">
          ${volumeName}
        </div>
        ${date}
      </div>
    </a>
  `;
}
