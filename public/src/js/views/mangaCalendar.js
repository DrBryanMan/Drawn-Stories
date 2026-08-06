import { API } from '../helpers/api.js';
import { renderCalendarStats } from '../components/calendar/CalendarStats.js';
import { renderCalendarControls } from '../components/calendar/CalendarControls.js';
import { renderCalendarMonthGrid } from '../components/calendar/CalendarMonthGrid.js';
import { renderCalendarSidebar } from '../components/calendar/CalendarSidebar.js';
import { renderCalendarWeekGrid } from '../components/calendar/CalendarWeekGrid.js';
import { openCalendarLegendModal } from '../components/calendar/CalendarLegendModal.js';

/**
 * Main View for Manga Magazine Release Calendar.
 */

export async function renderMangaCalendar(mainContainer, queryParams = {}) {
  // Load view stylesheet
  if (!document.querySelector('link[href*="mangaCalendar.css"]')) {
    const linkView = document.createElement('link');
    linkView.rel = 'stylesheet';
    linkView.href = '/static/css/views/mangaCalendar.css';
    document.head.appendChild(linkView);
  }

  // State Management
  let currentDate = new Date();
  let viewMode = queryParams.view === 'week' ? 'week' : 'month';
  let selectedMagazineId = queryParams.magazine_id || '';
  let selectedDayStr = new Date().toISOString().split('T')[0];

  let calendarData = {
    stats: {},
    issues: [],
    magazines: []
  };

  // Render Shell structure
  mainContainer.innerHTML = `
    <div class="manga-calendar container">
      <div class="page-header">
        <h1 class="page-title">Календар випусків манґи</h1>
        <p class="page-subtitle">Розклад релізів манґа-журналів та нових розділів</p>
      </div>

      <div id="cal-stats-slot"></div>
      <div id="cal-controls-slot"></div>

      <div class="manga-calendar-main-layout">
        <div class="manga-calendar-grid-wrapper" id="cal-grid-slot">
          <!-- Calendar Grid loaded here -->
        </div>

        <div id="cal-sidebar-slot" style="display: ${viewMode === 'month' ? 'block' : 'none'};">
          <!-- Sidebar loaded here -->
        </div>
      </div>
    </div>
  `;

  const statsSlot = mainContainer.querySelector('#cal-stats-slot');
  const controlsSlot = mainContainer.querySelector('#cal-controls-slot');
  const gridSlot = mainContainer.querySelector('#cal-grid-slot');
  const sidebarSlot = mainContainer.querySelector('#cal-sidebar-slot');

  // Date Range Calculation Helpers
  function getDateRange() {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const firstDay = new Date(year, month, 1);
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek === -1) startDayOfWeek = 6;

      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDayOfWeek);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 41);

      return {
        startDateStr: startDate.toISOString().split('T')[0],
        endDateStr: endDate.toISOString().split('T')[0]
      };
    } else {
      // Week Range
      const monday = new Date(currentDate);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      return {
        startDateStr: monday.toISOString().split('T')[0],
        endDateStr: sunday.toISOString().split('T')[0]
      };
    }
  }

  // Load Data from API
  async function loadData() {
    gridSlot.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--cal-text-muted);">Завантаження даних календаря...</div>`;

    const { startDateStr, endDateStr } = getDateRange();
    const params = {
      start_date: startDateStr,
      end_date: endDateStr
    };
    if (selectedMagazineId) {
      params.magazine_id = selectedMagazineId;
    }

    try {
      const data = await API.get('/magazines/calendar', params);
      calendarData = data;
    } catch (err) {
      console.error('Failed to load calendar data', err);
      calendarData = { stats: {}, issues: [], magazines: [] };
    }

    updateUI();
  }

  // Render & Update UI
  function updateUI() {
    // 1. Stats
    renderCalendarStats(statsSlot, calendarData.stats, viewMode);

    // 2. Controls
    renderCalendarControls(controlsSlot, {
      currentDate,
      viewMode,
      selectedMagazineId,
      magazinesList: calendarData.magazines || [],
      onPrev: () => {
        if (viewMode === 'month') {
          currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
          currentDate.setDate(currentDate.getDate() - 7);
        }
        loadData();
      },
      onNext: () => {
        if (viewMode === 'month') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
          currentDate.setDate(currentDate.getDate() + 7);
        }
        loadData();
      },
      onToday: () => {
        currentDate = new Date();
        selectedDayStr = currentDate.toISOString().split('T')[0];
        loadData();
      },
      onDateSelect: (newDate) => {
        currentDate = newDate;
        selectedDayStr = newDate.toISOString().split('T')[0];
        loadData();
      },
      onViewChange: (newMode) => {
        viewMode = newMode;
        sidebarSlot.style.display = viewMode === 'month' ? 'block' : 'none';
        loadData();
      },
      onMagazineChange: (magId) => {
        selectedMagazineId = magId;
        loadData();
      },
      onOpenLegend: () => {
        openCalendarLegendModal(calendarData.magazines || []);
      }
    });

    // 3. Main Grid Body
    if (viewMode === 'month') {
      renderCalendarMonthGrid(gridSlot, {
        currentDate,
        issuesList: calendarData.issues || [],
        selectedDayStr,
        magazinesList: calendarData.magazines || [],
        onSelectDay: (dateStr) => {
          selectedDayStr = dateStr;
          updateSidebar();
          // Update selected highlight in month grid
          gridSlot.querySelectorAll('.month-day-cell').forEach(c => {
            if (c.dataset.date === selectedDayStr) {
              c.classList.add('selected-day');
            } else {
              c.classList.remove('selected-day');
            }
          });
        }
      });
      updateSidebar();
    } else {
      renderCalendarWeekGrid(gridSlot, {
        currentDate,
        issuesList: calendarData.issues || []
      });
    }
  }

  function updateSidebar() {
    if (viewMode !== 'month') return;

    const dayIssues = (calendarData.issues || []).filter(iss => iss.release_date === selectedDayStr);

    const [yyyy, mm, dd] = selectedDayStr.split('-').map(Number);
    const selectedDateObj = new Date(yyyy, mm - 1, dd);

    renderCalendarSidebar(sidebarSlot, selectedDateObj, dayIssues);
  }

  // Initial Load
  await loadData();
}
