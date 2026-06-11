import { API } from '../helpers/api.js';
import { LANG_MAP } from '../helpers/lang.js';

const ICON = {
    volume: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>',
    issue: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path><path d="M8 7h8"></path><path d="M8 11h8"></path></svg>',
    collection: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
    readingOrder: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    event: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
    mangaChapter: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    save: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>'
};

const CONTENT_TYPES = [
  { id: 'volume',        icon: ICON.volume, label: 'Том (комікс)'      },
  { id: 'issue',         icon: ICON.issue, label: 'Випуск'            },
  { id: 'collection',    icon: ICON.collection, label: 'Збірник'           },
  { id: 'reading-order', icon: ICON.readingOrder, label: 'Порядок читання'   },
  { id: 'event',         icon: ICON.event, label: 'Подія'             },
  { id: 'manga-chapter', icon: ICON.mangaChapter, label: 'Розділ манґи'      },
];

let _modal = null;
let _currentType = null;

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
}

function selectType(typeId) {
  _currentType = typeId;
  const type = CONTENT_TYPES.find(t => t.id === typeId);

  document.getElementById('gam-title').innerHTML = `${type.icon} ${type.label}`;
  document.getElementById('gam-type-grid').style.display = 'none';
  document.getElementById('gam-form-area').style.display = 'block';
  document.getElementById('gam-actions').style.display = 'flex';
  document.getElementById('gam-status').style.display = 'none';

  renderForm(typeId);
}

function fld(label, html, hint = '', full = false) {
  return `
    <div class="admin-form-group${full ? ' admin-form-group--full' : ''}">
      <label class="admin-label">${label}</label>
      ${html}
      ${hint ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">${hint}</div>` : ''}
    </div>
  `;
}

function inp(name, type = 'text', placeholder = '') {
  return `<input type="${type}" name="${name}" placeholder="${placeholder}" class="admin-input">`;
}

const FORMS = {
  'volume': () => `
    <div class="admin-form-grid">
        ${fld('ComicVine ID', inp('cv_id', 'number'))}
        ${fld('ComicVine Slug', inp('cv_slug'))}
        ${fld('Назва тому *', inp('name', 'text', 'The Amazing Spider-Man'), '', true)}
        ${fld('Рік старту', inp('start_year', 'number'))}
        ${fld('Мова видання', `
            <select name="lang" class="admin-input">
                <option value="">— не вказано</option>
                ${Object.entries(LANG_MAP).map(([code, { flag, label }]) => `<option value="${code}">${flag} ${label}</option>`).join('')}
            </select>
        `)}
        ${fld('URL постера', inp('cv_img', 'url'), '', true)}
    </div>
  `,
  'issue': () => `
    <div class="admin-form-grid">
        ${fld('ComicVine ID', inp('cv_id', 'number'))}
        ${fld('ComicVine Slug', inp('cv_slug'))}
        ${fld('Назва випуску', inp('name'), '', true)}
        ${fld('Volume CV ID', inp('cv_vol_id', 'number'))}
        ${fld('Local Volume ID', inp('ds_vol_id', 'number'))}
        ${fld('Номер випуску *', inp('issue_number'), '', true)}
        ${fld('Дата обкладинки', inp('cover_date', 'date'))}
        ${fld('Дата релізу', inp('release_date', 'date'))}
        ${fld('URL обкладинки', inp('cv_img', 'url'), '', true)}
    </div>
  `,
  'collection': () => `
    <div class="admin-form-grid">
        ${fld('ComicVine ID', inp('cv_id', 'number'))}
        ${fld('ComicVine Slug', inp('cv_slug'))}
        ${fld('Назва збірника *', inp('name'), '', true)}
        ${fld('Parent Volume CV ID', inp('cv_vol_id', 'number'))}
        ${fld('Local Volume ID', inp('volume_id', 'number'))}
        ${fld('Порядковий номер', inp('issue_number'), '', true)}
        ${fld('Дата обкладинки', inp('cover_date', 'date'))}
        ${fld('Дата релізу', inp('release_date', 'date'))}
        ${fld('URL обкладинки', inp('cv_img', 'url'), '', true)}
    </div>
  `,
  'reading-order': () => `
    <div class="admin-form-grid">
        ${fld('Назва списку *', inp('name'), '', true)}
        ${fld('Опис списку', `<textarea name="description" class="admin-textarea"></textarea>`, '', true)}
        ${fld('URL фонового зображення', inp('cv_img', 'url'), '', true)}
    </div>
  `,
  'event': () => `
    <div class="admin-form-grid">
        ${fld('Назва події *', inp('name'), '', true)}
        ${fld('Рік початку', inp('start_year', 'number'))}
        ${fld('Рік завершення', inp('end_year', 'number'))}
        ${fld('Короткий опис', `<textarea name="description" class="admin-textarea"></textarea>`, '', true)}
        ${fld('URL постера події', inp('cv_img', 'url'), '', true)}
    </div>
  `,
  'manga-chapter': () => `
    <div class="admin-form-grid">
        ${fld('ID манґи в системі (DS Vol ID) *', inp('ds_vol_id', 'number'), 'ID тому з адресної стрічки', true)}
        ${fld('Номер розділу *', inp('issue_number'))}
        ${fld('Дата публікації', inp('release_date', 'date'))}
        ${fld('Назва розділу', inp('name'), '', true)}
        ${fld('URL обкладинки розділу', inp('cv_img', 'url'), '', true)}
    </div>
  `,
};

function renderForm(typeId) {
  const area = document.getElementById('gam-form-area');
  const builder = FORMS[typeId];
  area.innerHTML = builder ? builder() : '';
}

async function handleSubmit() {
  const btn = document.getElementById('gam-submit');
  const status = document.getElementById('gam-status');

  btn.disabled = true;
  btn.textContent = 'Збереження...';
  status.style.display = 'none';

  try {
    const data = collectFormData();
    await submitData(_currentType, data);

    status.style.display = 'block';
    status.style.background = 'rgba(16, 185, 129, 0.1)';
    status.style.color = '#10b981';
    status.textContent = '✓ Збережено успішно';

    setTimeout(closeGlobalAddModal, 1000);
  } catch (err) {
    status.style.display = 'block';
    status.style.background = 'rgba(239, 68, 68, 0.1)';
    status.style.color = '#ef4444';
    status.textContent = `✗ ${err.message}`;
    btn.disabled = false;
    btn.textContent = 'Зберегти';
  }
}

function collectFormData() {
  const area = document.getElementById('gam-form-area');
  const data = {};
  area.querySelectorAll('[name]').forEach(el => {
    const val = el.value.trim();
    data[el.name] = val === '' ? null : val;
  });
  return data;
}

const NUMERIC_FIELDS = ['cv_id', 'cv_vol_id', 'start_year', 'end_year', 'mal_id', 'ds_vol_id', 'volume_id'];

async function submitData(typeId, data) {
  const typedData = { ...data };
  NUMERIC_FIELDS.forEach(f => { if (typedData[f]) typedData[f] = parseInt(typedData[f]); });

  let endpoint;
  const MAP = {
    volume: '/volumes', issue: '/issues', collection: '/collections',
    'reading-order': '/reading-orders', event: '/events', 'manga-chapter': '/issues'
  };
  endpoint = MAP[typeId];

  if (typeId === 'manga-chapter' && !typedData.name) {
      typedData.name = `Розділ ${typedData.issue_number}`;
  }

  return await API.post(endpoint, typedData);
}

export function openGlobalAddModal() {
  ensureModal();
  _modal.style.display = 'flex';
  showTypeSelection();
}

export function closeGlobalAddModal() {
  if (_modal) _modal.style.display = 'none';
  _currentType = null;
}
