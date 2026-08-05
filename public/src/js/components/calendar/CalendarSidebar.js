import { getMagazineColor } from './colorHelper.js';

/**
 * Component for rendering right sidebar details for a selected calendar day.
 * Matches 1:1 with user mockup:
 * - Top header with full date and blue release count pill
 * - Magazine banner with accent border, title, subtitle, and pink series count pill
 * - Borderless clean series rows with cover, main title, ukrainian title, and blue issue tag
 */

const DAYS_FULL_UK = [
  'Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'
];

const MONTHS_GENITIVE_UK = [
  'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
  'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'
];

export function renderCalendarSidebar(container, selectedDayDate, dayIssues = []) {
  if (!selectedDayDate) {
    container.innerHTML = `
      <div class="calendar-sidebar">
        <div class="sidebar-date-title" style="color: var(--cal-text-muted);">Оберіть день у календарі</div>
      </div>
    `;
    return;
  }

  const dayOfWeek = DAYS_FULL_UK[selectedDayDate.getDay()];
  const dayNum = selectedDayDate.getDate();
  const monthGenitive = MONTHS_GENITIVE_UK[selectedDayDate.getMonth()];
  const dateTitleStr = `${dayOfWeek}, ${dayNum} ${monthGenitive}`;

  // Calculate total releases count
  let totalReleases = 0;
  dayIssues.forEach(iss => {
    totalReleases += (iss.chapters?.length || 1);
  });

  const issuesBlocksHtml = dayIssues.map(iss => {
    const color = getMagazineColor(iss.magazine_label, iss.magazine_id);
    const seriesCount = iss.chapters?.length || 0;

    const chaptersRowsHtml = (iss.chapters || []).map(ch => {
      const coverUrl = ch.manga_cover || '/public/logo.png';
      const mainTitle = ch.manga_name || ch.manga_name_uk || 'Манґа';
      const subTitle = ch.manga_name_uk && ch.manga_name_uk !== mainTitle ? ch.manga_name_uk : '';
      const chapLabel = ch.chapter_number ? `Розділ <strong>${ch.chapter_number}</strong>` : `Вип. <strong>${iss.issue_number}</strong>`;

      return `
        <a href="#/volumes/${ch.manga_id}" class="sidebar-chapter-row">
          <img src="${coverUrl}" alt="${mainTitle}" class="sidebar-chapter-img" loading="lazy" onerror="this.src='/public/logo.png'">
          <div class="sidebar-chapter-text">
            <div class="sidebar-chapter-main-title">${mainTitle}</div>
            ${subTitle ? `<div class="sidebar-chapter-sub-title">${subTitle}</div>` : ''}
          </div>
          <div class="sidebar-chapter-issue-tag">
            ${chapLabel}
          </div>
        </a>
      `;
    }).join('');

    return `
      <div class="sidebar-issue-section">
        <div class="sidebar-issue-banner" style="
          --mag-color: ${color.dot};
          --mag-bg: ${color.bg};
          --mag-text: ${color.text};
          --mag-pill-bg: ${color.bg};
          --mag-border: ${color.border};
        ">
          <div class="sidebar-issue-banner-left">
            <div class="sidebar-issue-banner-title">
              ${iss.magazine_label || iss.magazine_name} #${iss.issue_number}
            </div>
            <div class="sidebar-issue-banner-subtitle">${iss.magazine_name}</div>
          </div>
          <div class="sidebar-issue-banner-pill">${seriesCount} серій</div>
        </div>

        ${chaptersRowsHtml ? `<div class="sidebar-chapters-container">${chaptersRowsHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
    <div class="calendar-sidebar">
      <div class="sidebar-top-header">
        <div class="sidebar-date-title">${dateTitleStr}</div>
        <div class="sidebar-release-pill">${totalReleases} виходи</div>
      </div>

      <div class="sidebar-body">
        ${issuesBlocksHtml.length ? issuesBlocksHtml : '<div style="padding: 24px; color: var(--cal-text-muted); text-align: center; font-size: 0.9rem;">На цей день немає випусків</div>'}
      </div>
    </div>
  `;

  container.innerHTML = html;
}
