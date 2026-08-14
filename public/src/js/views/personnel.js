import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t } from '../helpers/i18n.js';

const paginator = createPaginator({ pageSize: 20 });
const getSortOptions = () => [
  { value: 'issues', label: t('sort_works_count') },
  { value: 'name', label: t('sort_char_name') },
  { value: 'recent', label: t('sort_recent') },
];
let searchQuery = '';
let sortField = 'issues';
let sortOrder = 'desc';

export async function renderPersonnel(container, query) {
  document.title = `${t('personnel')} — Drawn Stories`;
  paginator.reset();
  searchQuery = query.search || '';

  container.innerHTML = `
    <div class="container">
      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container">
          <div id="personnel-filter-bar-container"></div>
        </div>
      </div>

      <div class="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="personnel-grid" id="personnel-grid">
               <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="personnel-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  let filterBar = mountFilterBar(container.querySelector('#personnel-filter-bar-container'), {
    resultsCount: 0,
    resultsLabel: t('found_count'),
    showResults: true,
    showSearch: true,
    searchPlaceholder: t('search_personnel'),
    searchValue: searchQuery,
    onSearch: (val) => {
      searchQuery = val;
      paginator.reset();
      reloadPersonnel();
    },
    showSort: true,
    sortId: 'personnel-sort-select',
    sortValue: sortField,
    sortOptions: getSortOptions(),
    showSortOrder: true,
    sortOrderId: 'personnel-sort-order-btn',
    sortOrderValue: sortOrder,
    onSortChange: (val) => {
      sortField = val;
      paginator.reset();
      reloadPersonnel();
    },
    onSortOrderChange: (dir) => {
      sortOrder = dir;
      paginator.reset();
      reloadPersonnel();
    }
  });

  const reloadPersonnel = () => {
    fetchAndRenderPersonnel(filterBar);
  };

  reloadPersonnel();
}

async function fetchAndRenderPersonnel(filterBar) {
  const grid = document.getElementById('personnel-grid');
  const paginationWrap = document.getElementById('personnel-pagination');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton" style="height: 280px; border-radius: var(--r-lg)"></div>
  `).join('');

  try {
    const data = await API.get('/persons', {
      page: paginator.getPage(),
      limit: paginator.getPageSize(),
      search: searchQuery || undefined,
      sort: sortField,
      order_dir: sortOrder
    });

    const items = data.items || [];
    if (filterBar) filterBar.updateCount(data.total || 0);

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>${t('personnel_not_found')}</h3>
        </div>`;
      paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = items.map(item => {
      const cover = normalizeImageUrl(item.image);
      const metaInfo = [item.occupation, item.country].filter(Boolean).join(', ');

      return `
        <div class="personnel-card">
          <a href="#/persons/${item.id}" class="person-cover-wrap">
            ${cover
              ? `<img class="person-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy">`
              : `<div class="person-cover-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`
            }
          </a>
          <div class="person-info">
            <h3 class="person-name" title="${escapeHtmlAttribute(item.name)}">
              <a href="#/persons/${item.id}" style="color:inherit;text-decoration:none;">${escapeHtmlAttribute(item.name)}</a>
            </h3>
            ${metaInfo ? `<p class="person-meta" title="${escapeHtmlAttribute(metaInfo)}">${escapeHtmlAttribute(metaInfo)}</p>` : ''}
            <div class="person-stats">
              <span class="person-stat-label">${t('works_label')}:</span>
              <strong class="person-stat-value">${item.issue_count}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    paginationWrap.innerHTML = '';
    paginationWrap.appendChild(paginator.render(data.total || 0, () => {
      fetchAndRenderPersonnel(filterBar);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="error-state">${t('loading_error')}</div>`;
  }
}
