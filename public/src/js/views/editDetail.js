import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { updateEditsPendingCount, getAvatarHtml, currentUser } from '../shell.js';
import { langName, getEntityTypeLabel, getEntityUrl, formatDate } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';
import { icon } from '../helpers/icons.js';
import { getChangedFieldBadges, generateDiffHTML } from '../helpers/editDiff.js';
import { renderEditStatusBadge } from '../components/EditStatusBadge.js';
import { t } from '../helpers/i18n.js';

export async function renderEditDetail(main, params) {
    main.innerHTML = `
        <div class="container container--main">
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
        const statusBadgeHtml = renderEditStatusBadge(e.status);

        const entityLabel = getEntityTypeLabel(e.entity_type);
        const entityName = e.volume_name_uk || e.volume_name || `ID ${e.entity_id}`;
        const entityLink = getEntityUrl(e.entity_type, e.entity_id);

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
                   <span class="comment-text"><strong>${t('comment')}:</strong> ${escapeHtml(e.comment)}</span>
               </div>`
            : `<p class="edit-detail-subtitle">${t('edit_detail_subtitle')}</p>`;

        // Аватар автора пропозиції
        const proposerName = e.proposer_nickname || e.proposer_username;
        const proposerAvatarUrl = `/api/auth/avatar/${encodeURIComponent(proposerName)}`;
        const proposerAvatarHtml = getAvatarHtml(proposerAvatarUrl, 'person-avatar-img', 44);

        // Картка модератора
        let moderatorCardHTML = '';
        const modName = e.moderator_nickname || e.moderator_username;
        if (e.status !== 'pending' && modName) {
            const moderatorAvatarUrl = `/api/auth/avatar/${encodeURIComponent(modName)}`;
            const moderatorAvatarHtml = getAvatarHtml(moderatorAvatarUrl, 'person-avatar-img', 44);
            const modAction = e.status === 'approved' ? t('approved_by') : t('rejected_by');
            const modClass = e.status === 'approved' ? 'moderator-card--approved' : 'moderator-card--rejected';
            const commentMod = e.moderator_comment ? `<div class="person-card-comment"><strong>${t('comment')}:</strong> ${escapeHtml(e.moderator_comment)}</div>` : '';

            moderatorCardHTML = `
                <div class="people-section">
                    <span class="people-section-title">${modAction}</span>
                    <a href="#/user/${escapeHtml(modName)}" class="person-card moderator-card ${modClass}" title="Переглянути профіль ${escapeHtml(modName)}">
                        <div class="person-card-avatar">
                            ${moderatorAvatarHtml}
                        </div>
                        <div class="person-card-info">
                            <span class="person-card-name">${escapeHtml(modName || 'Модератор')}</span>
                            <span class="person-card-date">${formatDate(e.moderated_at)}</span>
                            ${commentMod}
                        </div>
                    </a>
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
                    <button class="btn-admin btn-admin--primary btn-approve-edit-detail" data-id="${e.id}">${t('approve_edit')}</button>
                    <button class="btn-admin btn-admin--danger btn-reject-edit-detail" data-id="${e.id}">${t('reject_edit')}</button>
                `;
            }

            if (isOwner || isPrivileged) {
                actionsHTML += `
                    <button class="btn-admin btn-admin--secondary btn-close-edit-detail" data-id="${e.id}">${t('close_edit')}</button>
                `;
            }

            if (isAdmin) {
                actionsHTML += `
                    <button class="btn-admin btn-admin--danger btn-delete-edit-detail" data-id="${e.id}" style="margin-left: auto;">${t('delete_edit')}</button>
                `;
            }

            actionsHTML += `</div>`;
        } else if (isAdmin) {
            actionsHTML = `
                <div class="edit-details-actions-bar">
                    <button class="btn-admin btn-admin--danger btn-delete-edit-detail" data-id="${e.id}" style="margin-left: auto;">${t('delete_edit')}</button>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="edit-detail-header-block">
                <div class="edit-detail-title-line">
                    <h1 class="edit-detail-main-title">${t('edit_single')} #${e.id}</h1>
                    ${statusBadgeHtml}
                </div>
                ${subtitleHTML}
            </div>

            <div class="edit-details-grid">
                <!-- Блок Контент -->
                <div class="edit-detail-block edit-detail-block--content">
                    <h2 class="edit-detail-block-title">
                        <span>${t('content')}</span>
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
                    <h2 class="edit-detail-block-title">${t('author_moderator')}</h2>
                    <div class="people-cards-column">
                        <div class="people-section">
                            <span class="people-section-title">${t('proposed_by')}</span>
                            <a href="#/user/${escapeHtml(proposerName)}" class="person-card author-card" title="Переглянути профіль ${escapeHtml(proposerName)}">
                                <div class="person-card-avatar">
                                    ${proposerAvatarHtml}
                                </div>
                                <div class="person-card-info">
                                    <span class="person-card-name">${escapeHtml(proposerName)}</span>
                                    <span class="person-card-date">${formatDate(e.created_at)}</span>
                                </div>
                            </a>
                        </div>

                        ${moderatorCardHTML}
                    </div>
                </div>
            </div>

            <!-- Блок Деталі зміни -->
            <div class="edit-detail-block edit-detail-block--diff">
                <h2 class="edit-detail-block-title">${t('edit_details_diff')}</h2>
                <div class="edit-diff-container-detail">
                    ${generateDiffHTML(beforeData, afterData)}
                </div>
            </div>

            ${renderScoreHistoryBlock(e)}

            ${actionsHTML}
        `;

        attachEvents();
    }

    function formatScoreReasonHTML(reasonStr) {
        if (!reasonStr) return '';

        const fieldMap = {
            'start_year': 'рік початку',
            'name_native': 'рідна назва',
            'name_uk': 'українська назва',
            'name_en': 'англійська назва',
            'name': 'назва',
            'cv_img': 'обкладинка',
            'cover_img': 'банер',
            'image': 'зображення',
            'synopsis_ua': 'український синопсис',
            'synopsis': 'синопсис',
            'description': 'опис',
            'bio': 'біографія',
            'lang': 'мова',
            'site_link': 'джерело',
            'website': 'вебсайт',
            'publisher': 'видавництво',
            'staff': 'персонал',
            'characters': 'персонажі',
            'theme_ids': 'теми'
        };

        let text = escapeHtml(reasonStr);
        for (const [key, val] of Object.entries(fieldMap)) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            text = text.replace(regex, val);
        }

        if (text.includes(': ')) {
            const parts = text.split(': ');
            const title = parts[0];
            let details = parts.slice(1).join(': ');

            details = details.replace(/\s*\(всього\s*[\+\-]?\d+\s*б\.\)/gi, '');

            const items = details.split(', ').map(item => item.trim()).filter(Boolean);

            const tagsHtml = items.map(item => {
                const ptsMatch = item.match(/\(([^)]*\+?\d+\s*б\.[^)]*)\)/);
                let ptsText = '';
                let cleanItem = item;

                if (ptsMatch) {
                    ptsText = ptsMatch[1];
                    cleanItem = item.replace(ptsMatch[0], '').trim();
                }

                return `
                    <span class="score-reason-tag">
                        <span class="score-reason-tag-label">${cleanItem}</span>
                        ${ptsText ? `<span class="score-reason-tag-pts">${ptsText}</span>` : ''}
                    </span>
                `;
            }).join('');

            return `
                <div class="score-reason-container">
                    <div class="score-reason-title">${title}</div>
                    <div class="score-reason-tags">${tagsHtml}</div>
                </div>
            `;
        }

        return `<div class="score-reason-title score-reason-title--simple">${text}</div>`;
    }

    function renderScoreHistoryBlock(e) {
        const history = e.score_history || [];
        if (history.length === 0) return '';

        const rows = history.map(row => {
            const delta = row.delta;
            const isPositive = delta > 0;
            const badgeClass = isPositive ? 'score-history-badge--positive' : 'score-history-badge--negative';
            const sign = isPositive ? '+' : '';
            const userDisp = row.nickname || row.username;
            const avatarUrl = `/api/auth/avatar/${encodeURIComponent(userDisp)}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'score-history-user-avatar', 32);

            return `
                <div class="score-history-card">
                    <a href="#/user/${escapeHtml(userDisp)}" class="score-history-user-info" title="Переглянути профіль ${escapeHtml(userDisp)}">
                        ${avatarHtml}
                        <span class="score-history-username">${escapeHtml(userDisp)}</span>
                    </a>
                    <div class="score-history-reason-box">
                        ${formatScoreReasonHTML(row.reason)}
                    </div>
                    <div class="score-history-badge ${badgeClass}">
                        ${isPositive ? icon('sparkles', 13) : icon('alertCircle', 13)}
                        <span>${sign}${delta} ${t('points_short')}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="edit-detail-block edit-detail-block--score">
                <h2 class="edit-detail-block-title">
                    <span>${icon('sparkles', 16)} ${t('awarded_points')}</span>
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



    await loadEditData();
}
