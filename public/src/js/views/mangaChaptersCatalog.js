import { API } from '../helpers/api.js';
import { createPaginator } from '../components/Pagination.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { router } from '../helpers/router.js';
import { t } from '../helpers/i18n.js';
import { renderMangaChapterCard } from '../components/cards/MangaChapterCard.js';

const paginator = createPaginator({ pageSize: 20 });

const DEFAULT_SORT_FIELD = 'created_at';
const DEFAULT_SORT_ORDER = 'desc';

const SORT_OPTIONS = [
  { value: 'created_at', label: t('sort_recent') || 'За датою додавання' },
  { value: 'release_date', label: t('sort_date') || 'За датою початку' },
];

const SORT_ORDER_TITLES = {
  created_at: {
    asc: t('sort_order_recent_asc') || 'За зростанням: старіші додані спочатку',
    desc: t('sort_order_recent_desc') || 'За спаданням: новіші додані спочатку',
  },
  release_date: {
    asc: t('sort_order_date_asc') || 'За зростанням: від старіших релізів до новіших',
    desc: t('sort_order_date_desc') || 'За спаданням: від новіших релізів до старіших',
  },
};

let searchQuery = '';
let filterBar = null;

// Filters state
let currentSortField = DEFAULT_SORT_FIELD;
let currentSortOrder = DEFAULT_SORT_ORDER;
let currentChapterMagazine = null;

function syncUrl() {
  const params = new URLSearchParams();
  if (searchQuery) params.set('search', searchQuery);
  if (currentSortField !== DEFAULT_SORT_FIELD) params.set('sort', currentSortField);
  if (currentSortOrder !== DEFAULT_SORT_ORDER) params.set('order_dir', currentSortOrder);
  if (currentChapterMagazine) params.set('chapter_magazine_id', currentChapterMagazine.id);
  
  const page = paginator.getPage();
  if (page > 1) params.set('page', page);

  const queryString = params.toString();
  const newHash = `#${router.currentPath}${queryString ? '?' + queryString : ''}`;
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

export async function renderMangaChaptersCatalog(main, query = {}) {
  paginator.reset();
  if (query.page) {
    paginator.setPage(Number(query.page));
  }
  searchQuery = query.search || '';
  currentSortField = query.sort || DEFAULT_SORT_FIELD;
  currentSortOrder = query.order_dir || DEFAULT_SORT_ORDER;
  currentChapterMagazine = null;

  if (query.chapter_magazine_id) {
    try {
      const res = await API.get(`/magazines/${query.chapter_magazine_id}`);
      if (res?.magazine) {
        currentChapterMagazine = { id: res.magazine.id, name: res.magazine.name };
      }
    } catch (e) {
      console.error('Failed to load initial chapter magazine filter', e);
    }
  }

  main.innerHTML = `
    <div class="container">
      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container"></div>
      </div>

      <div class="catalog-layout" id="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="comic-grid" id="catalog-grid">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="catalog-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  const chapterMagFilterHtml = `
    <div class="chapter-mag-filter" id="chapter-mag-filter-wrap">
      <button class="chapter-mag-filter__btn ${currentChapterMagazine ? 'is-filtered' : ''}" type="button" id="chapter-mag-filter-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M10 6h8v4h-8V6Z"/></svg>
        <span id="chapter-mag-filter-label">${escapeHtmlAttribute(currentChapterMagazine?.name || t('all_magazines') || 'Усі журнали')}</span>
        <svg class="chapter-mag-filter__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="chapter-mag-filter__dropdown" id="chapter-mag-filter-dropdown">
        <div class="chapter-mag-filter__search-wrap">
          <input type="search" class="chapter-mag-filter__search" id="chapter-mag-filter-search" placeholder="Пошук журналу...">
        </div>
        <div class="chapter-mag-filter__list" id="chapter-mag-filter-list"></div>
      </div>
    </div>
  `;

  const updateSortControl = () => {
    const selectedSort = SORT_OPTIONS.find((opt) => opt.value === currentSortField) || SORT_OPTIONS[0];
    const title = SORT_ORDER_TITLES[currentSortField]?.[currentSortOrder] || `За спаданням`;
    
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
    if (orderIcon) orderIcon.innerHTML = currentSortOrder === 'asc' ? '<path d="M5 6h6M5 12h10M5 18h14"/>' : '<path d="M5 6h14M5 12h10M5 18h6"/>';
    if (orderBtn) {
      orderBtn.title = title;
      orderBtn.setAttribute('aria-label', title);
    }
  };

  const reloadCatalog = () => {
    fetchAndRender();
  };

  document.title = `${t('manga_chapters') || 'Розділи манґи'} — Drawn Stories`;

  filterBar = mountFilterBar(main.querySelector('#catalog-filter-bar-container'), {
    extraMiddleHtml: chapterMagFilterHtml,
    resultsCount: 0,
    searchPlaceholder: t('search_chapters') || 'Пошук розділів...',
    searchValue: searchQuery,
    sortValue: currentSortField,
    sortOptions: SORT_OPTIONS,
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

  // Wire up chapterMagFilter
  const chapterMagFilterBtnEl = document.getElementById('chapter-mag-filter-btn');
  const chapterMagFilterDropdownEl = document.getElementById('chapter-mag-filter-dropdown');
  const chapterMagFilterSearchEl = document.getElementById('chapter-mag-filter-search');
  const chapterMagFilterListEl = document.getElementById('chapter-mag-filter-list');
  const chapterMagFilterLabelEl = document.getElementById('chapter-mag-filter-label');
  const chapterMagFilterWrapEl = document.getElementById('chapter-mag-filter-wrap');

  if (chapterMagFilterBtnEl) {
    let chapterMagSearchTimer = null;
    let chapterMagAllMagazines = null;

    const closeChapterMagDropdown = () => {
      chapterMagFilterDropdownEl?.classList.remove('is-open');
      chapterMagFilterBtnEl.classList.remove('is-active');
    };

    const renderChapterMagList = (magazines) => {
      if (!chapterMagFilterListEl) return;
      const all = `
        <button class="chapter-mag-filter__item ${!currentChapterMagazine ? 'is-selected' : ''}"
          type="button" data-chapter-mag-id="" data-chapter-mag-name="">
          Усі журнали
        </button>
      `;
      const items = magazines.map(m => `
        <button class="chapter-mag-filter__item ${currentChapterMagazine?.id === m.id ? 'is-selected' : ''}"
          type="button" data-chapter-mag-id="${m.id}" data-chapter-mag-name="${escapeHtmlAttribute(m.name)}">
          ${escapeHtmlAttribute(m.name)}
        </button>
      `).join('');
      chapterMagFilterListEl.innerHTML = all + items;
    };

    const loadChapterMagMagazines = async (query = '') => {
      if (!chapterMagFilterListEl) return;
      chapterMagFilterListEl.innerHTML = '<div class="chapter-mag-filter__loading">Завантаження...</div>';
      try {
        if (!chapterMagAllMagazines) {
          const res = await API.get('/magazines', { limit: 500, offset: 0 });
          chapterMagAllMagazines = res.items || [];
        }
        let items = chapterMagAllMagazines;
        if (query) {
          const q = query.toLowerCase();
          items = items.filter(m => m.name?.toLowerCase().includes(q) || m.name_native?.toLowerCase().includes(q));
        }
        renderChapterMagList(items);
      } catch {
        chapterMagFilterListEl.innerHTML = '<div class="chapter-mag-filter__loading">Помилка завантаження</div>';
      }
    };

    chapterMagFilterBtnEl.addEventListener('click', () => {
      const isOpen = chapterMagFilterDropdownEl.classList.contains('is-open');
      if (isOpen) {
        closeChapterMagDropdown();
      } else {
        chapterMagFilterDropdownEl.classList.add('is-open');
        chapterMagFilterBtnEl.classList.add('is-active');
        loadChapterMagMagazines(chapterMagFilterSearchEl?.value.trim() || '');
      }
    });

    chapterMagFilterSearchEl?.addEventListener('input', (e) => {
      clearTimeout(chapterMagSearchTimer);
      chapterMagSearchTimer = setTimeout(() => loadChapterMagMagazines(e.target.value.trim()), 250);
    });

    chapterMagFilterListEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chapter-mag-id]');
      if (!btn) return;
      const id = btn.dataset.chapterMagId;
      const name = btn.dataset.chapterMagName;
      currentChapterMagazine = id ? { id: Number(id), name } : null;
      if (chapterMagFilterLabelEl) {
        chapterMagFilterLabelEl.textContent = currentChapterMagazine ? name : 'Усі журнали';
      }
      chapterMagFilterBtnEl.classList.toggle('is-filtered', !!currentChapterMagazine);
      closeChapterMagDropdown();
      paginator.reset();
      reloadCatalog();
    });

    document.addEventListener('click', (e) => {
      if (chapterMagFilterWrapEl && !chapterMagFilterWrapEl.contains(e.target)) {
        closeChapterMagDropdown();
      }
    });
  }

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
    const data = await API.get('/manga-chapters', {
      search: searchQuery || undefined,
      limit: paginator.getPageSize(),
      offset: (paginator.getPage() - 1) * paginator.getPageSize(),
      sort_by: currentSortField,
      order: currentSortOrder,
      magazine_id: currentChapterMagazine?.id || undefined
    });

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
      grid.innerHTML = items.map(ch => renderMangaChapterCard(ch)).join('');
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
