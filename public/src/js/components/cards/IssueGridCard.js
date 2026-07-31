import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';
import { formatDate } from '../../helpers/lang.js';
import { icon } from '../../helpers/icons.js';

/**
 * Creates a grid card for an issue or collection.
 * @param {object} item 
 * @param {object} options 
 * @returns {string} HTML string
 */
export function renderIssueGridCard(item, options = {}) {
    const cover = normalizeImageUrl(item.image || item.image || item.cover_img);
    const isCollection = item.type === 'collection' || item.is_collection;
    const isVolume = item.type === 'volume';
    const isMangaChapter = item.type === 'manga_chapter';
    
    // Issue number always in the corner
    const issueNumLabel = item.chapter_number ? `#${item.chapter_number}` : (item.issue_number ? `#${item.issue_number}` : '');
    
    // Logic for title: use issue name, or volume name in italics if no issue name
    let mainTitle = options.chapterTitle || item.name_uk || item.name_en || item.name;
    let titleHtml = '';
    if (mainTitle) {
        titleHtml = escapeHtmlAttribute(mainTitle);
    } else {
        const volName = item.volume_name_uk || item.volume_name || 'Без назви';
        titleHtml = `<i style="opacity: 0.8; font-weight: 500;">${escapeHtmlAttribute(volName)}</i>`;
    }

    const subTitle = isVolume ? (item.start_year || '') : formatDate(item.cover_date || item.release_date, '—');
    const link = isVolume ? `#/volumes/${item.id}` : (isCollection ? `#/collections/${item.id}` : (isMangaChapter ? `#/manga-chapters/${item.id}` : `#/issues/${item.id}`));

    // Order number badge for moderators
    const orderBadge = options.showOrder && options.orderNum 
        ? `<div class="issue-grid-order-badge" title="Порядок у збірнику">${options.orderNum}</div>` 
        : '';
    
    const dragHandle = options.draggable 
        ? `<div class="issue-grid-drag-handle" draggable="true">${icon('list', 12)}</div>` 
        : '';

    return `
        <a href="${link || '#'}" class="issue-grid-card ${options.draggable ? 'is-draggable' : ''}" 
             ${options.draggable ? `data-id="${item.id}" data-item-type="${isMangaChapter ? 'manga_chapter' : 'issue'}"` : ''}>
            <div class="issue-grid-cover-wrap">
                ${cover
                    ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy">`
                    : `<div class="issue-grid-cover-empty" style="display: inline-block;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
                
                ${issueNumLabel ? `<div class="issue-grid-number">${escapeHtmlAttribute(issueNumLabel)}</div>` : ''}
                ${orderBadge}
                ${dragHandle}
                
                ${isVolume ? '<div class="issue-grid-type-badge">Манґа</div>' : (isCollection ? '<div class="issue-grid-type-badge">Збірник</div>' : '')}
                
                <div class="issue-grid-actions">
                    ${isCollection ? `
                        <button class="issue-grid-toggle-btn ${item.is_owned ? 'is-owned' : ''}" data-id="${item.id}" title="${item.is_owned ? 'Видалити з колекції' : 'Додати в колекцію'}">
                             ${item.is_owned ? icon('trash', 14) : icon('plus', 14)}
                        </button>
                    ` : `
                        <button class="issue-grid-membership-btn ${item.collection_count === 0 ? 'is-disabled' : ''}" 
                                data-issue-id="${item.id}" 
                                data-item-type="${isMangaChapter ? 'manga_chapter' : 'issue'}" 
                                title="${item.collection_count > 0 ? 'У збірниках' : 'Не у збірниках'}"
                                ${item.collection_count === 0 ? 'style="opacity: 0.4; cursor: default;"' : ''}>
                            ${icon('layers', 14)}
                            <span class="membership-count">${item.collection_count || 0}</span>
                        </button>
                    `}
                </div>
            </div>
            <div class="issue-grid-body">
                <div class="issue-grid-title" title="${mainTitle ? escapeHtmlAttribute(mainTitle) : ''}">${titleHtml}</div>
                ${(() => {
                    if (!options.showVolumeName) return '';
                    const volLabel = item.volume_name_uk || item.volume_name || '';
                    const isDup = !volLabel || volLabel === (item.name_uk || item.name || '');
                    if (isDup) return '';
                    return `<div class="issue-grid-volume-label" title="${escapeHtmlAttribute(volLabel)}">${escapeHtmlAttribute(volLabel)}</div>`;
                })()}
                <div class="issue-grid-date">${escapeHtmlAttribute(subTitle)}</div>
                ${options.chapterTitle && (item.name || item.issue_number) ? `
                    <div class="issue-grid-meta" style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                        Випуск #${escapeHtmlAttribute(item.issue_number || '—')}
                    </div>
                ` : ''}
            </div>
        </a>
    `;
}
