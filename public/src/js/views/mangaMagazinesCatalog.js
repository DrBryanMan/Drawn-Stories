import { API } from '../helpers/api.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { router } from '../helpers/router.js';
import { t } from '../helpers/i18n.js';
import { renderMagazineCard } from '../components/cards/MagazineCard.js';
import { renderMagazineIssueCard } from '../components/cards/MagazineIssueCard.js';

const paginator = createPaginator({ pageSize: 20 });

const MAGAZINE_SORT_OPTIONS = [
  { value: 'series', label: t('sort_series') || 'За кількістю серій' },
  { value: 'name', label: t('sort_name') || 'За назвою' },
  { value: 'recent', label: t('sort_recent') || 'За датою додавання' },
  { value: 'date', label: t('sort_date') || 'За датою початку' },
];

const ISSUE_SORT_OPTIONS = [
  { value: 'recent', label: t('sort_recent') || 'За датою додавання' },
  { value: 'date', label: t('sort_date') || 'За датою виходу' },
  { value: 'name', label: t('sort_name') || 'За назвою журналу' },
];

const SORT_ORDER_ICONS = {
  asc: '<path d="M5 6h6M5 12h10M5 18h14"/>',
  desc: '<path d="M5 6h14M5 12h10M5 18h6"/>',
};

const MAGAZINE_SORT_ORDER_TITLES = {
  name: {
    asc: t('sort_order_name_asc') || 'За зростанням: від А до Я',
    desc: t('sort_order_name_desc') || 'За спаданням: від Я до А',
  },
  recent: {
    asc: t('sort_order_recent_asc') || 'За зростанням: старіші додані спочатку',
    desc: t('sort_order_recent_desc') || 'За спаданням: новіші додані спочатку',
  },
  date: {
    asc: t('sort_order_date_asc') || 'За зростанням: від старіших релізів до новіших',
    desc: t('sort_order_date_desc') || 'За спаданням: від новіших релізів до старіших',
  },
  series: {
    asc: t('sort_order_series_asc') || 'За зростанням: від меншої кількості до більшої',
    desc: t('sort_order_series_desc') || 'За спаданням: від більшої кількості до меншої',
  },
};

const ISSUE_SORT_ORDER_TITLES = {
  name: {
    asc: 'Від А до Я',
    desc: 'Від Я до А',
  },
  recent: {
    asc: 'Старіші додані спочатку',
    desc: 'Новіші додані спочатку',
  },
  date: {
    asc: 'Від старіших випусків до новіших',
    desc: 'Від новіших випусків до старіших',
  }
};

let searchQuery = '';
let filterBar = null;
let viewMode = 'magazines'; // 'magazines' or 'issues'

// Filters state
let currentSortField = 'series';
let currentSortOrder = 'desc';

function syncUrl() {
  const params = new URLSearchParams();
  if (viewMode !== 'magazines') params.set('view', viewMode);
  if (searchQuery) params.set('search', searchQuery);
  
  const defaultSort = viewMode === 'issues' ? 'recent' : 'series';
  if (currentSortField !== defaultSort) params.set('sort', currentSortField);
  if (currentSortOrder !== 'desc') params.set('order_dir', currentSortOrder);
  
  const page = paginator.getPage();
  if (page > 1) params.set('page', page);

  const queryString = params.toString();
  const newHash = `#${router.currentPath}${queryString ? '?' + queryString : ''}`;
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

export async function renderMangaMagazinesCatalog(main, query = {}) {
  paginator.reset();
  if (query.page) {
    paginator.setPage(Number(query.page));
  }
  searchQuery = query.search || '';
  viewMode = query.view === 'issues' ? 'issues' : 'magazines';
  
  const defaultSort = viewMode === 'issues' ? 'recent' : 'series';
  currentSortField = query.sort || defaultSort;
  currentSortOrder = query.order_dir || 'desc';

  main.innerHTML = `
    <div class="container">
      <div class="catalog-top-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;">
        <div id="catalog-filter-bar-container" style="flex: 1; min-width: 300px;"></div>
        <div class="catalog-segmented" id="magazine-view-segmented" role="group" aria-label="Режим перегляду">
          <button class="catalog-segment ${viewMode === 'magazines' ? 'is-active' : ''}" type="button" data-view-mode="magazines">Журнали</button>
          <button class="catalog-segment ${viewMode === 'issues' ? 'is-active' : ''}" type="button" data-view-mode="issues">Випуски</button>
        </div>
      </div>

      <div class="catalog-layout" id="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="comic-grid ${viewMode === 'issues' ? 'comic-grid--magazine-issues' : 'comic-grid--magazines'}" id="catalog-grid">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="catalog-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  const updateSortControl = () => {
    const sortOpts = viewMode === 'issues' ? ISSUE_SORT_OPTIONS : MAGAZINE_SORT_OPTIONS;
    const selectedSort = sortOpts.find((opt) => opt.value === currentSortField) || sortOpts[0];
    const sortOrderTitles = viewMode === 'issues' ? ISSUE_SORT_ORDER_TITLES : MAGAZINE_SORT_ORDER_TITLES;
    const title = sortOrderTitles[currentSortField]?.[currentSortOrder] || `За спаданням`;
    
    if (filterBar) {
      filterBar.setSortValue(currentSortField);
      filterBar.setSortOrder(currentSortOrder);
    }

    const sortSelect = document.getElementById('sort-select');
    const orderBtn = document.getElementById('sort-order-btn');
    const orderIcon = document.getElementById('sort-order-icon');
    const sortLabel = sortSelect?.querySelector('.select-label');

    if (sortSelect) {
      sortSelect.value = selectedSort.value;
      sortSelect.title = selectedSort.label;
    }
    if (sortLabel) sortLabel.textContent = selectedSort.label;
    if (orderIcon) orderIcon.innerHTML = SORT_ORDER_ICONS[currentSortOrder];
    if (orderBtn) {
      orderBtn.title = title;
      orderBtn.setAttribute('aria-label', title);
    }
  };

  const reloadCatalog = () => {
    fetchAndRender();
  };

  const remountFilterBar = () => {
    const container = main.querySelector('#catalog-filter-bar-container');
    if (!container) return;
    
    const sortOpts = viewMode === 'issues' ? ISSUE_SORT_OPTIONS : MAGAZINE_SORT_OPTIONS;
    const searchPlaceholder = viewMode === 'issues' 
      ? 'Пошук випусків журналів...' 
      : (t('search_magazines') || 'Пошук журналів...');

    filterBar = mountFilterBar(container, {
      resultsCount: 0,
      searchPlaceholder: searchPlaceholder,
      searchValue: searchQuery,
      sortValue: currentSortField,
      sortOptions: sortOpts,
      sortOrderValue: currentSortOrder,
      showFiltersBtn: false,
      filtersBtnActive: false,
      onSearch: (val) => {
        searchQuery = val;
        paginator.reset();
        reloadCatalog();
      },
      onSortChange: (val) => {
        currentSortField = val;
        updateSortControl();
        paginator.reset();
        reloadCatalog();
      },
      onSortOrderChange: (dir) => {
        currentSortOrder = dir;
        updateSortControl();
        paginator.reset();
        reloadCatalog();
      }
    });
    updateSortControl();
  };

  // Event listeners for view mode segmented control
  const segmented = main.querySelector('#magazine-view-segmented');
  if (segmented) {
    segmented.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view-mode]');
      if (btn) {
        const newMode = btn.dataset.viewMode;
        if (newMode !== viewMode) {
          viewMode = newMode;
          currentSortField = viewMode === 'issues' ? 'recent' : 'series';
          currentSortOrder = 'desc';
          searchQuery = '';
          paginator.reset();
          
          segmented.querySelectorAll('[data-view-mode]').forEach(b => {
            b.classList.toggle('is-active', b.dataset.viewMode === viewMode);
          });
          
          const grid = document.getElementById('catalog-grid');
          if (grid) {
            grid.className = `comic-grid ${viewMode === 'issues' ? 'comic-grid--magazine-issues' : 'comic-grid--magazines'}`;
          }
          
          remountFilterBar();
          reloadCatalog();
        }
      }
    });
  }

  document.title = `${t('manga_magazines') || 'Журнали'} — Drawn Stories`;

  remountFilterBar();
  reloadCatalog();
}

async function fetchAndRender() {
  const grid = document.getElementById('catalog-grid');
  const paginationWrap = document.getElementById('catalog-pagination');
  if (!grid) return;

  syncUrl();

  const renderSkeletons = () => {
    grid.innerHTML = '';
    for (let i = 0; i < paginator.getPageSize(); i++) {
      const skel = document.createElement('div');
      skel.className = 'comic-card skeleton-card';
      skel.innerHTML = `
        <div class="skeleton" style="width: 100%; aspect-ratio: 2/3;"></div>
        <div class="comic-body">
          <div class="skeleton skeleton-text" style="width: 85%; height: 16px; margin-bottom: 8px;"></div>
          <div class="skeleton skeleton-text" style="width: 45%; height: 12px; margin-bottom: 6px;"></div>
          <div class="skeleton skeleton-text" style="width: 30%; height: 10px;"></div>
        </div>
      `;
      grid.appendChild(skel);
    }
  };

  renderSkeletons();

  try {
    let data;
    if (viewMode === 'issues') {
      data = await API.get('/magazines/issues-catalog', {
        search: searchQuery || undefined,
        limit: paginator.getPageSize(),
        offset: (paginator.getPage() - 1) * paginator.getPageSize(),
        sort: currentSortField,
        order_dir: currentSortOrder
      });
    } else {
      data = await API.get('/magazines', {
        search: searchQuery || undefined,
        limit: paginator.getPageSize(),
        offset: (paginator.getPage() - 1) * paginator.getPageSize(),
        sort: currentSortField,
        order_dir: currentSortOrder
      });
    }

    if (filterBar) filterBar.updateCount(data.total);

    grid.innerHTML = '';
    const items = data.items || [];
    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>${t('nothing_found') || 'Нічого не знайдено'}</h3>
          <p>${t('empty_search_tip') || 'Спробуйте змінити параметри пошуку'}</p>
        </div>`;
    } else {
      if (viewMode === 'issues') {
        grid.innerHTML = items.map(iss => renderMagazineIssueCard(iss)).join('');
      } else {
        grid.innerHTML = items.map(mag => renderMagazineCard(mag)).join('');
      }
    }

    paginationWrap.innerHTML = '';
    const pages = data.pages || Math.ceil(data.total / paginator.getPageSize());
    if (pages > 1) {
      const nav = paginator.render(data.total, () => {
        fetchAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      paginationWrap.appendChild(nav);
    }
  } catch (err) {
    grid.innerHTML = `<div class="error-state">Помилка завантаження: ${err.message}</div>`;
  }
}
