import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl } from '/static/js/helpers/image.js';

const ICON = {
    hash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
};

export class IssueEditor {
    constructor(issue, onSave) {
        this.issue = issue;
        this.onSave = onSave;
        this.modal = null;
    }

    initImageHandlers(area) {
        const container = area.querySelector('.gam-image-field-container');
        if (!container) return;

        const urlInput = container.querySelector('.gam-img-url-input');
        const fileInput = container.querySelector('.gam-img-file-input');
        const clearBtn = container.querySelector('.gam-img-clear');
        const filenameLabel = container.querySelector('.gam-img-filename');
        const previewImg = container.querySelector('.gam-preview-img');
        const placeholder = container.querySelector('.gam-preview-placeholder');

        const updatePreview = (src, isRemote = false) => {
            if (src) {
                previewImg.src = isRemote ? comicVineImageUrl(src) : src;
                previewImg.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                placeholder.style.display = 'flex';
            }
        };

        if (urlInput.value) updatePreview(urlInput.value, true);

        urlInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                updatePreview(val, true);
                fileInput.value = '';
                if (filenameLabel) filenameLabel.style.display = 'none';
                if (clearBtn) clearBtn.style.display = 'none';
            } else if (!fileInput.files.length) {
                updatePreview(null);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => updatePreview(ev.target.result);
                reader.readAsDataURL(file);
                
                if (filenameLabel) {
                    filenameLabel.textContent = file.name;
                    filenameLabel.style.display = 'block';
                }
                if (clearBtn) clearBtn.style.display = 'block';
                urlInput.value = '';
            }
        });

        clearBtn?.addEventListener('click', () => {
            fileInput.value = '';
            filenameLabel.style.display = 'none';
            clearBtn.style.display = 'none';
            updatePreview(urlInput.value.trim() || null, true);
        });
    }

    _imgFieldHTML(name, label, value, icon) {
        return `
            <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">${icon} ${label}</label>
                <div class="gam-image-field-container" style="display: grid; grid-template-columns: 1fr 140px; gap: 16px; align-items: start; position: relative;">
                    <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px;">
                        <input type="url" name="${name}" value="${value || ''}" placeholder="URL зображення..." class="admin-input gam-img-url-input">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label class="btn-admin btn-admin--secondary" style="margin: 0; cursor: pointer; flex: 1; text-align: center; white-space: nowrap;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Локальний файл
                                <input type="file" name="${name}_file" class="gam-img-file-input" style="display: none;" accept="image/webp">
                            </label>
                            <button type="button" class="btn-admin btn-admin--danger gam-img-clear" style="display: none; padding: 8px 12px; align-items: center; justify-content: center; height: 34px;">${ICON.trash}</button>
                        </div>
                        <div style="font-size: 0.7rem; color: #db5a5a; margin-top: 2px;">Дозволено лише формат <strong>.webp</strong></div>
                        <div class="gam-img-filename" style="font-size: 0.7rem; color: var(--text-muted); display: none; word-break: break-all; max-width: 250px;"></div>
                    </div>
                    <div class="gam-image-preview" style="
                        width: 140px; height: 180px; border: 2px dashed var(--border); border-radius: 8px;
                        display: flex; align-items: center; justify-content: center; overflow: hidden;
                        background: var(--bg-body); position: relative;
                    ">
                        <div class="gam-preview-placeholder" style="color: var(--text-muted); text-align: center; padding: 10px;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 4px;">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <div style="font-size: 0.65rem;">${label}</div>
                        </div>
                        <img class="gam-preview-img" style="display: none; width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        const i = this.issue;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';

        modal.innerHTML = `
            <div class="ds-modal ds-modal--large">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${ICON.edit}
                        Редагування випуску
                    </div>
                    <button class="ds-modal-close">&times;</button>
                </div>
                <div class="ds-modal-body">
                    <form id="edit-issue-form">
                        <div class="admin-form-grid">
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.hash} CV ID випуску</label>
                                <input type="number" name="cv_id" class="admin-input" value="${i.cv_id || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.link} CV Slug випуску</label>
                                <input type="text" name="cv_slug" class="admin-input" value="${i.cv_slug || ''}">
                            </div>

                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.type} Назва випуску</label>
                                <input type="text" name="name" class="admin-input" value="${i.name || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.hash} Номер випуску</label>
                                <input type="text" name="issue_number" class="admin-input" value="${i.issue_number || ''}">
                            </div>

                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.book} ID тому в БД</label>
                                <input type="number" name="volume_id" class="admin-input" value="${i.volume_id || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.calendar} Дата обкладинки (yyyy-mm-dd)</label>
                                <input type="text" name="cover_date" class="admin-input" value="${i.cover_date || ''}" placeholder="YYYY-MM-DD">
                            </div>

                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.calendar} Дата виходу (yyyy-mm-dd)</label>
                                <input type="text" name="release_date" class="admin-input" value="${i.release_date || ''}" placeholder="YYYY-MM-DD">
                            </div>

                            ${this._imgFieldHTML('cv_img', 'Обкладинка випуску', i.cv_img, ICON.image)}

                            <div class="admin-form-group admin-form-group--full">
                                <label class="admin-label">${ICON.alignLeft} Опис випуску</label>
                                <textarea name="description" class="admin-textarea">${i.description || ''}</textarea>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="ds-modal-footer">
                    <button class="btn-admin btn-admin--secondary" id="edit-cancel">Скасувати</button>
                    <button class="btn-admin btn-admin--primary" id="edit-save">Зберегти зміни</button>
                </div>
            </div>
        `;

        modal.querySelector('.ds-modal-close').addEventListener('click', () => this.close());
        modal.querySelector('#edit-cancel').addEventListener('click', () => this.close());
        modal.querySelector('#edit-save').addEventListener('click', () => this.save());
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        this.modal = modal;
        document.body.appendChild(modal);

        this.initImageHandlers(modal);
    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            this.modal.remove();
            this.modal = null;
        }
    }

    async save() {
        const form = this.modal.querySelector('#edit-issue-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        ['cv_id', 'volume_id'].forEach(key => {
            data[key] = data[key] ? parseInt(data[key]) : null;
        });

        const saveBtn = this.modal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';

        try {
            // Handle cover file upload if selected
            const fileInput = form.querySelector('input[name="cv_img_file"]');
            if (fileInput && fileInput.files.length > 0) {
                const uploadData = new FormData();
                uploadData.append('file', fileInput.files[0]);
                const uploadRes = await API.upload('/images/upload/issue', uploadData);
                data['cv_img'] = uploadRes.url;
            }

            await API.put(`/issues/${this.issue.id}`, data);
            this.close();
            if (this.onSave) this.onSave();
        } catch (err) {
            alert('Помилка збереження: ' + (err.message || 'Невідома помилка'));
            saveBtn.disabled = false;
            saveBtn.textContent = 'Зберегти зміни';
        }
    }
}
