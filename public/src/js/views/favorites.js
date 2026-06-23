import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { createComicCard } from '../components/ComicCard.js';
import { escapeHtmlAttribute, comicVineImageUrl } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

export async function renderFavorites(main, params) {
    const username = params.username;
    const isOwnProfile = currentUser && currentUser.username === username;

    main.innerHTML = `
        <div class="bookmarks-page">
            <div class="container">
                <div class="page-header">
                    ${createBreadcrumbs([
                        { label: 'Користувач', href: `#/user/${escapeHtmlAttribute(username)}/lists` },
                        { label: 'Обране' }
                    ])}
                    <h1 class="page-title">Обране ${escapeHtmlAttribute(username)}</h1>
                    <p class="bookmarks-subtitle" style="margin-top: 4px; color: var(--text-muted); font-size: 14px;">Колекція найкращого контенту за версією ${escapeHtmlAttribute(username)}</p>
                </div>

                <div id="favorites-content">
                    <div class="loading-state">Завантаження обраного...</div>
                </div>
            </div>
        </div>
    `;

    const content = main.querySelector('#favorites-content');

    try {
        const data = await API.get(`/user/favorites/${username}`);
        renderSections(content, data);
    } catch (err) {
        content.innerHTML = `<div class="error-state">Помилка завантаження: ${escapeHtmlAttribute(err.message)}</div>`;
    }
}

function renderSections(container, data) {
    container.innerHTML = '';

    const sections = [
        { key: 'volume', title: 'Томи' },
        { key: 'issue', title: 'Випуски' },
        { key: 'personnel', title: 'Персонал' },
        { key: 'character', title: 'Персонажі' }
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
                <h3>Тут поки порожньо</h3>
                <p>Користувач ще не додав нічого в обране.</p>
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
            <div class="comic-publisher">${type === 'personnel' ? 'Персонал' : 'Персонаж'}</div>
        </div>
    `;
    
    return card;
}
