import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

const paginator = createPaginator({ pageSize: 24 });
let searchQuery = '';

export async function renderEvents(container, query = {}) {
  document.title = 'Події — Drawn Stories';
  paginator.reset();
  searchQuery = query.search || '';

  container.innerHTML = `
    <div class="container">
      <div class="page-header">
        ${createBreadcrumbs([{ label: 'Події' }])}
      </div>

      <div class="catalog-top-row">
        <div id="catalog-filter-bar-container">
          <div id="events-filter-bar-container"></div>
        </div>
      </div>

      <div class="catalog-layout">
        <div class="catalog-main-column">
          <main class="catalog-results">
            <div class="comic-grid" id="events-grid">
               <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div class="pagination-wrap" id="events-pagination"></div>
          </main>
        </div>
      </div>
    </div>
  `;

  let filterBar = mountFilterBar(container.querySelector('#events-filter-bar-container'), {
    resultsCount: 0,
    resultsLabel: 'Знайдено подій',
    showResults: true,
    showSearch: true,
    searchPlaceholder: 'Пошук подій...',
    searchValue: searchQuery,
    onSearch: (val) => {
      searchQuery = val;
      paginator.reset();
      reloadEvents();
    }
  });

  const reloadEvents = () => {
    fetchAndRenderEvents(filterBar);
  };

  reloadEvents();
}

async function fetchAndRenderEvents(filterBar) {
  const grid = document.getElementById('events-grid');
  const paginationWrap = document.getElementById('events-pagination');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 8 }).map(() => `
    <div class="skeleton" style="width: 100%; aspect-ratio: 2/3; border-radius: var(--r);"></div>
  `).join('');

  try {
    const offset = (paginator.getPage() - 1) * paginator.getPageSize();
    const data = await API.get('/events', {
      search: searchQuery || undefined,
      limit: paginator.getPageSize(),
      offset: offset
    });

    const events = data.data || [];
    const totalCount = data.total || 0;
    
    if (filterBar) filterBar.updateCount(totalCount);

    if (events.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>Подій не знайдено</h3>
        </div>`;
      paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = events.map(event => {
      const cover = comicVineImageUrl(event.cv_img || event.image);
      const title = escapeHtmlAttribute(event.name || 'Без назви');
      const years = event.start_year ? (event.end_year && event.start_year !== event.end_year ? `${event.start_year}–${event.end_year}` : event.start_year) : '';
      const issues = event.issue_count ? `Випусків: ${event.issue_count}` : 'Немає випусків';

      return `
        <a href="#/events/${event.id}" class="comic-card">
          <div class="comic-cover-wrap">
            ${cover ? `<img class="comic-cover" src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="comic-no-cover"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
          </div>
          <div class="comic-body">
            <h4 class="comic-title" title="${title}">${title}</h4>
            ${years ? `<div class="comic-meta" style="font-size: 0.8em; color: var(--text-muted);">${years}</div>` : ''}
            <div class="comic-meta" style="font-size: 0.8em; color: var(--text-muted);">${issues}</div>
          </div>
        </a>
      `;
    }).join('');

    paginationWrap.innerHTML = '';
    // Since API /events is not fully paginated with a separate total, we just show simple pagination or hide if less than pageSize
    if (totalCount >= paginator.getPageSize() || paginator.getPage() > 1) {
      paginationWrap.appendChild(paginator.render(totalCount, () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchAndRenderEvents(filterBar);
      }));
    }

  } catch (err) {
    grid.innerHTML = `<div class="error-state" style="grid-column: 1 / -1;">Помилка завантаження подій: ${escapeHtmlAttribute(err.message)}</div>`;
    paginationWrap.innerHTML = '';
  }
}
