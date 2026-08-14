import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';
import { formatDate } from '../../helpers/lang.js';
import { t } from '../../helpers/i18n.js';
import { icon } from '../../helpers/icons.js';

/**
 * Картка випуску (для сторінок персонажа, персони, видавництва тощо)
 * @param {object} issue - Об'єкт випуску
 * @returns {string} HTML string
 */
export function renderEntityIssueCard(issue) {
  const cover = normalizeImageUrl(issue.image);
  const volName = escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '');
  const issueTitle = escapeHtmlAttribute(issue.name || '');
  const displayTitle = volName || issueTitle || t('no_title') || 'Без назви';
  const issueNum = issue.issue_number ? String(issue.issue_number).trim() : '';
  const relDate = formatDate(issue.release_date || issue.cover_date, '');

  const numBadge = issueNum
    ? `<span class="entity-release-number">#${escapeHtmlAttribute(issueNum)}</span>`
    : '';

  const roleBadge = issue.role
    ? `<span class="entity-role-badge">${escapeHtmlAttribute(issue.role)}</span>`
    : '';

  const coverHtml = cover
    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${displayTitle}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/issues/${issue.id}" class="entity-release-card" data-issue-id="${issue.id}">
      <div class="entity-release-cover">
        ${coverHtml}
        ${numBadge}
        ${roleBadge}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${displayTitle}">${displayTitle}</div>
        ${issueTitle && issueTitle !== volName ? `<div class="entity-release-sub" title="${issueTitle}">${issueTitle}</div>` : ''}
        ${relDate ? `<div class="entity-release-date">${icon('calendar', 11, { strokeWidth: 2.2 })} ${escapeHtmlAttribute(relDate)}</div>` : ''}
      </div>
    </a>
  `;
}

/**
 * Картка серії/тому
 * @param {object} vol - Об'єкт тому
 * @returns {string} HTML string
 */
export function renderEntityVolumeCard(vol) {
  const cover = normalizeImageUrl(vol.image);
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || t('no_title') || 'Без назви');
  const subTitle = (vol.name_uk && vol.name && vol.name_uk !== vol.name) ? escapeHtmlAttribute(vol.name) : '';
  const count = vol.char_issue_count !== undefined && vol.char_issue_count !== null
    ? vol.char_issue_count
    : (vol.issue_count || 0);
  const countText = t('issues_abbr', { count }) || `${count} вип.`;

  const coverHtml = cover
    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/volumes/${vol.id}" class="entity-release-card" data-volume-id="${vol.id}">
      <div class="entity-release-cover">
        ${coverHtml}
        <span class="entity-role-badge">${countText}</span>
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${title}">${title}</div>
        ${subTitle ? `<div class="entity-release-sub" title="${subTitle}">${subTitle}</div>` : ''}
      </div>
    </a>
  `;
}

/**
 * Картка глави манги
 * @param {object} mc - Об'єкт глави манги
 * @returns {string} HTML string
 */
export function renderEntityMangaChapterCard(mc) {
  const displayTitle = t('manga_chapter_num', { num: mc.chapter_number }) || `Глава ${mc.chapter_number}`;
  const subTitle = escapeHtmlAttribute(mc.title || mc.volume_name_uk || mc.volume_name || '');
  const roleBadge = mc.role
    ? `<span class="entity-role-badge">${escapeHtmlAttribute(mc.role)}</span>`
    : '';

  return `
    <a href="#/manga-chapters/${mc.id}" class="entity-release-card" data-chapter-id="${mc.id}">
      <div class="entity-release-cover">
        <div class="entity-release-cover-empty">${icon('book', 14)}</div>
        ${roleBadge}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title">${displayTitle}</div>
        ${subTitle ? `<div class="entity-release-sub">${subTitle}</div>` : ''}
      </div>
    </a>
  `;
}

/**
 * Картка збірника
 * @param {object} coll - Об'єкт збірника
 * @returns {string} HTML string
 */
export function renderEntityCollectionCard(coll) {
  const cover = normalizeImageUrl(coll.image);
  const volName = escapeHtmlAttribute(coll.volume_name_uk || coll.volume_name || '');
  const numText = coll.issue_number ? `#${coll.issue_number}` : '';
  const displayTitle = numText ? `${volName} ${numText}` : volName;
  const title = escapeHtmlAttribute(coll.name || '');

  const coverHtml = cover
    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${displayTitle}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/collections/${coll.id}" class="entity-release-card" data-collection-id="${coll.id}">
      <div class="entity-release-cover">
        ${coverHtml}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${displayTitle}">${displayTitle}</div>
        ${title ? `<div class="entity-release-sub">${title}</div>` : ''}
      </div>
    </a>
  `;
}
