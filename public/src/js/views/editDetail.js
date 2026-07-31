import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { updateEditsPendingCount, getAvatarHtml, currentUser } from '../shell.js';
import { langName } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';
import { icon } from '../helpers/icons.js';
import { getChangedFieldBadges, generateDiffHTML } from '../helpers/editDiff.js';

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
            'pending': `<span class="edit-status-badge edit-status--pending">${icon('planned', 16, { strokeWidth: 2.5, class: 'status-badge-icon', style: 'vertical-align: middle;' })}</span>`,
            'approved': `<span class="edit-status-badge edit-status--approved">${icon('check', 16, { strokeWidth: 2.5, class: 'status-badge-icon', style: 'vertical-align: middle;' })}</span>`,
            'rejected': `<span class="edit-status-badge edit-status--rejected">${icon('x', 16, { strokeWidth: 2.5, class: 'status-badge-icon', style: 'vertical-align: middle;' })}</span>`,
            'closed': `<span class="edit-status-badge edit-status--closed">${icon('dropped', 16, { strokeWidth: 2.5, class: 'status-badge-icon', style: 'vertical-align: middle;' })}</span>`
        };

        const ENTITY_TYPE_LABELS = {
            'volume': 'Том',
            'issue': 'Випуск',
            'character': 'Персонаж',
            'person': 'Персона',
            'publisher': 'Видавництво',
            'collection': 'Збірник'
        };
        const entityLabel = ENTITY_TYPE_LABELS[e.entity_type] || e.entity_type;
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
                   <span class="comment-icon">${icon('messageSquare', 14)}</span>
                   <span class="comment-text"><strong>Коментар автора:</strong> ${escapeHtml(e.comment)}</span>
               </div>`
            : `<p class="edit-detail-subtitle">Перегляд змін, запропонованих користувачем, та прийняття рішення про їх затвердження.</p>`;

        // Аватар автора пропозиції
        const proposerAvatarUrl = `/api/auth/avatar/${e.proposer_username}`;
        const proposerAvatarHtml = getAvatarHtml(proposerAvatarUrl, 'person-avatar-img', 44);

        // Картка модератора
        let moderatorCardHTML = '';
        if (e.status !== 'pending' && e.status !== 'closed') {
            const moderatorAvatarUrl = `/api/auth/avatar/${e.moderator_username}`;
            const moderatorAvatarHtml = getAvatarHtml(moderatorAvatarUrl, 'person-avatar-img', 44);
            const modAction = e.status === 'approved' ? 'Схвалив правку' : 'Відхилив правку';
            const modClass = e.status === 'approved' ? 'moderator-card--approved' : 'moderator-card--rejected';
            const commentMod = e.moderator_comment ? `<div class="person-card-comment"><strong>Коментар:</strong> ${escapeHtml(e.moderator_comment)}</div>` : '';

            moderatorCardHTML = `
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

        // Кнопки дій модератора та адміністратора
        let actionsHTML = '';
        const isOwner = currentUser && currentUser.username === e.proposer_username;
        const isPrivileged = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (e.status === 'pending') {
            actionsHTML = `<div class="edit-details-actions-bar">`;

            if (isPrivileged) {
                actionsHTML += `
                    <button class="btn-admin btn-admin--primary btn-approve-edit-detail" data-id="${e.id}">Схвалити правку</button>
                    <button class="btn-admin btn-admin--danger btn-reject-edit-detail" data-id="${e.id}">Відхилити правку</button>
                `;
            }

            if (isOwner || isPrivileged) {
                actionsHTML += `
                    <button class="btn-admin btn-admin--secondary btn-close-edit-detail" data-id="${e.id}">Закрити правку</button>
                `;
            }

            if (isAdmin) {
                actionsHTML += `
                    <button class="btn-admin btn-admin--danger btn-delete-edit-detail" data-id="${e.id}" style="margin-left: auto;">Видалити правку</button>
                `;
            }

            actionsHTML += `</div>`;
        } else if (isAdmin) {
            actionsHTML = `
                <div class="edit-details-actions-bar">
                    <button class="btn-admin btn-admin--danger btn-delete-edit-detail" data-id="${e.id}" style="margin-left: auto;">Видалити правку</button>
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

        const btnClose = content.querySelector('.btn-close-edit-detail');
        if (btnClose) {
            btnClose.addEventListener('click', async () => {
                const editId = btnClose.dataset.id;
                if (confirm('Ви впевнені, що хочете закрити та скасувати цю пропозицію правки?')) {
                    try {
                        btnClose.disabled = true;
                        btnClose.textContent = 'Обробка...';
                        await API.post(`/edits/${editId}/close`);
                        await updateEditsPendingCount();
                        await loadEditData();
                    } catch (err) {
                        alert('Помилка закриття: ' + err.message);
                        btnClose.disabled = false;
                        btnClose.textContent = 'Закрити правку';
                    }
                }
            });
        }

        const btnDelete = content.querySelector('.btn-delete-edit-detail');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                const editId = btnDelete.dataset.id;
                if (confirm(`Ви дійсно бажаєте видалити правку #${editId}? Нараховані бали буде віднято у автора.`)) {
                    try {
                        btnDelete.disabled = true;
                        btnDelete.textContent = 'Видалення...';
                        const res = await API.delete(`/edits/${editId}`);
                        alert(res.message || 'Правку успішно видалено');
                        await updateEditsPendingCount();
                        router.navigate('/edits');
                    } catch (err) {
                        alert('Помилка видалення: ' + err.message);
                        btnDelete.disabled = false;
                        btnDelete.textContent = 'Видалити правку';
                    }
                }
            });
        }
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
