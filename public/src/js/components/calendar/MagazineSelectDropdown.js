import { t } from '../../helpers/i18n.js';

/**
 * MagazineSelectDropdown.js
 * Dropdown using the project's standard `.user-search-select` classes.
 * Shows "All magazines" option + Top magazines list immediately on click (no empty state).
 * Filters real-time as user types into search input.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMagazineSelectDropdown(container, options = {}) {
  const {
    selectedMagazineId = '',
    magazinesList = [],
    onSelect
  } = options;

  let selectedValue = selectedMagazineId ? String(selectedMagazineId) : '';
  let searchQuery = '';
  let isOpen = false;

  const placeholder = t ? t('all_magazines') || 'Всі журнали' : 'Всі журнали';
  const searchPlaceholder = t ? t('search_magazine') || 'Пошук журналу...' : 'Пошук журналу...';

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    searchQuery = '';
    render();
  }

  function renderListHTML() {
    let html = `
      <div class="user-search-select__item ${!selectedValue ? 'is-selected' : ''}" data-value="">
        <span>${escapeHtml(placeholder)}</span>
      </div>
    `;

    const query = searchQuery.trim().toLowerCase();

    let displayList = magazinesList;
    if (query) {
      displayList = magazinesList.filter(m =>
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.label && m.label.toLowerCase().includes(query))
      );
    } else {
      // Show top 20 magazines by default when no search query
      displayList = magazinesList.slice(0, 20);
    }

    if (displayList.length === 0) {
      html += `<div class="user-search-select__empty">Журналів не знайдено</div>`;
    } else {
      displayList.forEach(m => {
        const itemVal = String(m.id);
        const isSelected = itemVal === selectedValue;
        const countText = m.series_count !== undefined ? `${m.series_count} серій` : '';

        html += `
          <div class="user-search-select__item ${isSelected ? 'is-selected' : ''}" data-value="${escapeHtml(itemVal)}">
            <span class="mag-item-title">${escapeHtml(m.name)}</span>
            ${countText ? `<span class="mag-item-badge">${countText}</span>` : ''}
          </div>
        `;
      });
    }

    return html;
  }

  function render() {
    const selectedObj = magazinesList.find(m => String(m.id) === String(selectedValue));
    const displayLabel = selectedObj ? selectedObj.name : placeholder;

    container.innerHTML = `
      <div class="user-search-select ${isOpen ? 'is-open' : ''}">
        <button type="button" class="user-search-select__trigger ${selectedValue ? 'has-value' : ''}">
          <span class="user-search-select__label">${escapeHtml(displayLabel)}</span>
          <span class="user-search-select__arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>

        <div class="user-search-select__dropdown" style="display: ${isOpen ? 'block' : 'none'};">
          <div class="user-search-select__search-wrap">
            <span class="user-search-select__search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="text" class="user-search-select__input" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(searchQuery)}" autocomplete="off">
          </div>
          <div class="user-search-select__list">
            ${renderListHTML()}
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const trigger = container.querySelector('.user-search-select__trigger');
    const input = container.querySelector('.user-search-select__input');
    const list = container.querySelector('.user-search-select__list');
    const dropdown = container.querySelector('.user-search-select__dropdown');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      if (isOpen) {
        searchQuery = '';
      }
      render();
      if (isOpen && input) {
        setTimeout(() => input.focus(), 50);
      }
    });

    input?.addEventListener('input', (e) => {
      e.stopPropagation();
      searchQuery = e.target.value;
      if (list) {
        list.innerHTML = renderListHTML();
        bindListItems(list);
      }
    });

    input?.addEventListener('click', (e) => e.stopPropagation());

    bindListItems(list);
  }

  function bindListItems(list) {
    list?.querySelectorAll('.user-search-select__item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.dataset.value;
        selectedValue = val;
        closeDropdown();
        onSelect?.(val);
      });
    });
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Initial render
  render();
}
