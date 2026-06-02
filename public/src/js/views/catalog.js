import { API } from '../helpers/api.js';
import { THEME_GROUP_LABELS, mountCatalogFilters, themeIcon, themeLabel } from '../components/CatalogFilterPanel.js';
import { createComicCard } from '../components/ComicCard.js';
import { createPaginator } from '../components/Pagination.js';
import { escapeHtmlAttribute } from '../helpers/image.js';

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
const SORT_CONTROL_TEMPLATE = `
  <div class="filter-group" id="catalog-sort-controls">
    <select class="filter-select" id="sort-select">
      <button>
        <span class="select-label">${SORT_OPTIONS.find((option) => option.value === DEFAULT_SORT_FIELD).label}</span>
        <span class="select-chevron-v">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
        </span>
      </button>
      ${SORT_OPTIONS.map((option) => `
        <option value="${option.value}"${option.value === DEFAULT_SORT_FIELD ? ' selected' : ''}>
          <span>${option.label}</span>
        </option>
      `).join('')}
    </select>
    
    <button class="filter-btn-icon sort-order-btn" id="sort-order-btn" type="button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" id="sort-order-icon">
      </svg>
    </button>
  </div>
`;
let searchQuery = '';
let searchTimer = null;

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

/**
 * Renders the catalog page into the given container.
 * @param {HTMLElement} main
 */
export async function renderCatalog(main, query = {}) {
  paginator.reset();
  searchQuery = query.search || '';
  let sortField = query.sort || DEFAULT_SORT_FIELD;
  let sortOrder = query.order_dir || DEFAULT_SORT_ORDER;
  let contentType = query.content_type || 'comics';
  let collectionOnly = query.collection === 'true';
  let filtersOpen = readStoredFiltersPanelState();
  let selectedPublishers = [];
  let selectedThemes = [];
  let excludedThemes = [];
  let publisherSearchTimer = null;
  let themeSearchTimer = null;

  // Initial load of labels for IDs in query string if needed
  if (query.publisher_ids) {
    try {
      const ids = query.publisher_ids.split(',');
      const res = await API.get('/publishers', { ids: query.publisher_ids });
      selectedPublishers = res.items || [];
    } catch (e) { console.error('Failed to load initial publishers', e); }
  }

  if (query.theme_ids) {
    try {
      const ids = query.theme_ids.split(',');
      const res = await API.get('/themes', { ids: query.theme_ids });
      selectedThemes = res.items || [];
    } catch (e) { console.error('Failed to load initial themes', e); }
  }
  
  if (query.exclude_theme_ids) {
    try {
      const ids = query.exclude_theme_ids.split(',');
      const res = await API.get('/themes', { ids: query.exclude_theme_ids });
      excludedThemes = res.items || [];
    } catch (e) { console.error('Failed to load initial excluded themes', e); }
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
        <div class="filter-bar" id="catalog-filter-bar">
          <div class="filter-section results-section">
            <div class="results-label">Знайдено</div>
            <div class="results-value" id="results-count">0</div>
          </div>

          <div class="filter-section search-section">
            <div class="search-inner">
              <span class="search-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" placeholder="Пошук коміксів..." class="search-input-pill" id="catalog-search">
            </div>
          </div>

          <div class="filter-section filters-section">
            <div class="catalog-sort-slot" id="catalog-sort-quick-slot">${SORT_CONTROL_TEMPLATE}</div>

            <button class="filter-btn-icon btn-filters-panel" id="open-filters-btn" title="Фільтри" aria-controls="catalog-filter-sidebar" aria-expanded="false">
              ${FILTER_PANEL_OPEN_ICON}
            </button>
          </div>
        </div>

        <div class="catalog-primary-actions" aria-label="Основні фільтри каталогу">
          <div class="catalog-segmented" role="group" aria-label="Тип контенту">
            <button class="catalog-segment is-active" type="button" data-content-type="comics">Комікси</button>
            <button class="catalog-segment" type="button" data-content-type="manga">Манга</button>
          </div>
          <button class="catalog-filter-chip" type="button" id="collection-filter-btn" aria-pressed="false">Збірники</button>
        </div>
      </div>

      <div class="catalog-layout" id="catalog-layout">
        <div class="catalog-main-column">
          <div class="catalog-actions-panel" id="catalog-actions-panel" aria-label="Фільтри каталогу"></div>

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

  const searchInput = document.getElementById('catalog-search');
  const sortSelect = document.getElementById('sort-select');
  const orderBtn = document.getElementById('sort-order-btn');
  const orderIcon = document.getElementById('sort-order-icon');
  const sortLabel = sortSelect.querySelector('.select-label');
  const filtersToggleBtn = document.getElementById('open-filters-btn');
  const catalogLayout = document.getElementById('catalog-layout');
  const filterSidebar = document.getElementById('catalog-filter-sidebar');
  const sortControls = document.getElementById('catalog-sort-controls');
  const sortQuickSlot = document.getElementById('catalog-sort-quick-slot');
  const sortPanelSlot = document.getElementById('catalog-sort-panel-slot');
  const typeButtons = [...document.querySelectorAll('[data-content-type]')];
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

  const reloadCatalog = () => {
    fetchAndRender(sortField, sortOrder, contentType, collectionOnly, selectedPublishers, selectedThemes, excludedThemes);
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
    const selectedSort = SORT_OPTIONS.find((option) => option.value === sortField) || SORT_OPTIONS[0];
    const title = SORT_ORDER_TITLES[sortField]?.[sortOrder] || `За ${sortOrder === 'asc' ? 'зростанням' : 'спаданням'}`;
    sortSelect.value = selectedSort.value;
    sortSelect.title = selectedSort.label;
    if (sortLabel) sortLabel.textContent = selectedSort.label;
    orderIcon.innerHTML = SORT_ORDER_ICONS[sortOrder];
    orderBtn.title = title;
    orderBtn.setAttribute('aria-label', title);
  };

  const setFiltersPanelOpen = (open, { persist = true } = {}) => {
    filtersOpen = open;
    catalogLayout.classList.toggle('is-filters-open', filtersOpen);
    filterSidebar.hidden = !filtersOpen;
    filtersToggleBtn.classList.toggle('is-active', filtersOpen);
    filtersToggleBtn.setAttribute('aria-expanded', String(filtersOpen));
    filtersToggleBtn.innerHTML = filtersOpen ? FILTER_PANEL_CLOSE_ICON : FILTER_PANEL_OPEN_ICON;
    (filtersOpen ? sortPanelSlot : sortQuickSlot).appendChild(sortControls);
    if (persist) storeFiltersPanelState(filtersOpen);
  };

  const updateCatalogControls = () => {
    typeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.contentType === contentType);
    });
    collectionBtn.classList.toggle('is-active', collectionOnly);
    collectionBtn.setAttribute('aria-pressed', String(collectionOnly));
    breadcrumbCurrent.textContent = collectionOnly
      ? `${contentType === 'manga' ? 'Манга' : 'Комікси'} / Збірники`
      : contentType === 'manga' ? 'Манга' : 'Комікси';
  };

  const renderSelectedPublishers = () => {
    selectedPublisherList.innerHTML = selectedPublishers.length
      ? selectedPublishers.map((publisher) => `
          <button class="publisher-chip" type="button" data-remove-publisher="${publisher.id}" title="Прибрати видавництво">
            <span>${escapeHtmlAttribute(publisher.name)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        `).join('')
      : '<div class="publisher-filter-empty">Видавництва не вибрані</div>';
  };

  const renderSelectedThemes = () => {
    const themes = [
      ...selectedThemes.map((theme) => ({ ...theme, exclude: false })),
      ...excludedThemes.map((theme) => ({ ...theme, exclude: true })),
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
          const checked = selectedPublishers.some((item) => item.id === publisher.id);
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
      const data = await API.get('/publishers', {
        search: query || undefined,
        limit: 18,
      });
      renderPublishers(data.items || []);
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
        const included = selectedThemes.some((item) => item.id === id);
        const excluded = excludedThemes.some((item) => item.id === id);
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
      const data = await API.get('/themes', {
        search: query || undefined,
        limit: query ? 50 : 60,
      });
      renderThemes(data.items || []);
      positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    } catch {
      themeList.innerHTML = '<div class="publisher-filter-empty">Не вдалося завантажити</div>';
      positionSidebarDropdown(themeFilterDropdownWrap, themeList);
    }
  };

  const inlineFilters = mountCatalogFilters({
    container: actionsPanel,
    selectedPublishers,
    selectedThemes,
    excludedThemes,
    onPublishersChange: (publishers) => {
      selectedPublishers = publishers;
      paginator.reset();
      renderSelectedPublishers();
      loadPublishers(publisherSearchInput.value.trim());
      reloadCatalog();
    },
    onThemesChange: (includedThemes, nextExcludedThemes) => {
      selectedThemes = includedThemes;
      excludedThemes = nextExcludedThemes;
      paginator.reset();
      renderSelectedThemes();
      if (!themeList.hidden) loadThemes(themeSearchInput.value.trim());
      reloadCatalog();
    },
  });

  const selectSidebarTheme = (row, exclude) => {
    const id = Number(row.dataset.sidebarThemeId);
    const existing = [...selectedThemes, ...excludedThemes].find((theme) => theme.id === id);
    const nextTheme = {
      id,
      name: row.dataset.sidebarThemeName,
      type: row.dataset.sidebarThemeType,
    };

    if (exclude) {
      excludedThemes = existing && excludedThemes.some((theme) => theme.id === id)
        ? excludedThemes.filter((theme) => theme.id !== id)
        : [...excludedThemes.filter((theme) => theme.id !== id), nextTheme];
      selectedThemes = selectedThemes.filter((theme) => theme.id !== id);
    } else {
      selectedThemes = existing && selectedThemes.some((theme) => theme.id === id)
        ? selectedThemes.filter((theme) => theme.id !== id)
        : [...selectedThemes.filter((theme) => theme.id !== id), nextTheme];
      excludedThemes = excludedThemes.filter((theme) => theme.id !== id);
    }

    paginator.reset();
    renderSelectedThemes();
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
    themeList.hidden = false;
    loadThemes(themeSearchInput.value.trim());
    reloadCatalog();
  };

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    paginator.reset();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(reloadCatalog, 300);
  });

  sortSelect.addEventListener('change', (e) => {
    sortField = e.target.value;
    updateSortControl();
    paginator.reset();
    reloadCatalog();
  });

  orderBtn.addEventListener('click', () => {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    updateSortControl();
    paginator.reset();
    reloadCatalog();
  });

  filtersToggleBtn.addEventListener('click', () => {
    setFiltersPanelOpen(!filtersOpen);
  });

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      contentType = button.dataset.contentType;
      paginator.reset();
      updateCatalogControls();
      reloadCatalog();
    });
  });

  collectionBtn.addEventListener('click', () => {
    collectionOnly = !collectionOnly;
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
    const exists = selectedPublishers.some((publisher) => publisher.id === id);
    selectedPublishers = exists
      ? selectedPublishers.filter((publisher) => publisher.id !== id)
      : [...selectedPublishers, { id, name: option.dataset.publisherName }];

    paginator.reset();
    renderSelectedPublishers();
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
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

    selectedPublishers = selectedPublishers.filter((publisher) => publisher.id !== Number(removeBtn.dataset.removePublisher));
    paginator.reset();
    renderSelectedPublishers();
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
    loadPublishers(publisherSearchInput.value.trim());
    reloadCatalog();
  });

  selectedThemeList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-sidebar-theme]');
    const toggleBtn = e.target.closest('[data-toggle-sidebar-theme]');

    if (removeBtn) {
      selectedThemes = selectedThemes.filter((theme) => theme.id !== Number(removeBtn.dataset.removeSidebarTheme));
      excludedThemes = excludedThemes.filter((theme) => theme.id !== Number(removeBtn.dataset.removeSidebarTheme));
    }

    if (toggleBtn) {
      const id = Number(toggleBtn.dataset.toggleSidebarTheme);
      const includedTheme = selectedThemes.find((theme) => theme.id === id);
      const excludedTheme = excludedThemes.find((theme) => theme.id === id);
      if (includedTheme) {
        selectedThemes = selectedThemes.filter((theme) => theme.id !== id);
        excludedThemes = [...excludedThemes, includedTheme];
      } else if (excludedTheme) {
        excludedThemes = excludedThemes.filter((theme) => theme.id !== id);
        selectedThemes = [...selectedThemes, excludedTheme];
      }
    }

    if (!removeBtn && !toggleBtn) return;
    paginator.reset();
    renderSelectedThemes();
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
    if (!themeList.hidden) loadThemes(themeSearchInput.value.trim());
    reloadCatalog();
  });

  clearAllFiltersBtn.addEventListener('click', () => {
    collectionOnly = false;
    selectedPublishers = [];
    selectedThemes = [];
    excludedThemes = [];
    publisherSearchInput.value = '';
    themeSearchInput.value = '';
    paginator.reset();
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
    updateCatalogControls();
    renderSelectedPublishers();
    renderSelectedThemes();
    closePublisherDropdown();
    closeThemeDropdown();
    reloadCatalog();
  });

  searchInput.value = searchQuery;
  updateSortControl();
  updateCatalogControls();
  setFiltersPanelOpen(filtersOpen, { persist: false });
  renderSelectedPublishers();
  renderSelectedThemes();
  
  if (selectedPublishers.length || selectedThemes.length || excludedThemes.length) {
    inlineFilters?.setFilters(selectedPublishers, selectedThemes, excludedThemes);
  }
  
  reloadCatalog();
}

async function fetchAndRender(
  sort,
  order = 'asc',
  contentType = 'comics',
  collectionOnly = false,
  publishers = [],
  themes = [],
  excludedThemes = [],
) {
  const grid = document.getElementById('catalog-grid');
  const paginationWrap = document.getElementById('catalog-pagination');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

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
      search: searchQuery || undefined,
      sort: sort,
      order_dir: order,
      content_type: contentType,
      collection: collectionOnly ? 'true' : undefined,
      publisher_ids: publishers.length ? publishers.map((publisher) => publisher.id).join(',') : undefined,
      theme_ids: themes.length ? themes.map((theme) => theme.id).join(',') : undefined,
      exclude_theme_ids: excludedThemes.length ? excludedThemes.map((theme) => theme.id).join(',') : undefined
    });

    if (countEl) countEl.textContent = data.total.toLocaleString('uk-UA');

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
      const nav = paginator.render(data.total, () => {
        fetchAndRender(sort, order, contentType, collectionOnly, publishers, themes, excludedThemes);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      paginationWrap.appendChild(nav);
    }
  } catch (err) {
    grid.innerHTML = `<div class="error-state">Помилка завантаження: ${err.message}</div>`;
  }
}
