import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { createComicCard } from '../components/ComicCard.js';
import { escapeHtmlAttribute, comicVineImageUrl } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';

export async function renderFavorites(main, params) {
    const username = params.username;
    const isOwnProfile = currentUser && currentUser.username === username;

    main.innerHTML = `
        <div class="bookmarks-page">
            <div class="container">
                <div class="page-header">
                    ${createBreadcrumbs([
                        { label: t('user_label'), href: `#/user/${escapeHtmlAttribute(username)}/lists` },
                        { label: t('favorites') }
                    ])}
                    <h1 class="page-title">${t('favorites_title').replace('{username}', escapeHtmlAttribute(username))}</h1>
                    <p class="bookmarks-subtitle" style="margin-top: 4px; color: var(--text-muted); font-size: 14px;">${t('favorites_sub').replace('{username}', escapeHtmlAttribute(username))}</p>
                </div>

                <div id="favorites-content">
                    <div class="loading-state">${t('favorites_loading')}</div>
                </div>
            </div>
        </div>
    `;

    const content = main.querySelector('#favorites-content');

    try {
        const data = await API.get(`/user/favorites/${username}`);
        renderSections(content, data);
    } catch (err) {
        content.innerHTML = `<div class="error-state">${t('loading_error')}: ${escapeHtmlAttribute(err.message)}</div>`;
    }
}

function renderSections(container, data) {
    container.innerHTML = '';

    const sections = [
        { key: 'volume', title: t('section_volumes') },
        { key: 'issue', title: t('section_issues') },
        { key: 'personnel', title: t('personnel') },
        { key: 'character', title: t('characters') }
    ];

    let hasAny = false;

    sections.forEach(sec => {
        const items = data[sec.key] || [];
        if (items.length === 0) return;
        hasAny = true;

        const sectionEl = document.createElement('section');
        sectionEl.className = 'bookmarks-section';
        sectionEl.innerHTML = `
            <div class="section-header">
                <h2>${sec.title} <span>${items.length}</span></h2>
            </div>
            <div class="bookmarks-grid" id="grid-${sec.key}"></div>
        `;
        container.appendChild(sectionEl);

        const grid = sectionEl.querySelector('.bookmarks-grid');
        items.forEach(item => {
            if (sec.key === 'volume' || sec.key === 'issue') {
                grid.appendChild(createComicCard(item));
            } else {
                grid.appendChild(createSimpleCard(item, sec.key));
            }
        });
    });

    if (!hasAny) {
        container.innerHTML = `
            <div class="bookmarks-empty">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                </div>
                <h3>${t('favorites_empty_title')}</h3>
                <p>${t('favorites_empty_desc')}</p>
            </div>
        `;
    }
}

function createSimpleCard(item, type) {
    const card = document.createElement('div');
    card.className = 'comic-card simple-card';
    
    const coverUrl = comicVineImageUrl(item.cv_img);
    const title = escapeHtmlAttribute(item.name || 'Без назви');
    
    card.innerHTML = `
        <div class="comic-cover-wrap">
            ${coverUrl 
                ? `<img class="comic-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}" loading="lazy">`
                : `<div class="comic-cover-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                   </div>`
            }
        </div>
        <div class="comic-body">
            <div class="comic-title">${title}</div>
            <div class="comic-publisher">${type === 'personnel' ? t('personnel') : t('character_singular')}</div>
        </div>
    `;
    
    return card;
}
