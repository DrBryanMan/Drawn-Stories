import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { createPaginator } from '../components/Pagination.js';

const paginator = createPaginator({ pageSize: 24 });
let allCharacters = [];
let filteredCharacters = [];
let searchQuery = '';

export async function renderVolumeCharacters(container, params = {}) {
    const volumeId = Number(params.id);
    if (!Number.isFinite(volumeId)) {
        container.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор тому.</div></div>';
        return;
    }

    paginator.reset();
    searchQuery = '';
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header" id="vol-char-breadcrumbs">
                <!-- Breadcrumbs skeleton -->
            </div>

            <div class="catalog-top-row">
                <div id="vol-char-filter-bar-container"></div>
            </div>

            <div class="catalog-layout">
                <div class="catalog-main-column">
                    <main class="catalog-results">
                        <div class="characters-grid" id="vol-characters-grid">
                            <div class="loader-container"><div class="loader"></div></div>
                        </div>
                        <div class="pagination-wrap" id="vol-char-pagination"></div>
                    </main>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await API.get(`/volumes/${volumeId}/characters`);
        const volume = res.volume || {};
        allCharacters = res.items || [];
        filteredCharacters = [...allCharacters];

        // Render breadcrumbs
        const volTitle = volume.name_uk || volume.name || 'Том';
        const breadcrumbsContainer = container.querySelector('#vol-char-breadcrumbs');
        if (breadcrumbsContainer) {
            breadcrumbsContainer.innerHTML = createBreadcrumbs([
                { label: 'Каталог', href: '#/catalog' },
                { label: volTitle, href: `#/volumes/${volumeId}` },
                { label: 'Персонажі' }
            ]);
        }

        document.title = `Персонажі — ${volTitle} — Drawn Stories`;

        // Mount FilterBar
        const filterBarContainer = container.querySelector('#vol-char-filter-bar-container');
        let filterBar = mountFilterBar(filterBarContainer, {
            resultsCount: filteredCharacters.length,
            resultsLabel: 'Знайдено',
            showResults: true,
            showSearch: true,
            searchPlaceholder: 'Пошук персонажів...',
            searchValue: searchQuery,
            onSearch: (val) => {
                searchQuery = val.trim().toLowerCase();
                applyFilter();
            },
            showSort: false
        });

        const applyFilter = () => {
            filteredCharacters = allCharacters.filter(char => {
                const name = (char.name_uk || char.name || '').toLowerCase();
                const realName = (char.real_name_uk || char.real_name || '').toLowerCase();
                const matchesSearch = !searchQuery || name.includes(searchQuery) || realName.includes(searchQuery);
                return matchesSearch;
            });

            if (filterBar) {
                filterBar.setResultsCount(filteredCharacters.length);
            }
            paginator.reset();
            renderGrid();
        };

        const renderGrid = () => {
            const grid = container.querySelector('#vol-characters-grid');
            const paginationWrap = container.querySelector('#vol-char-pagination');
            if (!grid) return;

            if (filteredCharacters.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                        Персонажів не знайдено
                    </div>
                `;
                paginationWrap.innerHTML = '';
                return;
            }

            const page = paginator.getPage();
            const pageSize = paginator.getPageSize();
            const pageItems = filteredCharacters.slice((page - 1) * pageSize, page * pageSize);

            const buildCharCardHTML = (char) => {
                const cover = char.image ? normalizeImageUrl(char.image) : '';
                const name = escapeHtmlAttribute(char.name_uk || char.name || 'Без назви');
                const charLink = char.cv_slug ? `#/characters/${char.id}-${char.cv_slug}` : `#/characters/${char.id}`;
                return `
                    <div class="character-card">
                        <div class="char-cover-wrap">
                            ${cover
                                ? `<img class="char-cover" src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                                : `<div class="char-cover-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>`
                            }
                        </div>
                        <div class="char-info">
                            <a href="${charLink}" class="char-name" title="${name}" style="text-decoration: none;">${name}</a>
                        </div>
                    </div>
                `;
            };

            const mains = pageItems.filter(c => c.role === 'main');
            const supportings = pageItems.filter(c => c.role !== 'main');

            let gridHtml = '';
            if (mains.length > 0) {
                gridHtml += `
                    <div class="volume-char-category" style="grid-column: 1 / -1; margin-bottom: 1.5rem; width: 100%;">
                        <div class="volume-char-category-title" style="font-size: 14px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Головні</div>
                        <div class="characters-grid">
                            ${mains.map(buildCharCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            if (supportings.length > 0) {
                gridHtml += `
                    <div class="volume-char-category" style="grid-column: 1 / -1; width: 100%;">
                        <div class="volume-char-category-title" style="font-size: 14px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Другорядні</div>
                        <div class="characters-grid">
                            ${supportings.map(buildCharCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            grid.innerHTML = gridHtml;

            // Render pagination
            paginationWrap.innerHTML = '';
            paginationWrap.appendChild(paginator.render(filteredCharacters.length, (newPage) => {
                paginator.setPage(newPage);
                renderGrid();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }));
        };

        renderGrid();

    } catch (err) {
        console.error('Error fetching volume characters:', err);
        container.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження даних: ${err.message}</div></div>`;
    }
}
