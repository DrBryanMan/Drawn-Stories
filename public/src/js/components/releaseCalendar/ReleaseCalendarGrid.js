import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';

const DAYS_UK = [
  'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'
];

const MONTHS_UK = [
  'Травня', 'Червня', 'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня', 'Січня', 'Лютого', 'Березня', 'Квітня'
];

function getMonthNameGenitive(monthIndex) {
  const genitiveMonths = [
    'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
    'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'
  ];
  return genitiveMonths[monthIndex] || '';
}

/**
 * Renders a release card without top badges.
 */
function renderReleaseGridCard(item) {
  const cover = normalizeImageUrl(item.image);
  const isCollection = item.is_collection || item.type === 'collection';
  const issueNumLabel = item.issue_number ? `#${item.issue_number}` : '';

  const mainTitle = item.name || item.volume_name_uk || item.volume_name || 'Без назви';
  const volLabel = item.volume_name_uk || item.volume_name || '';

  const link = isCollection ? `#/collections/${item.id}` : `#/issues/${item.id}`;

  return `
    <a href="${link}" class="issue-grid-card release-grid-card">
      <div class="issue-grid-cover-wrap">
        ${cover
          ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy" alt="${escapeHtmlAttribute(mainTitle)}">`
          : `<div class="issue-grid-cover-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
        }
        ${issueNumLabel ? `<div class="issue-grid-number">${escapeHtmlAttribute(issueNumLabel)}</div>` : ''}
      </div>
      <div class="issue-grid-body">
        <div class="issue-grid-title" title="${escapeHtmlAttribute(mainTitle)}">${escapeHtmlAttribute(mainTitle)}</div>
        ${volLabel && volLabel !== mainTitle ? `<div class="issue-grid-volume-label" title="${escapeHtmlAttribute(volLabel)}">${escapeHtmlAttribute(volLabel)}</div>` : ''}
        ${item.publisher_name ? `<div class="issue-grid-date" style="color: var(--text-muted); font-size: 11px;">${escapeHtmlAttribute(item.publisher_name)}</div>` : ''}
      </div>
    </a>
  `;
}

export function renderReleaseCalendarGrid(container, options = {}) {
  const {
    currentDate = new Date(),
    items = []
  } = options;

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate Monday of current week
  const startOfWeek = new Date(currentDate);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diffToMonday);

  // Generate 7 days for the week
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + i);

    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, '0');
    const day = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    weekDays.push({
      dateObj: dayDate,
      dateStr,
      dayName: DAYS_UK[i],
      dayNumber: dayDate.getDate(),
      monthName: getMonthNameGenitive(dayDate.getMonth()),
      isToday: dateStr === todayStr
    });
  }

  // Group items by dateStr
  const itemsByDate = {};
  items.forEach(item => {
    if (item.release_date) {
      const dStr = item.release_date.split('T')[0];
      if (!itemsByDate[dStr]) itemsByDate[dStr] = [];
      itemsByDate[dStr].push(item);
    }
  });

  let html = `<div class="release-calendar-grid-container">`;

  weekDays.forEach(day => {
    const dayItems = itemsByDate[day.dateStr] || [];
    const count = dayItems.length;
    const isEmpty = count === 0;

    const titleText = `${day.dayName}, ${day.dayNumber} ${day.monthName}`;

    html += `
      <section class="release-day-section ${day.isToday ? 'is-today-section' : ''}">
        <!-- Sticky centered day header -->
        <div class="release-day-header-wrapper">
          <div class="release-day-header ${day.isToday ? 'is-today' : ''} ${isEmpty ? 'is-empty' : ''}">
            <span class="release-day-title">${titleText}</span>
            ${isEmpty 
              ? `<span class="release-day-empty-text">— порожньо</span>` 
              : `<span class="release-day-count-badge">${count}</span>`
            }
          </div>
        </div>

        <!-- Grid of releases for this day -->
        ${!isEmpty ? `
          <div class="release-day-grid catalog-grid">
            ${dayItems.map(item => renderReleaseGridCard(item)).join('')}
          </div>
        ` : ''}
      </section>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;
}
