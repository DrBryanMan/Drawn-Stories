import { getPublisherColor } from '../../helpers/publisher.js';
import { getCurrentLanguage, t } from '../../helpers/i18n.js';

/**
 * Component for rendering right sidebar details for a selected calendar day.
 */

export function renderCalendarSidebar(container, selectedDayDate, dayIssues = []) {
  const currentLang = getCurrentLanguage();
  const locale = currentLang === 'en' ? 'en-US' : 'uk-UA';

  if (!selectedDayDate) {
    container.innerHTML = `
      <div class="calendar-sidebar">
        <div class="sidebar-date-title" style="color: var(--cal-text-muted);">${t('select_day_in_calendar')}</div>
      </div>
    `;
    return;
  }

  let dayOfWeek = selectedDayDate.toLocaleDateString(locale, { weekday: 'long' });
  dayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

  const dateFormatted = selectedDayDate.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const dateTitleStr = `${dayOfWeek}, ${dateFormatted}`;

  // Calculate total releases count
  let totalReleases = 0;
  dayIssues.forEach(iss => {
    totalReleases += (iss.chapters?.length || 1);
  });

  const issuesBlocksHtml = dayIssues.map(iss => {
    const colorHex = getPublisherColor(iss);
    const seriesCount = iss.chapters?.length || 0;

    const chaptersRowsHtml = (iss.chapters || []).map(ch => {
      const coverUrl = ch.manga_cover || '/public/logo.png';
      const mainTitle = ch.manga_name || ch.manga_name_uk || 'Manga';
      const subTitle = ch.manga_name_uk && ch.manga_name_uk !== mainTitle ? ch.manga_name_uk : '';
      const chapLabel = ch.chapter_number 
        ? `${t('chapter_num_prefix')} <strong>${ch.chapter_number}</strong>` 
        : `${t('issue_num_prefix')} <strong>${iss.issue_number}</strong>`;

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
        <div class="sidebar-issue-banner" style="--mag-color: ${colorHex};">
          <div class="sidebar-issue-banner-left">
            <div class="sidebar-issue-banner-title">
              ${iss.magazine_label || iss.magazine_name} #${iss.issue_number}
            </div>
            <div class="sidebar-issue-banner-subtitle">${iss.magazine_name}</div>
          </div>
          <a href="#/magazines/issues/${iss.issue_id}" class="sidebar-issue-banner-pill">${t('series_count_label', { n: seriesCount })}</a>
        </div>

        ${chaptersRowsHtml ? `<div class="sidebar-chapters-container">${chaptersRowsHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
    <div class="calendar-sidebar">
      <div class="sidebar-top-header">
        <div class="sidebar-date-title">${dateTitleStr}</div>
        <div class="sidebar-release-pill">${t('releases_out_count', { n: totalReleases })}</div>
      </div>

      <div class="sidebar-body">
        ${issuesBlocksHtml.length ? issuesBlocksHtml : `<div style="padding: 24px; color: var(--cal-text-muted); text-align: center; font-size: 0.9rem;">${t('no_issues_on_this_day')}</div>`}
      </div>
    </div>
  `;

  container.innerHTML = html;
}
