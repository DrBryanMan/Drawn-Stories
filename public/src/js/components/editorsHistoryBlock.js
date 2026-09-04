import { API } from '../helpers/api.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { getAvatarHtml } from '../shell.js';
import { FIELD_DEFINITIONS, getChangedFieldBadges, getFieldLabel } from '../helpers/editDiff.js';
import { renderEditStatusBadge } from './EditStatusBadge.js';
import { t } from '../helpers/i18n.js';
import { formatDate } from '../helpers/lang.js';

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
    const editTitle = options.editTitle || t('edit');

    const seenEditors = new Set();
    const editors = [];
    
    (edits || []).forEach(e => {
        const nameToUse = e.proposer_nickname || e.proposer_login || e.proposer_username;
        if (nameToUse && !seenEditors.has(nameToUse)) {
            seenEditors.add(nameToUse);
            editors.push({
                name: nameToUse,
                avatarUrl: `/api/auth/avatar/${encodeURIComponent(nameToUse)}`
            });
        }
    });

    let editorsListHTML = '';
    if (editors.length > 0) {
        editorsListHTML = `
            <div class="editors-list" title="${t('editors')}">
                <span class="editors-icon" title="${t('editors')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 1 0 7.75"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </span>
                <div class="editors-avatars">
                    ${editors.slice(0, 5).map(ed => `
                        <a href="#/user/${encodeURIComponent(ed.name)}" class="editor-avatar-link" title="${escapeHtmlAttribute(ed.name)}">
                            ${getAvatarHtml(ed.avatarUrl, 'editor-avatar-img', 28)}
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
        <button class="btn-history-trigger" id="entity-history-btn" title="${t('edit_history')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${orangeIndicatorHTML}
        </button>
    `;

    const editButtonHTML = currentUser ? `
        <button class="btn-history-trigger entity-edit-trigger-btn" id="${editButtonId}" title="${escapeHtmlAttribute(editTitle)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
    ` : '';

    const actionsHTML = (historyButtonHTML || editButtonHTML) ? `
        <div class="entity-history-actions">
            ${editButtonHTML}
            ${historyButtonHTML}
        </div>
    ` : '';

    return `
        <div class="entity-editors-history-block">
            ${actionsHTML}
            ${editorsListHTML}
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
        return formatDate(dateStr);
    };

    const getStatusBadge = (status) => {
        return renderEditStatusBadge(status, { shortText: true });
    };

    const getFieldBadge = (fieldKey) => {
        return getFieldLabel(fieldKey);
    };

    const renderEditsList = () => {
        if (!edits || edits.length === 0) {
            return `
                <div class="ds-empty-state">
                    <h3>${t('no_edits_found')}</h3>
                    <p>${t('no_edits_for_page')}</p>
                </div>
            `;
        }
        return `
            <div class="edit-history-list">
                ${edits.map(e => {
                    const proposerDisp = e.proposer_nickname || e.proposer_login || e.proposer_username;
                    const avatarUrl = `/api/auth/avatar/${encodeURIComponent(proposerDisp)}`;
                    const avatarHtml = getAvatarHtml(avatarUrl, 'contributor-avatar', 44);
                    const patchObj = e.patch_data || {};
                    const beforeData = patchObj.before || {};
                    const afterData = patchObj.after || patchObj;
                    const badgesHtml = getChangedFieldBadges(beforeData, afterData, { isCreation: e.is_creation });
                    
                    return `

                        <a href="#/edits/${e.id}" data-edit-id="${e.id}" class="edit-history-item">
                            <div class="edit-history-header">
                                <div class="edit-history-user">
                                    <div class="edit-history-avatar-wrap">
                                        ${avatarHtml}
                                    </div>
                                    <div class="edit-history-meta">
                                        <span class="edit-history-username">${escapeHtml(proposerDisp)}</span>
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
                <h3 style="margin: 0; font-family: var(--font-oswald); font-size: 1.25rem;">${t('edit_history_and_proposals')}</h3>
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
