import { renderMagazineSelectDropdown } from './MagazineSelectDropdown.js';
import { icon } from '../../helpers/icons.js';
import { t, getCurrentLanguage } from '../../helpers/i18n.js';

export function renderCalendarControls(container, options = {}) {
  const {
    currentDate = new Date(),
    viewMode = 'month',
    selectedMagazineId = '',
    magazinesList = [],
    onPrev,
    onNext,
    onToday,
    onDateSelect,
    onViewChange,
    onMagazineChange,
    onOpenLegend
  } = options;

  const currentLang = getCurrentLanguage();
  const locale = currentLang === 'en' ? 'en-US' : 'uk-UA';

  let dateTitle = '';
  if (viewMode === 'month') {
    const monthFormatted = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    dateTitle = monthFormatted.charAt(0).toUpperCase() + monthFormatted.slice(1);
  } else {
    // Week date range
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startMonth = startOfWeek.toLocaleDateString(locale, { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString(locale, { month: 'short' });

    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      dateTitle = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${startMonth} ${startOfWeek.getFullYear()}`;
    } else {
      dateTitle = `${startOfWeek.getDate()} ${startMonth} - ${endOfWeek.getDate()} ${endMonth}`;
    }
  }

  const yyyy = currentDate.getFullYear();
  const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
  const dd = String(currentDate.getDate()).padStart(2, '0');
  const isoDate = `${yyyy}-${mm}-${dd}`;

  const html = `
    <div class="calendar-controls-bar">
      <div class="calendar-controls-left">
        <div class="calendar-nav-group">
          <button type="button" class="calendar-btn calendar-btn-icon" id="cal-btn-prev" title="${t('prev_period')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="calendar-date-display">${dateTitle}</div>
          <button type="button" class="calendar-btn calendar-btn-icon" id="cal-btn-next" title="${t('next_period')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <button type="button" class="calendar-btn calendar-btn-icon calendar-btn-today" id="cal-btn-today" title="${t('go_to_today')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>

        <div class="calendar-datepicker-wrapper">
          <button type="button" class="calendar-btn calendar-btn-icon calendar-btn-today" id="cal-btn-datepicker" title="${t('select_date_tooltip')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          </button>
          <input type="date" class="calendar-datepicker-input" id="cal-native-date" value="${isoDate}">
        </div>
      </div>

      <div class="calendar-controls-right">
        <button type="button" class="calendar-btn calendar-btn-today" id="cal-btn-legend" title="${t('legend_tooltip')}">
          ${icon('bookOpen', 16)}
          <span>${t('legend')}</span>
        </button>

        <div id="cal-mag-dropdown-slot"></div>

        <div class="calendar-view-toggle">
          <button type="button" class="calendar-toggle-btn ${viewMode === 'week' ? 'active' : ''}" data-view="week">${t('week')}</button>
          <button type="button" class="calendar-toggle-btn ${viewMode === 'month' ? 'active' : ''}" data-view="month">${t('month')}</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind Custom Dropdown
  const magSlot = container.querySelector('#cal-mag-dropdown-slot');
  if (magSlot) {
    renderMagazineSelectDropdown(magSlot, {
      selectedMagazineId,
      magazinesList,
      onSelect: (magId) => onMagazineChange?.(magId)
    });
  }

  // Bind Events
  container.querySelector('#cal-btn-prev')?.addEventListener('click', () => onPrev?.());
  container.querySelector('#cal-btn-next')?.addEventListener('click', () => onNext?.());
  container.querySelector('#cal-btn-today')?.addEventListener('click', () => onToday?.());
  container.querySelector('#cal-btn-legend')?.addEventListener('click', () => onOpenLegend?.());

  const dateInput = container.querySelector('#cal-native-date');
  const datepickerBtn = container.querySelector('#cal-btn-datepicker');

  if (datepickerBtn && dateInput) {
    datepickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
      } else {
        dateInput.click();
        dateInput.focus();
      }
    });

    dateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        onDateSelect?.(new Date(e.target.value + 'T00:00:00'));
      }
    });
  }

  container.querySelectorAll('.calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.view;
      if (mode && mode !== viewMode) {
        onViewChange?.(mode);
      }
    });
  });
}
