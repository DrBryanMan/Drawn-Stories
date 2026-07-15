import { API } from '../helpers/api.js';
import { LANG_MAP } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';

// Local helper functions for rendering themes (identical to VolumeEditor / editorUtils)
function buildThemeChipsHTML(selectedThemes) {
  const chipClassByType = (type) => {
      if (type === 'genre') return ' chip-genre';
      if (type === 'type')  return ' chip-type';
      return ' chip-theme';
  };
  const makeChips = (arr) => arr.map(t => {
    const label = t.ua_name || t.name;
    return `
      <span class="chip ${chipClassByType(t.type)}" data-id="${t.id}">
        ${label}
        <button type="button" onclick="window._emRemoveThemeGlobal(${t.id})" title="Видалити">×</button>
      </span>
  `}).join('');
  return makeChips(selectedThemes);
}

function buildThemeCheckboxListHTML(allThemes, selectedIds) {
  const renderItem = (t) => {
    const label = t.ua_name || t.name;
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
              onchange="window._emThemeChangeGlobal(); this.closest('.theme-checkbox-item').classList.toggle('theme-checkbox-item--checked', this.checked); this.previousElementSibling.classList.toggle('theme-cb-box--checked', this.checked);">
        <span class="theme-cb-label">${label}</span>
      </label>
    `;
  };

  const types   = allThemes.filter(t => t.type === 'type');
  const genres  = allThemes.filter(t => t.type === 'genre');
  const themes  = allThemes.filter(t => t.type === 'theme' || !t.type);

  const parts = [];
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

// Register global handlers
window._emRemoveThemeGlobal = (themeId) => {
    const listEl = document.getElementById('themes-list');
    if (listEl) {
        const cb = listEl.querySelector(`input[value="${themeId}"]`);
        if (cb) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        }
    }
};

window._emThemeChangeGlobal = () => {
    const listEl = document.getElementById('themes-list');
    const chipsEl = document.getElementById('vol-theme-chips');
    const formArea = document.getElementById('gam-form-area');
    if (listEl && chipsEl) {
        const checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
        const selectedIds = new Set(Array.from(checked).map(cb => parseInt(cb.value)));
        
        const selectedThemes = Array.from(checked).map(cb => ({
            id: parseInt(cb.value),
            name: cb.closest('.theme-checkbox-item')?.querySelector('.theme-cb-label')?.textContent?.trim() || '',
            type: cb.dataset.type || 'theme'
        }));
        
        chipsEl.innerHTML = buildThemeChipsHTML(selectedThemes);

        if (formArea) {
            formArea.querySelectorAll('.btn-theme-suggest').forEach(btn => {
                const themeId = parseInt(btn.dataset.id);
                if (selectedIds.has(themeId)) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(59, 130, 246, 0.15)';
                    btn.style.color = '#3b82f6';
                    btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'var(--bg-card)';
                    btn.style.color = 'var(--text-muted)';
                    btn.style.borderColor = 'var(--border)';
                }
            });
        }
    }
};

window._emFilterThemesGlobal = (q) => {
    const list = document.getElementById('themes-list');
    if (!list) return;
    const query = q.toLowerCase();
    list.querySelectorAll('.theme-checkbox-item').forEach(item => {
        const uaText = item.querySelector('.theme-cb-label')?.textContent?.toLowerCase() || '';
        const enText = item.querySelector('input')?.dataset?.name || '';
        item.style.display = (uaText.includes(query) || enText.includes(query)) ? '' : 'none';
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
};


const ICON = {
    volume: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>',
    issue: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path><path d="M8 7h8"></path><path d="M8 11h8"></path></svg>',
    collection: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
    readingOrder: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    event: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
    publisher: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v18"></path><path d="M10 22V15a2 2 0 1 1 4 0v7"></path><path d="M4 18h16"></path></svg>',
    mangaChapter: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    save: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
};

const CONTENT_TYPES = [
  { id: 'volume',        icon: ICON.volume, label: 'Том (комікс)'      },
  { id: 'issue',         icon: ICON.issue, label: 'Випуск'            },
  { id: 'collection',    icon: ICON.collection, label: 'Збірник'           },
  { id: 'reading-order', icon: ICON.readingOrder, label: 'Порядок читання'   },
  { id: 'event',         icon: ICON.event, label: 'Подія'             },
  { id: 'publisher',     icon: ICON.publisher, label: 'Видавництво'       },
  { id: 'manga-chapter', icon: ICON.mangaChapter, label: 'Розділ манґи'      },
];

let _modal = null;
let _currentType = null;
let _allThemes = [];
let _selectedSuggestedThemeIds = new Set();

function ensureModal() {
  if (document.getElementById('global-add-modal')) return;

  const el = document.createElement('div');
  el.id = 'global-add-modal';
  el.className = 'ds-modal-overlay';
  el.style.display = 'none';

  el.innerHTML = `
    <div class="ds-modal ds-modal--large" id="gam-box">
      <div class="ds-modal-header">
        <div class="ds-modal-title" id="gam-title">${ICON.plus} Додати контент</div>
        <button class="ds-modal-close" id="gam-close">&times;</button>
      </div>

      <div class="ds-modal-body" style="display: block;">
        <div id="gam-type-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;"></div>
        <div id="gam-form-area" style="display: none;"></div>
        <div id="gam-status" style="display: none; margin-top: 1rem; padding: 12px; border-radius: 8px; font-size: 0.9rem; text-align: center;"></div>
      </div>

      <div class="ds-modal-footer" id="gam-actions" style="display: none;">
        <button id="gam-back" class="btn-admin btn-admin--secondary">${ICON.back} Назад</button>
        <button id="gam-submit" class="btn-admin btn-admin--primary">${ICON.save} Зберегти</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  _modal = el;

  el.addEventListener('click', e => { if (e.target === el) closeGlobalAddModal(); });
  document.getElementById('gam-close').addEventListener('click', closeGlobalAddModal);
  document.getElementById('gam-back').addEventListener('click', showTypeSelection);
  document.getElementById('gam-submit').addEventListener('click', handleSubmit);

  renderTypeGrid();
}

function renderTypeGrid() {
  const grid = document.getElementById('gam-type-grid');
  grid.innerHTML = CONTENT_TYPES.map(t => `
    <button class="gam-type-btn" data-type="${t.id}" style="
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 24px 16px; border: 1px solid var(--border); border-radius: 12px;
      background: var(--bg-card); cursor: pointer; color: var(--text);
      transition: all 0.2s;
    ">
      <span style="color: var(--accent);">${t.icon.replace('width="24"', 'width="32"').replace('height="24"', 'height="32"')}</span>
      <span style="font-weight: 600; font-size: 0.95rem;">${t.label}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.gam-type-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--bg-card-h)';
        btn.style.transform = 'translateY(-2px)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'var(--bg-card)';
        btn.style.transform = 'translateY(0)';
    });
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });
}

function showTypeSelection() {
  _currentType = null;
  document.getElementById('gam-title').innerHTML = `${ICON.plus} Додати контент`;
  document.getElementById('gam-type-grid').style.display = 'grid';
  document.getElementById('gam-form-area').style.display = 'none';
  document.getElementById('gam-actions').style.display = 'none';
  document.getElementById('gam-status').style.display = 'none';
  
  // Reset submit button state
  const submitBtn = document.getElementById('gam-submit');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `${ICON.save} Зберегти`;
  }
}

async function selectType(typeId) {
  _currentType = typeId;
  const type = CONTENT_TYPES.find(t => t.id === typeId);

  document.getElementById('gam-title').innerHTML = `${type.icon} ${type.label}`;
  document.getElementById('gam-type-grid').style.display = 'none';
  document.getElementById('gam-form-area').style.display = 'block';
  document.getElementById('gam-actions').style.display = 'flex';
  document.getElementById('gam-status').style.display = 'none';

  renderForm(typeId);

  if (typeId === 'volume') {
      _selectedSuggestedThemeIds.clear();
      if (_allThemes.length === 0) {
          try {
              const res = await API.get('/themes', { limit: 1000 });
              _allThemes = res.items || res.data || [];
          } catch (err) {
              console.error('Failed to load themes', err);
          }
      }
      const listEl = document.getElementById('themes-list');
      if (listEl) {
          listEl.innerHTML = buildThemeCheckboxListHTML(_allThemes, _selectedSuggestedThemeIds);
          window._emThemeChangeGlobal();
      }
  }
}

function fld(label, html, hint = '', full = false) {
  const labelWithRedAsterisk = label.replace('*', '<span style="color: #db5a5a; margin-left: 2px;">*</span>');
  return `
    <div class="admin-form-group${full ? ' admin-form-group--full' : ''}">
      <label class="admin-label">${labelWithRedAsterisk}</label>
      ${html}
      ${hint ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">${hint}</div>` : ''}
    </div>
  `;
}

function inp(name, type = 'text', placeholder = '') {
  return `<input type="${type}" name="${name}" placeholder="${placeholder}" class="admin-input">`;
}

function imgField(name = 'image', label = 'Обкладинка') {
  return `
    <div class="admin-form-group admin-form-group--full">
      <label class="admin-label">${label}</label>
      <div class="gam-image-field-container" style="display: grid; grid-template-columns: 1fr 140px; gap: 16px; align-items: start;">
        <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px;">
            <input type="url" name="${name}" placeholder="URL зображення (ComicVine, Fandom...)" class="admin-input gam-img-url-input">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="btn-admin btn-admin--secondary" style="margin: 0; cursor: pointer; flex: 1; text-align: center;">
                    ${ICON.plus} Завантажити локально
                    <input type="file" name="${name}_file" class="gam-img-file-input" style="display: none;" accept="image/webp">
                </label>
                <button type="button" class="btn-admin btn-admin--danger gam-img-clear" style="display: none; padding: 8px 12px; align-items: center; justify-content: center; height: 38px;">${ICON.trash}</button>
            </div>
             <div style="font-size: 0.75rem; color: #db5a5a; margin-top: 2px;">Дозволено лише формат <strong>.webp</strong></div>
            <div class="gam-img-filename" style="font-size: 0.75rem; color: var(--text-muted); display: none; word-break: break-all;"></div>
        </div>
        <div class="gam-image-preview" style="
            width: 140px; height: 180px; border: 2px dashed var(--border); border-radius: 8px;
            display: flex; align-items: center; justify-content: center; overflow: hidden;
            background: var(--bg-body); position: relative;
        ">
            <div class="gam-preview-placeholder" style="color: var(--text-muted); text-align: center; padding: 10px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 4px;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <div style="font-size: 0.7rem;">Прев'ю</div>
            </div>
            <img class="gam-preview-img" style="display: none; width: 100%; height: 100%; object-fit: cover;">
        </div>
      </div>
    </div>
  `;
}

const FORMS = {
  'volume': () => `
    <div class="admin-form-grid">
        ${fld('Назва тому *', inp('name', 'text', 'The Amazing Spider-Man'), '', true)}
        ${fld('Рік старту', inp('start_year', 'number'))}
        ${fld('Мова видання', `
            <select name="lang" class="admin-input">
                <option value="">— не вказано</option>
                ${Object.entries(LANG_MAP).map(([code, { flag, label }]) => `<option value="${code}">${flag} ${label}</option>`).join('')}
            </select>
        `)}
        ${fld('Теми', `
            <div class="volume-theme-suggestions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 0.75rem;">
                <button type="button" class="btn-theme-suggest" data-id="44" style="
                    padding: 6px 12px; border: 1px solid var(--border); border-radius: 20px;
                    background: var(--bg-card); color: var(--text-muted); cursor: pointer;
                    font-size: 0.85rem; transition: all 0.2s;
                ">Збірник</button>
                <button type="button" class="btn-theme-suggest" data-id="36" style="
                    padding: 6px 12px; border: 1px solid var(--border); border-radius: 20px;
                    background: var(--bg-card); color: var(--text-muted); cursor: pointer;
                    font-size: 0.85rem; transition: all 0.2s;
                ">Манґа</button>
                <button type="button" class="btn-theme-suggest" data-id="51" style="
                    padding: 6px 12px; border: 1px solid var(--border); border-radius: 20px;
                    background: var(--bg-card); color: var(--text-muted); cursor: pointer;
                    font-size: 0.85rem; transition: all 0.2s;
                ">Перекладене</button>
            </div>
            <input type="text" id="theme-search" class="admin-input" placeholder="Пошук тем..." style="margin-bottom:0.5rem; width:100%;"
                oninput="window._emFilterThemesGlobal(this.value)">
            <div id="themes-list" class="themes-checkbox-list">
                <div style="padding: 8px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Завантаження тем...</div>
            </div>
            <div id="vol-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.5rem; min-height:0; align-items:center;"></div>
        `, 'Оберіть теми, жанри та типи для серії.', true)}
        ${imgField()}
    </div>
  `,
  'issue': () => `
    <div class="admin-form-grid">
        ${fld('Назва випуску', inp('name'), '', true)}
        ${fld('Local Volume ID', inp('volume_id', 'number'))}
        ${fld('Номер випуску *', inp('issue_number'), '', true)}
        ${fld('Дата обкладинки', inp('cover_date', 'date'))}
        ${fld('Дата релізу', inp('release_date', 'date'))}
        ${imgField('image')}
    </div>
  `,
  'collection': () => `
    <div class="admin-form-grid">
        ${fld('Назва збірника *', inp('name', 'text', 'Vol 1: Great Power'), '', true)}
        ${fld('Локальний ID тому', inp('volume_id', 'number'), 'ID тому з адресного рядку тому збірника.')}
        ${fld('Порядковий номер', inp('issue_number', 'text', '56 або AB.56'))}
        ${fld('Дата обкладинки', inp('cover_date', 'date'))}
        ${fld('Дата релізу', inp('release_date', 'date'))}
        ${imgField('image')}
    </div>
  `,
  'reading-order': () => `
    <div class="admin-form-grid">
        ${fld('Назва списку *', inp('name'), '', true)}
        ${fld('Опис списку', `<textarea name="description" class="admin-textarea"></textarea>`, '', true)}
        ${imgField('cv_img', 'Фонове зображення')}
    </div>
  `,
  'event': () => `
    <div class="admin-form-grid">
        ${fld('Назва події *', inp('name'), '', true)}
        ${fld('Рік початку', inp('start_year', 'number'))}
        ${fld('Рік завершення', inp('end_year', 'number'))}
        ${fld('Короткий опис', `<textarea name="description" class="admin-textarea"></textarea>`, '', true)}
        ${imgField('cv_img', 'Постер події')}
    </div>
  `,
  'manga-chapter': () => `
    <div class="admin-form-grid">
        ${fld('ID манґи в системі (DS Vol ID) *', inp('volume_id', 'number'), 'ID тому з адресної стрічки', true)}
        ${fld('Номер розділу *', inp('issue_number'))}
        ${fld('Дата публікації', inp('release_date', 'date'))}
        ${fld('Назва розділу', inp('name'), '', true)}
        ${imgField()}
    </div>
  `,
  'publisher': () => `
    <div class="admin-form-grid">
        ${fld('Назва видавництва *', inp('name'), '', true)}
        ${fld('Тип робіт', `
            <select name="work_type" class="admin-input">
                <option value="comics">Комікси</option>
                <option value="manga">Манґа</option>
                <option value="mixed">Змішаний (Комікси, Манґа)</option>
            </select>
        `)}
        ${fld('Статус', `
            <select name="status" class="admin-input">
                <option value="Active">Активне</option>
                <option value="Inactive">Неактивне</option>
            </select>
        `)}
        ${fld('Синоніми (через ",")', inp('aliases'), 'Наприклад: DC, DC Comics')}
        ${fld('Вевсайт', inp('website', 'url'))}
        ${imgField('image', 'Логотип видавництва')}
    </div>
  `,
};

function renderForm(typeId) {
  const area = document.getElementById('gam-form-area');
  const builder = FORMS[typeId];
  area.innerHTML = builder ? builder() : '';
  initFormHandlers(area);
}

function initFormHandlers(area) {
    initImageHandlers(area);
    
    area.querySelectorAll('.btn-theme-suggest').forEach(btn => {
        btn.addEventListener('click', () => {
            const themeId = parseInt(btn.dataset.id);
            const listEl = document.getElementById('themes-list');
            const cb = listEl ? listEl.querySelector(`input[value="${themeId}"]`) : null;
            
            if (cb) {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            } else {
                if (_selectedSuggestedThemeIds.has(themeId)) {
                    _selectedSuggestedThemeIds.delete(themeId);
                    btn.classList.remove('active');
                    btn.style.background = 'var(--bg-card)';
                    btn.style.color = 'var(--text-muted)';
                    btn.style.borderColor = 'var(--border)';
                } else {
                    _selectedSuggestedThemeIds.add(themeId);
                    btn.classList.add('active');
                    btn.style.background = 'rgba(59, 130, 246, 0.15)';
                    btn.style.color = '#3b82f6';
                    btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
            }
        });
    });
}

function initImageHandlers(area) {
    const urlInput = area.querySelector('.gam-img-url-input');
    const fileInput = area.querySelector('.gam-img-file-input');
    const clearBtn = area.querySelector('.gam-img-clear');
    const filenameLabel = area.querySelector('.gam-img-filename');
    const previewImg = area.querySelector('.gam-preview-img');
    const placeholder = area.querySelector('.gam-preview-placeholder');

    const updatePreview = (src, isRemote = false) => {
        if (src) {
            previewImg.src = isRemote ? normalizeImageUrl(src) : src;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            previewImg.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    };

    urlInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
            updatePreview(val, true);
            // Clear file if URL is entered
            fileInput.value = '';
            filenameLabel.style.display = 'none';
            clearBtn.style.display = 'none';
        } else if (!fileInput.files.length) {
            updatePreview(null);
        }
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => updatePreview(ev.target.result);
            reader.readAsDataURL(file);
            
            filenameLabel.textContent = file.name;
            filenameLabel.style.display = 'block';
            clearBtn.style.display = 'block';
            // Clear URL if file is selected
            urlInput.value = '';
        }
    });

    clearBtn?.addEventListener('click', () => {
        fileInput.value = '';
        filenameLabel.style.display = 'none';
        clearBtn.style.display = 'none';
        updatePreview(urlInput.value.trim() || null);
    });
}

async function handleSubmit() {
  const btn = document.getElementById('gam-submit');
  const status = document.getElementById('gam-status');

  btn.disabled = true;
  const originalBtnText = btn.innerHTML;
  btn.textContent = 'Збереження...';
  status.style.display = 'none';

  try {
    const formArea = document.getElementById('gam-form-area');
    const data = collectFormData(formArea);
    
    // Check for local file upload first
    const fileInput = formArea.querySelector('.gam-img-file-input');
    if (fileInput && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const uploadRes = await API.upload(`/images/upload/${_currentType}`, formData);
        // Use the uploaded URL (it might be cv_img or another field name, but submitData handles mapping)
        const imgFieldName = fileInput.name.replace('_file', '');
        data[imgFieldName] = uploadRes.url;
    }

    const result = await submitData(_currentType, data);

    status.style.display = 'flex';
    status.style.alignItems = 'center';
    status.style.justifyContent = 'center';
    status.style.gap = '8px';
    status.style.background = 'rgba(16, 185, 129, 0.1)';
    status.style.color = '#10b981';
    status.innerHTML = `${ICON.check} Збережено успішно`;

    setTimeout(() => {
      let path = null;
      if (result && result.id) {
        if (_currentType === 'volume') path = `#/volumes/${result.id}`;
        else if (_currentType === 'issue' || _currentType === 'manga-chapter') path = `#/issues/${result.id}`;
        else if (_currentType === 'collection') path = `#/collections/${result.id}`;
        else if (_currentType === 'event') path = `#/events/${result.id}`;
      }
      
      const typeForRedirect = _currentType;
      closeGlobalAddModal();

      if (result && result.id) {
        const supportedTypes = ['volume', 'issue', 'collection', 'event', 'manga-chapter'];
        if (supportedTypes.includes(typeForRedirect) && path) {
          window.location.hash = path;
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    }, 1000);
  } catch (err) {
    status.style.display = 'flex';
    status.style.alignItems = 'center';
    status.style.justifyContent = 'center';
    status.style.gap = '8px';
    status.style.background = 'rgba(239, 68, 68, 0.1)';
    status.style.color = '#ef4444';
    
    let msg = err.message;
    if (msg === 'Method Not Allowed') {
        msg = 'Помилка: цей тип контенту ще не підтримується сервером';
    }
    
    status.innerHTML = `${ICON.alert} ${msg}`;
    btn.disabled = false;
    btn.innerHTML = originalBtnText;
  }
}

function collectFormData(area) {
  const data = {};
  area.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'file') return; // Skip files, handled separately
    const val = el.value.trim();
    data[el.name] = val === '' ? null : val;
  });

  const listEl = area.querySelector('#themes-list');
  if (listEl) {
      const checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
      data.theme_ids = Array.from(checked).map(cb => parseInt(cb.value));
  } else {
      data.theme_ids = [];
  }

  return data;
}

const NUMERIC_FIELDS = ['cv_id', 'cv_vol_id', 'start_year', 'end_year', 'mal_id', 'volume_id'];

async function submitData(typeId, data) {
  const typedData = { ...data };
  NUMERIC_FIELDS.forEach(f => { if (typedData[f]) typedData[f] = parseInt(typedData[f]); });

  let endpoint;
  const MAP = {
    volume: '/volumes', issue: '/issues', collection: '/collections',
    'reading-order': '/reading-orders', event: '/events', publisher: '/publishers',
    'manga-chapter': '/issues'
  };
  endpoint = MAP[typeId];

  if (typeId === 'manga-chapter' && !typedData.name) {
      typedData.name = `Розділ ${typedData.issue_number}`;
  }

  return await API.post(endpoint, typedData);
}

export function openGlobalAddModal() {
  ensureModal();
  if (_modal.style.display === 'flex') return;
  _modal.style.display = 'flex';
  showTypeSelection();
}

export function closeGlobalAddModal() {
  if (_modal) _modal.style.display = 'none';
  _currentType = null;
}
