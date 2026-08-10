/**
 * wanted.js — основна логіка сторінки /wanted.
 * Відображає контент з відсутніми даними по розділах.
 */
import { API } from '../helpers/api.js';
import { createWantedCard } from './wantedCard.js';
import { createPaginator } from '../components/Pagination.js';
import { icon } from '../helpers/icons.js';
import { openTerminalLogModal } from '../components/ScrapeProgressModal.js';

// ── Sections config ───────────────────────────────────────
const SECTIONS = [
  { key: 'volumes',     label: 'Томи',        iconName: 'volumes' },
  { key: 'collections', label: 'Збірники',    iconName: 'collections' },
  { key: 'issues',      label: 'Випуски',     iconName: 'issues' },
  { key: 'characters',  label: 'Персонажі',   iconName: 'characters' },
  { key: 'personnel',   label: 'Персонал',    iconName: 'personnel' },
  { key: 'publishers',  label: 'Видавництва', iconName: 'publishers' },
  { key: 'add',         label: 'Додавання',   iconName: 'plus' },
];

// ── Volume categories ─────────────────────────────────────
const VOLUME_CATEGORIES = [
  { key: 'no_uk_name',           label: 'Без укр. назви' },
  { key: 'no_lang',              label: 'Без мови' },
  { key: 'no_year',              label: 'Без року' },
  { key: 'no_publisher',         label: 'Без видавництва' },
  { key: 'no_theme',             label: 'Без теми' },
  { key: 'translated_no_source', label: 'Переклад без джерела' },
  { key: 'manga_no_journal',     label: 'Манґа без журналу' },
  { key: 'collection_unconverted', label: 'Неконвертовані збірники' },
  { key: 'collection_no_origin', label: 'Манґа-збірник без оригіналу' },
  { key: 'mixed_sources',        label: 'Змішані джерела' },
  { key: 'manga_no_staff',       label: 'Манґа-том без стафу' },
  { key: 'manga_no_characters',  label: 'Манґа-том без персонажів' },
];


// ── Collection categories ─────────────────────────────────
const COLLECTION_CATEGORIES = [
  { key: 'no_isbn',         label: 'Без ISBN' },
  { key: 'no_release_date', label: 'Без релізу' },
  { key: 'no_synopsis',     label: 'Без опису' },
  { key: 'no_pages',        label: 'Без сторінок' },
  { key: 'no_site_link',    label: 'Без посилання' },
  { key: 'no_issues',       label: 'Без випусків' },
  { key: 'no_contents',     label: 'Без змісту' },
];

// ── Issue categories ──────────────────────────────────────
const ISSUE_CATEGORIES = [
  { key: 'no_uk_name',    label: 'Без укр. назви' },
  { key: 'no_cover_date', label: 'Без дати обкладинки' },
  { key: 'no_release_date', label: 'Без дати релізу' },
  { key: 'no_pages',      label: 'Без сторінок' },
];

// ── Character categories ──────────────────────────────────
const CHARACTER_CATEGORIES = [
  { key: 'no_uk_name',      label: 'Без укр. імені' },
  { key: 'no_uk_real_name', label: 'Без укр. реального імені' },
  { key: 'no_image',        label: 'Без зображення' },
];

// ── Personnel categories ──────────────────────────────────
const PERSONNEL_CATEGORIES = [
  { key: 'no_uk_name', label: 'Без укр. імені' },
  { key: 'no_pseudo',  label: 'Без псевдо' },
  { key: 'no_image',   label: 'Без зображення' },
];

// ── Publisher categories ──────────────────────────────────
const PUBLISHER_CATEGORIES = [
  { key: 'no_founded',   label: 'Без дати заснування' },
  { key: 'no_location',  label: 'Без країни/місця' },
  { key: 'no_work_type', label: 'Без типу робіт' },
];

const SECTION_CATEGORIES = {
  volumes:     VOLUME_CATEGORIES,
  collections: COLLECTION_CATEGORIES,
  issues:      ISSUE_CATEGORIES,
  characters:  CHARACTER_CATEGORIES,
  personnel:   PERSONNEL_CATEGORIES,
  publishers:  PUBLISHER_CATEGORIES,
};

// ── Sort options ──────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'recent', label: 'За датою додавання' },
  { value: 'name',   label: 'За назвою' },
  { value: 'date',   label: 'За датою релізу' },
];

// ── State ─────────────────────────────────────────────────
const state = {
  section:     'volumes',
  category:    null,
  search:      '',
  sort:        'recent',
  order_dir:   'desc',
  content_type: '',
  page:        1,
  limit:       24,
  counts:      {},        // { volumes: N, ... }
  catCounts:   {},        // { no_uk_name: N, ... }
};

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('page')) {
    const pageVal = parseInt(params.get('page'), 10);
    if (!isNaN(pageVal) && pageVal > 0) state.page = pageVal;
  }
  if (params.has('type')) {
    state.content_type = params.get('type') || '';
  }
  if (params.has('sort')) {
    state.sort = params.get('sort') || 'recent';
  }
  if (params.has('section')) {
    state.section = params.get('section') || 'volumes';
  }
}

function updateUrlParams() {
  const params = new URLSearchParams();
  if (state.page > 1) {
    params.set('page', state.page);
  }
  if (state.content_type) {
    params.set('type', state.content_type);
  }
  if (state.sort && state.sort !== 'recent') {
    params.set('sort', state.sort);
  }
  if (state.section) {
    params.set('section', state.section);
  }
  const queryString = params.toString();
  const newSearch = queryString ? `?${queryString}` : '';
  const newUrl = `${window.location.pathname}${newSearch}${window.location.hash}`;
  if (window.location.search !== newSearch) {
    window.history.replaceState(null, '', newUrl);
  }
}

let searchDebounce = null;

const paginator = createPaginator({
  pageSize: state.limit
});

// ── Public render function ─────────────────────────────────
export async function renderWanted(root) {
  if (!root) return;

  // Auth check — only admin/moderator
  let user = null;
  try {
    user = await API.get('/auth/me');
  } catch {
    showAccessDenied(root);
    return;
  }

  if (!user.logged_in || !['admin', 'moderator'].includes(user.role)) {
    showAccessDenied(root);
    return;
  }

  readUrlParams();

  root.innerHTML = buildLayout();
  attachSidebarEvents(root);
  await loadSummary(root);
  await renderSection(root);
}

// ── Access denied screen ───────────────────────────────────
function showAccessDenied(root) {
  root.innerHTML = `
    <div class="wanted-access-denied">
      ${icon('lock', 48)}
      <h1>Доступ заборонено</h1>
      <p>Ця сторінка доступна лише для адміністраторів та модераторів.</p>
      <a href="/">← Повернутися на головну</a>
    </div>
  `;
}

function buildLayout() {
  const navItems = SECTIONS.map(s => {
    const countHtml = s.key !== 'add' ? `<span class="wanted-nav-count" id="nav-count-${s.key}">—</span>` : '';
    return `
      <button
        class="wanted-nav-item ${s.key === state.section ? 'is-active' : ''}"
        data-section="${s.key}"
      >
        <span class="wanted-nav-item-left">
          ${icon(s.iconName, 15)}
          <span>${s.label}</span>
        </span>
        ${countHtml}
      </button>
    `;
  }).join('');

  return `
    <div class="wanted-layout">
      <aside class="wanted-sidebar">
        <div class="wanted-sidebar-header">
          <div class="wanted-sidebar-title">
            ${icon('target', 20)}
            Wanted
          </div>
          <a class="wanted-sidebar-link" href="/">
            ${icon('home', 13)}
            Drawn Stories
          </a>
        </div>

        <div id="wanted-total-badge" class="wanted-total-badge" style="display:none">
          ${icon('warning', 14)}
          <span id="wanted-total-count">0</span> проблем загалом
        </div>

        <nav class="wanted-sidebar-nav">
          <div class="wanted-nav-section">Розділи</div>
          ${navItems}
        </nav>
      </aside>

      <main class="wanted-main" id="wanted-main">
        <div id="wanted-content"></div>
      </main>
    </div>
  `;
}

// ── Sidebar events ─────────────────────────────────────────
function attachSidebarEvents(root) {
  root.querySelectorAll('.wanted-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section === state.section) return;
      state.section = section;
      state.category = null;
      state.search = '';
      state.page = 1;
      state.content_type = '';

      root.querySelectorAll('.wanted-nav-item').forEach(b =>
        b.classList.toggle('is-active', b.dataset.section === section)
      );

      updateUrlParams();
      renderSection(root);
    });
  });
}

// ── Summary load ───────────────────────────────────────────
async function loadSummary(root) {
  try {
    const data = await API.get('/wanted/summary');
    state.counts = data;

    let total = 0;
    for (const [key, val] of Object.entries(data)) {
      total += val;
      const el = root.querySelector(`#nav-count-${key}`);
      if (el) el.textContent = val > 0 ? val : '0';
    }

    const totalEl = root.querySelector('#wanted-total-count');
    const badge   = root.querySelector('#wanted-total-badge');
    if (totalEl) totalEl.textContent = total;
    if (badge)   badge.style.display = total > 0 ? 'flex' : 'none';
  } catch (err) {
    console.error('Failed to load wanted summary:', err);
  }
}

// ── Section render ──────────────────────────────────────
async function renderSection(root) {
  const content = root.querySelector('#wanted-content');
  if (!content) return;

  const sectionConfig = SECTIONS.find(s => s.key === state.section);

  if (state.section === 'add') {
    content.innerHTML = buildAddPanel(sectionConfig);
    attachAddPanelEvents(content);
    return;
  }

  const categories    = SECTION_CATEGORIES[state.section] || [];

  // Reset category counts before loading new section
  state.catCounts = {};

  // Load category counts for any section that has categories
  if (categories.length > 0) {
    await loadCategoryCounts(root);
  }

  const showContentType = ['volumes', 'issues'].includes(state.section);

  content.innerHTML = `
    <div class="wanted-section-header">
      <div class="wanted-section-title">
        ${icon(sectionConfig?.iconName || 'volumes', 22)}
        ${sectionConfig?.label || state.section}
      </div>
    </div>

    ${buildCategories(categories)}
    ${buildToolbar(showContentType)}
    <div id="wanted-items-area">${buildSkeletonGrid()}</div>
    <div id="wanted-pagination" class="pagination-wrap"></div>
  `;

  attachToolbarEvents(root, content);
  await loadItems(content);
}

// ── Category counts ────────────────────────────────────
async function loadCategoryCounts(root) {
  try {
    const params = {};
    if (state.content_type && ['volumes', 'issues'].includes(state.section)) {
      params.content_type = state.content_type;
    }
    state.catCounts = await API.get(`/wanted/category-counts/${state.section}`, params);
    const catEl = root.querySelector('.wanted-categories');
    if (catEl) updateCategoryChips(catEl);
  } catch { /* silent */ }
}

function updateCategoryChips(container) {
  container.querySelectorAll('.wanted-category-chip').forEach(chip => {
    const key = chip.dataset.category;
    const cnt = state.catCounts[key] ?? '—';
    const badge = chip.querySelector('.wanted-chip-count');
    if (badge) badge.textContent = cnt;
  });
}

// ── Categories HTML ────────────────────────────────────────
function buildCategories(categories) {
  if (!categories.length) return '';

  const chips = categories.map(cat => `
    <button
      class="wanted-category-chip ${state.category === cat.key ? 'is-active' : ''}"
      data-category="${cat.key}"
    >
      ${cat.label}
      <span class="wanted-chip-count">${state.catCounts[cat.key] ?? '—'}</span>
    </button>
  `).join('');

  return `<div class="wanted-categories">${chips}</div>`;
}

// ── Toolbar HTML ───────────────────────────────────────────
function buildToolbar(showContentType = false) {
  const sortOpts = SORT_OPTIONS.map(o =>
    `<option value="${o.value}" ${state.sort === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');

  const segmentedHtml = showContentType ? `
    <div class="wanted-ct-group" role="group">
      <button class="wanted-ct-btn ${!state.content_type ? 'is-active' : ''}" data-ct="">Всі</button>
      <button class="wanted-ct-btn ${state.content_type === 'comics' ? 'is-active' : ''}" data-ct="comics">Комікси</button>
      <button class="wanted-ct-btn ${state.content_type === 'manga' ? 'is-active' : ''}" data-ct="manga">Манґа</button>
    </div>` : '';

  return `
    <div class="filter-bar">
      <div class="filter-section results-section">
        <div class="results-label">Знайдено</div>
        <div class="results-value" id="wanted-count-value">—</div>
      </div>

      <div class="filter-section search-section">
        <div class="search-inner">
          <span class="search-icon">
            ${icon('search', 15)}
          </span>
          <input
            type="text"
            id="wanted-search-input"
            class="search-input-pill"
            placeholder="Пошук..."
            value="${escHtml(state.search)}"
            autocomplete="off"
          >
        </div>
      </div>

      <div class="filter-section filters-section">
        <div class="filter-group">
          <select class="filter-select" id="wanted-sort-select">
            <button>
              <span class="select-label">${SORT_OPTIONS.find(o => o.value === state.sort)?.label || ''}</span>
              <span class="select-chevron-v">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
              </span>
            </button>
            ${sortOpts}
          </select>
        </div>
        ${segmentedHtml}
      </div>
    </div>
  `;
}

// ── Toolbar events ─────────────────────────────────────────
function attachToolbarEvents(root, content) {
  // Category chips
  content.querySelectorAll('.wanted-category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.category;
      state.category = state.category === key ? null : key;
      state.page = 1;
      content.querySelectorAll('.wanted-category-chip').forEach(c =>
        c.classList.toggle('is-active', c.dataset.category === state.category)
      );
      updateUrlParams();
      loadItems(content);
    });
  });

  // Search
  const searchInput = content.querySelector('#wanted-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.search = searchInput.value.trim();
        state.page = 1;
        updateUrlParams();
        loadItems(content);
      }, 350);
    });
  }

  // Sort
  const sortSelect = content.querySelector('#wanted-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      state.page = 1;
      const label = sortSelect.querySelector('.select-label');
      if (label) {
        label.textContent = SORT_OPTIONS.find(o => o.value === state.sort)?.label || '';
      }
      updateUrlParams();
      loadItems(content);
    });
  }

  // Content type
  content.querySelectorAll('.wanted-ct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.content_type = btn.dataset.ct;
      state.page = 1;
      content.querySelectorAll('.wanted-ct-btn').forEach(b =>
        b.classList.toggle('is-active', b.dataset.ct === state.content_type)
      );
      if (['volumes', 'issues'].includes(state.section)) loadCategoryCounts(root);
      updateUrlParams();
      loadItems(content);
    });
  });
}

// ── Load items ─────────────────────────────────────────────
async function loadItems(content) {
  paginator.setPage(state.page);
  const area = content.querySelector('#wanted-items-area');
  const paginationEl = content.querySelector('#wanted-pagination');
  if (!area) return;

  area.innerHTML = buildSkeletonGrid();

  try {
    const params = buildParams();
    const data   = await API.get(`/wanted/${state.section}`, params);

    updateCount(content, data.total);
    area.innerHTML = data.items.length
      ? renderCards(data.items)
      : renderEmpty();

    renderPagination(paginationEl, data);
  } catch (err) {
    area.innerHTML = `<div class="wanted-empty">
      ${icon('warning', 32)}
      <div class="wanted-empty-title">Помилка завантаження</div>
      <div class="wanted-empty-desc">${escHtml(err.message)}</div>
    </div>`;
  }
}

function buildParams() {
  const params = {
    page:      state.page,
    limit:     state.limit,
    sort:      state.sort,
    order_dir: state.order_dir,
  };
  if (state.category)    params.category     = state.category;
  if (state.search)      params.search       = state.search;
  if (state.content_type) params.content_type = state.content_type;
  return params;
}

function updateCount(content, total) {
  const valueEl = content.querySelector('#wanted-count-value');
  if (valueEl) valueEl.textContent = total.toLocaleString('uk-UA');
}

// ── Card rendering ─────────────────────────────────────────
function renderCards(items) {
  return `<div class="wanted-grid">${items.map(item => createWantedCard(item).outerHTML).join('')}</div>`;
}

function renderEmpty() {
  return `
    <div class="wanted-empty">
      ${icon('check', 40)}
      <div class="wanted-empty-title">Немає проблем!</div>
      <div class="wanted-empty-desc">Усі записи в цій категорії заповнені.</div>
    </div>
  `;
}

// ── Skeleton ───────────────────────────────────────────────
function buildSkeletonGrid(count = 12) {
  const cards = Array.from({ length: count }, () => `
    <div class="wanted-skeleton-card">
      <div class="wanted-skeleton-poster"></div>
      <div class="wanted-skeleton-body">
        <div class="wanted-skeleton-line w-3-4"></div>
        <div class="wanted-skeleton-line w-1-2"></div>
      </div>
    </div>
  `).join('');
  return `<div class="wanted-skeleton-grid">${cards}</div>`;
}

// ── Pagination ─────────────────────────────────────────────
function renderPagination(container, data) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(paginator.render(data.total || 0, () => {
    state.page = paginator.getPage();
    updateUrlParams();
    const content = document.querySelector('#wanted-content');
    if (content) loadItems(content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

// ── Add Panel UI & Events ───────────────────────────────────
function buildAddPanel(config) {
  return `
    <div class="wanted-section-header">
      <div class="wanted-section-title">
        ${icon(config?.iconName || 'plus', 22)}
        ${config?.label || 'Додавання'}
      </div>
      <div class="wanted-section-desc">Додавання нових об'єктів до бази даних за допомогою парсерів</div>
    </div>
    
    <div class="wanted-add-panel">
      <div class="wanted-add-grid">
        
        <!-- Додати випуск -->
        <div class="wanted-add-card" id="card-add-issue">
          <div class="wanted-add-card-title">
            ${icon('issues', 18)}
            Додати випуск (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Введіть ComicVine ID випуску. Скрипт завантажить дані з ComicVine API та збереже в базу.
          </div>
          <div class="wanted-add-card-row">
            <input type="number" min="1" class="wanted-add-input" placeholder="CV ID випуску (напр. 306640)" required>
            <button class="wanted-add-btn">Додати</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Додати том -->
        <div class="wanted-add-card" id="card-add-volume">
          <div class="wanted-add-card-title">
            ${icon('volumes', 18)}
            Додати том (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Введіть ComicVine ID тому. Скрипт завантажить назву, обкладинку, видавництво та рік початку.
          </div>
          <div class="wanted-add-card-row">
            <input type="number" min="1" class="wanted-add-input" placeholder="CV ID тому (напр. 18138)" required>
            <button class="wanted-add-btn">Додати</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Всі випуски тому -->
        <div class="wanted-add-card" id="card-add-volume-issues">
          <div class="wanted-add-card-title">
            ${icon('package', 18)}
            Всі випуски тому (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Завантажить <em>усі</em> випуски вказаного тому. Наявні випуски пропускаються. Може тривати кілька хвилин.
          </div>
          <div class="wanted-add-card-row">
            <input type="number" min="1" class="wanted-add-input" placeholder="CV ID тому (напр. 18138)" required>
            <button class="wanted-add-btn">Завантажити</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Додати манґу -->
        <div class="wanted-add-card" id="card-add-manga">
          <div class="wanted-add-card-title">
            ${icon('book', 18)}
            Додати манґу / манхву (Hikka)
          </div>
          <div class="wanted-add-card-desc">
            Введіть слаґ манґи або повне посилання з Hikka (наприклад, <code>manga-slug</code> або <code>https://hikka.io/manga/manga-slug</code>).
          </div>
          <div class="wanted-add-card-row">
            <input type="text" class="wanted-add-input" placeholder="Слаґ або посилання Hikka" required>
            <button class="wanted-add-btn">Додати</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Додати персонажа -->
        <div class="wanted-add-card" id="card-add-character">
          <div class="wanted-add-card-title">
            ${icon('characters', 18)}
            Додати персонажа (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Введіть ComicVine ID персонажа (напр. <code>1699</code>) або повне посилання.
          </div>
          <div class="wanted-add-card-row">
            <input type="text" class="wanted-add-input" placeholder="ID персонажа або посилання CV" required>
            <button class="wanted-add-btn">Додати</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Додати персону -->
        <div class="wanted-add-card" id="card-add-person">
          <div class="wanted-add-card-title">
            ${icon('personnel', 18)}
            Додати персону / автора (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Введіть ComicVine ID персони (напр. <code>3596</code>) або повне посилання.
          </div>
          <div class="wanted-add-card-row">
            <input type="text" class="wanted-add-input" placeholder="ID персони або посилання CV" required>
            <button class="wanted-add-btn">Додати</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Додати видавництво -->
        <div class="wanted-add-card" id="card-add-publisher-volumes">
          <div class="wanted-add-card-title">
            ${icon('publishers', 18)}
            Зв'язати томи видавництва (ComicVine)
          </div>
          <div class="wanted-add-card-desc">
            Введіть ComicVine ID видавництва (напр. <code>4010-6438</code> або просто <code>6438</code>). Скрипт знайде томи видавця на ComicVine та оновить посилання у наявних у базі томах.
          </div>
          <div class="wanted-add-card-row">
            <input type="text" class="wanted-add-input" placeholder="ID видавництва або посилання CV" required>
            <button class="wanted-add-btn">Оновити томи</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Парсер манґи з Hikka -->
        <div class="wanted-add-card" id="card-hikka-manga-parser">
          <div class="wanted-add-card-title">
            ${icon('refreshCw', 18)}
            Парсер манґи з Hikka
          </div>
          <div class="wanted-add-card-desc">
            Імпорт останніх доданих тайтлів або актуалізація статусу онгоінгів (знімає тему онгоїнгу, якщо тайтл вже завершено).
          </div>
          <div class="wanted-add-card-row" style="display: flex; gap: 8px;">
            <button class="wanted-add-btn" id="btn-hikka-missing" style="flex: 1;">Парсити останні додані</button>
            <button class="wanted-add-btn" id="btn-hikka-ongoing" style="flex: 1;">Перевірити онгоінги</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

        <!-- Оновити укр. назви та рейтинги манґи -->
        <div class="wanted-add-card" id="card-update-manga-meta">
          <div class="wanted-add-card-title">
            ${icon('refreshCw', 18)}
            Оновити рейтинги та укр. назви (Hikka / MAL)
          </div>
          <div class="wanted-add-card-desc">
            Оновлює українські назви (<code>name_uk</code>), оцінки Hikka та MAL і кількість голосів для наявних томів манґи.
          </div>
          <div class="wanted-add-card-row">
            <button class="wanted-add-btn" style="width: 100%;">Запустити оновлення</button>
          </div>
          <div class="wanted-add-card-status"></div>
        </div>

      </div>
    </div>
  `;
}

function attachAddPanelEvents(content) {
  setupCardOp(content, '#card-add-issue', '/parser/add-issue', (val) => ({ cv_id: parseInt(val, 10) }));
  setupCardOp(content, '#card-add-volume', '/parser/add-volume', (val) => ({ cv_id: parseInt(val, 10) }));
  setupCardOp(content, '#card-add-volume-issues', '/parser/add-volume-issues', (val) => ({ cv_vol_id: parseInt(val, 10) }));
  setupCardOp(content, '#card-add-manga', '/parser/add-manga', (val) => ({ slug: val }));
  setupCardOp(content, '#card-add-character', '/parser/add-character', (val) => ({ slug: val }));
  setupCardOp(content, '#card-add-person', '/parser/add-person', (val) => ({ slug: val }));
  setupCardOp(content, '#card-add-publisher-volumes', '/parser/add-publisher-volumes', (val) => {
    // extract numeric id if it's a link or slug
    const match = val.match(/(?:4010-)?(\d+)/);
    const id = match ? parseInt(match[1], 10) : parseInt(val, 10);
    return { cv_id: id };
  });

  const hikkaMissingBtn = content.querySelector('#btn-hikka-missing');
  if (hikkaMissingBtn) {
    hikkaMissingBtn.addEventListener('click', () => {
      openTerminalLogModal({
        title: 'Парсинг останніх доданих тайтлів з Hikka',
        sseUrl: '/api/parser/stream/hikka-manga/missing',
        autoReload: false
      });
    });
  }

  const hikkaOngoingBtn = content.querySelector('#btn-hikka-ongoing');
  if (hikkaOngoingBtn) {
    hikkaOngoingBtn.addEventListener('click', () => {
      openTerminalLogModal({
        title: 'Перевірка онгоінгів з Hikka',
        sseUrl: '/api/parser/stream/hikka-manga/ongoing',
        autoReload: false
      });
    });
  }

  const updateMangaBtn = content.querySelector('#card-update-manga-meta .wanted-add-btn');
  if (updateMangaBtn) {
    updateMangaBtn.addEventListener('click', () => {
      openTerminalLogModal({
        title: 'Оновлення оцінок та назв манґи (Hikka / MAL)',
        sseUrl: '/api/parser/stream/update-manga-meta',
        autoReload: false
      });
    });
  }
}

function setupCardOp(content, cardSelector, endpoint, payloadFn) {
  const card = content.querySelector(cardSelector);
  if (!card) return;
  
  const input = card.querySelector('.wanted-add-input');
  const btn = card.querySelector('.wanted-add-btn');
  const statusEl = card.querySelector('.wanted-add-card-status');
  
  const setStatus = (text, type = '') => {
    statusEl.textContent = text;
    statusEl.className = 'wanted-add-card-status' + (type ? ' ' + type : '');
  };
  
  const execute = async () => {
    const val = input ? input.value.trim() : '';
    if (input && input.hasAttribute('required') && !val) {
      setStatus('⚠ Будь ласка, заповніть поле.', 'warn');
      return;
    }
    
    btn.disabled = true;
    const oldBtnText = btn.textContent;
    btn.textContent = '⏳ Обробка…';
    setStatus('Запит надіслано, зачекайте...', '');
    
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed++;
      setStatus(`⏳ Виконується… (${elapsed}с)`, '');
    }, 1000);
    
    try {
      const payload = payloadFn(val);
      const res = await API.post(endpoint, payload);
      clearInterval(timer);
      
      if (res.ok) {
        setStatus(res.message || 'Успішно виконано!', 'ok');
        input.value = '';
      } else {
        setStatus('○ ' + (res.message || 'Сталася помилка.'), 'err');
      }
    } catch (err) {
      clearInterval(timer);
      setStatus('✗ Помилка: ' + (err.message || 'Не вдалося виконати запит.'), 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = oldBtnText;
    }
  };
  
  btn.addEventListener('click', execute);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') execute();
  });
}

// ── Utils ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
