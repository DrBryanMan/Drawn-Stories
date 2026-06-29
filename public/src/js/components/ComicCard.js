import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

const LIST_ICONS = {
    'Planned': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'Reading': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'Completed': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'On Hold': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>',
    'Dropped': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const LIST_COLORS = {
    'Planned': '#2563eb',
    'Reading': '#16a34a',
    'Completed': '#059669',
    'On Hold': '#d97706',
    'Dropped': '#dc2626',
};

const LIST_LABELS = {
    'Planned': 'Заплановано',
    'Reading': 'Читаю',
    'Completed': 'Прочитано',
    'On Hold': 'Відкладено',
    'Dropped': 'Закинуто'
};

/**
 * Creates a comic card element.
 * @param {object} item - Volume, Issue or Collection data from API
 * @returns {HTMLElement}
 */
export function createComicCard(item) {
    const isIssue = item.type === 'issue';
    const isCollection = item.type === 'collection';
    const isVolume = item.type === 'volume';

    const publisher = item.publisher_name || '';
    const year = item.start_year || (item.release_date ? item.release_date.split('-')[0] : '');
    const releaseDate = item.release_date ? item.release_date.split('-').reverse().join('.') : '';
    const lang = item.lang || '';
    const coverUrl = comicVineImageUrl(item.cv_img || item.hikka_img || item.cover_img);
    const title = escapeHtmlAttribute(item.name || 'Без назви');
    const coverSrc = escapeHtmlAttribute(coverUrl);

    const a = document.createElement('a');
    a.className = 'comic-card';
    
    if (isVolume) {
        a.href = `#/volumes/${item.id}`;
    } else if (isIssue) {
        a.href = `#/issues/${item.id}`;
        a.dataset.issueId = item.id;
    } else {
        const volId = item.volume_id;
        a.href = volId ? `#/volumes/${volId}` : '#';
        if (isCollection) a.dataset.collectionId = item.id;
    }

    const coverHTML = coverUrl
        ? `<img class="comic-cover" src="${coverSrc}" alt="${title}" loading="lazy">`
        : `<div class="comic-cover-placeholder">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
               <path d="m21 15-5-5L5 21"/>
             </svg>
           </div>`;

    let metaText = '';
    let statBadge = '';
    const issueIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>';
    const calendarIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';

    if (isIssue) {
        metaText = `
            <span class="comic-meta-item">${calendarIcon} ${releaseDate || year || '—'}</span>
        `;
    } else if (isCollection) {
        metaText = `
            <span class="comic-meta-item">${issueIcon} #${escapeHtmlAttribute(item.issue_number || '?')}</span>
            <span class="comic-meta-sep">·</span>
            <span class="comic-meta-item">${calendarIcon} ${year}</span>
        `;
    } else {
        const issueCount = item.issue_count || 0;
        const collectionCount = item.collection_count || 0;
        const unconvertedCount = item.unconverted_issue_count || 0;
        const translationCount = item.translation_count || 0;
        
        let statText = `${issueCount}`;
        let statClass = 'comic-stat-badge';
        let currentIcon = issueIcon;
        
        if (translationCount > 0) {
            statText = `${translationCount}`;
            currentIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>';
        } else if (collectionCount > 0) {
            if (unconvertedCount > 0) {
                statText = `${unconvertedCount}? ${collectionCount}`;
                statClass += ' comic-stat-badge--unconverted';
            } else {
                statText = `${collectionCount}`;
            }
        } else if (issueCount > 0) {
            statClass += ' comic-stat-badge--unconverted';
            statText = `${issueCount}`;
        }

        statBadge = `<div class="${statClass}">${currentIcon} ${statText}</div>`;
        metaText = `
            <span class="comic-meta-item">${calendarIcon} ${year}</span>
        `;
    }

    const langBadge = lang ? `<span class="comic-lang-badge">${escapeHtmlAttribute(lang)}</span>` : '';

    const volumeIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>';
    const publisherIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>';

    const subTitle = isIssue
        ? `<div class="comic-publisher">${volumeIcon} <span>${escapeHtmlAttribute(item.volume_name || '')}</span></div>`
        : (publisher ? `<div class="comic-publisher">${publisherIcon} <span>${publisher}</span></div>` : '');

    let badge = '';
    if (isIssue) {
        badge = `<div class="comic-type-badge">#${escapeHtmlAttribute(item.issue_number || '?')}</div>`;
    } else if (isCollection) {
        badge = `<div class="comic-type-badge comic-type-badge--collection">#${escapeHtmlAttribute(item.issue_number || '?')}</div>`;
    } else if (isVolume && item.translation_count > 0) {
        badge = `<div class="comic-type-badge comic-type-badge--original">Оригінал</div>`;
    }

    let listBadge = '';
    if (item.list_name && LIST_ICONS[item.list_name]) {
        const color = LIST_COLORS[item.list_name];
        const label = LIST_LABELS[item.list_name];
        const bg = `color-mix(in srgb, ${color} 15%, rgba(255, 255, 255, 0.75))`;
        listBadge = `
            <div class="comic-list-badge" title="${label}" style="color: ${color}; background: ${bg}; border-color: color-mix(in srgb, ${color} 30%, transparent)">
                ${LIST_ICONS[item.list_name]}
            </div>
        `;
    }

    const sources = [];
    if (item.mal_id) sources.push('<span class="comic-source-badge comic-source-badge--mal">MAL</span>');
    if (item.hikka_slug) sources.push('<span class="comic-source-badge comic-source-badge--hikka">HIKKA</span>');
    if (item.cv_id) sources.push('<span class="comic-source-badge comic-source-badge--cv">CV</span>');
    const sourcesHTML = sources.length > 0 ? `<div class="comic-sources-list">${sources.join('')}</div>` : '';

    a.innerHTML = `
        <div class="comic-media">
            ${coverHTML}
            ${badge}
            ${statBadge}
            ${listBadge}
            ${sourcesHTML}
        </div>
        <div class="comic-body">
            <div class="comic-title">${title}</div>
            <div class="comic-meta-pill">
                <span>${metaText}</span>
                ${langBadge}
            </div>
            ${subTitle}
        </div>
    `;

    return a;
}
