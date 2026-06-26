/**
 * wanted.js — основна логіка сторінки /wanted.
 * Відображає контент з відсутніми даними по розділах.
 */
import { API } from '../helpers/api.js';
import { createWantedCard } from './wantedCard.js';
import { createPaginator } from '../components/Pagination.js';

// ── Icons ─────────────────────────────────────────────────
const icon = (d, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICONS = {
  target:    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  home:      '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  lock:      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  volumes:   '<path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/>',
  issues:    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  characters:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  personnel: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  publishers:'<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/>',
  collections:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  check:     '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  warning:   '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  search:    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};

// ── Sections config ───────────────────────────────────────
const SECTIONS = [
  { key: 'volumes',     label: 'Томи',        icon: ICONS.volumes },
  { key: 'collections', label: 'Збірники',    icon: ICONS.collections },
  { key: 'issues',      label: 'Випуски',     icon: ICONS.issues },
  { key: 'characters',  label: 'Персонажі',   icon: ICONS.characters },
  { key: 'personnel',   label: 'Персонал',    icon: ICONS.personnel },
  { key: 'publishers',  label: 'Видавництва', icon: ICONS.publishers },
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

let searchDebounce = null;

const paginator = createPaginator({
  getPage: () => state.page,
  getPageSize: () => state.limit,
  setPage: (p) => {
    state.page = p;
    const content = document.querySelector('#wanted-content');
    if (content) loadItems(content);
  }
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

  root.innerHTML = buildLayout();
  attachSidebarEvents(root);
  await loadSummary(root);
  await renderSection(root);
}

// ── Access denied screen ───────────────────────────────────
function showAccessDenied(root) {
  root.innerHTML = `
    <div class="wanted-access-denied">
      ${icon(ICONS.lock, 48)}
      <h1>Доступ заборонено</h1>
      <p>Ця сторінка доступна лише для адміністраторів та модераторів.</p>
      <a href="/">← Повернутися на головну</a>
    </div>
  `;
}

// ── Layout HTML ────────────────────────────────────────────
function buildLayout() {
  const navItems = SECTIONS.map(s => `
    <button
      class="wanted-nav-item ${s.key === state.section ? 'is-active' : ''}"
      data-section="${s.key}"
    >
      <span class="wanted-nav-item-left">
        ${icon(s.icon, 15)}
        <span>${s.label}</span>
      </span>
      <span class="wanted-nav-count" id="nav-count-${s.key}">—</span>
    </button>
  `).join('');

  return `
    <div class="wanted-layout">
      <aside class="wanted-sidebar">
        <div class="wanted-sidebar-header">
          <div class="wanted-sidebar-title">
            ${icon(ICONS.target, 20)}
            Wanted
          </div>
          <a class="wanted-sidebar-link" href="/">
            ${icon(ICONS.home, 13)}
            Drawn Stories
          </a>
        </div>

        <div id="wanted-total-badge" class="wanted-total-badge" style="display:none">
          ${icon(ICONS.warning, 14)}
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
        ${icon(sectionConfig?.icon || ICONS.volumes, 22)}
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
            ${icon(ICONS.search, 15)}
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
      loadItems(content);
    });
  }

  // Content type
  content.querySelectorAll('.catalog-segment').forEach(btn => {
    btn.addEventListener('click', () => {
      state.content_type = btn.dataset.ct;
      state.page = 1;
      content.querySelectorAll('.catalog-segment').forEach(b =>
        b.classList.toggle('is-active', b.dataset.ct === state.content_type)
      );
      if (['volumes', 'issues'].includes(state.section)) loadCategoryCounts(root);
      loadItems(content);
    });
  });
}

// ── Load items ─────────────────────────────────────────────
async function loadItems(content) {
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
      ${icon(ICONS.warning, 32)}
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
      ${icon(ICONS.check, 40)}
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

// ── Utils ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
