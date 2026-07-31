import { API } from '/static/js/helpers/api.js';
import { escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { currentUser } from '/static/js/shell.js';

export function openEditPublisherModal(publisher, onUpdate) {
    const modalId = 'admin-edit-publisher-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'ds-modal-overlay';

    const role = currentUser ? currentUser.role : null;

    let footerButtonsHTML = '';
    if (role === 'admin') {
        footerButtonsHTML = `
            <button type="button" class="btn-admin btn-admin--danger btn-delete-pub-from-db">Видалити з бази</button>
            <div style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
                <button type="button" class="btn-admin btn-admin--secondary btn-close-pub-modal">Скасувати</button>
                <button type="button" class="btn-admin btn-admin--primary btn-admin--purple btn-save-pub-direct">Записати в БД</button>
                <button type="button" class="btn-admin btn-admin--primary btn-save-pub-approve" style="background: var(--green);">Записати і прийняти</button>
            </div>
        `;
    } else if (role === 'moderator' || role === 'editor') {
        footerButtonsHTML = `
            <div style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
                <button type="button" class="btn-admin btn-admin--secondary btn-close-pub-modal">Скасувати</button>
                <button type="button" class="btn-admin btn-admin--primary btn-save-pub-approve" style="background: var(--green);">Записати і прийняти</button>
            </div>
        `;
    } else {
        footerButtonsHTML = `
            <input type="text" id="edit-pub-propose-comment" class="admin-input" placeholder="Коментар до вашої правки..." style="margin-right: auto; max-width: 260px; font-size: 12px; height: 32px; margin-bottom: 0;">
            <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn-admin btn-admin--secondary btn-close-pub-modal">Скасувати</button>
                <button type="button" class="btn-admin btn-admin--primary btn-save-pub-propose" style="background: var(--yellow);">Запропонувати</button>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="ds-modal ds-modal--large" id="edit-publisher-modal-content">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Редагування видавництва
                </div>
                <button class="ds-modal-close btn-close-pub-modal" type="button">&times;</button>
            </div>
            <div class="ds-modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Оригінальна назва</label>
                    <input type="text" id="edit-pub-name" class="admin-input" value="${escapeHtmlAttribute(publisher.name || '')}" style="margin-bottom: 0;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Українська назва</label>
                    <input type="text" id="edit-pub-name-uk" class="admin-input" value="${escapeHtmlAttribute(publisher.name_uk || '')}" style="margin-bottom: 0;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Країна</label>
                    <input type="text" id="edit-pub-country" class="admin-input" value="${escapeHtmlAttribute(publisher.country || '')}" style="margin-bottom: 0;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Логотип / Зображення (URL / .webp)</label>
                    <input type="text" id="edit-pub-image" class="admin-input" value="${escapeHtmlAttribute(publisher.image || publisher.logo || '')}" style="margin-bottom: 0;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Офіційний веб-сайт</label>
                    <input type="text" id="edit-pub-website" class="admin-input" value="${escapeHtmlAttribute(publisher.website || '')}" style="margin-bottom: 0;">
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

    modal.querySelectorAll('.btn-close-pub-modal').forEach(btn => btn.addEventListener('click', close));
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const handleSave = async (actionType = 'approve') => {
        const updated = {
            name: modal.querySelector('#edit-pub-name').value.trim(),
            name_uk: modal.querySelector('#edit-pub-name-uk').value.trim() || null,
            country: modal.querySelector('#edit-pub-country').value.trim() || null,
            image: modal.querySelector('#edit-pub-image').value.trim() || null,
            website: modal.querySelector('#edit-pub-website').value.trim() || null,
        };

        if (!updated.name) {
            alert('Назва видавництва обов\'язкова');
            return;
        }

        const commentInput = modal.querySelector('#edit-pub-propose-comment');
        const comment = commentInput ? commentInput.value.trim() : '';

        try {
            if (actionType === 'direct') {
                await API.put(`/publishers/${publisher.id}`, updated);
            } else {
                const autoApprove = actionType === 'approve';
                await API.post('/edits', {
                    entity_type: 'publisher',
                    entity_id: publisher.id,
                    patch_data: updated,
                    auto_approve: autoApprove,
                    comment: comment
                });
            }
            if (onUpdate) onUpdate(updated);
            close();
        } catch (err) {
            alert('Помилка збереження: ' + err.message);
        }
    };

    modal.querySelector('.btn-save-pub-direct')?.addEventListener('click', () => handleSave('direct'));
    modal.querySelector('.btn-save-pub-approve')?.addEventListener('click', () => handleSave('approve'));
    modal.querySelector('.btn-save-pub-propose')?.addEventListener('click', () => handleSave('propose'));

    const deleteBtn = modal.querySelector('.btn-delete-pub-from-db');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Ви впевнені, що хочете остаточно видалити видавництво "${publisher.name}"?`)) return;
            try {
                await API.delete(`/publishers/${publisher.id}`);
                if (onUpdate) onUpdate(null);
                close();
            } catch (err) {
                alert('Помилка видалення: ' + err.message);
            }
        });
    }
}
