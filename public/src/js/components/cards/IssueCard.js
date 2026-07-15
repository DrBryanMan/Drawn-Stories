import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';

function formatIssueDate(value) {
    if (!value) return '';
    return String(value).replace(/-00/g, '');
}

/**
 * Creates a compact issue row for a volume detail page.
 * @param {object} issue
 * @returns {HTMLElement}
 */
export function createIssueCard(issue) {
    const card = document.createElement('article');
    card.className = 'issue-card';

    const coverUrl = normalizeImageUrl(issue.image || issue.image);
    const coverSrc = escapeHtmlAttribute(coverUrl);
    const title = escapeHtmlAttribute(issue.name || `Випуск #${issue.issue_number || issue.id}`);
    const issueNumber = issue.issue_number ? escapeHtmlAttribute(issue.issue_number) : '—';
    const coverDate = formatIssueDate(issue.cover_date);
    const releaseDate = formatIssueDate(issue.release_date);
    const siteLink = issue.site_link || (issue.cv_id && issue.cv_slug
        ? `https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}/`
        : '');

    const coverHTML = coverUrl
        ? `<img class="issue-card__cover" src="${coverSrc}" alt="${title}" loading="lazy">`
        : `<div class="issue-card__cover issue-card__cover--empty">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
               <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z"/>
               <path d="M8 7h6"/>
               <path d="M8 11h8"/>
             </svg>
           </div>`;

    card.innerHTML = `
        <div class="issue-card__index">
            <span>#</span>
            <strong>${issueNumber}</strong>
        </div>
        <div class="issue-card__body">
            <div class="issue-card__media">${coverHTML}</div>
            <div class="issue-card__content">
                <h3 class="issue-card__title">${title}</h3>
                <div class="issue-card__meta">
                    ${coverDate ? `<span>${escapeHtmlAttribute(coverDate)}</span>` : ''}
                    ${releaseDate && releaseDate !== coverDate ? `<span>Реліз ${escapeHtmlAttribute(releaseDate)}</span>` : ''}
                    ${!coverDate && !releaseDate ? '<span>Дата невідома</span>' : ''}
                </div>
                ${issue.description || issue.plot
                    ? `<p class="issue-card__description">${escapeHtmlAttribute(issue.plot || issue.description)}</p>`
                    : ''}
            </div>
        </div>
        <div class="issue-card__actions">
            ${siteLink ? `
                <a class="issue-card__link" href="${escapeHtmlAttribute(siteLink)}" target="_blank" rel="noreferrer" title="Відкрити джерело" aria-label="Відкрити джерело">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 3h6v6"/>
                        <path d="M10 14 21 3"/>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    </svg>
                </a>
            ` : ''}
        </div>
    `;

    return card;
}
