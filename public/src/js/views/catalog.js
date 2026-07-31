import { API } from '../helpers/api.js';
import { mountCatalogFilters } from '../components/CatalogFilterPanel.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { router } from '../helpers/router.js';
import { t } from '../helpers/i18n.js';

const paginator = createPaginator({ pageSize: 20 });
const FILTER_PANEL_OPEN_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="4" width="14" height="16" rx="2"/>
    <path d="M10 4v16"/>
    <path d="m16 9-3 3 3 3"/>
  </svg>
`;
const FILTER_PANEL_CLOSE_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="4" width="14" height="16" rx="2"/>
    <path d="M10 4v16"/>
    <path d="m13 9 3 3-3 3"/>
  </svg>
`;
const DEFAULT_SORT_FIELD = 'recent';
const DEFAULT_SORT_ORDER = 'desc';

const getSortOptions = () => [
  { value: 'name', label: t('sort_name') },
  { value: 'recent', label: t('sort_recent') },
  { value: 'date', label: t('sort_date') },
];
const getSortOrderTitles = () => ({
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
});

const FILTER_PANEL_STORAGE_KEY = 'drawn-stories.catalog.filters-panel-open';

let searchQuery = '';
let filterBar = null;

// State shared between renderCatalog and fetchAndRender
let currentSortField = DEFAULT_SORT_FIELD;
let currentSortOrder = DEFAULT_SORT_ORDER;
let currentContentType = '';
let currentViewType = 'series';
let currentCollectionOnly = false;
let currentPublishers = [];
let currentThemes = [];
let currentExcludedThemes = [];
let currentMagazines = [];
let currentLanguages = [];
let currentSources = [];
let currentExcludedSources = [];

function readStoredFiltersPanelState() {
  try {
    return localStorage.getItem(FILTER_PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeFiltersPanelState(open) {
  try {
    localStorage.setItem(FILTER_PANEL_STORAGE_KEY, String(open));
  } catch { /* localStorage can be unavailable in restricted contexts */ }
}

function syncUrl() {
  const params = new URLSearchParams();
  if (searchQuery) params.set('search', searchQuery);
  if (currentSortField !== DEFAULT_SORT_FIELD) params.set('sort', currentSortField);
  if (currentSortOrder !== DEFAULT_SORT_ORDER) params.set('order_dir', currentSortOrder);
  if (currentContentType) params.set('content_type', currentContentType);
  if (currentViewType !== 'series') params.set('view_type', currentViewType);
  if (currentCollectionOnly) params.set('collection', 'true');
  if (currentPublishers.length) params.set('publisher_ids', currentPublishers.map(p => p.id).join(','));
  if (currentThemes.length) params.set('theme_ids', currentThemes.map(t => t.id).join(','));
  if (currentExcludedThemes.length) params.set('exclude_theme_ids', currentExcludedThemes.map(t => t.id).join(','));
  if (currentMagazines.length) params.set('magazine_ids', currentMagazines.map(m => m.id).join(','));
  if (currentLanguages.length) params.set('langs', currentLanguages.join(','));
  if (currentSources.length) params.set('sources', currentSources.join(','));
  if (currentExcludedSources.length) params.set('exclude_sources', currentExcludedSources.join(','));
  
  const page = paginator.getPage();
  if (page > 1) params.set('page', page);

  const queryString = params.toString();
  const newHash = `#${router.currentPath}${queryString ? '?' + queryString : ''}`;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
  }
}

export async function renderCatalog(main, query = {}) {
  searchQuery = query.search || '';
  currentContentType = query.content_type || query.type || '';
  currentViewType = query.view_type || (query.mode === 'issues' ? 'issues' : 'series');
  currentCollectionOnly = query.collection === 'true' || query.mode === 'collections';
  
  currentSortField = query.sort || DEFAULT_SORT_FIELD;
  currentSortOrder = query.order_dir || query.order || DEFAULT_SORT_ORDER;

  let filtersOpen = readStoredFiltersPanelState();

  const page = Number(query.page) || 1;
  paginator.setPage(page);
  paginator.setNextCursor(null);

  currentPublishers = [];
  const pubParam = query.publisher_ids || query.publisher;
  if (pubParam) {
    try {
      const ids = pubParam.split(',');
      currentPublishers = await Promise.all(ids.map(async (id) => {
        const res = await API.get(`/publishers/${id}`);
        const p = res.publisher || res;
        return { id: Number(id), name: p.name || p.title || '' };
      }));
    } catch (e) { console.error('Failed to load initial publishers', e); }
  }

  currentThemes = [];
  const themeParam = query.theme_ids || query.theme;
  if (themeParam) {
    try {
      const ids = themeParam.split(',');
      currentThemes = await Promise.all(ids.map(async (id) => {
        const res = await API.get(`/themes/${id}`);
        const tObj = res.theme || res;
        return { id: Number(id), name: tObj.ua_name || tObj.name || tObj.title || '', type: tObj.type };
      }));
    } catch (e) { console.error('Failed to load initial themes', e); }
  }

  currentExcludedThemes = [];
  if (query.exclude_theme_ids) {
    try {
      const ids = query.exclude_theme_ids.split(',');
      currentExcludedThemes = await Promise.all(ids.map(async (id) => {
        const res = await API.get(`/themes/${id}`);
        const tObj = res.theme || res;
        return { id: Number(id), name: tObj.ua_name || tObj.name || tObj.title || '', type: tObj.type };
      }));
    } catch (e) { console.error('Failed to load initial excluded themes', e); }
  }

  currentMagazines = [];
  const magParam = query.magazine_ids || query.magazine;
  if (magParam) {
    try {
      const ids = magParam.split(',');
      currentMagazines = await Promise.all(ids.map(async (id) => {
        const res = await API.get(`/volumes/${id}`);
        const vObj = res.volume || res;
        return { id: Number(id), name: vObj.name || vObj.title || '' };
      }));
      if (currentMagazines.length > 0) {
        currentContentType = 'manga';
      }
    } catch (e) { console.error('Failed to load initial magazines', e); }
  }

  const rawLangs = query.langs || query.lang;
  currentLanguages = rawLangs ? rawLangs.split(',') : [];

  const rawSources = query.sources || query.source;
  currentSources = rawSources ? rawSources.split(',') : [];
  currentExcludedSources = query.exclude_sources ? query.exclude_sources.split(',') : [];

  main.innerHTML = `
    <div class="container">
      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container"></div>

        <div class="catalog-primary-actions" aria-label="Основні фільтри каталогу">
          <div class="catalog-segmented" role="group" aria-label="Тип контенту">
            <button class="catalog-segment" type="button" data-view-type="series">${t('series')}</button>
            <button class="catalog-segment" type="button" data-view-type="issues">${t('releases')}</button>
          </div>
          <button class="catalog-filter-chip" type="button" id="collection-filter-btn" aria-pressed="false">
            ${currentContentType === 'manga' ? `${t('volumes')}` : `${t('collections')}`}
          </button>
        </div>
        <div class="catalog-actions-panel" id="catalog-actions-panel" aria-label="Фільтри каталогу" style="display: ${filtersOpen ? 'flex' : 'none'};"></div>
      </div>

      <div class="catalog-layout" id="catalog-layout">
        <main class="catalog-results" style="width: 100%;">
          <div class="comic-grid" id="catalog-grid">
            <div class="loader-container"><div class="loader"></div></div>
          </div>
          <div class="pagination-wrap" id="catalog-pagination"></div>
        </main>
      </div>
    </div>
  `;

  const catalogLayout = document.getElementById('catalog-layout');
  const viewTypeButtons = [...document.querySelectorAll('[data-view-type]')];
  const collectionBtn = document.getElementById('collection-filter-btn');
  const actionsPanel = document.getElementById('catalog-actions-panel');

  const sortOptions = getSortOptions();

  let placeholder = t('search_comics');
  if (currentContentType === 'manga') placeholder = t('search_manga');

  filterBar = mountFilterBar(main.querySelector('#catalog-filter-bar-container'), {
    resultsCount: 0,
    searchPlaceholder: placeholder,
    searchValue: searchQuery,
    sortValue: currentSortField,
    sortOptions: sortOptions,
    sortOrderValue: currentSortOrder,
    showFiltersBtn: true,
    filtersBtnActive: filtersOpen,
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
    },
    onFiltersBtnClick: () => {
      setFiltersPanelOpen(!filtersOpen);
    }
  });

  const reloadCatalog = () => {
    if (currentMagazines.length > 0) {
      currentContentType = 'manga';
      updateCatalogControls();
    }
    fetchAndRender();
  };

  const updateSortControl = () => {
    const selectedSort = sortOptions.find((option) => option.value === currentSortField) || sortOptions[0];
    const sortOrderTitles = getSortOrderTitles();
    const title = sortOrderTitles[currentSortField]?.[currentSortOrder] || `За ${currentSortOrder === 'asc' ? 'зростанням' : 'спаданням'}`;
    
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

  const setFiltersPanelOpen = (open, { persist = true } = {}) => {
    filtersOpen = open;
    if (actionsPanel) {
      actionsPanel.style.display = filtersOpen ? 'flex' : 'none';
    }

    if (filterBar) {
      filterBar.setFiltersBtnActive(filtersOpen);
    }
    if (persist) storeFiltersPanelState(filtersOpen);
  };

  const updateCatalogControls = () => {
    if (viewTypeButtons) {
      viewTypeButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.viewType === currentViewType);
      });
    }
    if (collectionBtn) {
      collectionBtn.classList.toggle('is-active', currentCollectionOnly);
      collectionBtn.setAttribute('aria-pressed', String(currentCollectionOnly));
    }
    
    let baseLabel = t('comics');
    if (currentContentType === 'manga') baseLabel = t('manga');
    
    document.title = `${currentContentType === 'manga' ? t('manga') : t('comics')} — Drawn Stories`;
  };

  const inlineFilters = mountCatalogFilters({
    container: actionsPanel,
    selectedPublishers: currentPublishers,
    selectedThemes: currentThemes,
    excludedThemes: currentExcludedThemes,
    selectedMagazines: currentMagazines,
    selectedLanguages: currentLanguages,
    selectedSources: currentSources,
    excludedSources: currentExcludedSources,
    onPublishersChange: (publishers) => {
      currentPublishers = publishers;
      paginator.reset();
      reloadCatalog();
    },
    onThemesChange: (includedThemes, nextExcludedThemes) => {
      currentThemes = includedThemes;
      currentExcludedThemes = nextExcludedThemes;
      paginator.reset();
      reloadCatalog();
    },
    onMagazinesChange: (magazines) => {
      currentMagazines = magazines;
      paginator.reset();
      reloadCatalog();
    },
    onLanguagesChange: (langs) => {
      currentLanguages = langs;
      paginator.reset();
      reloadCatalog();
    },
    onSourcesChange: (sources, excluded) => {
      currentSources = sources;
      currentExcludedSources = excluded;
      paginator.reset();
      reloadCatalog();
    },
    onClearAll: () => {
      currentPublishers = [];
      currentThemes = [];
      currentExcludedThemes = [];
      currentMagazines = [];
      currentLanguages = [];
      currentSources = [];
      currentExcludedSources = [];
      paginator.reset();
      reloadCatalog();
    }
  });

  viewTypeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentViewType = button.dataset.viewType;
      paginator.reset();
      updateCatalogControls();
      reloadCatalog();
    });
  });

  collectionBtn?.addEventListener('click', () => {
    currentCollectionOnly = !currentCollectionOnly;
    paginator.reset();
    updateCatalogControls();
    reloadCatalog();
  });

  if (filterBar) filterBar.setSearchValue(searchQuery);
  updateSortControl();
  updateCatalogControls();
  setFiltersPanelOpen(filtersOpen, { persist: false });
  
  if (currentPublishers.length || currentThemes.length || currentExcludedThemes.length || currentMagazines.length || currentSources.length || currentExcludedSources.length) {
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
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
    let data;
    data = await API.get('/catalog', {
      page: paginator.getPage(),
      limit: paginator.getPageSize(),
      cursor: paginator.getCursor() || undefined,
      search: searchQuery || undefined,
      sort: currentSortField,
      order_dir: currentSortOrder,
      content_type: currentContentType || undefined,
      view_type: currentViewType,
      collection: currentCollectionOnly ? 'true' : undefined,
      publisher_ids: currentPublishers.length ? currentPublishers.map((p) => p.id).join(',') : undefined,
      theme_ids: currentThemes.length ? currentThemes.map((t) => t.id).join(',') : undefined,
      exclude_theme_ids: currentExcludedThemes.length ? currentExcludedThemes.map((t) => t.id).join(',') : undefined,
      magazine_ids: currentMagazines.length ? currentMagazines.map((m) => m.id).join(',') : undefined,
      langs: currentLanguages.length ? currentLanguages.join(',') : undefined,
      sources: currentSources.length ? currentSources.join(',') : undefined,
      exclude_sources: currentExcludedSources.length ? currentExcludedSources.join(',') : undefined
    });

    if (filterBar) filterBar.updateCount(data.total);
    paginator.setNextCursor(data.next_cursor);

    // Render cards
    grid.innerHTML = '';
    const items = data.items || [];
    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>${t('nothing_found')}</h3>
          <p>${t('empty_search_tip')}</p>
        </div>`;
    } else {
      items.forEach(item => grid.appendChild(createComicCard(item)));
    }

    // Render pagination
    paginationWrap.innerHTML = '';
    const pages = data.pages || Math.ceil(data.total / paginator.getPageSize());
    if (pages > 1) {
      const nav = paginator.render(data.total, (cursor) => {
        fetchAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      paginationWrap.appendChild(nav);
    }
  } catch (err) {
    grid.innerHTML = `<div class="error-state">Помилка завантаження: ${err.message}</div>`;
  }
}
