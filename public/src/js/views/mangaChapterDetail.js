import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { formatDate } from '../helpers/lang.js';

const ICON = {
    calendar:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hash:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    book:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    image:        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    smallImage:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
};

function translateCharacterRole(role) {
    const roles = {
        'main': 'Основний персонаж',
        'supporting': 'Другорядний персонаж',
        'minor': 'Інші',
        'cameo': 'Камео'
    };
    return roles[role] || role || 'Основний персонаж';
}

function renderSkeleton(container) {
    container.innerHTML = `
        <div class="issue-detail skeleton">
            <div class="container" style="height: 400px; background: var(--bg-card); border-radius: 8px;"></div>
        </div>
    `;
}

export async function renderMangaChapterDetail(main, params = {}) {
    const chapterId = parseInt(params.id, 10);
    if (!Number.isFinite(chapterId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор розділу.</div></div>';
        return;
    }

    renderSkeleton(main);

    try {
        const data = await API.get(`/manga-chapters/${chapterId}`);
        const { chapter, appearances = {} } = data;
        const characters = appearances.characters || [];

        const coverUrl = normalizeImageUrl(chapter.image);
        const title = escapeHtmlAttribute(chapter.name_uk || chapter.name_en || chapter.name || `Розділ #${chapter.chapter_number}`);
        const volName = escapeHtmlAttribute(chapter.volume_name_uk || chapter.volume_name || 'Без назви');
        
        main.innerHTML = `
            <div class="issue-detail volume-detail">
                <div class="container">
                    ${createBreadcrumbs([
                        { label: 'Каталог', href: '#/catalog' },
                        { label: volName, href: `#/volumes/${chapter.volume_id}` },
                        { label: `Розділ #${chapter.chapter_number}` }
                    ], 'breadcrumbs issue-breadcrumbs')}
                </div>

                <section class="issue-hero-band volume-hero-band">
                    <div class="container issue-hero volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty">${ICON.image}</div>`}
                        </div>

                        <div class="volume-hero-info">
                            <h1 class="volume-title">${title}</h1>
                            
                            <div class="volume-meta-pills" style="margin-top: 12px;">
                                <span class="volume-meta-pill" title="Том">
                                    ${ICON.book}
                                    <a href="#/volumes/${chapter.volume_id}" style="color: inherit; text-decoration: none;">${volName}</a>
                                </span>
                                <span class="volume-meta-pill" title="Номер розділу">
                                    ${ICON.hash}
                                    Розділ #${chapter.chapter_number}
                                </span>
                                ${chapter.release_date ? `
                                    <span class="volume-meta-pill" title="Дата релізу">
                                        ${ICON.calendar}
                                        ${formatDate(chapter.release_date)}
                                    </span>
                                ` : ''}
                                ${chapter.pages ? `
                                    <span class="volume-meta-pill" title="Кількість сторінок">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                                        Стор: ${chapter.pages}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container issue-layout volume-layout" style="margin-top: 24px;">
                    <div class="issue-main-content volume-main-content">
                        <!-- Synopsis -->
                        <div class="volume-description-card" style="margin-bottom: 24px; padding: 20px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-s);">
                            <h3 style="margin-bottom: 12px; font-weight: 600; font-size: 16px;">Синопсис розділу</h3>
                            <div class="synopsis-content-text" style="line-height: 1.6; opacity: 0.95; font-size: 14px;">
                                ${chapter.synopsis 
                                    ? chapter.synopsis.replace(/\n/g, '<br>') 
                                    : '<i style="opacity: 0.6;">Опис відсутній.</i>'}
                            </div>
                        </div>

                        <!-- Appearances Section -->
                        <div class="issue-appearances-section" style="margin-top: 32px;">
                            <h3 style="margin-bottom: 20px; font-weight: 600; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                                Появи персонажів
                                <span class="badge" style="font-size: 12px; padding: 2px 8px; background: var(--bg-badge); border-radius: 12px;">${characters.length}</span>
                            </h3>

                            ${characters.length === 0 ? `
                                <div class="empty-state" style="padding: 30px; text-align: center; background: var(--bg-card); border-radius: 8px; border: 1px dashed var(--border-s);">
                                    <p style="opacity: 0.6;">Персонажі не вказані.</p>
                                </div>
                            ` : `
                                <div class="characters-appearance-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
                                    ${characters.map(char => {
                                        const charCover = normalizeImageUrl(char.image);
                                        return `
                                            <a class="character-card-appearance" href="#/characters/${char.id}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-s); overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;">
                                                <div style="aspect-ratio: 1; overflow: hidden; background: var(--bg-body); display: flex; align-items: center; justify-content: center;">
                                                    ${charCover 
                                                        ? `<img src="${escapeHtmlAttribute(charCover)}" alt="${escapeHtmlAttribute(char.name_uk || char.name)}" style="width: 100%; height: 100%; object-fit: cover;">`
                                                        : `<div style="opacity: 0.3;">${ICON.smallImage}</div>`}
                                                </div>
                                                <div style="padding: 12px; display: flex; flex-direction: column; gap: 4px;">
                                                    <span style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                        ${escapeHtmlAttribute(char.name_uk || char.name)}
                                                    </span>
                                                    <span style="font-size: 11px; opacity: 0.6;">
                                                        ${escapeHtmlAttribute(translateCharacterRole(char.role))}
                                                    </span>
                                                </div>
                                            </a>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження розділу: ${escapeHtmlAttribute(err.message)}</div></div>`;
    }
}
