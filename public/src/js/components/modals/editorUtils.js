// admin/js/editorUtils.js
import { getCurrentLanguage } from '../../helpers/i18n.js';

export const PINNED_PUBLISHER_IDS = [
  11,  // Marvel
  4,   // DC
  199, // Image
  332, // IDW
  361, // Dynamite Entertainment
  182, // Disney
];

export const PINNED_THEME_IDS = [
  36, // манґа
  35, // журнал
  71, // репрінт
  73, // видається - в журналах манґа
  72, // публікується - в збірниках манґа
];

export function chipClassByType(type) {
  if (type === 'genre') return ' chip-genre';
  if (type === 'type')  return ' chip-type';
  return ' chip-theme';
}

export function buildThemeChipsHTML(allThemes, removeFnName) {
  const lang = getCurrentLanguage() || 'uk';
  const getThemeLabel = (t) => {
    const raw = (lang === 'en' ? (t.name || t.ua_name) : (t.ua_name || t.name)) || '';
    return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : '';
  };
  const types   = allThemes.filter(t => t.type === 'type');
  const genres  = allThemes.filter(t => t.type === 'genre');
  const themes  = allThemes.filter(t => t.type === 'theme' || !t.type);

  const makeChips = (arr) => arr.map(t => {
    const label = getThemeLabel(t);
    return `
      <span class="chip ${chipClassByType(t.type)}" data-id="${t.id}">
        ${label}
        <button type="button" onclick="${removeFnName}(${t.id})" title="Видалити">×</button>
      </span>
  `}).join('');

  const parts = [];
  if (types.length) {
    parts.push(`<span class="theme-chip-group-label" style="width: 100%;">Типи:</span>${makeChips(types)}`);
  }
  if (genres.length) {
    parts.push(`<span class="theme-chip-group-label" style="${types.length ? 'margin-left:0.25rem;' : ''} width: 100%;">Жанри:</span>${makeChips(genres)}`);
  }
  if (themes.length) {
    const hasLabel = types.length || genres.length;
    parts.push(`${hasLabel ? '<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Теми:</span>' : ''}${makeChips(themes)}`);
  }
  return parts.join('');
}

export function buildThemeCheckboxListHTML(allThemes, selectedIds, onChangeFn) {
  const pinnedIds = new Set(PINNED_THEME_IDS);
  const pinned  = allThemes.filter(t => pinnedIds.has(t.id));
  const types   = allThemes.filter(t => !pinnedIds.has(t.id) && t.type === 'type');
  const genres  = allThemes.filter(t => !pinnedIds.has(t.id) && t.type === 'genre');
  const themes  = allThemes.filter(t => !pinnedIds.has(t.id) && (t.type === 'theme' || !t.type));

  const lang = getCurrentLanguage() || 'uk';
  const locale = lang === 'en' ? 'en' : 'uk';
  const getThemeLabel = (t) => {
    const raw = (lang === 'en' ? (t.name || t.ua_name) : (t.ua_name || t.name)) || '';
    return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : '';
  };
  const sortAlphabetically = (a, b) => getThemeLabel(a).localeCompare(getThemeLabel(b), locale, { sensitivity: 'base' });

  pinned.sort(sortAlphabetically);
  types.sort(sortAlphabetically);
  genres.sort(sortAlphabetically);
  themes.sort(sortAlphabetically);

  const renderItem = (t) => {
    const label = getThemeLabel(t);
    const checked = selectedIds.has(t.id);
    return `
      <label class="theme-checkbox-item${checked ? ' theme-checkbox-item--checked' : ''}">
        <span class="theme-cb-box${checked ? ' theme-cb-box--checked' : ''}">
          <svg class="theme-cb-check" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <input type="checkbox" value="${t.id}"
              data-type="${t.type || 'theme'}"
              data-name="${(t.name || '').toLowerCase()}"
              data-ua-name="${label.toLowerCase()}"
              ${checked ? 'checked' : ''}
              onchange="${onChangeFn}(); this.closest('.theme-checkbox-item').classList.toggle('theme-checkbox-item--checked', this.checked); this.previousElementSibling.classList.toggle('theme-cb-box--checked', this.checked);">
        <span class="theme-cb-label">${label}</span>
      </label>
    `;
  };

  const parts = [];
  if (pinned.length) {
    parts.push(`<div class="theme-group-header theme-group-header--pinned">⭐ Закріплені</div>`);
    parts.push(pinned.map(renderItem).join(''));
  }
  if (types.length) {
    parts.push(`<div class="theme-group-header">📂 Типи</div>`);
    parts.push(types.map(renderItem).join(''));
  }
  if (genres.length) {
    parts.push(`<div class="theme-group-header">🎭 Жанри</div>`);
    parts.push(genres.map(renderItem).join(''));
  }
  if (themes.length) {
    parts.push(`<div class="theme-group-header">🏷️ Теми</div>`);
    parts.push(themes.map(renderItem).join(''));
  }
  return parts.join('');
}

export function filterThemeCheckboxList(query, listId) {
  const q = query.toLowerCase();
  const list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('.theme-checkbox-item').forEach(item => {
    const uaText = item.querySelector('.theme-cb-label')?.textContent?.toLowerCase() || '';
    const enText = item.querySelector('input')?.dataset?.name || '';
    item.style.display = (uaText.includes(q) || enText.includes(q)) ? '' : 'none';
  });
  list.querySelectorAll('.theme-group-header').forEach(header => {
    let next = header.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('theme-group-header')) {
      if (next.style.display !== 'none') { hasVisible = true; break; }
      next = next.nextElementSibling;
    }
    header.style.display = hasVisible ? '' : 'none';
  });
}

export function publisherSearchHTML({ publisherId, publisherName, inputId, hiddenId, resultsId, chipId }) {
  return `
    <div class="admin-form-group admin-form-group--full">
      <label class="admin-label">Видавництво</label>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.35rem;" id="${chipId}">
        ${publisherId ? `
          <span class="chip chip-publisher" data-id="${publisherId}">
            🏢 ${publisherName || 'ID:' + publisherId}
            <button type="button" onclick="window.clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
          </span>
        ` : ''}
      </div>
      <input type="hidden" id="${hiddenId}" name="publisher" value="${publisherId || ''}">
      <input type="text" id="${inputId}" class="admin-input" placeholder="Пошук видавництва..."
             style="width:100%; margin-bottom:0.35rem;"
             autocomplete="off">
      <div id="${resultsId}" class="publisher-inline-list">
        <div class="publisher-list-loading">Завантаження...</div>
      </div>
    </div>
  `;
}

export function initPublisherSearch({ inputId, hiddenId, resultsId, chipId, API }) {
  const input  = document.getElementById(inputId);
  const listEl = document.getElementById(resultsId);
  if (!input || !listEl) return;

  let timeout = null;

  async function renderPinned() {
    listEl.innerHTML = `
      <div class="publisher-group-header">📌 Рекомендовані</div>
      ${PINNED_PUBLISHER_IDS.map(id => `
        <div class="publisher-list-item" data-pub-id="${id}">
          🏢 <span class="pub-name-placeholder" data-id="${id}">…</span>
        </div>
      `).join('')}
    `;
    
    try {
        const res = await API.get(`/publishers?ids=${PINNED_PUBLISHER_IDS.join(',')}&limit=50`);
        const pubs = res.data || res.items || [];
        pubs.forEach(p => {
          const els = listEl.querySelectorAll(`.pub-name-placeholder[data-id="${p.id}"]`);
          els.forEach(el => {
            el.textContent = p.name;
            const item = el.closest('.publisher-list-item');
            item.onclick = () => window.selectPublisher(chipId, hiddenId, inputId, resultsId, p.id, p.name);
          });
        });
    } catch (err) {
        console.error('Error loading pinned publishers:', err);
    }
  }

  function renderSearch(q) {
    listEl.innerHTML = `<div class="publisher-list-loading">Пошук…</div>`;
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      try {
        const res = await API.get(`/publishers?search=${encodeURIComponent(q)}&limit=20`);
        const pubs = res.data || res.items || [];
        if (!pubs.length) {
          listEl.innerHTML = `<div class="publisher-list-empty">Нічого не знайдено</div>`;
          return;
        }
        listEl.innerHTML = pubs.map(p => `
          <div class="publisher-list-item" onclick="window.selectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}',${p.id},'${p.name.replace(/'/g, "\\'")}')">
            🏢 ${p.name}
            <span style="color:var(--text-muted); font-size:0.75rem; margin-left:auto;">id: ${p.id}</span>
          </div>
        `).join('');
      } catch (_) {
        listEl.innerHTML = `<div class="publisher-list-empty">Помилка пошуку</div>`;
      }
    }, 250);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) renderPinned();
    else    renderSearch(q);
  });

  renderPinned();
}

window.selectPublisher = (chipId, hiddenId, inputId, resultsId, pubId, pubName) => {
  const chip = document.getElementById(chipId);
  if (chip) {
    chip.innerHTML = `
      <span class="chip chip-publisher" data-id="${pubId}">
        🏢 ${pubName}
        <button type="button" onclick="window.clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
      </span>
    `;
  }
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = pubId;
  const input  = document.getElementById(inputId);
  if (input)  input.value = '';
};

window.clearPublisher = (chipId, hiddenId, inputId) => {
  const chip = document.getElementById(chipId);
  if (chip) chip.innerHTML = '';
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = '';
};
