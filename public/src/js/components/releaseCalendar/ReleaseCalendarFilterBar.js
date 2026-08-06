import { renderPublisherSelectDropdown } from './PublisherSelectDropdown.js';
import { icon } from '../../helpers/icons.js';

export function renderReleaseCalendarFilterBar(container, options = {}) {
  const {
    currentDate = new Date(),
    selectedPublisherId = '',
    publishersList = [],
    releaseType = 'issues', // 'issues' | 'collections'
    category = 'comics',    // 'comics' | 'manga'
    totalResults = 0,
    onPrevWeek,
    onNextWeek,
    onToday,
    onDateSelect,
    onPublisherChange,
    onReleaseTypeChange,
    onCategoryChange
  } = options;

  const monthsUkShort = [
    'Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер',
    'Лип', 'Сер', 'Вер', 'Жов', 'Лист', 'Груд'
  ];

  const monthsUkFull = [
    'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
    'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'
  ];

  // Calculate Monday and Sunday of current week
  const startOfWeek = new Date(currentDate);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Period status logic (Архів / Цей тиждень / Майбутнє)
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  let periodLabel = 'Цей тиждень';
  let periodIcon = 'clock';
  let periodClass = 'period-current';

  if (todayObj < startOfWeek) {
    periodLabel = 'Майбутнє';
    periodIcon = 'sparkles';
    periodClass = 'period-future';
  } else if (todayObj > endOfWeek) {
    periodLabel = 'Архів';
    periodIcon = 'archive';
    periodClass = 'period-past';
  }

  // Date Range Title
  let dateRangeTitle = '';
  if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
    const monthName = monthsUkFull[startOfWeek.getMonth()];
    dateRangeTitle = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${monthName} ${startOfWeek.getFullYear()}`;
  } else {
    const startMonth = monthsUkShort[startOfWeek.getMonth()];
    const endMonth = monthsUkShort[endOfWeek.getMonth()];
    dateRangeTitle = `${startOfWeek.getDate()} ${startMonth} - ${endOfWeek.getDate()} ${endMonth} ${endOfWeek.getFullYear()}`;
  }

  const yyyy = currentDate.getFullYear();
  const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
  const dd = String(currentDate.getDate()).padStart(2, '0');
  const isoDate = `${yyyy}-${mm}-${dd}`;

  const html = `
    <div class="calendar-controls-bar release-cal-controls-bar">
      <!-- Секція 1 (Ліворуч): Лічильник та плашка періоду часу -->
      <div class="release-cal-section release-cal-counter-section">
        <div class="release-cal-counter" title="Загальна кількість результатів">
          <span class="release-cal-counter-num">${totalResults}</span>
          <span class="release-cal-counter-label">релізів</span>
        </div>
        
        <div class="release-period-badge ${periodClass}" title="Статус періоду">
          ${icon(periodIcon, 14)}
          <span>${periodLabel}</span>
        </div>
      </div>

      <div class="release-cal-divider"></div>

      <!-- Секція 2 (По центру / Навігація): Перемикання тижнів, вибрана дата, кнопка Сьогодні -->
      <div class="release-cal-section calendar-controls-left">
        <div class="calendar-nav-group">
          <button type="button" class="calendar-btn calendar-btn-icon" id="rel-btn-prev" title="Попередній тиждень">
            ${icon('chevronLeft', 18)}
          </button>
          <div class="calendar-date-display">${dateRangeTitle}</div>
          <button type="button" class="calendar-btn calendar-btn-icon" id="rel-btn-next" title="Наступний тиждень">
            ${icon('chevronRight', 18)}
          </button>
        </div>

        <button type="button" class="calendar-btn calendar-btn-icon calendar-btn-today" id="rel-btn-today" title="Поточний день">
          ${icon('clock', 18)}
        </button>

        <div class="calendar-datepicker-wrapper">
          <button type="button" class="calendar-btn calendar-btn-icon calendar-btn-today" id="rel-btn-datepicker" title="Обрати дату">
            ${icon('calendar', 18)}
          </button>
          <input type="date" class="calendar-datepicker-input" id="rel-native-date" value="${isoDate}">
        </div>
      </div>

      <div class="release-cal-divider"></div>

      <!-- Секція 3 (Праворуч): Фільтри -->
      <div class="release-cal-section calendar-controls-right release-cal-filters-right">
        <!-- Picker видавництва -->
        <div id="rel-pub-dropdown-slot"></div>

        <!-- Перемикач типом релізу: Випуски / Збірники -->
        <div class="calendar-view-toggle release-type-toggle">
          <button type="button" class="calendar-toggle-btn ${releaseType === 'issues' ? 'active' : ''}" data-type="issues">
            Випуски
          </button>
          <button type="button" class="calendar-toggle-btn ${releaseType === 'collections' ? 'active' : ''}" data-type="collections">
            Збірники
          </button>
        </div>

        <!-- Перемикач категорії: Комікси / Манґа -->
        <div class="calendar-view-toggle category-toggle">
          <button type="button" class="calendar-toggle-btn ${category === 'comics' ? 'active' : ''}" data-category="comics">
            Комікси
          </button>
          <button type="button" class="calendar-toggle-btn ${category === 'manga' ? 'active' : ''}" data-category="manga">
            Манґа
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind Publisher Dropdown
  const pubSlot = container.querySelector('#rel-pub-dropdown-slot');
  if (pubSlot) {
    renderPublisherSelectDropdown(pubSlot, {
      selectedPublisherId,
      publishersList,
      onSelect: (pubId) => onPublisherChange?.(pubId)
    });
  }

  // Bind Nav Events
  container.querySelector('#rel-btn-prev')?.addEventListener('click', () => onPrevWeek?.());
  container.querySelector('#rel-btn-next')?.addEventListener('click', () => onNextWeek?.());
  container.querySelector('#rel-btn-today')?.addEventListener('click', () => onToday?.());

  const dateInput = container.querySelector('#rel-native-date');
  const datepickerBtn = container.querySelector('#rel-btn-datepicker');

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

  // Release Type Switcher Events
  container.querySelectorAll('.release-type-toggle .calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type && type !== releaseType) {
        onReleaseTypeChange?.(type);
      }
    });
  });

  // Category Switcher Events
  container.querySelectorAll('.category-toggle .calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      if (cat && cat !== category) {
        onCategoryChange?.(cat);
      }
    });
  });
}
