import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { createPaginator } from '../components/Pagination.js';
import { updateEditsPendingCount } from '../shell.js';
import { langName } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';

const ICON = {
    user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    message: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    pending: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="margin-right: 4px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    approved: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="margin-right: 4px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>',
    rejected: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="margin-right: 4px; vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

export async function renderEdits(main) {
    main.innerHTML = `
        <div class="container container--main">
            <div class="catalog-heading" style="margin-bottom: 1.5rem;">
                <h1 class="catalog-title">Модерація правок</h1>
                <p class="catalog-subtitle">Перегляд та опрацювання пропозицій редагування від користувачів</p>
            </div>
            
            <div class="edits-filter-bar">
                <div class="filter-section results-section">
                    <div class="results-label">Правок</div>
                    <div class="results-value" id="edits-count-value">—</div>
                </div>
                
                <div class="filter-section search-section">
                    <div class="search-inner">
                        <span class="search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input type="text" id="edits-search-input" class="search-input-pill" placeholder="Пошук за назвою..." autocomplete="off">
                    </div>
                </div>

                <div class="filter-section select-section" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select id="filter-entity-type" class="filter-select">
                        <option value="">Всі типи</option>
                    </select>
                    <select id="filter-proposer" class="filter-select">
                        <option value="">Всі автори</option>
                    </select>
                    <select id="filter-moderator" class="filter-select">
                        <option value="">Всі модератори</option>
                    </select>
                </div>
                
                <div class="filter-section tabs-section">
                    <div class="wanted-ct-group" role="group" id="edits-status-tabs">
                        <button class="wanted-ct-btn is-active" data-status="all">Всі</button>
                        <button class="wanted-ct-btn" data-status="pending">Очікують</button>
                        <button class="wanted-ct-btn" data-status="approved">Схвалені</button>
                        <button class="wanted-ct-btn" data-status="rejected">Відхилені</button>
                    </div>
                </div>
            </div>

            <div class="loader-container" id="edits-loader"><div class="loader"></div></div>
            <div id="edits-content" style="display: none;">
                <div class="edits-list" id="edits-list"></div>
                <div id="edits-pagination" class="pagination-wrap" style="margin-top: 2rem;"></div>
            </div>
        </div>
    `;

    const loader = main.querySelector('#edits-loader');
    const content = main.querySelector('#edits-content');
    const listContainer = main.querySelector('#edits-list');
    const paginator = createPaginator({ pageSize: 20 });
    
    let allEdits = [];
    let themesCache = [];
    let state = {
        status: 'all',
        search: '',
        entityType: '',
        proposer: '',
        moderator: ''
    };

    async function loadThemes() {
        try {
            const res = await API.get('/themes');
            themesCache = res.items || [];
        } catch (err) {
            console.error('Помилка завантаження тем:', err);
        }
    }

    async function loadEdits() {
        try {
            loader.style.display = 'flex';
            content.style.display = 'none';
            
            await loadThemes();
            allEdits = await API.get('/edits');
            
            populateFilters();
            
            loader.style.display = 'none';
            content.style.display = 'block';
            
            renderFilteredList();
        } catch (err) {
            loader.style.display = 'none';
            listContainer.innerHTML = `<div class="error-msg">Помилка завантаження правок: ${err.message}</div>`;
        }
    }

    function populateFilters() {
        const proposers = new Set();
        const moderators = new Set();
        const entityTypes = new Set();
        
        allEdits.forEach(e => {
            if (e.proposer_username) proposers.add(e.proposer_username);
            if (e.moderator_username) moderators.add(e.moderator_username);
            if (e.entity_type) entityTypes.add(e.entity_type);
        });
        
        const proposerSelect = main.querySelector('#filter-proposer');
        const moderatorSelect = main.querySelector('#filter-moderator');
        const entityTypeSelect = main.querySelector('#filter-entity-type');
        
        if (proposerSelect) {
            proposerSelect.innerHTML = '<option value="">Всі автори</option>' + 
                Array.from(proposers).sort().map(p => `<option value="${p}">${p}</option>`).join('');
            proposerSelect.value = state.proposer;
        }
        
        if (moderatorSelect) {
            moderatorSelect.innerHTML = '<option value="">Всі модератори</option>' + 
                Array.from(moderators).sort().map(m => `<option value="${m}">${m}</option>`).join('');
            moderatorSelect.value = state.moderator;
        }

        if (entityTypeSelect) {
            entityTypeSelect.innerHTML = '<option value="">Всі типи</option>' + 
                Array.from(entityTypes).sort().map(t => {
                    const label = t === 'volume' ? 'Том' : t;
                    return `<option value="${t}">${label}</option>`;
                }).join('');
            entityTypeSelect.value = state.entityType;
        }
    }

    function renderFilteredList() {
        const filtered = allEdits.filter(e => {
            if (state.status !== 'all' && e.status !== state.status) return false;
            if (state.entityType && e.entity_type !== state.entityType) return false;
            if (state.proposer && e.proposer_username !== state.proposer) return false;
            if (state.moderator && e.moderator_username !== state.moderator) return false;
            
            if (state.search) {
                const title = (e.volume_name_uk || e.volume_name || '').toLowerCase();
                if (!title.includes(state.search.toLowerCase())) return false;
            }
            return true;
        });

        // Оновимо кількість знайдених правок
        const countVal = main.querySelector('#edits-count-value');
        if (countVal) {
            countVal.textContent = filtered.length;
        }

        const total = filtered.length;
        const page = paginator.getPage();
        const pageSize = paginator.getPageSize();
        const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

        if (pageItems.length === 0) {
            listContainer.innerHTML = `<div class="empty-msg">Немає запитів на правку, що відповідають фільтрам.</div>`;
            const paginationWrap = main.querySelector('#edits-pagination');
            if (paginationWrap) paginationWrap.innerHTML = '';
            return;
        }

        listContainer.innerHTML = pageItems.map(e => renderEditCard(e)).join('');

        // Рендер пагінатора
        const paginationWrap = main.querySelector('#edits-pagination');
        if (paginationWrap) {
            paginationWrap.replaceChildren(
                paginator.render(total, () => {
                    renderFilteredList();
                    listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                })
            );
        }

        attachCardEvents();
    }

    function attachCardEvents() {
        listContainer.querySelectorAll('.btn-show-diff').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.edit-card');
                const diffBlock = card.querySelector('.edit-diff-container');
                const isExpanded = diffBlock.style.display === 'block';
                diffBlock.style.display = isExpanded ? 'none' : 'block';
                btn.classList.toggle('is-active', !isExpanded);
                btn.innerHTML = `${ICON.eye} ${isExpanded ? 'Показати деталі' : 'Сховати деталі'}`;
            });
        });

        listContainer.querySelectorAll('.btn-approve-edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const editId = btn.dataset.id;
                if (confirm('Схвалити цю правку та застосувати зміни до тома?')) {
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Обробка...';
                        await API.post(`/edits/${editId}/approve`);
                        await loadEdits();
                        await updateEditsPendingCount();
                    } catch (err) {
                        alert('Помилка затвердження: ' + err.message);
                        btn.disabled = false;
                        btn.textContent = 'Схвалити';
                    }
                }
            });
        });

        listContainer.querySelectorAll('.btn-reject-edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const editId = btn.dataset.id;
                const reason = prompt('Введіть причину відхилення правок (необов\'язково):');
                if (reason !== null) {
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Обробка...';
                        await API.post(`/edits/${editId}/reject`, { moderator_comment: reason });
                        await loadEdits();
                        await updateEditsPendingCount();
                    } catch (err) {
                        alert('Помилка відхилення: ' + err.message);
                        btn.disabled = false;
                        btn.textContent = 'Відхилити';
                    }
                }
            });
        });
    }

    function renderEditCard(e) {
        const statusLabels = {
            'pending': `<span class="edit-status-badge edit-status--pending">${ICON.pending} Очікує</span>`,
            'approved': `<span class="edit-status-badge edit-status--approved">${ICON.approved} Схвалено</span>`,
            'rejected': `<span class="edit-status-badge edit-status--rejected">${ICON.rejected} Відхилено</span>`
        };

        const entityLabel = e.entity_type === 'volume' ? 'Том' : e.entity_type;
        const entityName = e.volume_name_uk || e.volume_name || `ID ${e.entity_id}`;
        const entityLink = e.entity_type === 'volume' ? `#/volumes/${e.entity_id}` : '#/';

        const patchObj = e.patch_data || {};
        const beforeData = patchObj.before || {};
        const afterData = patchObj.after || patchObj;

        const volumeImg = normalizeImageUrl(e.volume_cv_img || afterData.cv_img || beforeData.cv_img || '');
        const volumeImgHTML = `
            <div class="edit-entity-image-wrap">
                ${volumeImg 
                    ? `<img src="${volumeImg}" class="edit-entity-image" alt="Обкладинка" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` 
                    : ''
                }
                <div class="edit-entity-image-placeholder" style="${volumeImg ? 'display:none;' : 'display:flex;'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
            </div>
        `;

        let commentHTML = '';
        if (e.comment) {
            commentHTML = `
                <div class="edit-comment-block">
                    <span class="comment-icon">${ICON.message}</span>
                    <span class="comment-text"><strong>Коментар автора:</strong> ${escapeHtml(e.comment)}</span>
                </div>
            `;
        }

        let proposerMetaHTML = `
            <div class="meta-group-left">
                <span class="meta-item">${ICON.user} Запропонував: <strong>${escapeHtml(e.proposer_username)}</strong> (${formatDate(e.created_at)})</span>
            </div>
        `;

        let moderatorMetaHTML = '';
        if (e.status !== 'pending') {
            const modAction = e.status === 'approved' ? 'Схвалено' : 'Відхилено';
            const modUser = e.moderator_username || `ID ${e.moderator_id}`;
            const modDate = formatDate(e.moderated_at);
            const reason = e.moderator_comment ? ` <span class="meta-reason-text" title="${escapeHtml(e.moderator_comment)}">(${escapeHtml(e.moderator_comment)})</span>` : '';
            moderatorMetaHTML = `
                <div class="meta-group-right">
                    <span class="meta-item">${ICON.user} ${modAction}: <strong>${modUser}</strong> (${modDate})${reason}</span>
                </div>
            `;
        }

        let actionsHTML = '';
        if (e.status === 'pending') {
            actionsHTML = `
                <div class="edit-card-actions">
                    <button class="btn-admin btn-admin--primary btn-approve-edit" data-id="${e.id}">Схвалити</button>
                    <button class="btn-admin btn-admin--danger btn-reject-edit" data-id="${e.id}">Відхилити</button>
                </div>
            `;
        }

        return `
            <div class="edit-card" id="edit-card-${e.id}">
                <div class="edit-card-header">
                    <div class="edit-card-info">
                        ${volumeImgHTML}
                        <div class="edit-entity-details">
                            <div class="edit-entity-header-line">
                                <span class="edit-entity-badge">${entityLabel}</span>
                            </div>
                            <a href="${entityLink}" class="edit-entity-title">${escapeHtml(entityName)}</a>
                        </div>
                    </div>
                    <div class="edit-card-meta">
                        <span class="edit-id-text">#${e.id}</span>
                        ${statusLabels[e.status]}
                    </div>
                </div>
                
                <div class="edit-card-body">
                    <div class="edit-meta-line">
                        ${proposerMetaHTML}
                        ${moderatorMetaHTML}
                    </div>
                    
                    ${getChangedFieldsBadges(beforeData, afterData)}
                    
                    ${commentHTML}
                    
                    <div class="edit-diff-wrap">
                        <button class="btn-show-diff" data-id="${e.id}">${ICON.eye} Показати деталі</button>
                        <div class="edit-diff-container" style="display: none;">
                            ${generateDiffHTML(beforeData, afterData)}
                        </div>
                    </div>
                </div>
                
                ${actionsHTML}
            </div>
        `;
    }

    function getChangedFieldsBadges(before, after) {
        const fields = {
            'name': 'Назва оригінальна',
            'name_native': 'Рідна назва',
            'name_uk': 'Назва UA',
            'start_year': 'Рік початку',
            'synopsis_ua': 'Синопсис UA',
            'synopsis': 'Синопсис EN',
            'description': 'Опис тома',
            'lang': 'Мова',
            'site_link': 'Джерело',
            'cv_img': 'Обкладинка',
            'cover_img': 'Банер'
        };
        
        const badges = [];
        
        // 1. Прості поля
        for (const [key, label] of Object.entries(fields)) {
            if (after[key] !== undefined && after[key] !== null) {
                const beforeVal = String(before[key] || '').trim();
                const afterVal = String(after[key] || '').trim();
                if (beforeVal !== afterVal) {
                    badges.push(`<span class="changed-field-badge">${label}</span>`);
                }
            }
        }
        
        // 2. Теми
        if (after.theme_ids !== undefined && after.theme_ids !== null) {
            const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
            const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();
            if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
                badges.push(`<span class="changed-field-badge changed-field-badge--themes">Теми</span>`);
            }
        }
        
        // 3. Персонал
        if (after.staff !== undefined && after.staff !== null) {
            const beforeStaffText = (before.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
            const afterStaffText = (after.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
            if (beforeStaffText !== afterStaffText) {
                badges.push(`<span class="changed-field-badge changed-field-badge--staff">Персонал</span>`);
            }
        }
        
        // 4. Персонажі
        if (after.characters !== undefined && after.characters !== null) {
            const beforeCharsText = (before.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
            const afterCharsText = (after.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
            if (beforeCharsText !== afterCharsText) {
                badges.push(`<span class="changed-field-badge changed-field-badge--characters">Персонажі</span>`);
            }
        }
        
        if (badges.length === 0) {
            return `<div class="changed-fields-wrap"><span class="changed-field-badge changed-field-badge--none">Немає фактичних змін</span></div>`;
        }
        
        return `<div class="changed-fields-wrap">${badges.join('')}</div>`;
    }

    function generateDiffHTML(before, after) {
        let html = '<div class="edit-patch-details">';
        
        const fields = {
            'name': { label: 'Назва оригінальна', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>' },
            'name_native': { label: 'Рідна назва', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>' },
            'name_uk': { label: 'Назва UA', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>' },
            'start_year': { label: 'Рік початку', icon: ICON.calendar || '' },
            'synopsis_ua': { label: 'Синопсис UA', icon: ICON.message || '' },
            'synopsis': { label: 'Синопсис EN', icon: ICON.message || '' },
            'description': { label: 'Опис тома', icon: ICON.message || '' },
            'lang': { label: 'Мова', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>' },
            'site_link': { label: 'Посилання на джерело', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' },
            'cv_img': { label: 'Обкладинка', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
            'cover_img': { label: 'Банер', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' }
        };
        
        let hasChanges = false;
        
        // 1. Порівнюємо прості поля
        for (const [key, info] of Object.entries(fields)) {
            if (after[key] !== undefined && after[key] !== null) {
                const beforeVal = String(before[key] || '').trim();
                const afterVal = String(after[key] || '').trim();
                
                if (beforeVal !== afterVal) {
                    hasChanges = true;
                    let displayBefore = beforeVal;
                    let displayAfter = afterVal;
                    if (key === 'lang') {
                        displayBefore = beforeVal ? (langName(beforeVal) || beforeVal) : '—';
                        displayAfter = afterVal ? (langName(afterVal) || afterVal) : '—';
                    }
                    html += renderDiffField(info.label, info.icon, displayBefore, displayAfter, key);
                }
            }
        }
        
        // 2. Порівнюємо Теми
        if (after.theme_ids !== undefined && after.theme_ids !== null) {
            const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
            const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();
            
            if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
                hasChanges = true;
                
                const getThemeChipHTML = (id, list) => {
                    const found = (list || []).find(t => t.id === id);
                    let name = found ? found.name : '';
                    if (!name) {
                        const cached = themesCache.find(t => t.id === id);
                        name = cached ? (cached.ua_name || cached.name) : '';
                    }
                    const label = name ? `#${id} ${name}` : `#${id}`;
                    return `<span class="diff-theme-chip" title="${escapeHtml(name)}">${escapeHtml(label)}</span>`;
                };
                
                const beforeText = beforeIds.map(id => getThemeChipHTML(id, before.themes)).join('') || '—';
                const afterText = afterIds.map(id => getThemeChipHTML(id, after.themes)).join('') || '—';
                html += renderDiffField('Теми', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>', beforeText, afterText, 'themes');
            }
        }
        
        // 3. Порівнюємо персонал
        if (after.staff !== undefined && after.staff !== null) {
            const beforeStaffText = (before.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
            const afterStaffText = (after.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
            
            if (beforeStaffText !== afterStaffText) {
                hasChanges = true;
                html += renderDiffField('Персонал', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', beforeStaffText, afterStaffText);
            }
        }
        
        // 4. Порівнюємо персонажів
        if (after.characters !== undefined && after.characters !== null) {
            const beforeCharsText = (before.characters || []).map(c => `ID персонажа: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';
            const afterCharsText = (after.characters || []).map(c => `ID персонажа: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';
            
            if (beforeCharsText !== afterCharsText) {
                hasChanges = true;
                html += renderDiffField('Персонажі', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>', beforeCharsText, afterCharsText);
            }
        }
        
        if (!hasChanges) {
            html += '<div class="empty-msg" style="padding: 10px 0;">Немає фактичних змін (дані збігаються з поточними в базі даних).</div>';
        }
        
        html += '</div>';
        return html;
    }

    function renderDiffField(label, iconHtml, beforeVal, afterVal, key = '') {
        let beforeRendered = beforeVal ? escapeHtml(beforeVal) : '<em>порожньо</em>';
        let afterRendered = afterVal ? escapeHtml(afterVal) : '<em>видалено</em>';
        
        if (key === 'cv_img' || key === 'cover_img') {
            const isBanner = key === 'cover_img';
            const imgClass = isBanner ? 'diff-image-preview diff-image-preview--banner' : 'diff-image-preview';
            const beforeUrl = normalizeImageUrl(beforeVal);
            const afterUrl = normalizeImageUrl(afterVal);
            
            beforeRendered = beforeVal ? `
                <div class="diff-image-preview-wrap">
                    <img src="${beforeUrl}" class="${imgClass}" alt="До">
                    <a href="${beforeUrl}" target="_blank" class="edit-img-link">${escapeHtml(beforeVal)}</a>
                </div>
            ` : '<em>порожньо</em>';
            
            afterRendered = afterVal ? `
                <div class="diff-image-preview-wrap">
                    <img src="${afterUrl}" class="${imgClass}" alt="Після">
                    <a href="${afterUrl}" target="_blank" class="edit-img-link">${escapeHtml(afterVal)}</a>
                </div>
            ` : '<em>видалено</em>';
        } else if (key === 'site_link') {
            beforeRendered = beforeVal ? `<a href="${beforeVal}" target="_blank" class="edit-site-link">${escapeHtml(beforeVal)}</a>` : '<em>порожньо</em>';
            afterRendered = afterVal ? `<a href="${afterVal}" target="_blank" class="edit-site-link">${escapeHtml(afterVal)}</a>` : '<em>видалено</em>';
        } else if (key === 'themes') {
            beforeRendered = beforeVal !== '—' ? `<div class="diff-theme-chips">${beforeVal}</div>` : '<em>порожньо</em>';
            afterRendered = afterVal !== '—' ? `<div class="diff-theme-chips">${afterVal}</div>` : '<em>видалено</em>';
        }
        
        return `
            <div class="diff-field-block">
                <div class="diff-field-title">
                    ${iconHtml}
                    <span>${label}</span>
                </div>
                <div class="diff-columns">
                    <div class="diff-col diff-col--before">
                        <span class="diff-col-label">До</span>
                        <span class="diff-col-value">${beforeRendered}</span>
                    </div>
                    <div class="diff-col diff-col--after">
                        <span class="diff-col-label">Після</span>
                        <span class="diff-col-value">${afterRendered}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const date = new Date(dateStr.replace(' ', 'T'));
            return date.toLocaleString('uk-UA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    // Обробка перемикання статусів
    const statusTabs = main.querySelector('#edits-status-tabs');
    if (statusTabs) {
        const btns = statusTabs.querySelectorAll('.wanted-ct-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                state.status = btn.dataset.status;
                paginator.reset();
                renderFilteredList();
            });
        });
    }

    // Текстовий пошук
    const searchInput = main.querySelector('#edits-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.search = e.target.value.trim();
            paginator.reset();
            renderFilteredList();
        });
    }

    // Селект типу контенту
    const entityTypeSelect = main.querySelector('#filter-entity-type');
    if (entityTypeSelect) {
        entityTypeSelect.addEventListener('change', (e) => {
            state.entityType = e.target.value;
            paginator.reset();
            renderFilteredList();
        });
    }

    // Селект автора
    const proposerSelect = main.querySelector('#filter-proposer');
    if (proposerSelect) {
        proposerSelect.addEventListener('change', (e) => {
            state.proposer = e.target.value;
            paginator.reset();
            renderFilteredList();
        });
    }

    // Селект модератора
    const moderatorSelect = main.querySelector('#filter-moderator');
    if (moderatorSelect) {
        moderatorSelect.addEventListener('change', (e) => {
            state.moderator = e.target.value;
            paginator.reset();
            renderFilteredList();
        });
    }

    await loadEdits();
}
