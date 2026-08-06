import { API } from '../helpers/api.js';
import { renderReleaseCalendarFilterBar } from '../components/releaseCalendar/ReleaseCalendarFilterBar.js';
import { renderReleaseCalendarGrid } from '../components/releaseCalendar/ReleaseCalendarGrid.js';

/**
 * Main View for Comic & Manga Release Calendar.
 */
export async function renderReleaseCalendar(mainContainer, queryParams = {}) {
  // Load view stylesheet dynamically if not present
  if (!document.querySelector('link[href*="releaseCalendar.css"]')) {
    const linkView = document.createElement('link');
    linkView.rel = 'stylesheet';
    linkView.href = '/static/css/views/releaseCalendar.css';
    document.head.appendChild(linkView);
  }

  // Also ensure mangaCalendar.css is loaded for base calendar controls styling if needed
  if (!document.querySelector('link[href*="mangaCalendar.css"]')) {
    const linkManga = document.createElement('link');
    linkManga.rel = 'stylesheet';
    linkManga.href = '/static/css/views/mangaCalendar.css';
    document.head.appendChild(linkManga);
  }

  // State
  let currentDate = new Date();
  let selectedPublisherId = queryParams.publisher_id || '';
  let releaseType = queryParams.type === 'collections' ? 'collections' : 'issues';
  let category = queryParams.category === 'manga' ? 'manga' : 'comics';

  let calendarData = {
    items: [],
    total: 0,
    publishers: []
  };

  // Layout Shell
  mainContainer.innerHTML = `
    <div class="release-calendar container">
      <div class="page-header" style="margin-bottom: 24px;">
        <h1 class="page-title">Календар релізів</h1>
        <p class="page-subtitle">Розклад нових випусків та збірників коміксів і манґи</p>
      </div>

      <div id="release-cal-filters-slot"></div>
      <div id="release-cal-grid-slot"></div>
    </div>
  `;

  const filtersSlot = mainContainer.querySelector('#release-cal-filters-slot');
  const gridSlot = mainContainer.querySelector('#release-cal-grid-slot');

  // Calculate Monday and Sunday for currentDate
  function getWeekRange() {
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    return {
      startDateStr: formatISO(monday),
      endDateStr: formatISO(sunday)
    };
  }

  // Load Data
  async function loadData() {
    gridSlot.innerHTML = `
      <div style="text-align: center; padding: 60px 0; color: var(--text-muted);">
        Завантаження релізів...
      </div>
    `;

    const { startDateStr, endDateStr } = getWeekRange();
    const params = {
      start_date: startDateStr,
      end_date: endDateStr,
      release_type: releaseType,
      category: category
    };

    if (selectedPublisherId) {
      params.publisher_id = selectedPublisherId;
    }

    try {
      const data = await API.get('/releases/calendar', params);
      calendarData = data || { items: [], total: 0, publishers: [] };
    } catch (err) {
      console.error('Failed to load release calendar data', err);
      calendarData = { items: [], total: 0, publishers: [] };
    }

    updateUI();
  }

  // Update UI
  function updateUI() {
    // 1. Render Filters Bar
    renderReleaseCalendarFilterBar(filtersSlot, {
      currentDate,
      selectedPublisherId,
      publishersList: calendarData.publishers || [],
      releaseType,
      category,
      totalResults: calendarData.total || 0,
      onPrevWeek: () => {
        currentDate.setDate(currentDate.getDate() - 7);
        loadData();
      },
      onNextWeek: () => {
        currentDate.setDate(currentDate.getDate() + 7);
        loadData();
      },
      onToday: () => {
        currentDate = new Date();
        loadData();
      },
      onDateSelect: (newDate) => {
        currentDate = newDate;
        loadData();
      },
      onPublisherChange: (pubId) => {
        selectedPublisherId = pubId;
        loadData();
      },
      onReleaseTypeChange: (type) => {
        releaseType = type;
        loadData();
      },
      onCategoryChange: (cat) => {
        category = cat;
        loadData();
      }
    });

    // 2. Render Main Grid by Days
    renderReleaseCalendarGrid(gridSlot, {
      currentDate,
      items: calendarData.items || []
    });
  }

  // Initial Load
  await loadData();
}
