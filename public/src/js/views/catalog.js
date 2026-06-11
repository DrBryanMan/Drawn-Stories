import { API } from '../helpers/api.js';
import { THEME_GROUP_LABELS, mountCatalogFilters, themeIcon, themeLabel, loadAllThemes, loadAllPublishers } from '../components/CatalogFilterPanel.js';
import { createComicCard } from '../components/ComicCard.js';
import { createPaginator } from '../components/Pagination.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { router } from '../helpers/router.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

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
const SORT_OPTIONS = [
  { value: 'name', label: 'За назвою' },
  { value: 'recent', label: 'За датою додавання' },
  { value: 'date', label: 'За датою релізу' },
];
const SORT_ORDER_ICONS = {
  asc: '<path d="M5 6h6M5 12h10M5 18h14"/>',
  desc: '<path d="M5 6h14M5 12h10M5 18h6"/>',
};
const SORT_ORDER_TITLES = {
  name: {
    asc: 'За зростанням: від А до Я',
    desc: 'За спаданням: від Я до А',
  },
  recent: {
    asc: 'За зростанням: старіші додані спочатку',
    desc: 'За спаданням: новіші додані спочатку',
  },
  date: {
    asc: 'За зростанням: від старіших релізів до новіших',
    desc: 'За спаданням: від новіших релізів до старіших',
  },
};
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
  currentSortField = query.sort || DEFAULT_SORT_FIELD;
  currentSortOrder = query.order_dir || DEFAULT_SORT_ORDER;
  currentContentType = query.content_type || '';
  currentViewType = query.view_type || 'series';
  currentCollectionOnly = query.collection === 'true';
  currentLanguages = query.langs ? query.langs.split(',') : [];
  currentSources = query.sources ? query.sources.split(',') : [];
  currentExcludedSources = query.exclude_sources ? query.exclude_sources.split(',') : [];

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
        <nav class="breadcrumbs" aria-label="Навігація">
          <a href="#/">Drawn Stories</a>
          <span class="breadcrumb-separator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </span>
          <span id="catalog-breadcrumb-current">Комікси</span>
        </nav>
      </div>

      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container"></div>

        <div class="catalog-primary-actions" aria-label="Основні фільтри каталогу">
          <div class="catalog-segmented" role="group" aria-label="Тип контенту">
            <button class="catalog-segment" type="button" data-view-type="series">Серії</button>
            <button class="catalog-segment" type="button" data-view-type="issues">Випуски</button>
          </div>
          <button class="catalog-filter-chip" type="button" id="collection-filter-btn" aria-pressed="false">
            ${currentContentType === 'manga' ? 'Томи' : 'Збірники'}
          </button>
        </div>

        <div class="catalog-actions-panel" id="catalog-actions-panel" aria-label="Фільтри каталогу"></div>
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

            <section class="catalog-filter-block">
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

  filterBar = mountFilterBar(main.querySelector('#catalog-filter-bar-container'), {
    resultsCount: 0,
    searchPlaceholder: 'Пошук коміксів...',
    searchValue: searchQuery,
    sortValue: currentSortField,
    sortOptions: SORT_OPTIONS,
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
    const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSortField) || SORT_OPTIONS[0];
    const title = SORT_ORDER_TITLES[currentSortField]?.[currentSortOrder] || `За ${currentSortOrder === 'asc' ? 'зростанням' : 'спаданням'}`;
    
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
    viewTypeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.viewType === currentViewType);
    });
    collectionBtn.classList.toggle('is-active', currentCollectionOnly);
    collectionBtn.setAttribute('aria-pressed', String(currentCollectionOnly));
    
    const baseLabel = currentContentType === 'manga' ? 'Манга' : currentContentType === 'comics' ? 'Комікси' : 'Каталог';
    const viewLabel = currentViewType === 'series' ? 'Серії' : 'Випуски';
    breadcrumbCurrent.textContent = `${baseLabel} / ${viewLabel}${currentCollectionOnly ? (currentContentType === 'manga' ? ' / Томи' : ' / Збірники') : ''}`;
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
      publisherSearchInput.value = '';
      themeSearchInput.value = '';
      paginator.reset();
      updateCatalogControls();
      renderSelectedPublishers();
      renderSelectedThemes();
      renderSelectedMagazines();
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

  collectionBtn.addEventListener('click', () => {
    currentCollectionOnly = !currentCollectionOnly;
    paginator.reset();
    updateCatalogControls();
    reloadCatalog();
  });

  publisherSearchInput.addEventListener('input', (e) => {
    closeThemeDropdown();
    publisherList.hidden = false;
    positionSidebarDropdown(publisherFilterDropdownWrap, publisherList);
    clearTimeout(publisherSearchTimer);
    publisherSearchTimer = setTimeout(() => loadPublishers(e.target.value.trim()), 250);
  });

  publisherSearchInput.addEventListener('focus', () => {
    openPublisherDropdown();
  });

  publisherList.addEventListener('click', (e) => {
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

  themeSearchInput.addEventListener('input', (e) => {
    closePublisherDropdown();
    themeList.hidden = false;
    positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    clearTimeout(themeSearchTimer);
    themeSearchTimer = setTimeout(() => loadThemes(e.target.value.trim()), 250);
  });

  themeSearchInput.addEventListener('focus', () => {
    openThemeDropdown();
  });

  themeList.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = e.target.closest('[data-sidebar-theme-id]');
    if (!row) return;
    selectSidebarTheme(row, e.target.closest('[data-sidebar-theme-action]')?.dataset.sidebarThemeAction === 'exclude');
  });

  document.addEventListener('click', (e) => {
    if (!publisherFilterDropdownWrap.contains(e.target)) {
      closePublisherDropdown();
    }

    if (!themeFilterDropdownWrap.contains(e.target)) {
      closeThemeDropdown();
    }
  });

  selectedPublisherList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-publisher]');
    if (!removeBtn) return;

    currentPublishers = currentPublishers.filter((publisher) => publisher.id !== Number(removeBtn.dataset.removePublisher));
    paginator.reset();
    renderSelectedPublishers();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    loadPublishers(publisherSearchInput.value.trim());
    reloadCatalog();
  });

  selectedMagazineList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-magazine]');
    if (!removeBtn) return;

    currentMagazines = currentMagazines.filter((magazine) => magazine.id !== Number(removeBtn.dataset.removeMagazine));
    renderSelectedMagazines();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    reloadCatalog();
  });

  selectedThemeList.addEventListener('click', (e) => {
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

  clearAllFiltersBtn.addEventListener('click', () => {
    currentCollectionOnly = false;
    currentPublishers = [];
    currentThemes = [];
    currentExcludedThemes = [];
    currentMagazines = [];
    currentSources = [];
    currentExcludedSources = [];
    publisherSearchInput.value = '';
    themeSearchInput.value = '';
    paginator.reset();
    inlineFilters?.setFilters(currentPublishers, currentThemes, currentExcludedThemes, currentMagazines, currentLanguages, currentSources, currentExcludedSources);
    updateCatalogControls();
    renderSelectedPublishers();
    renderSelectedThemes();
    renderSelectedMagazines();
    closePublisherDropdown();
    closeThemeDropdown();
    reloadCatalog();
  });

  if (filterBar) filterBar.setSearchValue(searchQuery);
  updateSortControl();
  updateCatalogControls();
  setFiltersPanelOpen(filtersOpen, { persist: false });
  renderSelectedPublishers();
  renderSelectedThemes();
  renderSelectedMagazines();
  
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
    const data = await API.get('/catalog', {
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
    if (data.items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>Нічого не знайдено</h3>
          <p>Спробуйте змінити запит пошуку</p>
        </div>`;
    } else {
      data.items.forEach(item => grid.appendChild(createComicCard(item)));
    }

    // Render pagination
    paginationWrap.innerHTML = '';
    if (data.pages > 1) {
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
