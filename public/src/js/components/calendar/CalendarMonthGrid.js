import { getMagazineColor } from './colorHelper.js';

/**
 * Component for rendering month grid (7 columns: Mon..Sun).
 * Displays day numbers, magazine issue badges, overflow counts, and legend footer.
 */

const DAYS_SHORT_UK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'];

export function renderCalendarMonthGrid(container, options = {}) {
  const {
    currentDate = new Date(),
    issuesList = [],
    selectedDayStr = '',
    magazinesList = [],
    onSelectDay
  } = options;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Determine grid start (Monday of first week) and end
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday -> 6

  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  // Group issues by date string 'YYYY-MM-DD'
  const issuesByDate = {};
  issuesList.forEach(iss => {
    if (iss.release_date) {
      const dateKey = iss.release_date;
      if (!issuesByDate[dateKey]) {
        issuesByDate[dateKey] = [];
      }
      issuesByDate[dateKey].push(iss);
    }
  });

  // Unique magazines in current month for legend
  const legendMagazinesMap = {};
  issuesList.forEach(iss => {
    if (iss.magazine_id && !legendMagazinesMap[iss.magazine_id]) {
      legendMagazinesMap[iss.magazine_id] = {
        id: iss.magazine_id,
        name: iss.magazine_name,
        label: iss.magazine_label
      };
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Render 35 or 42 day cells
  const cells = [];
  const currIter = new Date(startDate);

  // Render 5 or 6 rows
  for (let i = 0; i < 35; i++) {
    const iterYear = currIter.getFullYear();
    const iterMonth = currIter.getMonth();
    const iterDay = currIter.getDate();

    const mm = String(iterMonth + 1).padStart(2, '0');
    const dd = String(iterDay).padStart(2, '0');
    const dateStr = `${iterYear}-${mm}-${dd}`;

    const isOtherMonth = iterMonth !== month;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDayStr;

    const dayIssues = issuesByDate[dateStr] || [];

    // Max 3 badges per day cell to fit cleanly
    const maxBadges = 3;
    const visibleIssues = dayIssues.slice(0, maxBadges);
    const extraCount = dayIssues.length - maxBadges;

    const badgesHtml = visibleIssues.map(iss => {
      const color = getMagazineColor(iss.magazine_label, iss.magazine_id);
      const chCount = iss.chapters?.length ?? 0;
      const labelText = iss.magazine_label || iss.magazine_name || 'Журнал';

      return `
        <div class="mag-badge" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border};" title="${iss.magazine_name} #${iss.issue_number}">
          <span class="mag-badge-label">${labelText} #${iss.issue_number}</span>
          <span class="mag-badge-count">${chCount}</span>
        </div>
      `;
    }).join('');

    const moreHtml = extraCount > 0 ? `<div class="month-day-more">+${extraCount} журн.</div>` : '';

    cells.push(`
      <div class="month-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected-day' : ''}" data-date="${dateStr}">
        <div class="month-day-num">${iterDay}</div>
        <div class="month-day-badges">${badgesHtml}</div>
        ${moreHtml}
      </div>
    `);

    currIter.setDate(currIter.getDate() + 1);
  }

  // Legend HTML
  const legendItemsHtml = Object.values(legendMagazinesMap).map(mag => {
    const color = getMagazineColor(mag.label, mag.id);
    return `
      <div class="legend-item" data-mag-id="${mag.id}">
        <span class="legend-dot" style="background-color:${color.dot};"></span>
        <span>${mag.label || mag.name}</span>
      </div>
    `;
  }).join('');

  const html = `
    <div class="month-grid-header">
      ${DAYS_SHORT_UK.map(d => `<div>${d}</div>`).join('')}
    </div>
    <div class="month-grid-body">
      ${cells.join('')}
    </div>
    ${legendItemsHtml.length ? `
      <div class="month-calendar-legend">
        ${legendItemsHtml}
      </div>
    ` : ''}
  `;

  container.innerHTML = html;

  // Bind Day Cell Clicks
  container.querySelectorAll('.month-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      if (dateStr) {
        onSelectDay?.(dateStr);
      }
    });
  });
}
