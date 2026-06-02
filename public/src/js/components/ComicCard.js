import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

/**
 * Creates a comic card element.
 * @param {object} item - Volume data from API
 * @returns {HTMLElement}
 */
export function createComicCard(item) {
    const publisher = item.publisher_name || '';
    const year = item.start_year || '';
    const lang = item.lang || '';
    const coverUrl = comicVineImageUrl(item.cv_img || item.hikka_img);
    const title = escapeHtmlAttribute(item.name);
    const coverSrc = escapeHtmlAttribute(coverUrl);

    const a = document.createElement('a');
    a.className = 'comic-card';
    a.href = `#/volumes/${item.id}`;

    const coverHTML = coverUrl
        ? `<img class="comic-cover" src="${coverSrc}" alt="${title}" loading="lazy">`
        : `<div class="comic-cover-placeholder">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
               <path d="m21 15-5-5L5 21"/>
             </svg>
           </div>`;

    a.innerHTML = `
        ${coverHTML}
        <div class="comic-body">
            <div class="comic-title">${title}</div>
            <div class="comic-meta">
                <span>${year}</span>
                <span class="comic-year">${lang}</span>
            </div>
            ${publisher ? `<div class="comic-publisher">${publisher}</div>` : ''}
        </div>
    `;

    return a;
}
