import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

// ── Lucide SVG icons ────────────────────────────────
const ICON = {
    chevronRight:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    layers:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg>'
};

export async function renderMagazineDetail(main, params = {}) {
    const magazineId = Number(params.id);
    if (!Number.isFinite(magazineId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор журналу.</div></div>';
        return;
    }

    main.innerHTML = `
        <div class="volume-detail">
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
        const [data, issuesData] = await Promise.all([
            API.get(`/magazines/${magazineId}`),
            API.get(`/magazines/${magazineId}/all-issues`, { limit: 10000 })
        ]);
        const { magazine, series = [] } = data;
        const allIssues = issuesData.items || [];

        const coverUrl = normalizeImageUrl(magazine.image);
        const title = escapeHtmlAttribute(magazine.name);
        const nativeName = escapeHtmlAttribute(magazine.name_native || '');
        const publisherName = escapeHtmlAttribute(magazine.publisher_name || 'Невідомо');

        main.innerHTML = `
            <div class="volume-detail">
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
                    <!-- Related Collections Section (Issues Section) -->
                    <style>
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
                    </style>

                    <section class="related-collections-section block">
                        <div class="block-header">
                            <h2>
                                ${ICON.layers}
                                Нові випуски
                                <span id="issues-pag-label"></span>
                            </h2>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div id="issues-datepicker-container"></div>
                                ${(data.issues_count || allIssues.length) > 6 ? `
                                    <a href="#/magazines/${magazineId}/all?tab=issues" class="section-link">
                                        Всі випуски (${data.issues_count || allIssues.length})
                                        ${ICON.chevronRight}
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                        ${allIssues.length === 0 ? '<p>Немає завантажених випусків.</p>' : `
                            <div style="position: relative;">
                                <button class="outer-nav-btn outer-nav-btn--prev" id="btn-issues-prev" title="Попередня"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                                <div class="related-list" id="magazine-issues-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1em;">
                                </div>
                                <button class="outer-nav-btn outer-nav-btn--next" id="btn-issues-next" title="Наступна"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                            </div>
                        `}
                    </section>


                    ${series.length > 0 ? `
                        <section class="block">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h2>Поточні серії</h2>
                                ${(data.series_count || series.length) > 6 ? `
                                    <a href="#/magazines/${magazineId}/all?tab=series" class="section-link">
                                        Всі серії (${data.series_count || series.length})
                                        ${ICON.chevronRight}
                                    </a>
                                ` : ''}
                            </div>
                            <div class="issues-view-grid" id="magazine-ongoing-grid">
                                ${series.map(ser => {
                                    const serCover = normalizeImageUrl(ser.image);
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
                            const serCover = normalizeImageUrl(ser.image);
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

        if (allIssues.length > 0) {
            const formatTitle = (issueItem) => {
                let num = issueItem.name || `No. ${issueItem.issue_number}`;
                // Strip year (e.g., ", 2026" or " 2026")
                num = num.replace(/,?\s*\d{4}/g, '').trim();
                
                const dateStr = issueItem.cover_date || issueItem.release_date || '';
                let monthStr = '';
                const ukMonthsNominal = {
                    '01': 'Січень', '02': 'Лютий', '03': 'Березень', '04': 'Квітень',
                    '05': 'Травень', '06': 'Червень', '07': 'Липень', '08': 'Серпень',
                    '09': 'Вересень', '10': 'Жовтень', '11': 'Листопад', '12': 'Грудень'
                };
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length >= 2) {
                        const m = parts[1];
                        monthStr = ukMonthsNominal[m] || '';
                    }
                }
                return monthStr ? `${num}, ${monthStr}` : num;
            };

            let currentIssuesPage = 1;
            const issuesPerPage = 8;
            let selectedYear = '';
            if (allIssues.length > 0) {
                const latestIssueDate = allIssues[0].cover_date || allIssues[0].release_date || '';
                if (latestIssueDate && latestIssueDate.includes('-')) {
                    selectedYear = latestIssueDate.split('-')[0];
                }
            }
            
            let filteredIssues = selectedYear ? allIssues.filter(iss => (iss.cover_date || iss.release_date || '').startsWith(selectedYear)) : [...allIssues];

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
                    
                    let pagesCountStr = '';
                    if (iss.pages) {
                        pagesCountStr = `<span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(${iss.pages} с.)</span>`;
                    }
                    return `
                        <a href="#/magazines/issues/${iss.id}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; transition: transform 0.2s; position: relative;">
                            <div style="aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-s); background: var(--bg-card); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
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
            if (allIssues.length > 0 && datepickerContainer) {
                // Find all unique years across allIssues
                const years = allIssues.map(iss => {
                    const d = iss.cover_date || iss.release_date || '';
                    return d.split('-')[0];
                }).filter(y => y && !isNaN(y)).map(Number);

                // Get unique years, sorted descending
                const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a);

                let yearOptions = '';
                for (const yr of uniqueYears) {
                    yearOptions += `<option value="${yr}" ${String(yr) === selectedYear ? 'selected' : ''}>${yr}</option>`;
                }

                datepickerContainer.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Рік:
                        </span>
                        <select id="issues-yearpicker" style="background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 6px; color: var(--text); padding: 4px 8px; font-size: 13px; outline: none; height: 32px;">
                            <option value="">Всі роки</option>
                            ${yearOptions}
                        </select>
                    </div>
                `;
                document.getElementById('issues-yearpicker').addEventListener('change', (e) => {
                    const val = e.target.value;
                    selectedYear = val;
                    filteredIssues = val ? allIssues.filter(iss => (iss.cover_date || iss.release_date || '').startsWith(val)) : [...allIssues];
                    currentIssuesPage = 1;
                    renderIssuesSection();
                });
            }
            renderIssuesSection();
            document.getElementById('btn-issues-prev').onclick = () => { if (currentIssuesPage > 1) { currentIssuesPage--; renderIssuesSection(); } };
            document.getElementById('btn-issues-next').onclick = () => { const totalPages = Math.ceil(filteredIssues.length / issuesPerPage); if (currentIssuesPage < totalPages) { currentIssuesPage++; renderIssuesSection(); } };
        }
    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження журналу: ${err.message}</div></div>`;
    }
}
