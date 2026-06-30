import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

export async function renderMagazineDetail(main, params = {}) {
    const magazineId = Number(params.id);
    if (!Number.isFinite(magazineId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор журналу.</div></div>';
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
        const data = await API.get(`/magazines/${magazineId}`);
        const { magazine, issues = [], series = [] } = data;

        const coverUrl = comicVineImageUrl(magazine.image);
        const title = escapeHtmlAttribute(magazine.name);
        const nativeName = escapeHtmlAttribute(magazine.name_native || '');
        const publisherName = escapeHtmlAttribute(magazine.publisher_name || 'Невідомо');

        main.innerHTML = `
            <div class="volume-detail">
                <div class="container">
                    ${createBreadcrumbs([
                        { label: 'Каталог', href: '#/catalog' },
                        { label: title }
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
                                    ${nativeName ? `<span class="volume-original-title">${nativeName}</span>` : ''}
                                </div>
                            </div>
                            <div class="volume-hero-badges">
                                <span class="volume-badge volume-publisher-badge">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/></svg>
                                    ${publisherName}
                                </span>
                                <span class="volume-badge volume-year-badge">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                                    з ${magazine.start_year || 'невідомо'} року
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body">
                    <section class="volume-issues-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h2 style="margin: 0;">Останні випуски (${data.issues_count || issues.length})</h2>
                            ${(data.issues_count || issues.length) > 6 ? `
                                <a href="#/magazines/${magazineId}/all?tab=issues" style="color: var(--primary); text-decoration: none; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 4px;">
                                    Всі випуски
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
                                </a>
                            ` : ''}
                        </div>
                        ${issues.length === 0 ? '<p>Немає завантажених випусків.</p>' : `
                            <div class="issues-view-grid">
                                ${issues.map(iss => {
                                    const issCover = comicVineImageUrl(iss.image);
                                    return `
                                        <a class="issue-grid-card" href="#/magazines/issues/${iss.id}">
                                            <div class="issue-grid-poster">
                                                ${issCover ? `<img src="${escapeHtmlAttribute(issCover)}" alt="Випуск #${iss.issue_number}" loading="lazy">` : ''}
                                                <div class="issue-grid-badge"># ${escapeHtmlAttribute(iss.issue_number || '')}</div>
                                            </div>
                                            <div class="issue-grid-body">
                                                <h3 class="issue-grid-title">${escapeHtmlAttribute(iss.name || `Випуск #${iss.issue_number}`)}</h3>
                                                <span class="issue-grid-date">${iss.release_date || iss.cover_date || ''}</span>
                                            </div>
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </section>

                    ${series.length > 0 ? `
                        <section class="volume-translations-section" style="margin-top: 40px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h2 style="margin: 0;">Поточні серії в журналі (${data.series_count || series.length})</h2>
                                ${(data.series_count || series.length) > 6 ? `
                                    <a href="#/magazines/${magazineId}/all?tab=series" style="color: var(--primary); text-decoration: none; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 4px;">
                                        Всі серії
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
                                    </a>
                                ` : ''}
                            </div>
                            <div class="issues-view-grid" id="magazine-ongoing-grid">
                                ${series.map(ser => {
                                    const serCover = comicVineImageUrl(ser.cv_img || ser.hikka_img);
                                    return `
                                        <a class="issue-grid-card" href="#/volumes/${ser.id}">
                                            <div class="issue-grid-poster">
                                                ${serCover ? `<img src="${escapeHtmlAttribute(serCover)}" alt="${escapeHtmlAttribute(ser.name)}" loading="lazy">` : ''}
                                            </div>
                                            <div class="issue-grid-body">
                                                <h3 class="issue-grid-title">${escapeHtmlAttribute(ser.name_uk || ser.name)}</h3>
                                                <span class="issue-grid-date">${escapeHtmlAttribute(ser.publisher_name || '')}</span>
                                            </div>
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                            ${(data.series_count || series.length) > 6 ? `
                                <div style="display: flex; justify-content: center; margin-top: 24px;">
                                    <button class="btn-admin btn-admin--secondary" id="btn-show-all-ongoing" style="height: 38px; padding: 0 24px; font-size: 13px; font-weight: 600;">
                                        Показати всі
                                    </button>
                                </div>
                            ` : ''}
                        </section>
                    ` : ''}
                </div>
            </div>
        `;

        const btnShowAll = main.querySelector('#btn-show-all-ongoing');
        if (btnShowAll) {
            btnShowAll.onclick = async () => {
                btnShowAll.disabled = true;
                btnShowAll.textContent = 'Завантаження...';
                try {
                    const res = await API.get(`/magazines/${magazineId}/all-series`, { ongoing: true, limit: 100 });
                    const allSeries = res.items || [];
                    const grid = main.querySelector('#magazine-ongoing-grid');
                    if (grid) {
                        grid.innerHTML = allSeries.map(ser => {
                            const serCover = comicVineImageUrl(ser.cv_img || ser.hikka_img);
                            return `
                                <a class="issue-grid-card" href="#/volumes/${ser.id}">
                                    <div class="issue-grid-poster">
                                        ${serCover ? `<img src="${escapeHtmlAttribute(serCover)}" alt="${escapeHtmlAttribute(ser.name)}" loading="lazy">` : ''}
                                    </div>
                                    <div class="issue-grid-body">
                                        <h3 class="issue-grid-title">${escapeHtmlAttribute(ser.name_uk || ser.name)}</h3>
                                        <span class="issue-grid-date">${escapeHtmlAttribute(ser.publisher_name || '')}</span>
                                    </div>
                                </a>
                            `;
                        }).join('');
                    }
                    btnShowAll.parentElement.remove(); // Remove the button wrapper container
                } catch (e) {
                    alert('Помилка завантаження серій: ' + e.message);
                    btnShowAll.disabled = false;
                    btnShowAll.textContent = 'Показати всі';
                }
            };
        }
    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження журналу: ${err.message}</div></div>`;
    }
}
