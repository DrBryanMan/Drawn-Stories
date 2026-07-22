import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t } from '../helpers/i18n.js';

const paginator = createPaginator({ pageSize: 20 });
const getSortOptions = () => [
  { value: 'name', label: 'За назвою' },
  { value: 'recent', label: 'За датою додавання' },
];

let searchQuery = '';
let sortField = 'name';
let sortOrder = 'asc';

export async function renderEssences(container, query) {
  document.title = `Сутності — Drawn Stories`;
  paginator.reset();
  searchQuery = query.search || '';

  container.innerHTML = `
    <div class="container">
      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container">
          <div id="essences-filter-bar-container"></div>
        </div>
      </div>

      <div class="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="essences-grid" id="essences-grid">
               <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="essences-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  let filterBar = mountFilterBar(container.querySelector('#essences-filter-bar-container'), {
    resultsCount: 0,
    resultsLabel: t('found_count') || 'Знайдено',
    showResults: true,
    showSearch: true,
    searchPlaceholder: 'Пошук сутностей...',
    searchValue: searchQuery,
    onSearch: (val) => {
      searchQuery = val;
      paginator.reset();
      reloadEssences();
    },
    showSort: true,
    sortId: 'ess-sort-select',
    sortValue: sortField,
    sortOptions: getSortOptions(),
    showSortOrder: true,
    sortOrderId: 'ess-sort-order-btn',
    sortOrderValue: sortOrder,
    onSortChange: (val) => {
      sortField = val;
      paginator.reset();
      reloadEssences();
    },
    onSortOrderChange: (dir) => {
      sortOrder = dir;
      paginator.reset();
      reloadEssences();
    }
  });

  const reloadEssences = () => {
    fetchAndRenderEssences(filterBar);
  };

  reloadEssences();
}

async function fetchAndRenderEssences(filterBar) {
  const grid = document.getElementById('essences-grid');
  const paginationWrap = document.getElementById('essences-pagination');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 8 }).map(() => `
    <div class="skeleton" style="height: 320px; border-radius: var(--r-lg);"></div>
  `).join('');

  try {
    const data = await API.get('/essences', {
      page: paginator.getPage(),
      limit: paginator.getPageSize(),
      search: searchQuery || undefined,
      sort: sortField,
      order_dir: sortOrder
    });

    if (filterBar) {
      filterBar.updateCount(data.total || 0);
    }

    if (!data.items || data.items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 0; text-align: center; color: var(--text-muted);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px;">
             <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/>
          </svg>
          <div style="font-size: 1.1rem; font-weight: 600;">Сутностей не знайдено</div>
        </div>
      `;
      paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = data.items.map(item => {
      const title = item.essence_name_uk || item.essence_name;
      const person = item.person_name_uk || item.person_name || '';
      const imgUrl = item.image ? normalizeImageUrl(item.image) : '/images/placeholders/character.webp';
      const charCount = item.characters_count || 0;

      return `
        <a href="#/essences/${item.slug}" class="essence-card">
          <div class="essence-card-image-wrap">
            <img class="essence-card-img" src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(title)}" loading="lazy">
          </div>
          <div class="essence-card-content">
            <div class="essence-card-title">${escapeHtmlAttribute(title)}</div>
            ${person ? `<div class="essence-card-person">${escapeHtmlAttribute(person)}</div>` : ''}
            <div class="essence-card-meta">
              ${item.franchise ? `<span class="essence-card-badge">${escapeHtmlAttribute(item.franchise)}</span>` : ''}
              <span>${charCount} версій</span>
            </div>
          </div>
        </a>
      `;
    }).join('');

    paginator.render(paginationWrap, data.total, (newPage) => {
      paginator.setPage(newPage);
      fetchAndRenderEssences(filterBar);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="error-state" style="grid-column: 1 / -1;">Помилка завантаження даних</div>`;
  }
}
