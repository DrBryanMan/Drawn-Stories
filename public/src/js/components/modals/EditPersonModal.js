import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { currentUser } from '/static/js/shell.js';
import { icon } from '/static/js/helpers/icons.js';
import { t } from '../../helpers/i18n.js';

export function openEditPersonModal(person = {}, onUpdate) {
    const isCreation = !person || !person.id;
    const modalId = 'admin-edit-person-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'ds-modal-overlay';

    const role = currentUser ? currentUser.role : null;
    const canAutoApprove = isCreation ? (role === 'admin' || role === 'moderator') : (role === 'admin' || role === 'moderator' || role === 'editor');

    let footerButtonsHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
            ${role === 'admin' && !isCreation ? `
                <button type="button" class="btn-admin btn-admin--danger btn-delete-person-from-db" title="${t('delete_from_db')}" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">${icon('trash', 14)}</button>
            ` : ''}
            ${(!currentUser || !canAutoApprove) ? `
                <input type="text" id="edit-person-propose-comment" class="admin-input" placeholder="${isCreation ? 'Коментар до створення (необов\'язково)' : t('edit_comment_placeholder')}" style="max-width: 260px; font-size: 12px; height: 32px; margin-bottom: 0;">
            ` : ''}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-admin btn-admin--secondary btn-close-person-modal">${t('cancel')}</button>
            ${(() => {
                if (role === 'admin') {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-person-approve" style="background: var(--green);">${isCreation ? 'Створити (+50 б.)' : t('save_and_approve')}</button>
                    `;
                } else if (role === 'moderator') {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-person-approve" style="background: var(--green);">${isCreation ? 'Створити (+50 б.)' : t('save_and_approve')}</button>
                    `;
                } else if (role === 'editor' && !isCreation) {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-person-approve" style="background: var(--green);">${t('save_and_approve')}</button>
                    `;
                } else {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-person-propose" style="background: var(--yellow);">${isCreation ? 'Подати на створення (+50 б.)' : t('propose_edit')}</button>
                    `;
                }
            })()}
        </div>
    `;
    
    modal.innerHTML = `
        <div class="ds-modal ds-modal--large" id="edit-person-modal-content">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    ${isCreation ? 'Додавання нової персони' : 'Редагування персони'}
                </div>
                <button class="ds-modal-close btn-close-person-modal" type="button">&times;</button>
            </div>
            <div class="ds-modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; display: block;">Загальна інформація</span>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Оригінальне ім'я *</label>
                            <input type="text" id="edit-person-name" class="admin-input" value="${escapeHtmlAttribute(person?.name || '')}" style="margin-bottom: 0;" placeholder="Stan Lee">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Українське ім'я</label>
                            <input type="text" id="edit-person-name-uk" class="admin-input" value="${escapeHtmlAttribute(person?.name_uk || '')}" style="margin-bottom: 0;" placeholder="Стен Лі">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Назва мовою оригіналу (Native)</label>
                            <input type="text" id="edit-person-name-native" class="admin-input" value="${escapeHtmlAttribute(person?.name_native || '')}" placeholder="японська/корейська тощо" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Псевдонім</label>
                            <input type="text" id="edit-person-pseudo" class="admin-input" value="${escapeHtmlAttribute(person?.pseudo || '')}" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Професія / Роль</label>
                            <input type="text" id="edit-person-occupation" class="admin-input" value="${escapeHtmlAttribute(person?.occupation || '')}" placeholder="Writer, Artist, Editor" style="margin-bottom: 0;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; display: block;">Додатково</span>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Дата народження</label>
                            <input type="text" id="edit-person-birth" class="admin-input" placeholder="YYYY-MM-DD" value="${escapeHtmlAttribute(person?.birth || '')}" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Місто / Регіон</label>
                            <input type="text" id="edit-person-hometown" class="admin-input" value="${escapeHtmlAttribute(person?.hometown || person?.birth_place || '')}" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Країна</label>
                            <input type="text" id="edit-person-country" class="admin-input" value="${escapeHtmlAttribute(person?.country || '')}" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Стать</label>
                            <select id="edit-person-gender" class="admin-input" style="margin-bottom: 0;">
                                <option value="" ${!person?.gender ? 'selected' : ''}>Не вказано</option>
                                <option value="1" ${person?.gender === 1 ? 'selected' : ''}>Чоловіча</option>
                                <option value="2" ${person?.gender === 2 ? 'selected' : ''}>Жіноча</option>
                            </select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Фото (URL / .webp)</label>
                            <input type="text" id="edit-person-image" class="admin-input" value="${escapeHtmlAttribute(person?.image || '')}" style="margin-bottom: 0;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                            <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Веб-сайт</label>
                            <input type="text" id="edit-person-website" class="admin-input" value="${escapeHtmlAttribute(person?.website || '')}" style="margin-bottom: 0;">
                        </div>
                    </div>
                </div>
            </div>
            <div class="ds-modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--border-s);">
                ${footerButtonsHTML}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
        document.removeEventListener('keydown', onEsc);
    };
    
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);

    modal.querySelectorAll('.btn-close-person-modal').forEach(btn => btn.addEventListener('click', close));
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const handleSave = async (actionType = 'approve') => {
        const updated = {
            name: modal.querySelector('#edit-person-name').value.trim(),
            name_uk: modal.querySelector('#edit-person-name-uk').value.trim() || null,
            name_native: modal.querySelector('#edit-person-name-native')?.value.trim() || null,
            pseudo: modal.querySelector('#edit-person-pseudo').value.trim() || null,
            occupation: modal.querySelector('#edit-person-occupation').value.trim() || null,
            birth: modal.querySelector('#edit-person-birth').value.trim() || null,
            hometown: modal.querySelector('#edit-person-hometown').value.trim() || null,
            country: modal.querySelector('#edit-person-country').value.trim() || null,
            gender: modal.querySelector('#edit-person-gender')?.value ? parseInt(modal.querySelector('#edit-person-gender').value) : null,
            image: modal.querySelector('#edit-person-image').value.trim() || null,
            website: modal.querySelector('#edit-person-website').value.trim() || null,
        };

        if (!updated.name) {
            alert('Оригінальне ім\'я обов\'язкове');
            return;
        }

        const commentInput = modal.querySelector('#edit-person-propose-comment');
        const comment = commentInput ? commentInput.value.trim() : '';

        try {
            const autoApprove = actionType === 'approve';
            const res = await API.post('/edits', {
                entity_type: 'person',
                entity_id: isCreation ? 0 : person.id,
                patch_data: updated,
                is_creation: isCreation,
                auto_approve: autoApprove,
                comment: comment
            });

            if (isCreation) {
                if (autoApprove && res && res.created_entity_id) {
                    window.location.hash = `#/personnel/${res.created_entity_id}`;
                } else {
                    alert('Заявку на створення персони подано на розгляд модераторам (+50 балів після схвалення)');
                }
            } else {
                if (!autoApprove) {
                    alert('Правку надіслано на розгляд модераторам');
                }
            }

            if (onUpdate) onUpdate(updated);
            close();
        } catch (err) {
            alert('Помилка збереження: ' + (err.message || err));
        }
    };

    modal.querySelector('.btn-save-person-approve')?.addEventListener('click', () => handleSave('approve'));
    modal.querySelector('.btn-save-person-propose')?.addEventListener('click', () => handleSave('propose'));

    const deleteBtn = modal.querySelector('.btn-delete-person-from-db');
    if (deleteBtn && !isCreation) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Ви впевнені, що хочете остаточно видалити персону "${person.name}"?`)) return;
            try {
                await API.delete(`/persons/${person.id}`);
                if (onUpdate) onUpdate(null);
                close();
            } catch (err) {
                alert('Помилка видалення: ' + err.message);
            }
        });
    }
}

