import { API } from '../helpers/api.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { getAvatarHtml } from '../shell.js';
import { FIELD_DEFINITIONS, getChangedFieldBadges } from '../helpers/editDiff.js';

export async function fetchEntityEdits(entityType, entityId) {
    try {
        const edits = await API.get(`/edits?entity_type=${entityType}&entity_id=${entityId}`);
        return Array.isArray(edits) ? edits : (edits.items || []);
    } catch (e) {
        console.error(`Failed to fetch edits for ${entityType} #${entityId}:`, e);
        return [];
    }
}

export function renderEditorsHistoryBlock(edits, currentUser, options = {}) {
    const editButtonId = options.editButtonId || 'entity-edit-btn';
    const editTitle = options.editTitle || 'Редагувати';

    const seenEditors = new Set();
    const editors = [];
    
    (edits || []).forEach(e => {
        const username = e.proposer_username;
        if (username && !seenEditors.has(username)) {
            seenEditors.add(username);
            editors.push({
                username: username,
                avatarUrl: `/api/auth/avatar/${username}`
            });
        }
    });

    let editorsListHTML = '';
    if (editors.length > 0) {
        editorsListHTML = `
            <div class="volume-editors-list" title="Редактори">
                <span class="volume-editors-icon" title="Редактори">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </span>
                <div class="volume-editors-avatars">
                    ${editors.slice(0, 5).map(ed => `
                        <a href="#/user/${ed.username}" class="volume-editor-avatar-link" title="${escapeHtmlAttribute(ed.username)}">
                            ${getAvatarHtml(ed.avatarUrl, 'volume-editor-avatar-img', 28)}
                        </a>
                    `).join('')}
                    ${editors.length > 5 ? `<span style="font-size: 11px; margin-left: 4px; color: var(--text-muted); font-weight: 600;">+${editors.length - 5}</span>` : ''}
                </div>
            </div>
        `;
    }

    const hasPendingEdits = (edits || []).some(e => e.status === 'pending');
    const orangeIndicatorHTML = hasPendingEdits ? `<span class="badge-pending-dot"></span>` : '';

    const historyButtonHTML = `
        <button class="btn-history-trigger" id="entity-history-btn" title="Історія змін">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${orangeIndicatorHTML}
        </button>
    `;

    const editButtonHTML = currentUser ? `
        <button class="btn-history-trigger entity-edit-trigger-btn" id="${editButtonId}" title="${escapeHtmlAttribute(editTitle)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
    ` : '';

    return `
        <div class="volume-editors-history-block" data-edits='${escapeHtmlAttribute(JSON.stringify(edits || []))}'>
            ${editorsListHTML}
            ${historyButtonHTML}
            ${editButtonHTML}
        </div>
    `;
}

export function initEditorsHistoryBlock(container, edits) {
    if (!container) return;
    const historyBtn = container.querySelector('#entity-history-btn');
    if (historyBtn) {
        historyBtn.onclick = () => openEditHistoryModal(edits);
    }
}

export function openEditHistoryModal(edits) {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    modal.id = 'edit-history-modal-overlay';

    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const formatEditDate = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const months = ['січ.', 'лют.', 'берез.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'верес.', 'жовт.', 'лист.', 'груд.'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year} ${hours}:${minutes}`;
    };

    const getStatusBadge = (status) => {
        if (status === 'approved') {
            return `
                <span class="edit-history-status-badge edit-history-status-badge--approved">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Прийнято
                </span>
            `;
        }
        if (status === 'pending') {
            return `
                <span class="edit-history-status-badge edit-history-status-badge--pending">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Очікує
                </span>
            `;
        }
        if (status === 'rejected') {
            return `
                <span class="edit-history-status-badge edit-history-status-badge--rejected">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Відхилено
                </span>
            `;
        }
        if (status === 'closed') {
            return `
                <span class="edit-history-status-badge edit-history-status-badge--closed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    Закрито
                </span>
            `;
        }
        return status;
    };

    const getFieldBadge = (fieldKey) => {
        if (FIELD_DEFINITIONS[fieldKey] && FIELD_DEFINITIONS[fieldKey].label) {
            return FIELD_DEFINITIONS[fieldKey].label;
        }
        const fieldMapping = {
            'name_uk': 'Назва UA',
            'name_en': 'Назва EN',
            'name': 'Назва / Ім\'я',
            'name_native': 'Рідне ім\'я',
            'pseudo': 'Псевдонім',
            'start_year': 'Рік початку',
            'synopsis_ua': 'Синопсис UA',
            'synopsis': 'Синопсис EN',
            'description': 'Опис',
            'bio': 'Біографія',
            'lang': 'Мова',
            'site_link': 'Джерело',
            'website': 'Вебсайт',
            'image': 'Обкладинка',
            'cover_img': 'Банер',
            'theme_ids': 'Теми',
            'staff': 'Персонал',
            'characters': 'Персонажі'
        };
        return fieldMapping[fieldKey] || fieldKey;
    };

    const renderEditsList = () => {
        if (!edits || edits.length === 0) {
            return `
                <div class="ds-empty-state">
                    <h3>Нічого не знайдено</h3>
                    <p>До цієї сторінки ще не було запропоновано жодної правки.</p>
                </div>
            `;
        }
        return `
            <div class="edit-history-list">
                ${edits.map(e => {
                    const avatarUrl = `/api/auth/avatar/${e.proposer_username}`;
                    const avatarHtml = getAvatarHtml(avatarUrl, 'contributor-avatar', 44);
                    const patchObj = e.patch_data || {};
                    const beforeData = patchObj.before || {};
                    const afterData = patchObj.after || patchObj;
                    const badgesHtml = getChangedFieldBadges(beforeData, afterData);
                    
                    return `
                        <a href="#/edits/${e.id}" data-edit-id="${e.id}" class="edit-history-item">
                            <div class="edit-history-header">
                                <div class="edit-history-user">
                                    <div class="edit-history-avatar-wrap">
                                        ${avatarHtml}
                                    </div>
                                    <div class="edit-history-meta">
                                        <span class="edit-history-username">${escapeHtml(e.proposer_username)}</span>
                                        <span class="edit-history-date">${formatEditDate(e.created_at)}</span>
                                    </div>
                                </div>
                                <div class="edit-history-status">
                                    ${getStatusBadge(e.status)}
                                </div>
                            </div>
                            <div class="edit-history-body">
                                <div class="edit-history-badges-wrap">
                                    ${badgesHtml}
                                </div>
                                ${e.comment ? `<div class="edit-history-comment">${escapeHtml(e.comment)}</div>` : ''}
                            </div>
                        </a>
                    `;
                }).join('')}
            </div>
        `;
    };

    modal.innerHTML = `
        <div class="ds-modal ds-modal--medium" id="edit-history-modal" style="max-height: 85vh; display: flex; flex-direction: column;">
            <div class="ds-modal-header" style="border-bottom: 1px solid var(--border-s); padding-bottom: 12px; margin-bottom: 16px;">
                <h3 style="margin: 0; font-family: var(--font-oswald); font-size: 1.25rem;">Історія змін та правок</h3>
                <button type="button" class="btn-modal-close" id="btn-close-edit-history-modal">✕</button>
            </div>
            <div class="ds-modal-body" style="overflow-y: auto; flex: 1; padding-right: 4px;">
                ${renderEditsList()}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    document.addEventListener('keydown', handleKeyDown);

    modal.querySelector('#btn-close-edit-history-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
            return;
        }
        const itemLink = e.target.closest('.edit-history-item');
        if (itemLink) {
            e.preventDefault();
            const editId = itemLink.getAttribute('data-edit-id');
            closeModal();
            if (window.router) {
                window.router.navigate(`/edits/${editId}`);
            } else {
                window.location.hash = `#/edits/${editId}`;
            }
        }
    });
}
