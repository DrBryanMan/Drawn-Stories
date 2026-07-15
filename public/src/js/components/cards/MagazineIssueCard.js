import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';

/**
 * Creates the HTML string for a magazine issue card.
 * @param {object} item - Magazine issue data from API
 * @returns {string} HTML markup for the card
 */
export function renderMagazineIssueCard(item) {
    const coverUrl = normalizeImageUrl(item.image);
    const title = item.name || `${item.magazine_name} #${item.issue_number}`;
    const cleanTitle = escapeHtmlAttribute(title);
    const releaseDate = item.release_date ? item.release_date.split('-').reverse().join('.') : '';
    const year = item.release_date ? item.release_date.split('-')[0] : '';
    const pagesText = item.pages ? `${item.pages} ст.` : '';

    const coverHTML = coverUrl
        ? `<img class="magazine-issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${cleanTitle}" loading="lazy">`
        : `<div class="magazine-issue-cover-placeholder">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
               <path d="m21 15-5-5L5 21"/>
             </svg>
           </div>`;

    const calendarIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';
    const bookOpenIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
    const magazineIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>';

    return `
        <div class="magazine-issue-card">
            <a href="#/magazines/issues/${item.id}" class="magazine-issue-card-overlay"></a>
            <div class="magazine-issue-media">
                ${coverHTML}
                <div class="magazine-issue-badge">#${escapeHtmlAttribute(item.issue_number || '?')}</div>
            </div>
            <div class="magazine-issue-body">
                <div class="magazine-issue-title" title="${cleanTitle}">${cleanTitle}</div>
                <div class="magazine-issue-meta">
                    <span class="magazine-issue-meta-item">${calendarIcon} ${releaseDate || year || '—'}</span>
                    ${pagesText ? `
                        <span class="magazine-issue-meta-sep">·</span>
                        <span class="magazine-issue-meta-item">${bookOpenIcon} ${pagesText}</span>
                    ` : ''}
                </div>
                <div class="magazine-issue-magazine">
                    ${magazineIcon} <span>${escapeHtmlAttribute(item.magazine_name || '')}</span>
                </div>
            </div>
        </div>
    `;
}
