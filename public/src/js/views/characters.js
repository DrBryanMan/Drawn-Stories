import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';

const paginator = createPaginator({ pageSize: 20 });
const getSortOptions = () => [
  { value: 'issues', label: t('sort_popularity') },
  { value: 'name', label: t('sort_char_name') },
  { value: 'recent', label: t('sort_recent') },
];
let searchQuery = '';
let sortField = 'issues';
let sortOrder = 'desc';

export async function renderCharacters(container, query) {
  document.title = `${t('characters')} — Drawn Stories`;
  paginator.reset();
  searchQuery = query.search || '';

  container.innerHTML = `
    <div class="container">
      <div class="page-header">
        ${createBreadcrumbs([{ label: t('characters') }])}
      </div>

      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container">
          <div id="characters-filter-bar-container"></div>
        </div>
      </div>

      <div class="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="characters-grid" id="catalog-grid">
               <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="char-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  let filterBar = mountFilterBar(container.querySelector('#characters-filter-bar-container'), {
    resultsCount: 0,
    resultsLabel: t('found_count'),
    showResults: true,
    showSearch: true,
    searchPlaceholder: t('search_characters'),
    searchValue: searchQuery,
    onSearch: (val) => {
      searchQuery = val;
      paginator.reset();
      reloadCharacters();
    },
    showSort: true,
    sortId: 'char-sort-select',
    sortValue: sortField,
    sortOptions: getSortOptions(),
    showSortOrder: true,
    sortOrderId: 'char-sort-order-btn',
    sortOrderValue: sortOrder,
    onSortChange: (val) => {
      sortField = val;
      paginator.reset();
      reloadCharacters();
    },
    onSortOrderChange: (dir) => {
      sortOrder = dir;
      paginator.reset();
      reloadCharacters();
    }
  });

  const reloadCharacters = () => {
    fetchAndRenderCharacters(filterBar);
  };

  reloadCharacters();
}

async function fetchAndRenderCharacters(filterBar) {
  const grid = document.getElementById('catalog-grid');
  const paginationWrap = document.getElementById('char-pagination');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton" style="height: 280px; border-radius: var(--r-lg)"></div>
  `).join('');

  try {
    const data = await API.get('/characters', {
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
          <h3>${t('characters_not_found')}</h3>
        </div>`;
      paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = items.map(item => {
      const cover = normalizeImageUrl(item.image);
      let genderIcon = '';
      if (item.gender === 1) {
        genderIcon = `<span class="char-gender-badge male" title="${t('gender_male')}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></svg></span>`;
      } else if (item.gender === 2) {
        genderIcon = `<span class="char-gender-badge female" title="${t('gender_female')}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/></svg></span>`;
      } else {
        genderIcon = `<span class="char-gender-badge unknown" title="${t('gender_unknown')}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>`;
      }

      return `
        <div class="character-card">
          <div class="char-cover-wrap">
            ${cover
              ? `<img class="char-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy">`
              : `<svg class="char-cover-empty" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
            }
            ${genderIcon}
          </div>
          <div class="char-info">
            <h3 class="char-name" title="${escapeHtmlAttribute(item.name)}">${escapeHtmlAttribute(item.name)}</h3>
            ${item.real_name ? `<p class="char-real-name" title="${escapeHtmlAttribute(item.real_name)}">${escapeHtmlAttribute(item.real_name)}</p>` : ''}
            <div class="char-stats">
              <span class="char-stat-label">${t('section_issues')}:</span>
              <strong class="char-stat-value">${item.issue_count}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    paginationWrap.innerHTML = '';
    paginationWrap.appendChild(paginator.render(data.total || 0, () => {
      fetchAndRenderCharacters(filterBar);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="error-state">${t('loading_error')}</div>`;
  }
}
