/**
 * Component for displaying upper statistics cards.
 * Uses Lucide SVG icons and formatted counters.
 */

export function renderCalendarStats(container, stats = {}, viewMode = 'month') {
  const periodLabel = viewMode === 'week' ? 'тиждень' : 'місяць';

  const totalChapters = stats.total_chapters ?? 0;
  const userChapters = stats.user_chapters ?? 0;
  const activeMagazines = stats.active_magazines ?? 0;
  const activeSeries = stats.active_series ?? 0;

  const html = `
    <div class="calendar-stats-grid">
      <div class="calendar-stat-card">
        <div class="calendar-stat-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </div>
        <div class="calendar-stat-info">
          <div class="calendar-stat-value">${totalChapters}</div>
          <div class="calendar-stat-label">Розділів за ${periodLabel}</div>
        </div>
      </div>

      <div class="calendar-stat-card">
        <div class="calendar-stat-icon" style="background: rgba(234, 179, 8, 0.1); color: #ca8a04;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="calendar-stat-info">
          <div class="calendar-stat-value">${userChapters}</div>
          <div class="calendar-stat-label">Зі списку користувача</div>
        </div>
      </div>

      <div class="calendar-stat-card">
        <div class="calendar-stat-icon" style="background: rgba(16, 185, 129, 0.1); color: #059669;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
        </div>
        <div class="calendar-stat-info">
          <div class="calendar-stat-value">${activeMagazines}</div>
          <div class="calendar-stat-label">Активних журналів</div>
        </div>
      </div>

      <div class="calendar-stat-card">
        <div class="calendar-stat-icon" style="background: rgba(168, 85, 247, 0.1); color: #9333ea;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/></svg>
        </div>
        <div class="calendar-stat-info">
          <div class="calendar-stat-value">${activeSeries}</div>
          <div class="calendar-stat-label">Активних серій</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}
