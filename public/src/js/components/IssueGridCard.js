import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

/**
 * Formats a date string for display.
 * @param {string} dateStr 
 * @returns {string}
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2] === '00') {
            const months = [
                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
            ];
            const mIdx = parseInt(parts[1]) - 1;
            return `${months[mIdx] || parts[1]} ${parts[0]}`;
        }
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return dateStr;
        }
    }
    return dateStr;
}

const ICON = {
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    grip: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>'
};

/**
 * Creates a grid card for an issue or collection.
 * @param {object} item 
 * @param {object} options 
 * @returns {string} HTML string
 */
export function renderIssueGridCard(item, options = {}) {
    const cover = comicVineImageUrl(item.cv_img || item.hikka_img);
    const isCollection = item.type === 'collection' || item.is_collection;
    const isVolume = item.type === 'volume';
    
    // Issue number always in the corner
    const issueNumLabel = item.issue_number ? `#${item.issue_number}` : '';
    
    // Logic for title: use issue name, or volume name in italics if no issue name
    let mainTitle = options.chapterTitle || item.name_uk || item.name;
    let titleHtml = '';
    if (mainTitle) {
        titleHtml = escapeHtmlAttribute(mainTitle);
    } else {
        const volName = item.volume_name_uk || item.volume_name || 'Без назви';
        titleHtml = `<i style="opacity: 0.8; font-weight: 500;">${escapeHtmlAttribute(volName)}</i>`;
    }

    const subTitle = isVolume ? (item.start_year || '') : formatDate(item.cover_date || item.release_date);
    const link = isVolume ? `#/volumes/${item.id}` : (isCollection ? `#/collections/${item.id}` : (item.volume_id ? `#/volumes/${item.volume_id}` : null));

    // Order number badge for moderators
    const orderBadge = options.showOrder && options.orderNum 
        ? `<div class="issue-grid-order-badge" title="Порядок у збірнику">${options.orderNum}</div>` 
        : '';
    
    const dragHandle = options.draggable 
        ? `<div class="issue-grid-drag-handle" draggable="true">${ICON.grip}</div>` 
        : '';

    return `
        <div class="issue-grid-card ${options.draggable ? 'is-draggable' : ''}" 
             ${link ? `onclick="location.hash='${link}'" style="cursor: pointer;"` : ''}
             ${options.draggable ? `data-id="${item.id}"` : ''}>
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
                            ${item.is_owned ? ICON.trash : ICON.plus}
                        </button>
                    ` : `
                        <button class="issue-grid-membership-btn" data-issue-id="${item.id}" title="У збірниках">
                            ${ICON.layers}
                            ${item.collection_count > 0 ? `<span class="membership-count">${item.collection_count}</span>` : ''}
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
        </div>
    `;
}
