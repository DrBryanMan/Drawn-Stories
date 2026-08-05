import { getMagazineColor } from './colorHelper.js';

/**
 * Component for rendering week grid layout (7 day sections Mon..Sun)
 * with magazine cards and chapter items directly visible for each day.
 */

const DAYS_FULL_UK = [
  'Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'
];

const MONTHS_GENITIVE_UK = [
  'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
  'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'
];

export function renderCalendarWeekGrid(container, options = {}) {
  const {
    currentDate = new Date(),
    issuesList = [],
    onSelectDay
  } = options;

  // Compute Monday of current week
  const monday = new Date(currentDate);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);

  // Group issues by release date
  const issuesByDate = {};
  issuesList.forEach(iss => {
    if (iss.release_date) {
      if (!issuesByDate[iss.release_date]) {
        issuesByDate[iss.release_date] = [];
      }
      issuesByDate[iss.release_date].push(iss);
    }
  });

  const dayColumns = [];

  for (let i = 0; i < 7; i++) {
    const iterDate = new Date(monday);
    iterDate.setDate(monday.getDate() + i);

    const yyyy = iterDate.getFullYear();
    const mm = String(iterDate.getMonth() + 1).padStart(2, '0');
    const dd = String(iterDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const dayName = DAYS_FULL_UK[iterDate.getDay()];
    const dateFormatted = `${iterDate.getDate()} ${MONTHS_GENITIVE_UK[iterDate.getMonth()]}`;

    const dayIssues = issuesByDate[dateStr] || [];

    const issuesHtml = dayIssues.map(iss => {
      const color = getMagazineColor(iss.magazine_label, iss.magazine_id);

      const chaptersHtml = (iss.chapters || []).map(ch => {
        const coverUrl = ch.manga_cover || '/public/logo.png';
        const title = ch.manga_name || ch.manga_name_uk || 'Манґа';
        const titleUk = ch.manga_name_uk && ch.manga_name_uk !== title ? ch.manga_name_uk : '';
        const chapLabel = ch.chapter_number ? `Розділ ${ch.chapter_number}` : `Вип. ${iss.issue_number}`;

        return `
          <a href="#/volumes/${ch.manga_id}" class="week-chapter-row">
            <img src="${coverUrl}" alt="${title}" class="week-chapter-img" loading="lazy" onerror="this.src='/public/logo.png'">
            <div class="week-chapter-text">
              <div class="week-chapter-main-title">${title}</div>
              ${titleUk ? `<div class="week-chapter-sub-title">${titleUk}</div>` : ''}
              <div class="week-chapter-num-blue">${chapLabel}</div>
            </div>
          </a>
        `;
      }).join('');

      return `
        <div class="week-issue-block" style="
          --mag-color: ${color.dot};
          --mag-bg: ${color.bg};
          --mag-text: ${color.text};
          --mag-border: ${color.border};
        ">
          <div class="week-issue-header">
            <div class="week-issue-title">
              ${iss.magazine_label || iss.magazine_name} #${iss.issue_number}
            </div>
            <div class="week-issue-subtitle">${iss.magazine_name}</div>
          </div>
          <div class="week-chapters-flex">
            ${chaptersHtml.length ? chaptersHtml : '<div style="font-size:0.85rem; color:var(--cal-text-muted); grid-column: 1/-1; padding: 6px 0;">Випуск без доданих розділів</div>'}
          </div>
        </div>
      `;
    }).join('');

    dayColumns.push(`
      <div class="week-day-column">
        <div class="week-day-header">
          <div>${dayName}, ${dateFormatted}</div>
          <span style="font-size: 0.8rem; font-weight: 500; color: var(--cal-text-muted);">${dayIssues.length} випусків</span>
        </div>
        <div class="week-day-issues">
          ${issuesHtml.length ? issuesHtml : '<div style="color: var(--cal-text-muted); font-size: 0.85rem; padding: 10px 0;">Випусків не заплановано</div>'}
        </div>
      </div>
    `);
  }

  const html = `
    <div class="week-grid-container">
      ${dayColumns.join('')}
    </div>
  `;

  container.innerHTML = html;
}
