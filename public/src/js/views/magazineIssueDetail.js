import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { currentUser } from '../shell.js';
import { MagazineChapterAdder } from '/admin/js/MagazineChapterAdder.js';
import { MagazineChapterEditor } from '/admin/js/MagazineChapterEditor.js';

// ── Lucide SVG icons ────────────────────────────────
const ICON = {
    list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    chevronLeft: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
    chevronRight: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    book: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
    layers: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg>`
};

export async function renderMagazineIssueDetail(main, params = {}) {
    const issueId = Number(params.id);
    if (!Number.isFinite(issueId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор випуску.</div></div>';
        return;
    }

    main.innerHTML = `
        <div class="volume-detail">
            <div class="container">
                <nav class="breadcrumbs volume-breadcrumbs">
                    <div class="skeleton skeleton-text" style="width: 200px; height: 16px;"></div>
                </nav>
            </div>
            <section class="issue-hero-band">
                <div class="container volume-skeleton-hero">
                    <div class="volume-cover-column">
                        <div class="skeleton skeleton-rect" style="width: 100%; aspect-ratio: 2/3;"></div>
                    </div>
                    <div class="issue-hero-info">
                        <div class="skeleton skeleton-text" style="width: 120px; height: 22px;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; height: 36px;"></div>
                    </div>
                </div>
            </section>
        </div>
    `;

    try {
        const data = await API.get(`/magazines/issues/${issueId}`);
        const { issue, chapters = [], prev_issue, next_issue, all_issues = [] } = data;

        const coverUrl = normalizeImageUrl(issue.image);
        const title = escapeHtmlAttribute(issue.name || `Випуск #${issue.issue_number}`);
        const magazineName = escapeHtmlAttribute(issue.magazine_name || 'Журнал');
        const ukMonths = {
            '01': 'січня', '02': 'лютого', '03': 'березня', '04': 'квітня',
            '05': 'травня', '06': 'червня', '07': 'липня', '08': 'серпня',
            '09': 'вересня', '10': 'жовтня', '11': 'листопада', '12': 'грудня'
        };

        const ukMonthsNominal = {
            '01': 'Січень', '02': 'Лютий', '03': 'Березень', '04': 'Квітень',
            '05': 'Травень', '06': 'Червень', '07': 'Липень', '08': 'Серпень',
            '09': 'Вересень', '10': 'Жовтень', '11': 'Листопад', '12': 'Грудень'
        };

        const formatDateHuman = (dateStr) => {
            if (!dateStr || dateStr === 'невідомо') return 'невідомо';
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                const year = parts[0];
                const month = ukMonths[parts[1]] || parts[1];
                if (parts.length > 2) {
                    const day = parseInt(parts[2], 10);
                    return `${day} ${month} ${year}`;
                }
                return `${month} ${year}`;
            }
            return dateStr;
        };

        const formatCoverDateHuman = (dateStr) => {
            if (!dateStr || dateStr === 'невідомо') return 'невідомо';
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                const year = parts[0];
                const month = ukMonthsNominal[parts[1]] || parts[1];
                return `${month} ${year}`;
            }
            return dateStr;
        };

        const releaseDateRaw = issue.release_date || issue.cover_date || 'невідомо';
        const coverDateRaw = issue.cover_date || 'невідомо';
        
        const releaseDate = formatDateHuman(releaseDateRaw);
        const coverDate = formatCoverDateHuman(coverDateRaw);
        
        const isModerator = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

        const formatTitle = (issueItem) => {
            let num = issueItem.name || `No. ${issueItem.issue_number}`;
            // Strip year (e.g., ", 2026" or " 2026")
            num = num.replace(/,?\s*\d{4}/g, '').trim();
            
            const dateStr = issueItem.cover_date || issueItem.release_date || '';
            let monthStr = '';
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length >= 2) {
                    const m = parts[1];
                    monthStr = ukMonthsNominal[m] || '';
                }
            }
            return monthStr ? `${num}, ${monthStr}` : num;
        };

        const navCardHTML = (sibling, direction) => {
            const isNext = direction === 'next';
            const num = sibling?.issue_number ? `#${escapeHtmlAttribute(sibling.issue_number)}` : '';
            const sibTitle = escapeHtmlAttribute(sibling?.name || 'Без назви');
            const dirLabel = isNext ? 'НАСТУПНИЙ' : 'ПОПЕРЕДНІЙ';
            const link = sibling ? `#/magazines/issues/${sibling.id}` : null;

            if (!sibling) {
                return `<div class="issue-nav-card issue-nav-card--placeholder" style="visibility: hidden;"></div>`;
            }

            return `
                <a class="issue-nav-card issue-nav-card--${direction}" href="${link}">
                    <div class="issue-nav-top">
                        <span class="issue-nav-dir">${dirLabel}</span>
                        ${num ? `<span class="issue-nav-num">${num}</span>` : ''}
                    </div>
                    <div class="issue-nav-title">${sibTitle}</div>
                </a>
            `;
        };

        // Determine pages badge
        let pagesHtml = '';
        if (issue.pages) {
            pagesHtml = `
                <span class="volume-badge volume-lang-badge">
                    ${ICON.book}
                    ${issue.pages} сторінок
                </span>
            `;
        } else {
            const calculatedPages = chapters.reduce((sum, ch) => sum + (Number(ch.pages) || 0), 0);
            if (calculatedPages > 0) {
                pagesHtml = `
                    <span class="volume-badge volume-lang-badge" style="color: var(--text-muted); font-style: italic;" title="Відома кількість сторінок з розділів">
                        ${ICON.book}
                        ${calculatedPages} сторінок *
                    </span>
                `;
            }
        }

        main.innerHTML = `
            <style>
                .magazine-chapter-row {
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    background: var(--bg-card);
                    border: 1px solid var(--border-s);
                    border-radius: 12px;
                    padding: 16px;
                    gap: 20px;
                    transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
                }
                .magazine-chapter-row:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
                    background: var(--bg-card-h);
                }
                .chapter-bg-banner {
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: 100%;
                    pointer-events: none;
                    z-index: 1;
                    opacity: .1;
                    transition: opacity 0.2s ease;
                }
                .magazine-chapter-row:hover .chapter-bg-banner {
                    opacity: 0.3 !important;
                }
                .magazine-chapter-row.is-dragging {
                    opacity: 0.4;
                    background: var(--bg-card);
                    border: 1px dashed var(--accent) !important;
                    box-shadow: none;
                    transform: none;
                }
                .magazine-chapter-row.drag-over {
                    border-color: color-mix(in srgb, var(--accent) 50%, transparent) !important;
                    background: color-mix(in srgb, var(--accent) 8%, var(--bg-card)) !important;
                    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
                }
                .magazine-drag-preview {
                    position: fixed;
                    top: -9999px;
                    left: -9999px;
                    z-index: 99999;
                    pointer-events: none;
                    opacity: 0.92;
                    transform: rotate(0.5deg);
                    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22);
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    background: var(--bg-card);
                }
                .magazine-drag-preview .chapter-actions-right,
                .magazine-drag-preview .chapter-drag-handle {
                    display: none !important;
                }
                .chapter-drag-handle {
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    color: var(--text-muted);
                    z-index: 4;
                    cursor: grab;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease-in-out;
                }
                .chapter-drag-handle svg {
                    pointer-events: none;
                }
                .chapter-drag-handle:active {
                    cursor: grabbing !important;
                }
                body.admin-drag-active,
                body.admin-drag-active * {
                    cursor: grabbing !important;
                }
                
                /* Hide controls by default and show on hover */
                .chapter-actions-right {
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease-in-out;
                }
                .magazine-chapter-row:hover .chapter-drag-handle {
                    opacity: 0.8 !important;
                    pointer-events: auto !important;
                }
                .magazine-chapter-row:hover .chapter-actions-right {
                    opacity: 1;
                    pointer-events: auto;
                }
                /* Keep controls hidden during active drag operations */
                body.admin-drag-active .chapter-drag-handle,
                body.admin-drag-active .chapter-actions-right {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                .outer-nav-btn {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 3em;
                    border: none;
                    background: transparent;
                    color: var(--text);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    transition: all 0.2s ease;
                }
                .outer-nav-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--accent);
                }
                .outer-nav-btn:disabled {
                    opacity: 0.15;
                    cursor: not-allowed;
                    pointer-events: none;
                }
                .outer-nav-btn--prev {
                    left: -4em;
                    border-radius: 8px 0 0 8px;
                }
                .outer-nav-btn--next {
                    right: -4em;
                    border-radius: 0 8px 8px 0;
                }
                @media (max-width: 1200px) {
                    .outer-nav-btn--prev { left: -10px; }
                    .outer-nav-btn--next { right: -10px; }
                }
                .issue-nav-card {
                    text-decoration: none;
                    color: var(--text-main);
                    padding: 8px 12px;
                    border: 1px solid var(--border-s);
                    border-radius: 8px;
                    background: var(--bg-card);
                    width: 140px;
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                }
                .issue-nav-top { display: flex; justify-content: space-between; margin-bottom: 4px; color: var(--text-muted); }
                .issue-nav-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            </style>
            <div class="volume-detail">
                <div class="container">
                    ${createBreadcrumbs([
                        { label: 'Каталог', href: '#/catalog' },
                        { label: magazineName, href: `#/magazines/${issue.magazine_id}` },
                        { label: `Випуск #${issue.issue_number}` }
                    ], 'breadcrumbs volume-breadcrumbs')}
                </div>

                <section class="issue-hero-band issue-hero-band--banner" style="--volume-banner-url: url('${escapeHtmlAttribute(coverUrl)}')">
                    <div class="container issue-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty"></div>`}
                        </div>
                        <div class="issue-hero-info">
                            <div class="issue-header-block" style="border-bottom: 1px solid var(--border-s); padding-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                                ${navCardHTML(prev_issue, 'prev')}
                                <div class="issue-header-center" style="display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; min-width: 0;">
                                    <span style="font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: 0.05em; text-transform: uppercase;">Випуск #${issue.issue_number}</span>
                                    <h1 style="font-family: var(--font-oswald); font-size: 30px; font-weight: 800; margin: 2px 0 0 0;">${title}</h1>
                                </div>
                                ${navCardHTML(next_issue, 'next')}
                            </div>
                            <div class="issue-hero-badges" style="margin-top: 15px;">
                                <a href="#/magazines/${issue.magazine_id}" title="Журнал" class="volume-badge volume-series-badge" style="color: var(--primary); text-decoration: none; font-weight: 600;">
                                    ${ICON.book} ${magazineName}
                                </a>
                                <span class="volume-badge volume-cover-date-badge" title="Дата обкладинки">
                                    ${ICON.calendar} ${coverDate}
                                </span>
                                <span class="volume-badge volume-year-badge" title="Дата релізу">
                                    ${ICON.calendar} ${releaseDate}
                                </span>
                                ${pagesHtml}
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body">
                    <!-- All Issues Section -->
                    <section class="related-collections-section block">
                        <div class="block-header">
                            <h2>
                                ${ICON.layers} Всі випуски журналу
                                <span id="issues-pag-label"></span>
                            </h2>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div id="issues-datepicker-container"></div>
                            </div>
                        </div>
                        <div style="position: relative;">
                            <button class="outer-nav-btn outer-nav-btn--prev" id="btn-issues-prev" title="Попередня">${ICON.chevronLeft}</button>
                            <div class="related-list" id="magazine-issues-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1em;">
                            </div>
                            <button class="outer-nav-btn outer-nav-btn--next" id="btn-issues-next" title="Наступна">${ICON.chevronRight}</button>
                        </div>
                    </section>

                    <section class="volume-issues-section block">
                        <div class="block-header">
                            <h2>
                                ${ICON.list}
                                Серії в номері
                            </h2>
                            ${isModerator ? `
                                <button class="readlist-btn" id="btn-add-magazine-chapter" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: var(--bg-card); border: 1px solid var(--border);">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Додати розділ
                                </button>
                            ` : ''}
                        </div>

                        ${chapters.length === 0 ? '<p>У цей випуск ще не було додано розділів.</p>' : `
                            <div class="magazine-chapters-list" id="magazine-chapters-grid" style="display: flex; flex-direction: column; gap: 6px;">
                                ${chapters.map((ch, index) => {
                                    const mangaBanner = normalizeImageUrl(ch.manga_banner || ch.manga_volume_cover);
                                    const chapterCover = normalizeImageUrl(ch.chapter_cover || ch.manga_volume_cover);
                                    const mangaTitle = escapeHtmlAttribute(ch.manga_name_uk || ch.manga_name);
                                    const origTitle = ch.manga_name_uk && ch.manga_name_uk !== ch.manga_name ? ch.manga_name : '';
                                    const badges = [];
                                    const labels = ch.label ? ch.label.split(',') : [];
                                    if (labels.includes('lead')) badges.push('<span class="manga-badge badge-lead" style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center;">Lead</span>');
                                    if (labels.includes('color')) badges.push('<span class="manga-badge badge-color" style="background: #fce7f3; color: #db2777; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center;">Color</span>');
                                    if (labels.includes('debut')) badges.push('<span class="manga-badge badge-debut" style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center;">Debut</span>');
                                    if (labels.includes('final')) badges.push('<span class="manga-badge badge-final" style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center;">Final</span>');
                                    if (labels.includes('digital') || labels.includes('digital exclusive')) badges.push('<span class="manga-badge badge-digital" style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center; white-space: nowrap;">Digital</span>');

                                    return `
                                        <div class="magazine-chapter-row" ${isModerator ? `data-id="${ch.chapter_id}"` : ''} style="padding-left: ${isModerator ? '36px' : '16px'}; padding-right: ${isModerator ? '48px' : '16px'};">
                                            ${mangaBanner ? `<div class="chapter-bg-banner" style="background: linear-gradient(to right, var(--bg-card) 10%, transparent 50%, var(--bg-card) 100%), url('${escapeHtmlAttribute(mangaBanner)}') center/cover;"></div>` : ''}
                                            <a href="#/volumes/${ch.manga_volume_id}" style="position: absolute; inset: 0; z-index: 2;" title="Перейти до тому"></a>
                                            ${isModerator ? `
                                                <div class="chapter-drag-handle" draggable="true" title="Перетягнути для сортування">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                                </div>
                                            ` : ''}
                                            <div class="chapter-left-side" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 80px; gap: 6px; flex-shrink: 0; z-index: 3;">
                                                <div class="chapter-order" style="font-size: 1.5rem; font-weight: 800; color: var(--text-muted); line-height: 1; text-align: center; font-family: var(--font-monos);">${ch.order_num || ''}</div>
                                                <div class="chapter-badges" style="display: flex; flex-direction: column; gap: 4px; width: 100%;">${badges.join('')}</div>
                                            </div>
                                            <div style="display: block; width: 60px; height: 80px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--bg-body); border: 1px solid var(--border-s); z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                                ${chapterCover ? `<img src="${escapeHtmlAttribute(chapterCover)}" alt="${mangaTitle}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                                            </div>
                                            <div class="chapter-info" style="flex-grow: 1; min-width: 0; z-index: 3;">
                                                <div style="font-size: 15px; font-weight: 600; color: var(--text-main); text-decoration: none; display: block; margin-bottom: 2px;">${mangaTitle}</div>
                                                ${origTitle ? `<span style="font-size: 12px; color: var(--text-muted); display: block;">${escapeHtmlAttribute(origTitle)}</span>` : ''}
                                            </div>
                                            <div class="chapter-number-info" style="text-align: right; flex-shrink: 0; z-index: 3; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                                                <div style="display: flex; align-items: baseline; gap: 6px;">
                                                    <a href="#/manga-chapters/${ch.chapter_id}" style="font-size: 14px; font-weight: 700; color: var(--accent); text-decoration: none; z-index: 4; position: relative;">
                                                        Розд. ${escapeHtmlAttribute(ch.chapter_number || '')}
                                                    </a>
                                                    ${ch.pages ? `<span style="font-size: 12px; color: var(--text-muted);">${ch.pages} стор.</span>` : ''}
                                                </div>
                                                ${ch.chapter_name ? `<a href="#/manga-chapters/${ch.chapter_id}" style="font-size: 12px; color: var(--text-muted); display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; font-weight: 500; z-index: 4; position: relative;">${escapeHtmlAttribute(ch.chapter_name)}</a>` : ''}
                                            </div>
                                            ${isModerator ? `
                                                <div class="chapter-actions-right" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 4;">
                                                    <button class="edit-chapter-btn btn-admin" data-chapter-index="${index}" title="Редагувати" style="background: var(--bg-card); border: 1px solid var(--border-s); color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                                    <button class="delete-chapter-btn btn-admin" data-chapter-id="${ch.chapter_id}" title="Видалити" style="background: var(--bg-card); border: 1px solid var(--border-s); color: var(--red); cursor: pointer; padding: 6px; border-radius: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </section>
                </div>
            </div>
        `;
 
        let currentIssuesPage = 1;
        const issuesPerPage = 8;
        let selectedYear = '';
        const issueCoverDate = issue.cover_date || issue.release_date || '';
        if (issueCoverDate && issueCoverDate.includes('-')) {
            selectedYear = issueCoverDate.split('-')[0];
        }

        let filteredIssues = all_issues;
        if (selectedYear) {
            filteredIssues = all_issues.filter(iss => (iss.cover_date || iss.release_date || '').startsWith(selectedYear));
        }

        const initialIndex = filteredIssues.findIndex(iss => iss.id === issueId);
        if (initialIndex !== -1) currentIssuesPage = Math.floor(initialIndex / issuesPerPage) + 1;

        const renderIssuesSection = () => {
            const listContainer = document.getElementById('magazine-issues-list-container');
            if (!listContainer) return;
            const totalPages = Math.ceil(filteredIssues.length / issuesPerPage);
            if (currentIssuesPage > totalPages) currentIssuesPage = Math.max(1, totalPages);
            const start = (currentIssuesPage - 1) * issuesPerPage;
            const end = start + issuesPerPage;
            const pageItems = filteredIssues.slice(start, end);
            listContainer.innerHTML = pageItems.map(iss => {
                const issCover = normalizeImageUrl(iss.image);
                const isCurrent = iss.id === issueId;
                
                let pagesCountStr = '';
                if (iss.pages) {
                    pagesCountStr = `<span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(${iss.pages} с.)</span>`;
                }
                return `
                    <a href="#/magazines/issues/${iss.id}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; transition: transform 0.2s; position: relative;">
                        <div style="aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; border: ${isCurrent ? '2px solid var(--accent)' : '1px solid var(--border-s)'}; background: var(--bg-card); box-shadow: ${isCurrent ? '0 0 0 3px var(--accent-glow)' : '0 4px 6px -1px rgba(0,0,0,0.1)'};">
                            ${issCover ? `<img src="${escapeHtmlAttribute(issCover)}" style="width: 100%; height: 100%; object-fit: cover;" alt="Випуск #${iss.issue_number}">` : ''}
                        </div>
                        <div style="padding: 0 4px;">
                            <div style="font-size: 11px; font-weight: 600; color: var(--text-main); margin-top: 6px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${formatTitle(iss)}">
                                ${escapeHtmlAttribute(formatTitle(iss))} ${pagesCountStr}
                            </div>
                        </div>
                    </a>
                `;
            }).join('');
            const pagLabel = document.getElementById('issues-pag-label');
            const btnPrev = document.getElementById('btn-issues-prev');
            const btnNext = document.getElementById('btn-issues-next');
            if (filteredIssues.length > issuesPerPage) {
                if (pagLabel) pagLabel.textContent = `(${currentIssuesPage} / ${totalPages})`;
                if (btnPrev) { btnPrev.disabled = currentIssuesPage === 1; btnPrev.style.display = 'flex'; }
                if (btnNext) { btnNext.disabled = currentIssuesPage === totalPages; btnNext.style.display = 'flex'; }
            } else {
                if (pagLabel) pagLabel.textContent = '';
                if (btnPrev) btnPrev.style.display = 'none';
                if (btnNext) btnNext.style.display = 'none';
            }
        };

        const datepickerContainer = document.getElementById('issues-datepicker-container');
        if (all_issues.length > 10 && datepickerContainer) {
            // Find bounds of years in all issues
            const years = all_issues.map(iss => {
                const d = iss.cover_date || iss.release_date || '';
                return d.split('-')[0];
            }).filter(y => y && !isNaN(y)).map(Number);

            const minYear = years.length ? Math.min(...years) : 1970;
            const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();

            let yearOptions = '';
            for (let yr = maxYear; yr >= minYear; yr--) {
                yearOptions += `<option value="${yr}" ${String(yr) === selectedYear ? 'selected' : ''}>${yr}</option>`;
            }

            datepickerContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">${ICON.calendar} Рік:</span>
                    <select id="issues-yearpicker" style="background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 6px; color: var(--text); padding: 4px 8px; font-size: 13px; outline: none; height: 32px;">
                        <option value="">Всі роки</option>
                        ${yearOptions}
                    </select>
                </div>
            `;
            document.getElementById('issues-yearpicker').addEventListener('change', (e) => {
                const val = e.target.value;
                selectedYear = val;
                filteredIssues = val ? all_issues.filter(iss => (iss.cover_date || iss.release_date || '').startsWith(val)) : [...all_issues];
                currentIssuesPage = 1;
                renderIssuesSection();
            });
        }
        renderIssuesSection();
        document.getElementById('btn-issues-prev').onclick = () => { if (currentIssuesPage > 1) { currentIssuesPage--; renderIssuesSection(); } };
        document.getElementById('btn-issues-next').onclick = () => { const totalPages = Math.ceil(filteredIssues.length / issuesPerPage); if (currentIssuesPage < totalPages) { currentIssuesPage++; renderIssuesSection(); } };
 
        if (isModerator) {
            main.querySelector('#btn-add-magazine-chapter')?.addEventListener('click', () => {
                new MagazineChapterAdder(issue, chapters, () => renderMagazineIssueDetail(main, params)).render();
            });
            main.querySelectorAll('.edit-chapter-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    new MagazineChapterEditor(issueId, chapters[Number(btn.getAttribute('data-chapter-index'))], () => renderMagazineIssueDetail(main, params)).render();
                };
            });
            main.querySelectorAll('.delete-chapter-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    const chId = Number(btn.getAttribute('data-chapter-id'));
                    if (confirm('Ви впевнені?')) {
                        try { await API.delete(`/magazines/issues/${issueId}/chapters/${chId}`); renderMagazineIssueDetail(main, params); } catch (err) { alert('Помилка: ' + err.message); }
                    }
                };
            });
 
            const initReordering = () => {
                const grid = main.querySelector('#magazine-chapters-grid');
                if (!grid) return;
                let draggingCard = null;
                let isSaving = false;
                let dragPreview = null;
                const getCards = () => Array.from(grid.querySelectorAll('.magazine-chapter-row'));
                grid.addEventListener('dragstart', (e) => {
                    const handle = e.target.closest('.chapter-drag-handle');
                    if (!handle) { e.preventDefault(); return; }
                    draggingCard = handle.closest('.magazine-chapter-row');
                    draggingCard.classList.add('is-dragging');
                    document.body.classList.add('admin-drag-active');
                    
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggingCard.getAttribute('data-id') || '');
                    
                    const rect = draggingCard.getBoundingClientRect();
                    dragPreview = draggingCard.cloneNode(true);
                    dragPreview.classList.add('magazine-drag-preview');
                    dragPreview.style.width = `${Math.ceil(rect.width)}px`;
                    dragPreview.style.height = `${Math.ceil(rect.height)}px`;
                    document.body.appendChild(dragPreview);
                    if (e.dataTransfer?.setDragImage) {
                        e.dataTransfer.setDragImage(dragPreview, e.clientX - rect.left, e.clientY - rect.top);
                    }
                });
                grid.addEventListener('dragend', () => { 
                    draggingCard?.classList.remove('is-dragging'); 
                    document.body.classList.remove('admin-drag-active'); 
                    dragPreview?.remove(); 
                    draggingCard = null;
                    dragPreview = null;
                });
                grid.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const target = e.target.closest('.magazine-chapter-row');
                    if (!target || target === draggingCard) return;
                    getCards().forEach(c => c.classList.remove('drag-over'));
                    target.classList.add('drag-over');
                    const rect = target.getBoundingClientRect();
                    grid.insertBefore(draggingCard, (e.clientY - rect.top) > (rect.height / 2) ? target.nextSibling : target);
                    getCards().forEach((card, idx) => { const el = card.querySelector('.chapter-order'); if (el) el.textContent = String(idx + 1); });
                });
                grid.addEventListener('drop', async () => {
                    getCards().forEach(c => c.classList.remove('drag-over'));
                    if (isSaving) return;
                    isSaving = true;
                    try { await API.put(`/magazines/issues/${issueId}/reorder-chapters`, { items: getCards().map(c => ({ id: Number(c.getAttribute('data-id')) })) }); } catch (err) { alert('Помилка: ' + err.message); renderMagazineIssueDetail(main, params); } finally { isSaving = false; }
                });
            };
            initReordering();
        }
    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження випуску: ${err.message}</div></div>`;
    }
}
