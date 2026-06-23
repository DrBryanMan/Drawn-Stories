import { API } from '../helpers/api.js';
import { Bookmarks } from '../helpers/bookmarks.js';
import { currentUser } from '../shell.js';
import { createComicCard } from '../components/ComicCard.js';
import { escapeHtmlAttribute, comicVineImageUrl } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

export async function renderBookmarks(main) {
    main.innerHTML = `
        <div class="bookmarks-page">
            <div class="container">
                <div class="page-header">
                    ${createBreadcrumbs([{ label: 'Мої закладки' }])}
                    <h1 class="page-title">Мої закладки</h1>
                    <p class="bookmarks-subtitle" style="margin-top: 4px; color: var(--text-muted); font-size: 14px;">Ваш персональний список збереженого контенту</p>
                </div>

                ${!currentUser ? `
                    <div class="bookmarks-login-banner">
                        <div class="banner-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        </div>
                        <div class="banner-content">
                            <h3>Бажаєте зберегти ці закладки назавжди?</h3>
                            <p>Увійдіть або зареєструйтесь, щоб ваші списки були доступні на будь-якому пристрої.</p>
                        </div>
                        <a href="#/auth" class="banner-btn">Увійти</a>
                    </div>
                ` : ''}

                <div id="bookmarks-content">
                    <div class="loading-state">Завантаження закладок...</div>
                </div>
            </div>
        </div>
    `;

    const content = main.querySelector('#bookmarks-content');
    const allBookmarks = Bookmarks.getAll();

    if (allBookmarks.length === 0) {
        content.innerHTML = `
            <div class="bookmarks-empty">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                </div>
                <h3>У вас поки немає закладок</h3>
                <p>Додавайте томи, випуски або персонажів у закладки, щоб вони завжди були під рукою.</p>
                <a href="#/catalog" class="bookmarks-empty-btn">Перейти в каталог</a>
            </div>
        `;
        return;
    }

    try {
        const data = await API.post('/catalog/bookmarks', allBookmarks);
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

    sections.forEach(sec => {
        const items = data[sec.key] || [];
        if (items.length === 0) return;

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
