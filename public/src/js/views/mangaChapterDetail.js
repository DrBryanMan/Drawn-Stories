import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { formatDate } from '../helpers/lang.js';
import { icon } from '../helpers/icons.js';

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
                <section class="issue-hero-band volume-hero-band">
                    <div class="container issue-hero volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`}
                        </div>

                        <div class="volume-hero-info">
                            <h1 class="volume-title">${title}</h1>
                            
                            <div class="volume-meta-pills" style="margin-top: 12px;">
                                <span class="volume-meta-pill" title="Том">
                                    ${icon('book', 13, { strokeWidth: 2.2 })}
                                    <a href="#/volumes/${chapter.volume_id}" style="color: inherit; text-decoration: none;">${volName}</a>
                                </span>
                                <span class="volume-meta-pill" title="Номер розділу">
                                    ${icon('hash', 13, { strokeWidth: 2.2 })}
                                    Розділ #${chapter.chapter_number}
                                </span>
                                ${chapter.release_date ? `
                                    <span class="volume-meta-pill" title="Дата релізу">
                                        ${icon('calendar', 13, { strokeWidth: 2.2 })}
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
                                                        : `<div style="opacity: 0.3;">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`}
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
