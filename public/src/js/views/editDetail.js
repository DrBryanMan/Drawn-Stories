import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { updateEditsPendingCount, getAvatarHtml } from '../shell.js';
import { langName } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';

const ICON = {
    user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    message: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    pending: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    approved: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>',
    rejected: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-badge-icon" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

export async function renderEditDetail(main, params) {
    main.innerHTML = `
        <div class="container container--main">
            <div class="back-link-wrap">
                <a href="#/edits" class="back-to-edits-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Назад до списку правок
                </a>
            </div>

            <div class="loader-container" id="edit-detail-loader"><div class="loader"></div></div>
            <div id="edit-detail-content" style="display: none;"></div>
        </div>
    `;

    const loader = main.querySelector('#edit-detail-loader');
    const content = main.querySelector('#edit-detail-content');
    
    let editData = null;
    let themesCache = [];

    async function loadThemes() {
        try {
            const res = await API.get('/themes');
            themesCache = res.items || [];
        } catch (err) {
            console.error('Помилка завантаження тем:', err);
        }
    }

    async function loadEditData() {
        try {
            loader.style.display = 'flex';
            content.style.display = 'none';
            
            await loadThemes();
            editData = await API.get(`/edits/${params.id}`);
            
            loader.style.display = 'none';
            content.style.display = 'block';
            
            renderDetails();
        } catch (err) {
            loader.style.display = 'none';
            content.innerHTML = `<div class="error-msg">Помилка завантаження детальних даних правки: ${err.message}</div>`;
            content.style.display = 'block';
        }
    }

    function renderDetails() {
        const e = editData;
        const statusLabels = {
            'pending': `<span class="edit-status-badge edit-status--pending">${ICON.pending}</span>`,
            'approved': `<span class="edit-status-badge edit-status--approved">${ICON.approved}</span>`,
            'rejected': `<span class="edit-status-badge edit-status--rejected">${ICON.rejected}</span>`
        };

        const entityLabel = e.entity_type === 'volume' ? 'Том' : e.entity_type;
        const entityName = e.volume_name_uk || e.volume_name || `ID ${e.entity_id}`;
        const entityLink = e.entity_type === 'volume' ? `#/volumes/${e.entity_id}` : '#/';

        const patchObj = e.patch_data || {};
        const beforeData = patchObj.before || {};
        const afterData = patchObj.after || patchObj;

        const volumeImg = normalizeImageUrl(e.volume_cv_img || afterData.image || beforeData.image || '');
        const volumeImgHTML = `
            <div class="edit-entity-image-wrap">
                ${volumeImg 
                    ? `<img src="${volumeImg}" class="edit-entity-image" alt="Обкладинка" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` 
                    : ''
                }
                <div class="edit-entity-image-placeholder" style="${volumeImg ? 'display:none;' : 'display:flex;'}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
            </div>
        `;

        const subtitleHTML = e.comment 
            ? `<div class="edit-comment-block" style="margin-top: 8px;">
                   <span class="comment-icon">${ICON.message}</span>
                   <span class="comment-text"><strong>Коментар автора:</strong> ${escapeHtml(e.comment)}</span>
               </div>`
            : `<p class="edit-detail-subtitle">Перегляд змін, запропонованих користувачем, та прийняття рішення про їх затвердження.</p>`;

        // Аватар автора пропозиції
        const proposerAvatarUrl = `/api/auth/avatar/${e.proposer_username}`;
        const proposerAvatarHtml = getAvatarHtml(proposerAvatarUrl, 'person-avatar-img', 44);

        // Картка модератора
        let moderatorCardHTML = '';
        if (e.status !== 'pending') {
            const moderatorAvatarUrl = `/api/auth/avatar/${e.moderator_username}`;
            const moderatorAvatarHtml = getAvatarHtml(moderatorAvatarUrl, 'person-avatar-img', 44);
            const modAction = e.status === 'approved' ? 'Схвалив правку' : 'Відхилив правку';
            const modClass = e.status === 'approved' ? 'moderator-card--approved' : 'moderator-card--rejected';
            const commentMod = e.moderator_comment ? `<div class="person-card-comment"><strong>Коментар:</strong> ${escapeHtml(e.moderator_comment)}</div>` : '';

            moderatorCardHTML = `
                <hr class="people-divider">
                <div class="people-section">
                    <span class="people-section-title">${modAction}</span>
                    <div class="person-card moderator-card ${modClass}">
                        <div class="person-card-avatar">
                            ${moderatorAvatarHtml}
                        </div>
                        <div class="person-card-info">
                            <span class="person-card-name">${escapeHtml(e.moderator_username || 'Модератор')}</span>
                            <span class="person-card-date">${formatDate(e.moderated_at)}</span>
                            ${commentMod}
                        </div>
                    </div>
                </div>
            `;
        }

        // Кнопки дій модератора
        let actionsHTML = '';
        if (e.status === 'pending') {
            actionsHTML = `
                <div class="edit-details-actions-bar">
                    <button class="btn-admin btn-admin--primary btn-approve-edit-detail" data-id="${e.id}">Схвалити правку</button>
                    <button class="btn-admin btn-admin--danger btn-reject-edit-detail" data-id="${e.id}">Відхилити правку</button>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="edit-detail-header-block">
                <div class="edit-detail-title-line">
                    <h1 class="edit-detail-main-title">Правка #${e.id}</h1>
                    ${statusLabels[e.status]}
                </div>
                ${subtitleHTML}
            </div>

            <div class="edit-details-grid">
                <!-- Блок Контент -->
                <div class="edit-detail-block edit-detail-block--content">
                    <h2 class="edit-detail-block-title">
                        <span>Контент</span>
                        <div class="edit-detail-entity-line">
                            <span class="edit-entity-badge">${entityLabel}</span>
                        </div>
                    </h2>
                    <div class="edit-detail-content-card">
                        ${volumeImgHTML}
                        <div class="edit-detail-content-info">
                            <a href="${entityLink}" class="edit-detail-entity-title">${escapeHtml(entityName)}</a>
                        </div>
                    </div>
                </div>

                <!-- Блок Автор/Модератор -->
                <div class="edit-detail-block edit-detail-block--people">
                    <h2 class="edit-detail-block-title">Автор / Модератор</h2>
                    <div class="people-cards-column">
                        <div class="people-section">
                            <span class="people-section-title">Запропонував правку</span>
                            <div class="person-card author-card">
                                <div class="person-card-avatar">
                                    ${proposerAvatarHtml}
                                </div>
                                <div class="person-card-info">
                                    <span class="person-card-name">${escapeHtml(e.proposer_username)}</span>
                                    <span class="person-card-date">${formatDate(e.created_at)}</span>
                                </div>
                            </div>
                        </div>

                        ${moderatorCardHTML}
                    </div>
                </div>
            </div>

            <!-- Блок Деталі зміни -->
            <div class="edit-detail-block edit-detail-block--diff">
                <h2 class="edit-detail-block-title">Деталі правки (зміни)</h2>
                <div class="edit-diff-container-detail">
                    ${generateDiffHTML(beforeData, afterData)}
                </div>
            </div>

            ${renderScoreHistoryBlock(e)}

            ${actionsHTML}
        `;

        attachEvents();
    }

    function renderScoreHistoryBlock(e) {
        const history = e.score_history || [];
        if (history.length === 0) return '';

        const rows = history.map(row => {
            const delta = row.delta;
            const isPositive = delta > 0;
            const chipClass = isPositive ? 'score-chip--positive' : 'score-chip--negative';
            const sign = isPositive ? '+' : '';
            return `
                <div class="score-history-row">
                    <span class="score-chip ${chipClass}">${sign}${delta} б.</span>
                    <span class="score-history-user">${escapeHtml(row.username)}</span>
                    <span class="score-history-reason">${escapeHtml(row.reason)}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="edit-detail-block edit-detail-block--score">
                <h2 class="edit-detail-block-title">
                    <span>Нараховані бали</span>
                </h2>
                <div class="score-history-list">
                    ${rows}
                </div>
            </div>
        `;
    }

    function attachEvents() {
        const btnApprove = content.querySelector('.btn-approve-edit-detail');
        if (btnApprove) {
            btnApprove.addEventListener('click', async () => {
                const editId = btnApprove.dataset.id;
                if (confirm('Схвалити цю правку та застосувати зміни до тома?')) {
                    try {
                        btnApprove.disabled = true;
                        btnApprove.textContent = 'Обробка...';
                        await API.post(`/edits/${editId}/approve`);
                        await updateEditsPendingCount();
                        await loadEditData();
                    } catch (err) {
                        alert('Помилка затвердження: ' + err.message);
                        btnApprove.disabled = false;
                        btnApprove.textContent = 'Схвалити правку';
                    }
                }
            });
        }

        const btnReject = content.querySelector('.btn-reject-edit-detail');
        if (btnReject) {
            btnReject.addEventListener('click', async () => {
                const editId = btnReject.dataset.id;
                const reason = prompt('Введіть причину відхилення правок (необов\'язково):');
                if (reason !== null) {
                    try {
                        btnReject.disabled = true;
                        btnReject.textContent = 'Обробка...';
                        await API.post(`/edits/${editId}/reject`, { moderator_comment: reason });
                        await updateEditsPendingCount();
                        await loadEditData();
                    } catch (err) {
                        alert('Помилка відхилення: ' + err.message);
                        btnReject.disabled = false;
                        btnReject.textContent = 'Відхилити правку';
                    }
                }
            });
        }
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
            'image': 'Обкладинка',
            'cover_img': 'Банер'
        };
        
        const badges = [];
        
        for (const [key, label] of Object.entries(fields)) {
            if (after[key] !== undefined && after[key] !== null) {
                const beforeVal = String(before[key] || '').trim();
                const afterVal = String(after[key] || '').trim();
                if (beforeVal !== afterVal) {
                    badges.push(`<span class="changed-field-badge">${label}</span>`);
                }
            }
        }
        
        if (after.theme_ids !== undefined && after.theme_ids !== null) {
            const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
            const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();
            if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
                badges.push(`<span class="changed-field-badge changed-field-badge--themes">Теми</span>`);
            }
        }
        
        if (after.staff !== undefined && after.staff !== null) {
            const beforeStaffText = (before.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
            const afterStaffText = (after.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
            if (beforeStaffText !== afterStaffText) {
                badges.push(`<span class="changed-field-badge changed-field-badge--staff">Персонал</span>`);
            }
        }
        
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
            'image': { label: 'Обкладинка', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
            'cover_img': { label: 'Банер', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' }
        };
        
        let hasChanges = false;
        
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
        
        if (after.staff !== undefined && after.staff !== null) {
            const beforeStaffText = (before.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
            const afterStaffText = (after.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
            
            if (beforeStaffText !== afterStaffText) {
                hasChanges = true;
                html += renderDiffField('Персонал', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', beforeStaffText, afterStaffText);
            }
        }
        
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
        
        if (key === 'image' || key === 'cover_img') {
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

    await loadEditData();
}
