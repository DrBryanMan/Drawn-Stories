/* public/src/js/components/addIssueModal.js */
import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

// ── Lucide SVG icons ──────────────────────────────
const ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    layers: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>'
};

let _modal = null;
let _config = null;
let _searchTimeout = null;
let _selectedIssueIds = new Set();
let _currentSearchResults = [];
let _cachedSelectedIssues = new Map();
let _isMangaMode = false;

function ensureModal() {
    if (document.getElementById('add-issue-modal-overlay')) return;

    const el = document.createElement('div');
    el.id = 'add-issue-modal-overlay';
    el.className = 'ds-modal-overlay';
    el.style.display = 'none';
    
    el.innerHTML = `
        <div class="ds-modal ds-modal--large">
            <div class="ds-modal-header">
                <div class="ds-modal-title" id="aim-title"></div>
                <button class="ds-modal-close" id="aim-close-btn">${ICON.x}</button>
            </div>
            <div class="ds-modal-body" id="aim-body"></div>
            <div class="ds-modal-footer">
                <button class="btn-aim btn-aim--secondary" id="aim-cancel-btn">Скасувати</button>
                <button class="btn-aim btn-aim--primary" id="aim-confirm-btn" style="display: none;">
                    ${ICON.plus} Додати вибрані (<span id="aim-selected-count">0</span>)
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    _modal = el;

    const close = () => closeAddIssueModal();
    document.getElementById('aim-close-btn').onclick = close;
    document.getElementById('aim-cancel-btn').onclick = close;
    el.onclick = (e) => { if (e.target === el) close(); };

    document.getElementById('aim-confirm-btn').onclick = async (e) => {
        if (!_config || _selectedIssueIds.size === 0) return;
        const items = Array.from(_selectedIssueIds).map(id => ({
            id,
            is_manga: _isMangaMode
        }));
        const onAdd = _config.onAdd;
        e.currentTarget.disabled = true;
        await onAdd(items);
        closeAddIssueModal();
    };

    const escHandler = (e) => { 
        if (e.key === 'Escape' && _modal.style.display === 'flex') close(); 
    };
    document.addEventListener('keydown', escHandler);
}

function renderModalLayout(layout = 'vertical') {
    const body = document.getElementById('aim-body');
    body.className = `ds-modal-body ds-modal-body--${layout}`;

    const filterClass = layout === 'vertical' ? 'aim-filters--row' : 'aim-filters--col';
    
    const filtersHtml = `
        <div class="aim-filters ${filterClass}">
            <div class="aim-filter-group">
                <label class="aim-label">Номер</label>
                <input type="text" id="aim-number" class="aim-input" placeholder="#...">
            </div>
            <div class="aim-filter-group">
                <label class="aim-label">БД ID тому</label>
                <input type="number" id="aim-volume-id" class="aim-input" placeholder="ID...">
            </div>
            <div class="aim-filter-group">
                <label class="aim-label">CV ID тому</label>
                <input type="number" id="aim-cv-vol-id" class="aim-input" placeholder="ID...">
            </div>
            <div class="aim-filter-group">
                <label class="aim-label">Hikka Slug</label>
                <input type="text" id="aim-hikka-slug" class="aim-input" placeholder="Slug...">
            </div>
            <div class="aim-filter-group">
                <label class="aim-label">Назва випуску</label>
                <input type="text" id="aim-name" class="aim-input" placeholder="Назва...">
            </div>
            <div class="aim-filter-group">
                <label class="aim-label">Назва тому</label>
                <input type="text" id="aim-volume" class="aim-input" placeholder="Том...">
            </div>
            ${_config?.extraFiltersHTML || ''}
        </div>
    `;

    const mainHtml = `
        <div class="aim-selection-bar" id="aim-selection-bar">
            <div style="display: flex; align-items: center; gap: 20px;">
                <label class="aim-select-all" id="aim-select-all-label" style="opacity: 0.5; pointer-events: none;">
                    <input type="checkbox" id="aim-select-all-checkbox" class="aim-checkbox">
                    <span>Вибрати всі <span id="aim-select-all-count"></span></span>
                </label>
                <label class="aim-select-all" id="aim-exact-label" title="Пошук за точним співпадінням назви" style="opacity: 0.5; pointer-events: none;">
                    <input type="checkbox" id="aim-exact-checkbox" class="aim-checkbox">
                    <span>Точне</span>
                </label>
            </div>
            <div id="aim-selection-hint" style="font-size: 12px; color: var(--text-muted); font-weight: 750;"></div>
        </div>
        <div id="aim-content-area">
            <div id="aim-results" class="aim-results-grid"></div>
        </div>
    `;

    if (layout === 'horizontal') {
        body.innerHTML = `
            <div class="aim-sidebar">${filtersHtml}</div>
            <div class="aim-main">${mainHtml}</div>
        `;
    } else {
        body.innerHTML = `${filtersHtml}${mainHtml}`;
    }

    const inputs = ['aim-name', 'aim-volume', 'aim-number', 'aim-volume-id', 'aim-cv-vol-id', 'aim-hikka-slug'];
    inputs.forEach(id => {
        document.getElementById(id).oninput = () => {
            updateCheckboxesState();
            clearTimeout(_searchTimeout);
            _searchTimeout = setTimeout(runSearch, 400);
        };
    });

    document.getElementById('aim-select-all-checkbox').onchange = (e) => {
        toggleSelectAll(e.target.checked);
    };

    document.getElementById('aim-exact-checkbox').onchange = () => {
        runSearch();
    };
}

function updateCheckboxesState() {
    const name = document.getElementById('aim-name')?.value.trim();
    const volume = document.getElementById('aim-volume')?.value.trim();
    const hasText = !!(name || volume);
    
    const exactLabel = document.getElementById('aim-exact-label');
    const exactCheckbox = document.getElementById('aim-exact-checkbox');
    
    if (exactLabel && exactCheckbox) {
        exactLabel.style.opacity = hasText ? '1' : '0.5';
        exactLabel.style.pointerEvents = hasText ? 'auto' : 'none';
        if (!hasText) exactCheckbox.checked = false;
    }

    const selectAllLabel = document.getElementById('aim-select-all-label');
    const hasResults = _currentSearchResults.length > 0;
    if (selectAllLabel) {
        selectAllLabel.style.opacity = hasResults ? '1' : '0.5';
        selectAllLabel.style.pointerEvents = hasResults ? 'auto' : 'none';
    }
}

export function openAddIssueModal(config) {
    ensureModal();
    if (_modal.style.display === 'flex') return;
    _config = config;
    _selectedIssueIds.clear();
    _currentSearchResults = [];
    _cachedSelectedIssues.clear();

    const layout = config.layout || 'vertical';
    renderModalLayout(layout);

    document.getElementById('aim-title').innerHTML = `${ICON.layers} ${config.title || 'Додати випуски'}`;
    document.getElementById('aim-results').innerHTML = '';
    document.getElementById('aim-selection-hint').textContent = '';
    updateConfirmButton();

    _modal.style.display = 'flex';
    document.getElementById('aim-name').focus();
}

export function closeAddIssueModal() {
    if (!_modal) return;
    _modal.style.display = 'none';
    _config = null;
    _selectedIssueIds.clear();
    _currentSearchResults = [];
    _cachedSelectedIssues.clear();
    document.getElementById('aim-confirm-btn').disabled = false;
    clearTimeout(_searchTimeout);
}

function setEmptyState(text, isError = false) {
    const resultsEl = document.getElementById('aim-results');
    const contentArea = document.getElementById('aim-content-area');
    
    // Clear existing results and states
    resultsEl.innerHTML = '';
    const existingStates = contentArea.querySelectorAll('.aim-empty');
    existingStates.forEach(s => s.remove());

    if (text) {
        const div = document.createElement('div');
        div.className = 'aim-empty';
        if (isError) div.style.color = 'var(--red)';
        div.textContent = text;
        contentArea.insertBefore(div, resultsEl);
    }
}

async function runSearch() {
    if (!_config) return;

    const name = document.getElementById('aim-name').value.trim();
    const volume = document.getElementById('aim-volume').value.trim();
    const number = document.getElementById('aim-number').value.trim();
    const volId = document.getElementById('aim-volume-id').value.trim();
    const cvVolId = document.getElementById('aim-cv-vol-id').value.trim();
    const hikkaSlug = document.getElementById('aim-hikka-slug').value.trim();
    const exact = document.getElementById('aim-exact-checkbox').checked;

    if (!name && !volume && !number && !volId && !cvVolId && !hikkaSlug) {
        _currentSearchResults = [];
        updateCheckboxesState();
        if (_selectedIssueIds.size > 0) {
            setEmptyState(null);
            renderResults(Array.from(_cachedSelectedIssues.values()));
        } else {
            setEmptyState(null);
            document.getElementById('aim-results').innerHTML = '';
            document.getElementById('aim-selection-hint').textContent = '';
            document.getElementById('aim-select-all-count').textContent = '';
        }
        return;
    }

    setEmptyState('Пошук...');

    try {
        const params = { limit: 50 };
        if (name) params.name = name;
        if (volume) params.volume_name = volume;
        if (number) params.issue_number = number;
        if (volId) params.volume_id = volId;
        if (cvVolId) params.cv_vol_id = cvVolId;
        if (hikkaSlug) params.hikka_slug = hikkaSlug;
        if (exact) params.exact = true;

        let data = [];
        if (_config.collectionId) {
            const response = await API.get(`/collections/${_config.collectionId}/candidates`, params);
            data = response.data || [];
            _isMangaMode = response.is_manga || false;
        } else {
            const response = await API.get('/issues', params);
            data = response.data || [];
            _isMangaMode = false;
        }

        if (data.length === 0) {
            setEmptyState('Нічого не знайдено');
            _currentSearchResults = [];
            updateCheckboxesState();
            document.getElementById('aim-selection-hint').textContent = '';
            document.getElementById('aim-select-all-count').textContent = '';
            return;
        }

        setEmptyState(null);
        renderResults(data);
    } catch (err) {
        setEmptyState(`Помилка: ${err.message}`, true);
        _currentSearchResults = [];
        updateCheckboxesState();
    }
}

function renderResults(data) {
    const resultsEl = document.getElementById('aim-results');
    const hintEl = document.getElementById('aim-selection-hint');
    const countEl = document.getElementById('aim-select-all-count');

    _currentSearchResults = data.filter(i => !_config.alreadyIds?.has(i.id));
    const alreadyCount = data.length - _currentSearchResults.length;

    resultsEl.innerHTML = data.map(issue => {
        const alreadyAdded = _config.alreadyIds?.has(issue.id);
        const selected = _selectedIssueIds.has(issue.id);
        const img = normalizeImageUrl(issue.cv_img);

        return `
            <div class="aim-card${alreadyAdded ? ' added' : ''}${selected ? ' selected' : ''}" 
                 data-id="${issue.id}">
                <div class="aim-card-img-wrap">
                    ${img 
                        ? `<img src="${img}" class="aim-card-img" loading="lazy">` 
                        : `<div class="aim-card-placeholder">${ICON.book}</div>`}
                    <div class="aim-card-check">${ICON.check}</div>
                </div>
                <div class="aim-card-info">
                    <div class="aim-card-title" title="${escapeHtmlAttribute(issue.name || 'Без назви')}">
                        ${escapeHtmlAttribute(issue.name || 'Без назви')}
                    </div>
                    <div class="aim-card-meta">${escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '')}</div>
                    <div class="aim-card-meta">#${escapeHtmlAttribute(issue.issue_number || '—')}</div>
                </div>
            </div>
        `;
    }).join('');

    if (_currentSearchResults.length > 0) {
        countEl.textContent = `(${_currentSearchResults.length})`;
        hintEl.textContent = alreadyCount > 0 ? `${alreadyCount} вже додано` : '';
    } else {
        countEl.textContent = '';
        hintEl.textContent = alreadyCount > 0 ? `${alreadyCount} вже додано` : '';
    }

    updateCheckboxesState();
    syncSelectAllCheckbox();

    resultsEl.querySelectorAll('.aim-card:not(.added)').forEach(card => {
        card.onclick = () => {
            const id = parseInt(card.dataset.id);
            const issueData = data.find(i => i.id === id);
            
            if (_selectedIssueIds.has(id)) {
                _selectedIssueIds.delete(id);
                _cachedSelectedIssues.delete(id);
                card.classList.remove('selected');
            } else {
                _selectedIssueIds.add(id);
                if (issueData) _cachedSelectedIssues.set(id, issueData);
                card.classList.add('selected');
            }
            updateConfirmButton();
            syncSelectAllCheckbox();
        };
    });
}

function toggleSelectAll(checked) {
    if (!_currentSearchResults.length) return;

    const resultsEl = document.getElementById('aim-results');
    _currentSearchResults.forEach(i => {
        if (checked) {
            _selectedIssueIds.add(i.id);
            _cachedSelectedIssues.set(i.id, i);
        } else {
            _selectedIssueIds.delete(i.id);
            _cachedSelectedIssues.delete(i.id);
        }
        
        const card = resultsEl.querySelector(`.aim-card[data-id="${i.id}"]`);
        if (card) card.classList.toggle('selected', checked);
    });

    updateConfirmButton();
}

function syncSelectAllCheckbox() {
    const cb = document.getElementById('aim-select-all-checkbox');
    if (!cb || !_currentSearchResults.length) return;

    const allSelected = _currentSearchResults.every(i => _selectedIssueIds.has(i.id));
    const someSelected = _currentSearchResults.some(i => _selectedIssueIds.has(i.id));
    
    cb.checked = allSelected;
    cb.indeterminate = someSelected && !allSelected;
}

function updateConfirmButton() {
    const btn = document.getElementById('aim-confirm-btn');
    const countEl = document.getElementById('aim-selected-count');
    const count = _selectedIssueIds.size;

    countEl.textContent = count;
    btn.style.display = count > 0 ? 'inline-flex' : 'none';
}
