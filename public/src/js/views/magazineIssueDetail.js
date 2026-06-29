import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

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
            <section class="volume-hero-band">
                <div class="container volume-skeleton-hero">
                    <div class="volume-cover-column">
                        <div class="skeleton skeleton-rect" style="width: 100%; aspect-ratio: 2/3;"></div>
                    </div>
                    <div class="volume-hero-info">
                        <div class="skeleton skeleton-text" style="width: 120px; height: 22px;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; height: 36px;"></div>
                    </div>
                </div>
            </section>
        </div>
    `;

    try {
        const data = await API.get(`/magazines/issues/${issueId}`);
        const { issue, chapters = [] } = data;

        const coverUrl = comicVineImageUrl(issue.image);
        const title = escapeHtmlAttribute(issue.name || `Випуск #${issue.issue_number}`);
        const magazineName = escapeHtmlAttribute(issue.magazine_name || 'Журнал');
        const releaseDate = issue.release_date || issue.cover_date || 'невідомо';

        main.innerHTML = `
            <div class="volume-detail">
                <div class="container">
                    ${createBreadcrumbs([
                        { label: 'Каталог', href: '#/catalog' },
                        { label: magazineName, href: `#/magazines/${issue.magazine_id}` },
                        { label: `Випуск #${issue.issue_number}` }
                    ], 'breadcrumbs volume-breadcrumbs')}
                </div>

                <section class="volume-hero-band volume-hero-band--banner" style="--volume-banner-url: url('${escapeHtmlAttribute(coverUrl)}')">
                    <div class="container volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty"></div>`}
                        </div>
                        <div class="volume-hero-info">
                            <div class="volume-header">
                                <div class="volume-title">
                                    <span class="volume-main-title">
                                        <h1>${title}</h1>
                                    </span>
                                    <span class="volume-original-title">
                                        Журнал: <a href="#/magazines/${issue.magazine_id}" style="color: var(--primary); text-decoration: none;">${magazineName}</a>
                                    </span>
                                </div>
                            </div>
                            <div class="volume-hero-badges">
                                <span class="volume-badge volume-year-badge">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                                    Дата виходу: ${releaseDate}
                                </span>
                                ${issue.pages ? `
                                    <span class="volume-badge volume-lang-badge">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                                        ${issue.pages} сторінок
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body">
                    <section class="volume-issues-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                            <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                Серії в номері
                            </h2>
                        </div>

                        ${chapters.length === 0 ? '<p>Немає зареєстрованих розділів у цьому випуску.</p>' : `
                            <div class="magazine-chapters-list" style="display: flex; flex-direction: column; gap: 16px;">
                                ${chapters.map(ch => {
                                    const mangaCover = comicVineImageUrl(ch.manga_cover);
                                    const mangaTitle = escapeHtmlAttribute(ch.manga_name_uk || ch.manga_name);
                                    const origTitle = ch.manga_name_uk && ch.manga_name_uk !== ch.manga_name ? ch.manga_name : '';
                                    
                                    // Generate badges
                                    const badges = [];
                                    if (ch.label === 'lead') badges.push('<span class="manga-badge badge-lead" style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Lead</span>');
                                    if (ch.label === 'color') badges.push('<span class="manga-badge badge-color" style="background: #fce7f3; color: #db2777; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Color</span>');
                                    if (ch.label === 'debut') badges.push('<span class="manga-badge badge-debut" style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Debut</span>');
                                    if (ch.label === 'final') badges.push('<span class="manga-badge badge-final" style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Final</span>');

                                    return `
                                        <div class="magazine-chapter-row" style="display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 12px; padding: 16px; gap: 20px; transition: transform 0.2s, box-shadow 0.2s;">
                                            <div class="chapter-order" style="font-size: 24px; font-weight: bold; color: var(--text-muted); width: 40px; text-align: center;">
                                                ${ch.order_num || ''}
                                            </div>
                                            
                                            <div class="chapter-badges" style="display: flex; flex-direction: column; gap: 4px; width: 80px;">
                                                ${badges.join('')}
                                            </div>

                                            <a href="#/volumes/${ch.manga_volume_id}" style="display: block; width: 60px; height: 80px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--bg-body); border: 1px solid var(--border-s);">
                                                ${mangaCover ? `<img src="${escapeHtmlAttribute(mangaCover)}" alt="${mangaTitle}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                                            </a>

                                            <div class="chapter-info" style="flex-grow: 1; min-width: 0;">
                                                <a href="#/volumes/${ch.manga_volume_id}" style="font-size: 18px; font-weight: 600; color: var(--text-main); text-decoration: none; display: block; margin-bottom: 4px;">
                                                    ${mangaTitle}
                                                </a>
                                                ${origTitle ? `<span style="font-size: 13px; color: var(--text-muted); display: block;">${escapeHtmlAttribute(origTitle)}</span>` : ''}
                                            </div>

                                            <div class="chapter-number-info" style="text-align: right; flex-shrink: 0;">
                                                <a href="#/volumes/${ch.manga_volume_id}" style="font-size: 15px; font-weight: 600; color: var(--primary); text-decoration: none;">
                                                    Розд. ${escapeHtmlAttribute(ch.chapter_number || '')}
                                                </a>
                                                ${ch.chapter_name ? `<span style="font-size: 13px; color: var(--text-muted); display: block; margin-top: 4px;">${escapeHtmlAttribute(ch.chapter_name)}</span>` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </section>
                </div>
            </div>
        `;
    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження випуску: ${err.message}</div></div>`;
    }
}
