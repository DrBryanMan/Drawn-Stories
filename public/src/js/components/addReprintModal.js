/* public/src/js/components/addReprintModal.js */
import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

const ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

let _modal = null;
let _config = null;
let _searchTimeout = null;
let _selectedIssue = null;
let _selectedIssueStories = [];
let _searchResults = [];

function ensureModal() {
    if (document.getElementById('add-reprint-modal-overlay')) return;

    const el = document.createElement('div');
    el.id = 'add-reprint-modal-overlay';
    el.className = 'ds-modal-overlay';
    el.style.display = 'none';
    
    el.innerHTML = `
        <div class="ds-modal ds-modal--large">
            <div class="ds-modal-header">
                <div class="ds-modal-title">${ICON.plus} Додати репринт</div>
                <button class="ds-modal-close" id="arm-close-btn">${ICON.x}</button>
            </div>
            <div class="ds-modal-body ds-modal-body--vertical">
                <!-- 1. Фільтри пошуку (arm-filters) layout: 4 + 2 -->
                <div class="arm-filters">
                    <div class="arm-filter-group">
                        <label class="arm-label">Номер випуску</label>
                        <input type="text" id="arm-number" class="arm-input" placeholder="#...">
                    </div>
                    <div class="arm-filter-group">
                        <label class="arm-label">БД ID випуску</label>
                        <input type="number" id="arm-issue-id" class="arm-input" placeholder="ID...">
                    </div>
                    <div class="arm-filter-group">
                        <label class="arm-label">БД ID тому</label>
                        <input type="number" id="arm-volume-id" class="arm-input" placeholder="ID...">
                    </div>
                    <div class="arm-filter-group">
                        <label class="arm-label">CV ID тому</label>
                        <input type="number" id="arm-cv-vol-id" class="arm-input" placeholder="ID...">
                    </div>
                </div>
                
                <div class="arm-filters-row2">
                    <div class="arm-filter-group">
                        <label class="arm-label">Назва випуску</label>
                        <input type="text" id="arm-name" class="arm-input" placeholder="Назва...">
                    </div>
                    <div class="arm-filter-group">
                        <label class="arm-label">Назва тома</label>
                        <input type="text" id="arm-volume" class="arm-input" placeholder="Том...">
                    </div>
                </div>

                <!-- 2. Налаштування репринту (arm-settings-pane) під фільтрами -->
                <div class="arm-settings-pane">
                    <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 14px; color: var(--text);">Налаштування репринту</h4>
                    
                    <div id="arm-selected-info">
                        Виберіть випуск-репринт зі списку результатів нижче
                    </div>
                    
                    <div id="arm-fields-group" class="arm-fields-group">
                        <!-- Перемикач ролі випуску -->
                        <div class="arm-field" style="display: flex; flex-direction: column; gap: 6px; width: 100%; margin-bottom: 8px;">
                            <label class="arm-label">Роль обраного випуску</label>
                            <div style="display: flex; gap: 16px; margin-top: 4px;">
                                <label style="font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text);">
                                    <input type="radio" name="arm-role-radio" id="arm-role-reprint" value="reprint" checked style="accent-color: var(--accent); margin: 0;">
                                    <span>Репринт</span>
                                </label>
                                <label style="font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text);">
                                    <input type="radio" name="arm-role-radio" id="arm-role-original" value="original" style="accent-color: var(--accent); margin: 0;">
                                    <span>Оригінал</span>
                                </label>
                            </div>
                        </div>

                        <div class="arm-field">
                            <label class="arm-label">Оригінальна історія</label>
                            <select id="arm-story-select" class="arm-input" style="height: 38px;"></select>
                        </div>
                        <div class="arm-field arm-field--wide">
                            <label class="arm-label">Назва іншою мовою</label>
                            <input type="text" id="arm-foreign-name" class="arm-input" placeholder="Наприклад, Звонок...">
                        </div>
                    </div>
                </div>

                <!-- 3. Результати пошуку (arm-results-container) під налаштуваннями -->
                <div id="arm-results-container" class="arm-results-container">
                    <div id="arm-results" class="arm-results-grid"></div>
                </div>
            </div>
            <div class="ds-modal-footer">
                <button class="btn-aim btn-aim--secondary" id="arm-cancel-btn">Скасувати</button>
                <button class="btn-aim btn-aim--primary" id="arm-confirm-btn" disabled>
                    ${ICON.plus} Додати репринт
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    _modal = el;

    const close = () => closeAddReprintModal();
    document.getElementById('arm-close-btn').onclick = close;
    document.getElementById('arm-cancel-btn').onclick = close;
    el.onclick = (e) => { if (e.target === el) close(); };

    // Слухаємо зміни радіокнопок ролі
    document.getElementById('arm-role-reprint').addEventListener('change', updateStoriesDropdown);
    document.getElementById('arm-role-original').addEventListener('change', updateStoriesDropdown);

    document.getElementById('arm-confirm-btn').onclick = async (e) => {
        if (!_config || !_selectedIssue) return;
        const confirmBtn = e.currentTarget;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Збереження...';
        
        const isOriginalRoleSelected = document.getElementById('arm-role-original').checked;
        const originalId = isOriginalRoleSelected ? _selectedIssue.id : _config.issueId;
        const reprintId = isOriginalRoleSelected ? _config.issueId : _selectedIssue.id;

        const storySelect = document.getElementById('arm-story-select');
        const foreignNameInput = document.getElementById('arm-foreign-name');
        
        const storyId = storySelect.value === '-1' ? null : parseInt(storySelect.value);
        const storyForeignName = foreignNameInput.value.trim() || null;
        
        try {
            await API.post(`/issues/${_config.issueId}/reprints`, {
                original_id: originalId,
                reprint_id: reprintId,
                story_id: storyId,
                story_foreign_name: storyForeignName
            });
            if (_config.onAdd) {
                _config.onAdd();
            }
            closeAddReprintModal();
        } catch (err) {
            alert('Помилка додавання репринту: ' + err.message);
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `${ICON.plus} Додати репринт`;
        }
    };

    const escHandler = (e) => { 
        if (e.key === 'Escape' && _modal.style.display === 'flex') close(); 
    };
    document.addEventListener('keydown', escHandler);
}

function updateStoriesDropdown() {
    const select = document.getElementById('arm-story-select');
    if (!select) return;
    
    const isOriginalRoleSelected = document.getElementById('arm-role-original').checked;
    let selectHTML = '<option value="-1">Основна історія</option>';
    
    if (isOriginalRoleSelected) {
        // Ми додаємо оригінал, тому оригінальні історії беруться з обраного випуску
        if (_selectedIssueStories && _selectedIssueStories.length > 0) {
            _selectedIssueStories.forEach(story => {
                const name = story.name_ua || story.name_original || `Історія ${story.order_num}`;
                selectHTML += `<option value="${story.id}">${escapeHtmlAttribute(name)}</option>`;
            });
        }
    } else {
        // Ми додаємо репринт, тому оригінал - поточний випуск
        if (_config.stories && _config.stories.length > 0) {
            _config.stories.forEach(story => {
                const name = story.name_ua || story.name_original || `Історія ${story.order_num}`;
                selectHTML += `<option value="${story.id}">${escapeHtmlAttribute(name)}</option>`;
            });
        }
    }
    
    select.innerHTML = selectHTML;
}

export function openAddReprintModal(config) {
    ensureModal();
    if (_modal.style.display === 'flex') return;
    _config = config;
    _selectedIssue = null;
    _selectedIssueStories = [];
    _searchResults = [];

    // Очищаємо поля
    document.getElementById('arm-number').value = '';
    document.getElementById('arm-issue-id').value = '';
    document.getElementById('arm-volume-id').value = '';
    document.getElementById('arm-cv-vol-id').value = '';
    document.getElementById('arm-name').value = '';
    document.getElementById('arm-volume').value = '';
    document.getElementById('arm-results').innerHTML = '';
    
    document.getElementById('arm-role-reprint').checked = true; // за замовчуванням обраний є репринтом
    document.getElementById('arm-selected-info').style.display = 'block';
    document.getElementById('arm-selected-info').innerHTML = 'Виберіть випуск-репринт зі списку результатів нижче';
    document.getElementById('arm-fields-group').style.display = 'none';
    document.getElementById('arm-confirm-btn').disabled = true;

    // Налаштовуємо пошук
    const inputs = ['arm-number', 'arm-issue-id', 'arm-volume-id', 'arm-cv-vol-id', 'arm-volume', 'arm-name'];
    inputs.forEach(id => {
        document.getElementById(id).oninput = () => {
            clearTimeout(_searchTimeout);
            _searchTimeout = setTimeout(runSearch, 400);
        };
    });

    _modal.style.display = 'flex';
    document.getElementById('arm-volume').focus();
}

export function closeAddReprintModal() {
    if (!_modal) return;
    _modal.style.display = 'none';
    _config = null;
    _selectedIssue = null;
    _selectedIssueStories = [];
    _searchResults = [];
    document.getElementById('arm-confirm-btn').disabled = false;
    clearTimeout(_searchTimeout);
}

function setEmptyState(text, isError = false) {
    const resultsEl = document.getElementById('arm-results');
    resultsEl.innerHTML = '';
    
    const parent = document.getElementById('arm-results-container');
    const existingEmpty = parent.querySelector('.arm-empty');
    if (existingEmpty) existingEmpty.remove();

    if (text) {
        const div = document.createElement('div');
        div.className = 'arm-empty';
        if (isError) div.style.color = 'var(--red)';
        div.textContent = text;
        parent.appendChild(div);
    }
}

async function runSearch() {
    if (!_config) return;

    const number = document.getElementById('arm-number').value.trim();
    const issueId = document.getElementById('arm-issue-id').value.trim();
    const volId = document.getElementById('arm-volume-id').value.trim();
    const cvVolId = document.getElementById('arm-cv-vol-id').value.trim();
    const name = document.getElementById('arm-name').value.trim();
    const volume = document.getElementById('arm-volume').value.trim();

    if (!number && !issueId && !volId && !cvVolId && !name && !volume) {
        _searchResults = [];
        setEmptyState(null);
        document.getElementById('arm-results').innerHTML = '';
        return;
    }

    setEmptyState('Пошук...');

    try {
        const params = { limit: 200 };
        if (number) params.issue_number = number;
        if (issueId) params.ds_id = issueId;
        if (volId) params.volume_id = volId;
        if (cvVolId) params.cv_vol_id = cvVolId;
        if (name) params.name = name;
        if (volume) params.volume_name = volume;

        const response = await API.get('/issues', params);
        const data = response.data || [];

        // Виключаємо поточний випуск з результатів пошуку та вже додані
        _searchResults = data.filter(i => i.id !== _config.issueId && !_config.alreadyIds?.has(i.id));

        if (_searchResults.length === 0) {
            setEmptyState('Нічого не знайдено');
            return;
        }

        setEmptyState(null);
        renderResults();
    } catch (err) {
        setEmptyState(`Помилка: ${err.message}`, true);
        _searchResults = [];
    }
}

function renderResults() {
    const resultsEl = document.getElementById('arm-results');
    
    resultsEl.innerHTML = _searchResults.map(issue => {
        const selected = _selectedIssue && _selectedIssue.id === issue.id;
        const img = comicVineImageUrl(issue.cv_img);

        return `
            <div class="arm-card${selected ? ' selected' : ''}" data-id="${issue.id}">
                <div class="arm-card-img-wrap">
                    ${img 
                        ? `<img src="${img}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` 
                        : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">${ICON.book}</div>`}
                    <div class="arm-card-check">${ICON.check}</div>
                </div>
                <div class="arm-card-details">
                    <div class="arm-card-title" title="${escapeHtmlAttribute(issue.name || 'Без назви')}">
                        ${escapeHtmlAttribute(issue.name || 'Без назви')}
                    </div>
                    <div class="arm-card-vol" title="${escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '')}">
                        ${escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '')}
                    </div>
                    <div class="arm-card-num">
                        #${escapeHtmlAttribute(issue.issue_number || '—')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    resultsEl.querySelectorAll('.arm-card').forEach(card => {
        card.onclick = () => {
            const id = parseInt(card.dataset.id);
            const issue = _searchResults.find(i => i.id === id);
            if (!issue) return;

            // Знімаємо вибір з попереднього
            resultsEl.querySelectorAll('.arm-card.selected').forEach(c => {
                c.classList.remove('selected');
            });

            // Вибираємо новий
            card.classList.add('selected');

            selectIssue(issue);
        };
    });
}

async function selectIssue(issue) {
    _selectedIssue = issue;
    _selectedIssueStories = [];
    
    const info = document.getElementById('arm-selected-info');
    const fields = document.getElementById('arm-fields-group');
    const foreignInput = document.getElementById('arm-foreign-name');
    
    info.style.display = 'block';
    info.innerHTML = 'Завантаження історій вибраного випуску...';
    fields.style.display = 'none';
    document.getElementById('arm-confirm-btn').disabled = true;

    try {
        const res = await API.get(`/issues/${issue.id}`);
        _selectedIssueStories = res.stories || [];
        
        info.style.display = 'none';
        fields.style.display = 'flex';
        
        updateStoriesDropdown();
        foreignInput.value = '';
        document.getElementById('arm-confirm-btn').disabled = false;
    } catch (err) {
        info.innerHTML = `<span style="color: var(--red)">Помилка завантаження історій: ${err.message}</span>`;
    }
}
