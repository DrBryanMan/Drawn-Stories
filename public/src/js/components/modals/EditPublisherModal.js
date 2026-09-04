import { API } from '/static/js/helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { currentUser } from '/static/js/shell.js';
import { icon } from '/static/js/helpers/icons.js';
import { t } from '../../helpers/i18n.js';

export function openEditPublisherModal(publisher, onUpdate) {
    const modalId = 'admin-edit-publisher-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'ds-modal-overlay';

    const role = currentUser ? currentUser.role : null;

    let footerButtonsHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
            ${role === 'admin' && publisher && publisher.id ? `
                <button type="button" class="btn-admin btn-admin--danger btn-delete-pub-from-db" title="${t('delete_from_db')}" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">${icon('trash', 14)}</button>
            ` : ''}
            ${(!currentUser || (role !== 'admin' && role !== 'moderator' && role !== 'editor')) ? `
                <input type="text" id="edit-pub-propose-comment" class="admin-input" placeholder="${t('edit_comment_placeholder')}" style="max-width: 260px; font-size: 12px; height: 32px; margin-bottom: 0;">
            ` : ''}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-admin btn-admin--secondary btn-close-pub-modal">${t('cancel')}</button>
            ${(() => {
                if (role === 'admin') {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-admin--purple btn-save-pub-direct">${t('save_to_db')}</button>
                        <button type="button" class="btn-admin btn-admin--primary btn-save-pub-approve" style="background: var(--green);">${t('save_and_approve')}</button>
                    `;
                } else if (role === 'moderator' || role === 'editor') {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-pub-approve" style="background: var(--green);">${t('save_and_approve')}</button>
                    `;
                } else {
                    return `
                        <button type="button" class="btn-admin btn-admin--primary btn-save-pub-propose" style="background: var(--yellow);">${t('propose_edit')}</button>
                    `;
                }
            })()}
        </div>
    `;
    
    modal.innerHTML = `
        <div class="ds-modal ds-modal--large" id="edit-publisher-modal-content">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Редагування видавництва
                </div>
                <button class="ds-modal-close btn-close-pub-modal" type="button">&times;</button>
            </div>
            <div class="ds-modal-body" style="padding: 20px 24px;">
                <div class="admin-form-grid">
                    <div class="admin-form-group admin-form-group--full">
                        <label class="admin-label">Назва видавництва</label>
                        <input type="text" id="edit-pub-name" class="admin-input" value="${escapeHtmlAttribute(publisher.name || '')}">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-label">Рік заснування</label>
                        <input type="number" id="edit-pub-founded-date" class="admin-input" min="0" value="${escapeHtmlAttribute(publisher.founded_date || '')}">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-label">Країна</label>
                        <input type="text" id="edit-pub-country" class="admin-input" value="${escapeHtmlAttribute(publisher.country || '')}">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-label">Тип робіт</label>
                        <select id="edit-pub-work-type" class="admin-input">
                            <option value="comics" ${publisher.work_type === 'comics' ? 'selected' : ''}>Комікси</option>
                            <option value="manga" ${publisher.work_type === 'manga' ? 'selected' : ''}>Манґа</option>
                            <option value="manga, comics" ${publisher.work_type === 'manga, comics' ? 'selected' : ''}>Змішаний (Комікси, Манґа)</option>
                        </select>
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-label">Статус</label>
                        <select id="edit-pub-status" class="admin-input">
                            <option value="Active" ${['active', 'активне', 'активна'].includes((publisher.status || '').toLowerCase()) ? 'selected' : ''}>Активне</option>
                            <option value="Inactive" ${!['active', 'активне', 'активна'].includes((publisher.status || '').toLowerCase()) ? 'selected' : ''}>Неактивне</option>
                        </select>
                    </div>
                    <div class="admin-form-group admin-form-group--full">
                        <label class="admin-label">Синоніми (через кому)</label>
                        <input type="text" id="edit-pub-aliases" class="admin-input" value="${escapeHtmlAttribute(publisher.aliases || '')}" placeholder="Наприклад: DC, DC Comics">
                    </div>
                    <div class="admin-form-group admin-form-group--full">
                        <label class="admin-label">Офіційний веб-сайт</label>
                        <input type="url" id="edit-pub-website" class="admin-input" value="${escapeHtmlAttribute(publisher.website || '')}">
                    </div>
                    <div class="admin-form-group admin-form-group--full">
                        <label class="admin-label">Логотип / зображення</label>
                        <div style="display:grid; grid-template-columns:1fr 140px; gap:16px; align-items:start;">
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                <input type="url" id="edit-pub-image" class="admin-input" placeholder="URL зображення" value="${escapeHtmlAttribute(publisher.image || '')}" autocomplete="off">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <label class="btn-admin btn-admin--secondary" style="margin:0; cursor:pointer; flex:1; text-align:center;">
                                        ${icon('plus', 18)} Завантажити локально
                                        <input type="file" id="edit-pub-image-file" style="display:none;" accept="image/webp">
                                    </label>
                                    <button type="button" class="btn-admin btn-admin--danger" id="edit-pub-image-clear" style="display:none; padding:8px 12px; height:38px;">${icon('trash', 18)}</button>
                                </div>
                                <div style="font-size:.75rem; color:#db5a5a;">Дозволено лише формат <strong>.webp</strong></div>
                                <div id="edit-pub-image-filename" style="display:none; font-size:.75rem; color:var(--text-muted); word-break:break-all;"></div>
                            </div>
                            <div style="width:140px; height:180px; border:2px dashed var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--bg-body);">
                                <div id="edit-pub-image-placeholder" style="color:var(--text-muted); text-align:center; padding:10px; ${publisher.image ? 'display:none;' : ''}">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}<div style="font-size:.7rem;">Прев’ю</div></div>
                                <img id="edit-pub-image-preview" src="${publisher.image ? escapeHtmlAttribute(normalizeImageUrl(publisher.image)) : ''}" style="${publisher.image ? 'display:block;' : 'display:none;'} width:100%; height:100%; object-fit:cover;">
                            </div>
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

    modal.querySelectorAll('.btn-close-pub-modal').forEach(btn => btn.addEventListener('click', close));
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const imageInput = modal.querySelector('#edit-pub-image');
    const imageFileInput = modal.querySelector('#edit-pub-image-file');
    const imageClearButton = modal.querySelector('#edit-pub-image-clear');
    const imagePreview = modal.querySelector('#edit-pub-image-preview');
    const imagePlaceholder = modal.querySelector('#edit-pub-image-placeholder');
    const imageFilename = modal.querySelector('#edit-pub-image-filename');
    const updateImagePreview = (source, isRemote = false) => {
        if (source) {
            imagePreview.src = isRemote ? normalizeImageUrl(source) : source;
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            imagePreview.removeAttribute('src');
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'block';
        }
    };
    imageInput.addEventListener('input', () => {
        const value = imageInput.value.trim();
        if (value) {
            imageFileInput.value = '';
            imageFilename.style.display = 'none';
            imageClearButton.style.display = 'none';
            updateImagePreview(value, true);
        } else if (!imageFileInput.files.length) {
            updateImagePreview(null);
        }
    });
    imageFileInput.addEventListener('change', () => {
        const file = imageFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => updateImagePreview(event.target.result);
        reader.readAsDataURL(file);
        imageInput.value = '';
        imageFilename.textContent = file.name;
        imageFilename.style.display = 'block';
        imageClearButton.style.display = 'block';
    });
    imageClearButton.addEventListener('click', () => {
        imageFileInput.value = '';
        imageFilename.style.display = 'none';
        imageClearButton.style.display = 'none';
        updateImagePreview(imageInput.value.trim(), true);
    });

    const handleSave = async (actionType = 'approve') => {
        const updated = {
            name: modal.querySelector('#edit-pub-name').value.trim(),
            founded_date: modal.querySelector('#edit-pub-founded-date').value.trim() || null,
            country: modal.querySelector('#edit-pub-country').value.trim() || null,
            work_type: modal.querySelector('#edit-pub-work-type').value,
            status: modal.querySelector('#edit-pub-status').value,
            aliases: modal.querySelector('#edit-pub-aliases').value.trim() || null,
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
            const imageFile = imageFileInput.files[0];
            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);
                const uploadResult = await API.upload('/images/upload/publisher', formData);
                updated.image = uploadResult.url;
            }
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
