import { API } from '../helpers/api.js';
import { LANG_MAP } from '../helpers/lang.js';
import { comicVineImageUrl } from '../helpers/image.js';

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
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
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

function imgField(name = 'cv_img', label = 'Обкладинка') {
  return `
    <div class="admin-form-group admin-form-group--full">
      <label class="admin-label">${label}</label>
      <div class="gam-image-field-container" style="display: grid; grid-template-columns: 1fr 140px; gap: 16px; align-items: start;">
        <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px;">
            <input type="url" name="${name}" placeholder="URL зображення (ComicVine, Fandom...)" class="admin-input gam-img-url-input">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="btn-admin btn-admin--secondary" style="margin: 0; cursor: pointer; flex: 1; text-align: center;">
                    ${ICON.plus} Завантажити локально
                    <input type="file" name="${name}_file" class="gam-img-file-input" style="display: none;" accept="image/*">
                </label>
                <button type="button" class="btn-admin btn-admin--danger gam-img-clear" style="display: none; padding: 8px 12px;">&times;</button>
            </div>
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
        ${imgField()}
    </div>
  `,
  'collection': () => `
    <div class="admin-form-grid">
        ${fld('Назва збірника *', inp('name', 'text', 'Vol 1: Great Power'), '', true)}
        ${fld('Локальний ID тому', inp('volume_id', 'number'), 'ID тому з адресного рядку тому збірника.')}
        ${fld('Порядковий номер', inp('issue_number', 'text', '56 або AB.56'))}
        ${fld('Дата обкладинки', inp('cover_date', 'date'))}
        ${fld('Дата релізу', inp('release_date', 'date'))}
        ${imgField()}
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
        ${fld('Тип робіт', inp('work_type', 'text', 'Комікси, Манґа'), 'Через кому')}
        ${fld('Статус', `
            <select name="status" class="admin-input">
                <option value="Active">Активне</option>
                <option value="Inactive">Неактивне</option>
            </select>
        `)}
        ${fld('ComicVine ID', inp('cv_id', 'number'))}
        ${fld('ComicVine Slug', inp('cv_slug'))}
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
  initImageHandlers(area);
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
            previewImg.src = isRemote ? comicVineImageUrl(src) : src;
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

    await submitData(_currentType, data);

    status.style.display = 'flex';
    status.style.alignItems = 'center';
    status.style.justifyContent = 'center';
    status.style.gap = '8px';
    status.style.background = 'rgba(16, 185, 129, 0.1)';
    status.style.color = '#10b981';
    status.innerHTML = `${ICON.check} Збережено успішно`;

    setTimeout(closeGlobalAddModal, 1000);
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
  _modal.style.display = 'flex';
  showTypeSelection();
}

export function closeGlobalAddModal() {
  if (_modal) _modal.style.display = 'none';
  _currentType = null;
}
