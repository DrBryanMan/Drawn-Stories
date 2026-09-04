import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { formatDate } from '../helpers/lang.js';
import { icon } from '../helpers/icons.js';
import { t } from '../helpers/i18n.js';
import { currentUser } from '../shell.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { MangaChapterEditor } from '../components/modals/EditMangaChapterModal.js';

function translateCharacterRole(role) {
    const roles = {
        'main': t('role_main_char'),
        'supporting': t('role_supporting_char'),
        'minor': t('role_minor_char'),
        'cameo': t('role_cameo')
    };
    return roles[role] || role || t('role_main_char');
}

function renderSkeleton(container) {
    container.innerHTML = `
        <div class="issue-detail issue-detail-skeleton">
            <div class="container" style="padding-top: 20px;">
                <div class="skeleton" style="width: 240px; height: 16px; margin-bottom: 24px;"></div>
            </div>
            <div class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="skeleton" style="aspect-ratio: 2/3; border-radius: 8px;"></div>
                    <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 8px;">
                        <div class="skeleton" style="width: 80px; height: 20px; border-radius: 999px;"></div>
                        <div class="skeleton" style="width: 70%; height: 32px;"></div>
                        <div class="skeleton" style="width: 50%; height: 16px;"></div>
                        <div class="skeleton" style="width: 100%; height: 100px; margin-top: 8px; border-radius: 8px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function navCardHTML(chapter, direction) {
    const isNext = direction === 'next';
    const num = chapter?.chapter_number ? `#${escapeHtmlAttribute(chapter.chapter_number)}` : '';
    const title = escapeHtmlAttribute(chapter?.name_uk || chapter?.name_en || chapter?.name || (num ? `${t('chapter_num_prefix')} ${num}` : t('no_title')));
    const dirLabel = isNext ? t('nav_next') : t('nav_prev');
    const link = chapter ? `#/manga-chapters/${chapter.id}` : null;

    if (!chapter) {
        return `
            <div class="issue-nav-card issue-nav-card--placeholder" style="visibility: hidden;"></div>
        `;
    }

    return `
        <a class="issue-nav-card issue-nav-card--${direction}" href="${link}">
            <div class="issue-nav-top">
                <span class="issue-nav-dir">${dirLabel}</span>
                ${num ? `<span class="issue-nav-num">${num}</span>` : ''}
            </div>
            <div class="issue-nav-title">${title}</div>
        </a>
    `;
}

export async function renderMangaChapterDetail(main, params = {}) {
    const isModerator = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
    const chapterId = parseInt(params.id, 10);
    if (!Number.isFinite(chapterId)) {
        main.innerHTML = `
            <div class="issue-detail">
                <div class="container issue-detail-error">
                    <h2>${t('invalid_id')}</h2>
                    <p>${t('not_found_id')}</p>
                </div>
            </div>
        `;
        return;
    }

    renderSkeleton(main);

    let data, edits;
    try {
        [data, edits] = await Promise.all([
            API.get(`/manga-chapters/${chapterId}`),
            fetchEntityEdits('manga_chapter', chapterId)
        ]);
    } catch (err) {
        main.innerHTML = `
            <div class="issue-detail">
                <div class="container issue-detail-error">
                    <h2>${t('loading_error')}</h2>
                    <p>${escapeHtmlAttribute(err.message || t('something_went_wrong'))}</p>
                </div>
            </div>
        `;
        return;
    }

    const { chapter, prev_chapter, next_chapter, appearances = {} } = data;
    const characters = appearances.characters || [];

    const chapterTitle = chapter.name_uk || chapter.name_en || chapter.name || '';
    const chapterNum = chapter.chapter_number ? `#${chapter.chapter_number}` : '';
    const displayTitle = chapterTitle || (chapterNum ? `${t('chapter_num_prefix')} ${chapterNum}` : t('no_title'));
    const volName = chapter.volume_name_uk || chapter.volume_name || '';

    const pageTitle = chapterTitle
        ? `${chapterTitle} ${chapterNum} — ${volName}`
        : `${chapterNum ? chapterNum + ' — ' : ''}${volName}`;
    document.title = `${pageTitle} | Drawn Stories`;

    const coverUrl = normalizeImageUrl(chapter.image);
    const releaseDate = formatDate(chapter.release_date);

    // ── Cover ─────────────────────────────────────
    const coverHTML = coverUrl
        ? `<img class="issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${escapeHtmlAttribute(displayTitle)}">`
        : `<div class="issue-cover--empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`;

    // ── Badges ────────────────────────────────────
    const volumeBadge = chapter.volume_id
        ? `<a href="#/volumes/${chapter.volume_id}" class="volume-badge volume-series-badge" title="${t('series')}: ${escapeHtmlAttribute(volName || t('series'))}">
               ${icon('book', 13, { strokeWidth: 2.2 })}
               <span>${escapeHtmlAttribute(volName || t('series'))}</span>
           </a>`
        : '';

    const releaseDateBadge = releaseDate
        ? `<span class="volume-badge volume-release-date-badge" title="${t('release_date')}">
               ${icon('calendar', 13, { strokeWidth: 2.2 })}
               ${t('release')}: ${escapeHtmlAttribute(releaseDate)}
           </span>`
        : '';

    const pagesBadge = chapter.pages
        ? `<span class="volume-badge volume-pages-badge" title="${t('pages_count')}">
               ${icon('book', 13, { strokeWidth: 2.2 })}
               ${t('pages')}: ${escapeHtmlAttribute(chapter.pages)}
           </span>`
        : '';

    main.innerHTML = `
        <div class="issue-detail">
            <section class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="issue-cover-column">
                        ${coverHTML}
                        ${chapterNum ? `<div class="issue-cover-number">${escapeHtmlAttribute(chapterNum)}</div>` : ''}
                    </div>

                    <div class="issue-hero-info">
                        <div class="issue-header-block">
                            ${navCardHTML(prev_chapter, 'prev')}
                            <div class="issue-header-center">
                                <h1>${escapeHtmlAttribute(displayTitle)}</h1>
                                ${chapterTitle && chapterNum ? `
                                    <div class="issue-main-story-label">
                                        <span>${t('chapter_num_prefix')} ${escapeHtmlAttribute(chapterNum)}</span>
                                    </div>
                                ` : ''}
                            </div>
                            ${navCardHTML(next_chapter, 'next')}
                        </div>

                        <div class="issue-hero-badges">
                            ${volumeBadge}
                            ${releaseDateBadge}
                            ${pagesBadge}
                        </div>
                    </div>
                    ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'manga-chapter-edit-btn', editTitle: isModerator ? t('edit') : t('suggest_edit') })}
                </div>
            </section>

            <div class="container issue-body">
                <!-- Synopsis / Description -->
                <div class="issue-main-description-section" style="margin-bottom: 24px;">
                    <div class="issue-description">
                        <h3 class="issue-description-title">${t('synopsis')}</h3>
                        <div class="issue-description-text">
                            ${chapter.synopsis 
                                ? chapter.synopsis.replace(/\n/g, '<br>') 
                                : `<div class="issue-story-empty">— ${t('no_description')} —</div>`}
                        </div>
                    </div>
                </div>

                <!-- Appearances Section -->
                <div class="issue-appearances-section" style="margin-top: 32px;">
                    <div class="issue-section-heading" style="margin-bottom: 16px;">
                        <h2>${t('appearances')}</h2>
                        ${characters.length > 0 ? `<span class="issue-section-count">${characters.length}</span>` : ''}
                    </div>

                    ${characters.length === 0 ? `
                        <div class="issue-story-empty">— ${t('no_appearances_found')} —</div>
                    ` : `
                        <div class="characters-appearance-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
                            ${characters.map(char => {
                                const charCover = normalizeImageUrl(char.image);
                                return `
                                    <a class="character-card-appearance" href="#/characters/${char.id}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; background: var(--bg-card); border-radius: var(--r); border: 1px solid var(--border-s); overflow: hidden; transition: transform var(--t), box-shadow var(--t);">
                                        <div style="aspect-ratio: 1; overflow: hidden; background: var(--bg-2); display: flex; align-items: center; justify-content: center;">
                                            ${charCover 
                                                ? `<img src="${escapeHtmlAttribute(charCover)}" alt="${escapeHtmlAttribute(char.name_uk || char.name)}" style="width: 100%; height: 100%; object-fit: cover;">`
                                                : `<div style="color: var(--text-muted);">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`}
                                        </div>
                                        <div style="padding: 12px; display: flex; flex-direction: column; gap: 4px;">
                                            <span style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text);">
                                                ${escapeHtmlAttribute(char.name_uk || char.name)}
                                            </span>
                                            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
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

            ${isModerator ? `
                <div class="volume-hero-admin-actions">
                    <button class="btn-admin btn-admin--danger" id="chapter-delete-btn" title="Видалити розділ">
                        ${icon('trash', 14, { strokeWidth: 2.2 })}
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    initEditorsHistoryBlock(main, edits);

    const editBtn = main.querySelector('#manga-chapter-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const editor = new MangaChapterEditor(chapter, characters, () => {
                renderMangaChapterDetail(main, params);
            });
            editor.render();
        });
    }

    if (isModerator) {
        const deleteBtn = main.querySelector('#chapter-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm(t('confirm_delete_issue') || `Ви впевнені, що хочете видалити цей розділ?`)) return;
                try {
                    await API.delete(`/manga-chapters/${chapterId}`);
                    if (chapter.volume_id) {
                        window.location.hash = `#/volumes/${chapter.volume_id}`;
                    } else {
                        window.location.hash = '#/manga-chapters';
                    }
                } catch (err) {
                    alert(`${t('error_deleting')}: ${err.message}`);
                }
            });
        }
    }
}
