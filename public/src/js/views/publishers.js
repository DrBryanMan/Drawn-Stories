import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';

const paginator = createPaginator({ pageSize: 20 });
const getSortOptions = () => [
  { value: 'name', label: t('sort_name') },
  { value: 'founded', label: t('sort_founded') },
  { value: 'volumes', label: t('sort_volumes') },
];
let searchQuery = '';
let sortField = 'volumes';
let sortOrder = 'desc';

export async function renderPublishers(container, query) {
  document.title = `${t('publishers')} — Drawn Stories`;
  paginator.reset();
  searchQuery = query.search || '';

  container.innerHTML = `
    <div class="container">
      <div class="page-header">
        ${createBreadcrumbs([{ label: t('publishers') }])}
      </div>

      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container">
          <div id="publishers-filter-bar-container"></div>
        </div>
      </div>

      <div class="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="publishers-grid" id="publishers-grid">
               <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="pub-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  let filterBar = mountFilterBar(container.querySelector('#publishers-filter-bar-container'), {
    resultsCount: 0,
    resultsLabel: t('found_count'),
    showResults: true,
    showSearch: true,
    searchPlaceholder: t('search_publishers'),
    searchValue: searchQuery,
    onSearch: (val) => {
      searchQuery = val;
      paginator.reset();
      reloadPublishers();
    },
    showSort: true,
    sortId: 'pub-sort-select',
    sortValue: sortField,
    sortOptions: getSortOptions(),
    showSortOrder: true,
    sortOrderId: 'pub-sort-order-btn',
    sortOrderValue: sortOrder,
    onSortChange: (val) => {
      sortField = val;
      paginator.reset();
      reloadPublishers();
    },
    onSortOrderChange: (dir) => {
      sortOrder = dir;
      paginator.reset();
      reloadPublishers();
    }
  });

  const reloadPublishers = () => {
    fetchAndRenderPublishers(filterBar);
  };

  reloadPublishers();
}

async function fetchAndRenderPublishers(filterBar) {
  const grid = document.getElementById('publishers-grid');
  const paginationWrap = document.getElementById('pub-pagination');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="skeleton" style="height: 350px; border-radius: var(--radius-lg)"></div>
  `).join('');

  try {
    const data = await API.get('/publishers', {
      page: paginator.getPage(),
      limit: paginator.getPageSize(),
      search: searchQuery || undefined,
      sort: sortField,
      order_dir: sortOrder
    });

    const publishers = data.items || [];
    if (filterBar) filterBar.updateCount(data.total || 0);

    if (publishers.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>${t('publishers_not_found')}</h3>
        </div>`;
      paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = publishers.map(pub => {
      const statusValue = (pub.status || '').toLowerCase();
      const isActive = statusValue === 'active' || statusValue === 'активне' || statusValue === 'активна';
      const statusText = isActive ? t('status_active') : t('status_inactive');
      
      const workTypeMap = {
        'manga': t('manga'),
        'comics': t('comics'),
        'mixed': t('mixed')
      };

      const badges = pub.work_type 
        ? pub.work_type.split(',').map(s => {
            const trimmed = s.trim().toLowerCase();
            return workTypeMap[trimmed] || s.trim();
          }) 
        : ['—'];
      
      const logoInitial = pub.name ? pub.name.charAt(0).toUpperCase() : '?';
      const imageUrl = comicVineImageUrl(pub.image);
      const logoHtml = imageUrl 
        ? `<img src="${escapeHtmlAttribute(imageUrl)}" alt="${escapeHtmlAttribute(pub.name)} logo" loading="lazy">` 
        : logoInitial;

      const releases = pub.latest_releases || [];
      const releasesHtml = releases.map(vol => {
          const imgUrl = comicVineImageUrl(vol.cover_img || vol.cv_img);
          const title = escapeHtmlAttribute(vol.name_uk || vol.name);
          const issueCount = vol.issue_count || 0;
          return `
            <a href="#/volumes/${vol.id}" class="pub-release-card">
              <div class="pub-release-cover">
                ${imgUrl ? `<img src="${imgUrl}" alt="${title}" loading="lazy" />` : `<div class="no-cover">${t('no_cover')}</div>`}
              </div>
              <div class="pub-release-info">
                <div class="pub-release-title" title="${title}">${title}</div>
                <div class="pub-release-episodes">${t('section_issues')}: ${issueCount}</div>
              </div>
            </a>
          `;
      }).join('');

      let emptyPlaceholders = '';
      if (releases.length > 0 && releases.length < 3) {
        for (let i = 0; i < 3 - releases.length; i++) {
          emptyPlaceholders += `<div class="pub-release-card empty" style="visibility: hidden"></div>`;
        }
      }

      return `
        <div class="publisher-card">
          <div class="pub-header">
            <div class="pub-logo">${logoHtml}</div>
            <div class="pub-meta">
              <div class="pub-title-row">
                <h3 class="pub-name">${escapeHtmlAttribute(pub.name)}</h3>
                <span class="pub-status ${isActive ? 'active' : ''}">${statusText}</span>
              </div>
              <div class="pub-badges">
                ${badges.map(b => `<span class="pub-badge">${b}</span>`).join('')}
              </div>
            </div>
          </div>
          
          <div class="pub-body">
            <div class="pub-section-title">${t('latest_releases')}</div>
            <div class="pub-releases">
              ${releases.length > 0 ? releasesHtml + emptyPlaceholders : `<div class="text-secondary text-sm">${t('no_releases')}</div>`}
            </div>
          </div>

          <div class="pub-footer">
            <div class="pub-total">${t('total_published')}: <strong>${pub.volume_count || 0}</strong></div>
            <a href="#/catalog?publisher=${pub.id}" class="pub-btn">${t('go_to_publisher')}</a>
          </div>
        </div>
      `;
    }).join('');

    paginationWrap.innerHTML = '';
    paginationWrap.appendChild(paginator.render(data.total, () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchAndRenderPublishers();
    }));

  } catch (err) {
    grid.innerHTML = `<div class="error-state">${t('loading_error')}: ${escapeHtmlAttribute(err.message)}</div>`;
    paginationWrap.innerHTML = '';
  }
}
