import { getPublisherColor } from '../../helpers/publisher.js';
import { icon } from '../../helpers/icons.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openCalendarLegendModal(magazinesList = []) {
  const existing = document.getElementById('calendar-legend-modal');
  if (existing) existing.remove();

  // Extract unique publisher names sorted alphabetically
  const publishersSet = new Set();
  magazinesList.forEach(m => {
    if (m.publisher_name) publishersSet.add(m.publisher_name);
  });
  const publishersList = Array.from(publishersSet).sort((a, b) => a.localeCompare(b));

  let currentQuery = '';
  let selectedPublisher = '';

  const modal = document.createElement('div');
  modal.id = 'calendar-legend-modal';
  modal.className = 'ds-modal-overlay';

  function renderItems() {
    const query = currentQuery.trim().toLowerCase();
    const filtered = magazinesList.filter(m => {
      // Publisher filter
      if (selectedPublisher && m.publisher_name !== selectedPublisher) {
        return false;
      }
      // Text search filter
      if (query) {
        const nameMatch = m.name && m.name.toLowerCase().includes(query);
        const labelMatch = m.label && m.label.toLowerCase().includes(query);
        const pubMatch = m.publisher_name && m.publisher_name.toLowerCase().includes(query);
        return nameMatch || labelMatch || pubMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); padding: 24px 0; font-size: 13px;">Журналів не знайдено</div>`;
    }

    return filtered.map(m => {
      const colorHex = getPublisherColor(m);
      const labelText = m.label || m.name;
      const hasDiffLabel = m.label && m.label !== m.name;

      return `
        <div class="legend-modal-row" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 8px;
          background: color-mix(in srgb, ${colorHex} 6%, transparent);
          border: 1px solid color-mix(in srgb, ${colorHex} 16%, transparent);
          gap: 12px;
          transition: transform 0.15s ease, background-color 0.15s ease;
        ">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${colorHex}; flex-shrink: 0;" title="${escapeHtml(m.publisher_name || 'Видавництво')}"></span>
            <span style="font-family: var(--font-monos); font-weight: 700; font-size: 13px; color: ${colorHex}; min-width: 64px; flex-shrink: 0;">${escapeHtml(labelText)}</span>
            <span style="font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
              ${escapeHtml(hasDiffLabel ? m.name : '')}
            </span>
          </div>
          ${m.publisher_name ? `
            <span style="
              font-size: 11px;
              font-weight: 700;
              color: ${colorHex};
              background: color-mix(in srgb, ${colorHex} 12%, transparent);
              padding: 3px 10px;
              border-radius: 12px;
              border: 1px solid color-mix(in srgb, ${colorHex} 25%, transparent);
              flex-shrink: 0;
            ">
              ${escapeHtml(m.publisher_name)}
            </span>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  modal.innerHTML = `
    <div class="ds-modal legend-modal-content" style="max-width: 580px; margin: auto; border-radius: var(--r-lg);">
      <div class="ds-modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-s);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: var(--accent); display: flex; align-items: center;">${icon('bookOpen', 20)}</span>
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text);">Легенда скорочень журналів</h3>
        </div>
        <button class="ds-modal-close-btn" id="close-legend-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted); stroke-width: 2;">&times;</button>
      </div>

      <div style="padding: 12px 20px; border-bottom: 1px solid var(--border-s); background: var(--bg-card);">
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="legend-modal-search" placeholder="Пошук скорочення або назви..." style="flex: 1; min-width: 0; padding: 8px 12px; border-radius: var(--r); border: 1px solid var(--border-s); background: var(--bg-body); color: var(--text); font-size: 13px; outline: none;">
          
          <select id="legend-modal-pub-select" style="min-width: 150px; max-width: 180px; padding: 8px 10px; border-radius: var(--r); border: 1px solid var(--border-s); background: var(--bg-body); color: var(--text); font-size: 13px; outline: none; cursor: pointer;">
            <option value="">Всі видавництва</option>
            ${publishersList.map(pub => `<option value="${escapeHtml(pub)}">${escapeHtml(pub)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="ds-modal-body" id="legend-modal-list" style="padding: 14px 20px; max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
        ${renderItems()}
      </div>

      <div class="ds-modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-s); display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary" id="confirm-legend-modal" style="padding: 6px 18px; border-radius: var(--r); font-weight: 600; cursor: pointer;">Закрити</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');

  const closeModal = () => {
    modal.remove();
    document.body.classList.remove('modal-open');
  };

  modal.querySelector('#close-legend-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#confirm-legend-modal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const searchInput = modal.querySelector('#legend-modal-search');
  const pubSelect = modal.querySelector('#legend-modal-pub-select');
  const listContainer = modal.querySelector('#legend-modal-list');

  searchInput?.addEventListener('input', (e) => {
    currentQuery = e.target.value;
    if (listContainer) {
      listContainer.innerHTML = renderItems();
    }
  });

  pubSelect?.addEventListener('change', (e) => {
    selectedPublisher = e.target.value;
    if (listContainer) {
      listContainer.innerHTML = renderItems();
    }
  });
}
