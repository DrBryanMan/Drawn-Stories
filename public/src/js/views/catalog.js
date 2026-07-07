import { API } from '../helpers/api.js';
import { THEME_GROUP_LABELS, mountCatalogFilters, themeIcon, themeLabel, loadAllThemes, loadAllPublishers } from '../components/CatalogFilterPanel.js';
import { createComicCard } from '../components/ComicCard.js';
import { createPaginator } from '../components/Pagination.js';
import { escapeHtmlAttribute, comicVineImageUrl } from '../helpers/image.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { router } from '../helpers/router.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { formatDate } from '../helpers/lang.js';
import { t } from '../helpers/i18n.js';
import { getPublisherColor } from '../helpers/publisher.js';


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

const FORMAT_LABELS = {
  'weekly': 'Тижневий',
  'biweekly': 'Двотижневий',
  'monthly': 'Місячний',
  'bimonthly': 'Двомісячний',
  'quarterly': 'Квартальний',
  'semiannually': 'Піврічний',
  'digital': 'Цифровий',
  'irregular': 'Нерегулярний'
};

const DEMOGRAPHIC_LABELS = {
  'shonen': 'shonen',
  'seinen': 'seinen',
  'shojo': 'shojo',
  'josei': 'josei',
  'kodomo': 'kodomo'
};
const getSortOptions = () => [
  { value: 'name', label: t('sort_name') },
  { value: 'recent', label: t('sort_recent') },
  { value: 'date', label: t('sort_date') },
];
const SORT_ORDER_ICONS = {
  asc: '<path d="M5 6h6M5 12h10M5 18h14"/>',
  desc: '<path d="M5 6h14M5 12h10M5 18h6"/>',
};
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
  series: {
    asc: t('sort_order_series_asc') || 'За зростанням: від меншої кількості до більшої',
    desc: t('sort_order_series_desc') || 'За спаданням: від більшої кількості до меншої',
  },
});
const DEFAULT_SORT_FIELD_MAGAZINES = 'series';
const getMagazineSortOptions = () => [
  { value: 'series', label: t('sort_series') },
  { value: 'name', label: t('sort_name') },
  { value: 'recent', label: t('sort_recent') },
  { value: 'date', label: t('sort_date') },
];
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
/** Фільтр за манґа-журналом у каталозі розділів: { id, name } | null */
let currentChapterMagazine = null;
let currentFormats = [];
let currentDemographics = [];

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
  if (currentChapterMagazine) params.set('chapter_magazine_id', currentChapterMagazine.id);
  if (currentFormats.length) params.set('formats', currentFormats.join(','));
  if (currentDemographics.length) params.set('demographics', currentDemographics.join(','));
  
  const page = paginator.getPage();
  if (page > 1) params.set('page', page);

  const queryString = params.toString();
  const newHash = `#${router.currentPath}${queryString ? '?' + queryString : ''}`;
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

/**
 * Renders the catalog page into the given container.
 * @param {HTMLElement} main
 */
export async function renderCatalog(main, query = {}) {
  paginator.reset();
  if (query.page) {
    paginator.setPage(Number(query.page));
  }
  searchQuery = query.search || '';
  currentContentType = query.content_type || '';
  currentSortField = query.sort || (currentContentType === 'manga-chapters' ? 'created_at' : currentContentType === 'manga-magazines' ? DEFAULT_SORT_FIELD_MAGAZINES : DEFAULT_SORT_FIELD);
  currentSortOrder = query.order_dir || DEFAULT_SORT_ORDER;
  currentViewType = query.view_type || 'series';
  currentCollectionOnly = query.collection === 'true';
  currentLanguages = query.langs ? query.langs.split(',') : [];
  currentSources = query.sources ? query.sources.split(',') : [];
  currentExcludedSources = query.exclude_sources ? query.exclude_sources.split(',') : [];
  currentChapterMagazine = null;
  currentFormats = query.formats ? query.formats.split(',') : [];
  currentDemographics = query.demographics ? query.demographics.split(',') : [];

  const isChapters = currentContentType === 'manga-chapters';
  const isMagazines = currentContentType === 'manga-magazines';
  const showPrimaryActions = !isChapters && !isMagazines;

  let breadcrumbItems = [];
  if (isMagazines) {
    breadcrumbItems = [{ label: t('catalog'), href: '#/catalog' }, { label: t('manga_magazines'), id: 'catalog-breadcrumb-current' }];
  } else if (isChapters) {
    breadcrumbItems = [{ label: t('catalog'), href: '#/catalog' }, { label: t('manga_chapters'), id: 'catalog-breadcrumb-current' }];
  } else {
    let baseLabel = t('comics');
    if (currentContentType === 'manga') baseLabel = t('manga');
    breadcrumbItems = [{ label: baseLabel, id: 'catalog-breadcrumb-current' }];
  }

  let filtersOpen = readStoredFiltersPanelState();
  currentPublishers = [];
  currentThemes = [];
  currentExcludedThemes = [];
  let publisherSearchTimer = null;
  let themeSearchTimer = null;

  // Initial load of labels for IDs in query string if needed
  if (query.publisher_ids) {
    try {
      const res = await API.get('/publishers', { ids: query.publisher_ids });
      currentPublishers = res.items || [];
    } catch (e) { console.error('Failed to load initial publishers', e); }
  }

  if (query.theme_ids) {
    try {
      const res = await API.get('/themes', { ids: query.theme_ids });
      currentThemes = res.items || [];
    } catch (e) { console.error('Failed to load initial themes', e); }
  }
  
  if (query.exclude_theme_ids) {
    try {
      const res = await API.get('/themes', { ids: query.exclude_theme_ids });
      currentExcludedThemes = res.items || [];
    } catch (e) { console.error('Failed to load initial excluded themes', e); }
  }

  currentMagazines = [];
  if (query.magazine_ids) {
    try {
      const ids = query.magazine_ids.split(',');
      currentMagazines = await Promise.all(ids.map(async (id) => {
        const res = await API.get(`/volumes/${id}`);
        return { id: Number(id), name: res.volume.name };
      }));
      if (currentMagazines.length > 0) {
        currentContentType = 'manga';
      }
    } catch (e) { console.error('Failed to load initial magazines', e); }
  }

  main.innerHTML = `
    <div class="container">
      <div class="page-header">
        ${createBreadcrumbs(breadcrumbItems)}
      </div>

      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container"></div>

        ${showPrimaryActions ? `
        <div class="catalog-primary-actions" aria-label="Основні фільтри каталогу">
          <div class="catalog-segmented" role="group" aria-label="Тип контенту">
            <button class="catalog-segment" type="button" data-view-type="series">${t('series')}</button>
            <button class="catalog-segment" type="button" data-view-type="issues">${t('releases')}</button>
          </div>
          <button class="catalog-filter-chip" type="button" id="collection-filter-btn" aria-pressed="false">
            ${currentContentType === 'manga' ? `${t('volumes')}` : `${t('collections')}`}
          </button>
        </div>
        <div class="catalog-actions-panel" id="catalog-actions-panel" aria-label="Фільтри каталогу"></div>
        ` : ''}
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

        <aside class="catalog-filter-sidebar" id="catalog-filter-sidebar" aria-label="Додаткові фільтри" hidden>
          <div class="catalog-filter-card">
            <div class="catalog-filter-card__head">
              <div>
                <div class="catalog-filter-card__eyebrow">Фільтри</div>
                <h2>Параметри</h2>
              </div>
              <button class="catalog-clear-link" type="button" id="clear-all-filters-btn">Скинути</button>
            </div>

            <section class="catalog-filter-block">
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
                <span>Сортування</span>
              </div>
              <div class="catalog-sort-slot catalog-sort-slot--panel" id="catalog-sort-panel-slot"></div>
            </section>

            <section class="catalog-filter-block">
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg>
                <span>Видавництво</span>
              </div>
              <div class="sidebar-selected-list" id="publisher-selected-list"></div>
              <div class="sidebar-filter-dropdown-wrap" id="publisher-filter-dropdown-wrap">
                <div class="sidebar-filter-search">
                  <input type="search" id="publisher-filter-search" placeholder="Пошук видавництва...">
                </div>
                <div class="sidebar-filter-list publisher-filter-list" id="publisher-filter-list" hidden></div>
              </div>
            </section>

            <section class="catalog-filter-block" id="magazine-filter-block" hidden>
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M10 6h8v4h-8V6Z"/></svg>
                <span>Журнал</span>
              </div>
              <div class="sidebar-selected-list" id="magazine-selected-list"></div>
            </section>

            <section class="catalog-filter-block" id="format-filter-block" hidden>
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                <span>Формат</span>
              </div>
              <div class="sidebar-filter-list-checkboxes" id="format-filter-list"></div>
            </section>

            <section class="catalog-filter-block" id="demographic-filter-block" hidden>
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Аудиторія</span>
              </div>
              <div class="sidebar-filter-list-checkboxes" id="demographic-filter-list"></div>
            </section>

            <section class="catalog-filter-block" id="theme-filter-block">
              <div class="catalog-filter-block__title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z"/><path d="M7 7h.01"/></svg>
                <span>Теми</span>
              </div>
              <div class="sidebar-selected-list" id="theme-selected-list"></div>
              <div class="sidebar-filter-dropdown-wrap" id="theme-filter-dropdown-wrap">
                <div class="sidebar-filter-search">
                  <input type="search" id="theme-filter-search" placeholder="Пошук теми...">
                </div>
                <div class="sidebar-filter-list theme-filter-list catalog-filter-dropdown--themes" id="theme-filter-list" hidden></div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  `;

  const catalogLayout = document.getElementById('catalog-layout');
  const filterSidebar = document.getElementById('catalog-filter-sidebar');
  const sortPanelSlot = document.getElementById('catalog-sort-panel-slot');
  const viewTypeButtons = [...document.querySelectorAll('[data-view-type]')];
  const collectionBtn = document.getElementById('collection-filter-btn');
  const breadcrumbCurrent = document.getElementById('catalog-breadcrumb-current');
  const publisherFilterDropdownWrap = document.getElementById('publisher-filter-dropdown-wrap');
  const publisherSearchInput = document.getElementById('publisher-filter-search');
  const publisherList = document.getElementById('publisher-filter-list');
  const selectedPublisherList = document.getElementById('publisher-selected-list');
  const themeFilterDropdownWrap = document.getElementById('theme-filter-dropdown-wrap');
  const themeSearchInput = document.getElementById('theme-filter-search');
  const themeList = document.getElementById('theme-filter-list');
  const selectedThemeList = document.getElementById('theme-selected-list');
  const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
  const actionsPanel = document.getElementById('catalog-actions-panel');
  const magazineFilterBlock = document.getElementById('magazine-filter-block');
  const selectedMagazineList = document.getElementById('magazine-selected-list');

  // Chapter-specific: журнал-фільтр
  const chapterMagFilterWrap = document.getElementById('chapter-mag-filter-wrap');
  const chapterMagFilterBtn = document.getElementById('chapter-mag-filter-btn');
  const chapterMagFilterDropdown = document.getElementById('chapter-mag-filter-dropdown');
  const chapterMagFilterSearch = document.getElementById('chapter-mag-filter-search');
  const chapterMagFilterList = document.getElementById('chapter-mag-filter-list');
  const chapterMagFilterLabel = document.getElementById('chapter-mag-filter-label');

  // Restore chapter magazine filter from URL if present
  if (isChapters && query.chapter_magazine_id) {
    try {
      const res = await API.get(`/magazines/${query.chapter_magazine_id}`);
      if (res?.magazine) {
        currentChapterMagazine = { id: res.magazine.id, name: res.magazine.name };
      }
    } catch (e) { console.error('Failed to load initial chapter magazine filter', e); }
  }

  const sortOptions = isChapters
    ? [
        { value: 'created_at', label: t('sort_recent') },
        { value: 'release_date', label: t('sort_date') },
      ]
    : isMagazines
    ? getMagazineSortOptions()
    : getSortOptions();

  let placeholder = t('search_comics');
  if (currentContentType === 'manga') placeholder = t('search_manga');
  else if (isMagazines) placeholder = t('search_magazines');
  else if (isChapters) placeholder = t('search_chapters');

  const chapterMagFilterHtml = isChapters ? `
    <div class="chapter-mag-filter" id="chapter-mag-filter-wrap">
      <button class="chapter-mag-filter__btn ${currentChapterMagazine ? 'is-filtered' : ''}" type="button" id="chapter-mag-filter-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M10 6h8v4h-8V6Z"/></svg>
        <span id="chapter-mag-filter-label">${escapeHtmlAttribute(currentChapterMagazine?.name || t('all_magazines'))}</span>
        <svg class="chapter-mag-filter__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="chapter-mag-filter__dropdown" id="chapter-mag-filter-dropdown">
        <div class="chapter-mag-filter__search-wrap">
          <input type="search" class="chapter-mag-filter__search" id="chapter-mag-filter-search" placeholder="Пошук журналу...">
        </div>
        <div class="chapter-mag-filter__list" id="chapter-mag-filter-list"></div>
      </div>
    </div>
  ` : '';

  filterBar = mountFilterBar(main.querySelector('#catalog-filter-bar-container'), {
    extraMiddleHtml: chapterMagFilterHtml,
    resultsCount: 0,
    searchPlaceholder: placeholder,
    searchValue: searchQuery,
    sortValue: currentSortField,
    sortOptions: sortOptions,
    sortOrderValue: currentSortOrder,
    showFiltersBtn: showPrimaryActions || isMagazines,
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

  const positionSidebarDropdown = (wrap, list) => {
    if (list.hidden) return;
    const rect = wrap.getBoundingClientRect();
    const dropdownHeight = Math.min(list.scrollHeight || 320, 320);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    const availableSpace = openUp ? spaceAbove : spaceBelow;
    list.style.setProperty('--sidebar-dropdown-max-height', `${Math.max(96, Math.min(320, availableSpace))}px`);
    wrap.classList.toggle('is-open-up', openUp);
  };

  const openPublisherDropdown = (query = publisherSearchInput.value.trim()) => {
    closeThemeDropdown();
    publisherList.hidden = false;
    positionSidebarDropdown(publisherFilterDropdownWrap, publisherList);
    loadPublishers(query);
  };

  const closePublisherDropdown = () => {
    publisherList.hidden = true;
    publisherFilterDropdownWrap.classList.remove('is-open-up');
  };

  const openThemeDropdown = (query = themeSearchInput.value.trim()) => {
    closePublisherDropdown();
    themeList.hidden = false;
    positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    loadThemes(query);
  };

  const closeThemeDropdown = () => {
    themeList.hidden = true;
    themeFilterDropdownWrap.classList.remove('is-open-up');
  };

  const updateSortControl = () => {
    const selectedSort = sortOptions.find((option) => option.value === currentSortField) || sortOptions[0];
    const sortOrderTitles = isChapters ? {
      created_at: {
        asc: t('sort_order_recent_asc') || 'За зростанням: старіші додані спочатку',
        desc: t('sort_order_recent_desc') || 'За спаданням: новіші додані спочатку',
      },
      release_date: {
        asc: t('sort_order_date_asc') || 'За зростанням: від старіших релізів до новіших',
        desc: t('sort_order_date_desc') || 'За спаданням: від новіших релізів до старіших',
      }
    } : getSortOrderTitles();
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
    if (orderIcon) orderIcon.innerHTML = SORT_ORDER_ICONS[currentSortOrder];
    if (orderBtn) {
      orderBtn.title = title;
      orderBtn.setAttribute('aria-label', title);
    }
  };

  const setFiltersPanelOpen = (open, { persist = true } = {}) => {
    if (isChapters) {
      open = false;
      persist = false;
    }
    filtersOpen = open;
    catalogLayout.classList.toggle('is-filters-open', filtersOpen);
    filterSidebar.hidden = !filtersOpen;
    
    if (actionsPanel) {
      actionsPanel.style.display = filtersOpen ? 'none' : '';
    }

    if (filterBar) {
      filterBar.setFiltersBtnActive(filtersOpen);
    }

    const filtersToggleBtn = document.getElementById('open-filters-btn');
    if (filtersToggleBtn) {
      filtersToggleBtn.innerHTML = filtersOpen ? FILTER_PANEL_CLOSE_ICON : FILTER_PANEL_OPEN_ICON;
    }

    const sortControls = document.getElementById('catalog-sort-controls');
    const sortQuickSlot = document.getElementById('catalog-sort-quick-slot');
    if (sortControls) {
      const slot = filtersOpen ? sortPanelSlot : sortQuickSlot;
      if (slot) slot.appendChild(sortControls);
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
    
    const themeFilterBlock = document.getElementById('theme-filter-block');
    const formatFilterBlock = document.getElementById('format-filter-block');
    const demographicFilterBlock = document.getElementById('demographic-filter-block');

    if (isMagazines) {
      document.title = `${t('manga_magazines')} — Drawn Stories`;
      breadcrumbCurrent.textContent = t('manga_magazines');
      if (themeFilterBlock) themeFilterBlock.hidden = true;
      if (formatFilterBlock) formatFilterBlock.hidden = false;
      if (demographicFilterBlock) demographicFilterBlock.hidden = false;
    } else if (isChapters) {
      document.title = `${t('manga_chapters')} — Drawn Stories`;
      breadcrumbCurrent.textContent = t('manga_chapters');
      if (themeFilterBlock) themeFilterBlock.hidden = true;
      if (formatFilterBlock) formatFilterBlock.hidden = true;
      if (demographicFilterBlock) demographicFilterBlock.hidden = true;
    } else {
      document.title = `${currentContentType === 'manga' ? t('manga') : t('comics')} — Drawn Stories`;
      const viewLabel = currentViewType === 'series' ? t('series') : t('releases');
      breadcrumbCurrent.textContent = `${baseLabel} / ${viewLabel}${currentCollectionOnly ? (currentContentType === 'manga' ? ` / ${t('volumes')}` : ` / ${t('collections')}`) : ''}`;
      if (themeFilterBlock) themeFilterBlock.hidden = false;
      if (formatFilterBlock) formatFilterBlock.hidden = true;
      if (demographicFilterBlock) demographicFilterBlock.hidden = true;
    }
  };

  const renderSelectedPublishers = () => {
    selectedPublisherList.innerHTML = currentPublishers.length
      ? currentPublishers.map((publisher) => `
          <button class="publisher-chip" type="button" data-remove-publisher="${publisher.id}" title="Прибрати видавництво">
            <span>${escapeHtmlAttribute(publisher.name)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        `).join('')
      : '<div class="publisher-filter-empty">Видавництва не вибрані</div>';
  };

  const renderSelectedMagazines = () => {
    if (!selectedMagazineList) return;
    selectedMagazineList.innerHTML = currentMagazines.length
      ? currentMagazines.map((magazine) => `
          <button class="publisher-chip" type="button" data-remove-magazine="${magazine.id}" title="Прибрати журнал">
            <span>${escapeHtmlAttribute(magazine.name)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        `).join('')
      : '';
    if (magazineFilterBlock) {
      magazineFilterBlock.hidden = currentMagazines.length === 0;
    }
  };

  const renderSelectedThemes = () => {
    const themes = [
      ...currentThemes.map((theme) => ({ ...theme, exclude: false })),
      ...currentExcludedThemes.map((theme) => ({ ...theme, exclude: true })),
    ];
    selectedThemeList.innerHTML = themes.length
      ? themes.map((theme) => `
          <span class="publisher-chip theme-sidebar-chip${theme.exclude ? ' is-excluded' : ''}">
            ${themeIcon(theme.type)}
            <span>${escapeHtmlAttribute(theme.name)}</span>
            <button type="button" data-toggle-sidebar-theme="${theme.id}" title="Перемкнути включення/виключення">⇄</button>
            <button type="button" data-remove-sidebar-theme="${theme.id}" title="Прибрати тему">×</button>
          </span>
        `).join('')
      : '<div class="publisher-filter-empty">Теми не вибрані</div>';
  };

  const renderPublishers = (publishers) => {
    publisherList.innerHTML = publishers.length
      ? publishers.map((publisher) => {
          const checked = currentPublishers.some((item) => item.id === publisher.id);
          const name = escapeHtmlAttribute(publisher.name);
          return `
            <button class="publisher-filter-option${checked ? ' is-selected' : ''}" type="button" data-publisher-id="${publisher.id}" data-publisher-name="${name}">
              <span class="publisher-filter-check"></span>
              <span class="publisher-filter-name">${name}</span>
              <span class="publisher-filter-count">${publisher.volume_count?.toLocaleString('uk-UA') ?? 0}</span>
            </button>
          `;
        }).join('')
      : '<div class="publisher-filter-empty">Нічого не знайдено</div>';
  };

  const loadPublishers = async (query = '') => {
    publisherList.innerHTML = '<div class="publisher-filter-empty">Завантаження...</div>';
    try {
      const allPubs = await loadAllPublishers();
      let items = [];
      if (!query) {
        items = allPubs.slice(0, 18);
      } else {
        const fuse = new Fuse(allPubs, { keys: ['name'], threshold: 0.35, ignoreLocation: true });
        items = fuse.search(query).map(r => r.item).slice(0, 18);
      }
      renderPublishers(items);
      positionSidebarDropdown(publisherFilterDropdownWrap, publisherList);
    } catch {
      publisherList.innerHTML = '<div class="publisher-filter-empty">Не вдалося завантажити</div>';
      positionSidebarDropdown(publisherFilterDropdownWrap, publisherList);
    }
  };

  const renderThemes = (themes) => {
    const groups = { type: [], genre: [], theme: [] };
    themes.forEach((theme) => {
      const group = groups[theme.type] ? theme.type : 'theme';
      groups[group].push(theme);
    });

    let html = '';
    Object.entries(groups).forEach(([group, items]) => {
      if (!items.length) return;
      html += `<div class="catalog-filter-dropdown__group">${themeIcon(group)}<span>${THEME_GROUP_LABELS[group]}</span></div>`;
      html += items.map((theme) => {
        const id = Number(theme.id);
        const included = currentThemes.some((item) => item.id === id);
        const excluded = currentExcludedThemes.some((item) => item.id === id);
        const name = themeLabel(theme);
        return `
          <div class="catalog-filter-dropdown__item catalog-filter-dropdown__item--theme${included ? ' is-included' : ''}${excluded ? ' is-excluded' : ''}" data-sidebar-theme-id="${id}" data-sidebar-theme-name="${escapeHtmlAttribute(name)}" data-sidebar-theme-type="${theme.type || 'theme'}">
            <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(name)}</span>
            <span class="catalog-filter-dropdown__actions">
              ${included ? '<span class="catalog-filter-state catalog-filter-state--include"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' : ''}
              ${excluded ? '<span class="catalog-filter-state catalog-filter-state--exclude">−</span>' : ''}
              <button type="button" data-sidebar-theme-action="include" title="Включити">＋</button>
              <button type="button" data-sidebar-theme-action="exclude" title="Виключити">−</button>
            </span>
          </div>
        `;
      }).join('');
    });

    themeList.innerHTML = html || '<div class="publisher-filter-empty">Нічого не знайдено</div>';
  };

  const loadThemes = async (query = '') => {
    themeList.innerHTML = '<div class="publisher-filter-empty">Завантаження...</div>';
    try {
      const allTh = await loadAllThemes();
      let items = [];
      if (!query) {
        items = allTh;
      } else {
        const fuse = new Fuse(allTh, { keys: ['name', 'ua_name'], threshold: 0.35, ignoreLocation: true });
        items = fuse.search(query).map(r => r.item);
      }
      renderThemes(items);
      positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    } catch {
      themeList.innerHTML = '<div class="publisher-filter-empty">Не вдалося завантажити</div>';
      positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    }
  };

  const renderFormatFilters = () => {
    const listEl = document.getElementById('format-filter-list');
    if (!listEl) return;
    listEl.innerHTML = Object.entries(FORMAT_LABELS).map(([value, label]) => {
      const checked = currentFormats.includes(value) ? 'checked' : '';
      return `
        <label class="filter-checkbox-label">
          <input type="checkbox" data-format-value="${value}" ${checked}>
          <span>${label}</span>
        </label>
      `;
    }).join('');
  };

  const renderDemographicFilters = () => {
    const listEl = document.getElementById('demographic-filter-list');
    if (!listEl) return;
    listEl.innerHTML = Object.entries(DEMOGRAPHIC_LABELS).map(([value, label]) => {
      const checked = currentDemographics.includes(value) ? 'checked' : '';
      return `
        <label class="filter-checkbox-label">
          <input type="checkbox" data-demo-value="${value}" ${checked}>
          <span>${label}</span>
        </label>
      `;
    }).join('');
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
      renderSelectedPublishers();
      loadPublishers(publisherSearchInput.value.trim());
      reloadCatalog();
    },
    onThemesChange: (includedThemes, nextExcludedThemes) => {
      currentThemes = includedThemes;
      currentExcludedThemes = nextExcludedThemes;
      paginator.reset();
      renderSelectedThemes();
      if (!themeList.hidden) loadThemes(themeSearchInput.value.trim());
      reloadCatalog();
    },
    onMagazinesChange: (magazines) => {
      currentMagazines = magazines;
      paginator.reset();
      renderSelectedMagazines();
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
      currentFormats = [];
      currentDemographics = [];
      publisherSearchInput.value = '';
      themeSearchInput.value = '';
      paginator.reset();
      updateCatalogControls();
      renderSelectedPublishers();
      renderSelectedThemes();
      renderSelectedMagazines();
      renderFormatFilters();
      renderDemographicFilters();
      reloadCatalog();
    }
  });

  const selectSidebarTheme = (row, exclude) => {
    const id = Number(row.dataset.sidebarThemeId);
    const existing = [...currentThemes, ...currentExcludedThemes].find((theme) => theme.id === id);
    const nextTheme = {
      id,
      name: row.dataset.sidebarThemeName,
      type: row.dataset.sidebarThemeType,
    };

    if (exclude) {
      currentExcludedThemes = existing && currentExcludedThemes.some((theme) => theme.id === id)
        ? currentExcludedThemes.filter((theme) => theme.id !== id)
        : [...currentExcludedThemes.filter((theme) => theme.id !== id), nextTheme];
      currentThemes = currentThemes.filter((theme) => theme.id !== id);
    } else {
      currentThemes = existing && currentThemes.some((theme) => theme.id === id)
        ? currentThemes.filter((theme) => theme.id !== id)
        : [...currentThemes.filter((theme) => theme.id !== id), nextTheme];
      currentExcludedThemes = currentExcludedThemes.filter((theme) => theme.id !== id);
    }

    paginator.reset();
    renderSelectedThemes();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    themeList.hidden = false;
    loadThemes(themeSearchInput.value.trim());
    reloadCatalog();
  };

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

  publisherSearchInput?.addEventListener('input', (e) => {
    closeThemeDropdown();
    publisherList.hidden = false;
    positionSidebarDropdown(publisherFilterDropdownWrap, publisherList);
    clearTimeout(publisherSearchTimer);
    publisherSearchTimer = setTimeout(() => loadPublishers(e.target.value.trim()), 250);
  });

  publisherSearchInput?.addEventListener('focus', () => {
    openPublisherDropdown();
  });

  publisherList?.addEventListener('click', (e) => {
    const option = e.target.closest('[data-publisher-id]');
    if (!option) return;

    const id = Number(option.dataset.publisherId);
    const exists = currentPublishers.some((publisher) => publisher.id === id);
    currentPublishers = exists
      ? currentPublishers.filter((publisher) => publisher.id !== id)
      : [...currentPublishers, { id, name: option.dataset.publisherName }];

    paginator.reset();
    renderSelectedPublishers();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    loadPublishers(publisherSearchInput.value.trim());
    reloadCatalog();
  });

  themeSearchInput?.addEventListener('input', (e) => {
    closePublisherDropdown();
    themeList.hidden = false;
    positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    clearTimeout(themeSearchTimer);
    themeSearchTimer = setTimeout(() => loadThemes(e.target.value.trim()), 250);
  });

  themeSearchInput?.addEventListener('focus', () => {
    openThemeDropdown();
  });

  themeList?.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = e.target.closest('[data-sidebar-theme-id]');
    if (!row) return;
    selectSidebarTheme(row, e.target.closest('[data-sidebar-theme-action]')?.dataset.sidebarThemeAction === 'exclude');
  });

  if (publisherFilterDropdownWrap && themeFilterDropdownWrap) {
    document.addEventListener('click', (e) => {
      if (!publisherFilterDropdownWrap.contains(e.target)) {
        closePublisherDropdown();
      }
      if (!themeFilterDropdownWrap.contains(e.target)) {
        closeThemeDropdown();
      }
    });
  }

  selectedPublisherList?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-publisher]');
    if (!removeBtn) return;

    currentPublishers = currentPublishers.filter((publisher) => publisher.id !== Number(removeBtn.dataset.removePublisher));
    paginator.reset();
    renderSelectedPublishers();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    loadPublishers(publisherSearchInput.value.trim());
    reloadCatalog();
  });

  selectedMagazineList?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-magazine]');
    if (!removeBtn) return;

    currentMagazines = currentMagazines.filter((magazine) => magazine.id !== Number(removeBtn.dataset.removeMagazine));
    renderSelectedMagazines();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    reloadCatalog();
  });

  selectedThemeList?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-sidebar-theme]');
    const toggleBtn = e.target.closest('[data-toggle-sidebar-theme]');

    if (removeBtn) {
      currentThemes = currentThemes.filter((theme) => theme.id !== Number(removeBtn.dataset.removeSidebarTheme));
      currentExcludedThemes = currentExcludedThemes.filter((theme) => theme.id !== Number(removeBtn.dataset.removeSidebarTheme));
    }

    if (toggleBtn) {
      const id = Number(toggleBtn.dataset.toggleSidebarTheme);
      const includedTheme = currentThemes.find((theme) => theme.id === id);
      const excludedTheme = currentExcludedThemes.find((theme) => theme.id === id);
      if (includedTheme) {
        currentThemes = currentThemes.filter((theme) => theme.id !== id);
        currentExcludedThemes = [...currentExcludedThemes, includedTheme];
      } else if (excludedTheme) {
        currentExcludedThemes = currentExcludedThemes.filter((theme) => theme.id !== id);
        currentThemes = [...currentThemes, excludedTheme];
      }
    }

    if (!removeBtn && !toggleBtn) return;
    paginator.reset();
    renderSelectedThemes();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    if (!themeList.hidden) loadThemes(themeSearchInput.value.trim());
    reloadCatalog();
  });

  clearAllFiltersBtn?.addEventListener('click', () => {
    currentCollectionOnly = false;
    currentPublishers = [];
    currentThemes = [];
    currentExcludedThemes = [];
    currentMagazines = [];
    currentSources = [];
    currentExcludedSources = [];
    currentFormats = [];
    currentDemographics = [];
    if (publisherSearchInput) publisherSearchInput.value = '';
    if (themeSearchInput) themeSearchInput.value = '';
    paginator.reset();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    updateCatalogControls();
    renderSelectedPublishers();
    renderSelectedThemes();
    renderSelectedMagazines();
    renderFormatFilters();
    renderDemographicFilters();
    closePublisherDropdown();
    closeThemeDropdown();
    reloadCatalog();
  });

  // ── Глава-журнал фільтр ────────────────────────────────────────────────────
  // We query elements again inside block in case DOM rebuilt
  const chapterMagFilterBtnEl = document.getElementById('chapter-mag-filter-btn');
  const chapterMagFilterDropdownEl = document.getElementById('chapter-mag-filter-dropdown');
  const chapterMagFilterSearchEl = document.getElementById('chapter-mag-filter-search');
  const chapterMagFilterListEl = document.getElementById('chapter-mag-filter-list');
  const chapterMagFilterLabelEl = document.getElementById('chapter-mag-filter-label');
  const chapterMagFilterWrapEl = document.getElementById('chapter-mag-filter-wrap');

  if (isChapters && chapterMagFilterBtnEl) {
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

  const formatList = document.getElementById('format-filter-list');
  formatList?.addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-format-value]');
    if (!checkbox) return;
    const value = checkbox.dataset.formatValue;
    if (checkbox.checked) {
      if (!currentFormats.includes(value)) currentFormats.push(value);
    } else {
      currentFormats = currentFormats.filter(v => v !== value);
    }
    paginator.reset();
    reloadCatalog();
  });

  const demoList = document.getElementById('demographic-filter-list');
  demoList?.addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-demo-value]');
    if (!checkbox) return;
    const value = checkbox.dataset.demoValue;
    if (checkbox.checked) {
      if (!currentDemographics.includes(value)) currentDemographics.push(value);
    } else {
      currentDemographics = currentDemographics.filter(v => v !== value);
    }
    paginator.reset();
    reloadCatalog();
  });

  if (filterBar) filterBar.setSearchValue(searchQuery);
  updateSortControl();
  updateCatalogControls();
  setFiltersPanelOpen(filtersOpen, { persist: false });
  if (showPrimaryActions) {
    renderSelectedPublishers();
    renderSelectedThemes();
    renderSelectedMagazines();
    
    if (currentPublishers.length || currentThemes.length || currentExcludedThemes.length || currentMagazines.length || currentSources.length || currentExcludedSources.length) {
      inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    }
  } else if (isMagazines) {
    renderSelectedPublishers();
    renderFormatFilters();
    renderDemographicFilters();
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

  const isChapters = currentContentType === 'manga-chapters';
  const isMagazines = currentContentType === 'manga-magazines';

  try {
    let data;
    if (isMagazines) {
      data = await API.get('/magazines', {
        search: searchQuery || undefined,
        limit: paginator.getPageSize(),
        offset: (paginator.getPage() - 1) * paginator.getPageSize(),
        sort: currentSortField,
        order_dir: currentSortOrder,
        publisher_ids: currentPublishers.length ? currentPublishers.map((p) => p.id).join(',') : undefined,
        formats: currentFormats.length ? currentFormats.join(',') : undefined,
        demographics: currentDemographics.length ? currentDemographics.join(',') : undefined,
      });
    } else if (isChapters) {
      data = await API.get('/manga-chapters', {
        search: searchQuery || undefined,
        limit: paginator.getPageSize(),
        offset: (paginator.getPage() - 1) * paginator.getPageSize(),
        sort_by: currentSortField,
        order: currentSortOrder,
        magazine_id: currentChapterMagazine?.id || undefined
      });
    } else {
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
    }

    if (filterBar) filterBar.updateCount(data.total);
    if (!isMagazines && !isChapters) {
      paginator.setNextCursor(data.next_cursor);
    }

    // Render cards
    grid.innerHTML = '';
    grid.classList.toggle('comic-grid--magazines', isMagazines);
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
      if (isMagazines) {
        grid.innerHTML = items.map(mag => {
          const pubColor = getPublisherColor(mag.publisher_name);
          const publisherName = escapeHtmlAttribute(mag.publisher_name || '').toUpperCase();
          const title = escapeHtmlAttribute(mag.name || 'Без назви');
          const nativeName = mag.name_native ? `<div class="magazine-card-native">${escapeHtmlAttribute(mag.name_native)}</div>` : '';
          const labelText = escapeHtmlAttribute(mag.label || 'MAG');
          const formatText = FORMAT_LABELS[mag.format] || mag.format || 'Нерегулярний';
          const demographicText = DEMOGRAPHIC_LABELS[mag.demographic] || mag.demographic || 'Інше';
          
          const seriesText = `${mag.series_count || 0} <span>(${mag.series_ongoing_count || 0})</span>`;
          const issuesCount = mag.issues_count || 0;
          const startYear = mag.start_year || '—';
          
          const popularList = mag.popular_series || [];
          const popularHtml = popularList.length > 0 
            ? `
              <div class="magazine-card-series-section">
                <div class="magazine-card-series-title">Відомі серії</div>
                <div class="magazine-card-series-list">
                  ${popularList.map(ser => {
                    const serCover = comicVineImageUrl(ser.cover_img || ser.cv_img || ser.hikka_img);
                    const serTitle = escapeHtmlAttribute(ser.name_uk || ser.name || 'Без назви');
                    const score = ser.mal_score ? Number(ser.mal_score).toFixed(2) : '—';
                    return `
                      <a href="#/volumes/${ser.id}" class="magazine-card-series-item" title="${serTitle}">
                        ${serCover 
                          ? `<img class="magazine-card-series-cover" src="${escapeHtmlAttribute(serCover)}" alt="${serTitle}" loading="lazy">`
                          : `<div class="magazine-card-series-cover-placeholder"></div>`}
                        <div class="magazine-card-series-score">${score}</div>
                      </a>
                    `;
                  }).join('')}
                </div>
              </div>
            `
            : '';

          return `
            <div class="magazine-card" style="border-top: 4px solid ${pubColor};">
              <a href="#/magazines/${mag.id}" class="magazine-card-link-overlay"></a>
              <div class="magazine-card-header">
                <span class="magazine-card-label" style="border: 1px solid color-mix(in srgb, ${pubColor} 20%, var(--border-s)); background: color-mix(in srgb, ${pubColor} 6%, #ffffff); color: ${pubColor};">
                  ${labelText}
                </span>
                <span class="magazine-card-publisher" style="color: ${pubColor};">${publisherName}</span>
              </div>
              <div class="magazine-card-content">
                <div class="magazine-card-title-group">
                  <h3 class="magazine-card-title">${title}</h3>
                  ${nativeName}
                </div>
                <div class="magazine-card-badges">
                  <span class="magazine-card-badge">${demographicText}</span>
                  <span class="magazine-card-badge">${formatText}</span>
                </div>
                <div class="magazine-card-stats">
                  <div class="magazine-card-stat">
                    <div class="magazine-card-stat-value">${seriesText}</div>
                    <div class="magazine-card-stat-label">Серій</div>
                  </div>
                  <div class="magazine-card-stat">
                    <div class="magazine-card-stat-value">0</div>
                    <div class="magazine-card-stat-label">Ваншотів</div>
                  </div>
                  <div class="magazine-card-stat">
                    <div class="magazine-card-stat-value">${issuesCount}</div>
                    <div class="magazine-card-stat-label">Випусків</div>
                  </div>
                  <div class="magazine-card-stat">
                    <div class="magazine-card-stat-value">${startYear}</div>
                    <div class="magazine-card-stat-label">Рік</div>
                  </div>
                </div>
                ${popularHtml}
              </div>
            </div>
          `;
        }).join('');
      } else if (isChapters) {
        grid.innerHTML = items.map(ch => {
          const cover = comicVineImageUrl(ch.image || ch.volume_cv_img || ch.volume_hikka_img || ch.volume_cover_img);
          const displayTitle = ch.name_uk || ch.name_en || ch.name || t('chapter_badge_label').replace('{num}', ch.chapter_number);
          const title = escapeHtmlAttribute(displayTitle);
          
          const chNum = ch.chapter_number ? `<span class="comic-type-badge" style="left: auto; right: 8px; background: rgba(108, 92, 231, 0.85); font-weight: 600;">${t('chapter_badge_label').replace('{num}', escapeHtmlAttribute(ch.chapter_number))}</span>` : '';
          const volumeName = escapeHtmlAttribute(ch.volume_name_uk || ch.volume_name || t('no_title'));
          const date = ch.release_date ? `<div class="comic-meta" style="font-size: 0.8em; color: var(--text-muted);">${formatDate(ch.release_date)}</div>` : '';

          return `
            <a href="#/manga-chapters/${ch.id}" class="comic-card">
              <div class="comic-cover-wrap" style="position: relative;">
                ${cover ? `<img class="comic-cover" src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="comic-cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
                ${chNum}
              </div>
              <div class="comic-body">
                <h4 class="comic-title" title="${title}">${title}</h4>
                <div class="comic-meta" style="font-size: 0.8em; color: var(--accent); font-weight: 500; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${volumeName}
                </div>
                ${date}
              </div>
            </a>
          `;
        }).join('');
      } else {
        items.forEach(item => grid.appendChild(createComicCard(item)));
      }
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
