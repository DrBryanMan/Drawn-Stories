import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

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
    const lang = item.lang || '';
    const coverUrl = comicVineImageUrl(item.cv_img || item.hikka_img || item.cover_img);
    const title = escapeHtmlAttribute(item.name || 'Без назви');
    const coverSrc = escapeHtmlAttribute(coverUrl);

    const a = document.createElement('a');
    a.className = 'comic-card';
    
    if (isVolume) {
        a.href = `#/volumes/${item.id}`;
    } else {
        // For issues and collections, link to the volume they belong to
        const volId = item.volume_id || item.volume_id;
        a.href = volId ? `#/volumes/${volId}` : '#';
        if (isIssue) a.dataset.issueId = item.id;
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
    const issueIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>';
    const calendarIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';

    if (isIssue || isCollection) {
        metaText = `
            <span class="comic-meta-item">${issueIcon} #${escapeHtmlAttribute(item.issue_number || '?')}</span>
            <span class="comic-meta-sep">·</span>
            <span class="comic-meta-item">${calendarIcon} ${year}</span>
        `;
    } else {
        metaText = `
            <span class="comic-meta-item">${issueIcon} ${item.issue_count || 0}</span>
            <span class="comic-meta-sep">·</span>
            <span class="comic-meta-item">${calendarIcon} ${year}</span>
        `;
    }

    const langBadge = lang ? `<span class="comic-lang-badge">${escapeHtmlAttribute(lang)}</span>` : '';

    const subTitle = (isIssue || isCollection)
        ? `<div class="comic-publisher">${escapeHtmlAttribute(item.volume_name || '')}</div>`
        : (publisher ? `<div class="comic-publisher">${publisher}</div>` : '');

    let badge = '';
    if (isIssue) badge = '<div class="comic-type-badge">Випуск</div>';
    else if (isCollection) {
        const isManga = item.is_manga || (item.volume_name && (item.volume_name.toLowerCase().includes('manga') || item.volume_name.toLowerCase().includes('манга')));
        badge = `<div class="comic-type-badge comic-type-badge--collection">${isManga ? 'Том' : 'Збірник'}</div>`;
    }

    a.innerHTML = `
        ${coverHTML}
        ${badge}
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
