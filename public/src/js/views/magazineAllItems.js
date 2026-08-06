import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { formatDate } from '../helpers/lang.js';
import { icon } from '../helpers/icons.js';

export async function renderMagazineAllItems(main, params = {}) {
    const magazineId = Number(params.id);
    if (!Number.isFinite(magazineId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор журналу.</div></div>';
        return;
    }

    // Get current tab from URL query if present, otherwise default to issues
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    let activeTab = urlParams.get('tab') === 'series' ? 'series' : 'issues';

    let page = 1;
    const limit = 24;
    const paginator = createPaginator({ pageSize: limit });

    main.innerHTML = `
        <div class="volume-detail">
            <div class="container volume-body" style="padding-top: 40px;">
                <div class="skeleton skeleton-rect" style="width: 100%; height: 400px; border-radius: 12px;"></div>
            </div>
        </div>
    `;

    try {
        const magData = await API.get(`/magazines/${magazineId}`);
        const magazineTitle = escapeHtmlAttribute(magData.magazine.name);

        const updateContent = async () => {
            const listContainer = document.getElementById('magazine-all-items-grid');
            const paginationContainer = document.getElementById('magazine-all-items-pagination');
            if (listContainer) {
                listContainer.innerHTML = '<div class="skeleton skeleton-rect" style="width: 100%; height: 200px; border-radius: 12px;"></div>';
            }

            const data = await API.get(`/magazines/${magazineId}/all-${activeTab}`, { page, limit });
            
            if (listContainer) {
                if (data.items.length === 0) {
                    listContainer.innerHTML = '<p>Нічого не знайдено.</p>';
                } else {
                    listContainer.innerHTML = `
                        <div class="issues-view-grid">
                            ${data.items.map(item => {
                                if (activeTab === 'issues') {
                                    const issCover = normalizeImageUrl(item.image);
                                    const formattedDate = formatDate(item.cover_date || item.release_date, '');
                                    return `
                                        <a class="issue-grid-card" href="#/magazines/issues/${item.id}">
                                            <div class="issue-grid-cover-wrap">
                                                ${issCover
                                                    ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(issCover)}" alt="Випуск #${item.issue_number}" loading="lazy">`
                                                    : `<div class="issue-grid-cover-empty">${icon('imagePlaceholder', 32)}</div>`}
                                                ${item.issue_number ? `<div class="issue-grid-number"># ${escapeHtmlAttribute(item.issue_number)}</div>` : ''}
                                            </div>
                                            <div class="issue-grid-body">
                                                <h3 class="issue-grid-title" title="${escapeHtmlAttribute(item.name || `Випуск #${item.issue_number}`)}">
                                                    ${escapeHtmlAttribute(item.name || `Випуск #${item.issue_number}`)}
                                                </h3>
                                                ${formattedDate ? `
                                                    <div class="issue-grid-date" style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                                                        ${icon('calendar', 12, { strokeWidth: 2 })}
                                                        <span>${escapeHtmlAttribute(formattedDate)}</span>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </a>
                                    `;
                                } else {
                                    const serCover = normalizeImageUrl(item.image);
                                    return `
                                        <a class="issue-grid-card" href="#/volumes/${item.id}">
                                            <div class="issue-grid-cover-wrap">
                                                ${serCover
                                                    ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(serCover)}" alt="${escapeHtmlAttribute(item.name)}" loading="lazy">`
                                                    : `<div class="issue-grid-cover-empty">${icon('imagePlaceholder', 32)}</div>`}
                                            </div>
                                            <div class="issue-grid-body">
                                                <h3 class="issue-grid-title">${escapeHtmlAttribute(item.name_uk || item.name)}</h3>
                                                <span class="issue-grid-date">${escapeHtmlAttribute(item.publisher_name || '')}</span>
                                            </div>
                                        </a>
                                    `;
                                }
                            }).join('')}
                        </div>
                    `;
                }
            }

            if (paginationContainer) {
                paginationContainer.innerHTML = '';
                paginator.setPage(page);

                if (data.total > limit) {
                    paginationContainer.appendChild(paginator.render(data.total, () => {
                        page = paginator.getPage();
                        updateContent();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }));
                }
            }
        };


        const renderLayout = () => {
            main.innerHTML = `
                <div class="volume-detail">
                    <div class="container volume-body" style="padding-top: 20px;">
                        <div class="wanted-section-header wanted-section-header--row">
                            <div class="wanted-section-title">
                                ${icon('magazine', 24, { strokeWidth: 2.2 })}
                                <span>${magazineTitle}</span>
                            </div>
                            
                            <div class="wanted-ct-group" role="group">
                                <button class="wanted-ct-btn ${activeTab === 'issues' ? 'is-active' : ''}" data-tab="issues">Випуски</button>
                                <button class="wanted-ct-btn ${activeTab === 'series' ? 'is-active' : ''}" data-tab="series">Серії</button>
                            </div>
                        </div>

                        <div id="magazine-all-items-grid"></div>
                        <div id="magazine-all-items-pagination" class="pagination-wrap"></div>
                    </div>
                </div>
            `;

            // Attach toggle tab button events
            main.querySelectorAll('.wanted-ct-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab;
                    if (tab === activeTab) return;
                    activeTab = tab;
                    page = 1;
                    
                    // Update active styling
                    main.querySelectorAll('.wanted-ct-btn').forEach(b => {
                        b.classList.toggle('is-active', b.dataset.tab === activeTab);
                    });

                    // Update url query silently without reloading
                    const hashWithoutQuery = window.location.hash.split('?')[0];
                    history.replaceState(null, '', `${hashWithoutQuery}?tab=${activeTab}`);

                    updateContent();
                });
            });
        };

        renderLayout();
        await updateContent();

    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження списку: ${err.message}</div></div>`;
    }
}
