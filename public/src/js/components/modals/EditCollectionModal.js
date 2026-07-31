import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { currentUser } from '/static/js/shell.js';
import * as Utils from './editorUtils.js';
import { icon } from '../../helpers/icons.js';

const fieldValue = (value) => escapeHtmlAttribute(value ?? '');

export class CollectionEditor {
    constructor(collection, onSave) {
        this.collection = collection;
        this.onSave = onSave;
        this.modal = null;
        this.allThemes = [];
        this.currentThemeIds = new Set();
    }

    async fetchExtraData() {
        try {
            const [themesRes, colRes] = await Promise.all([
                API.get('/themes', { limit: 1000 }),
                API.get(`/collections/${this.collection.id}`)
            ]);
            this.allThemes = themesRes.items || themesRes.data || [];
            this.currentThemeIds = new Set((colRes.themes || []).map(t => t.id));
            this.collection = { ...this.collection, ...colRes.collection };
        } catch (err) {
            console.error('Error fetching extra data:', err);
        }
    }

    initImageHandlers(area) {
        area.querySelectorAll('.gam-image-field-container').forEach(container => {
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
        });
    }

    _imgFieldHTML(name, label, value, labelIconHtml) {
        return `
            <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">${labelIconHtml} ${label}</label>
                <div class="gam-image-field-container" style="display: grid; grid-template-columns: 1fr 140px; gap: 16px; align-items: start; position: relative;">
                    <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px;">
                        <input type="url" name="${name}" value="${fieldValue(value)}" placeholder="URL зображення..." class="admin-input gam-img-url-input">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label class="btn-admin btn-admin--secondary" style="margin: 0; cursor: pointer; flex: 1; text-align: center; white-space: nowrap;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Локальний файл
                                <input type="file" name="${name}_file" class="gam-img-file-input" style="display: none;" accept="image/webp">
                            </label>
                            <button type="button" class="btn-admin btn-admin--danger gam-img-clear" style="display: none; padding: 8px 12px; align-items: center; justify-content: center; height: 34px;">${icon('trash', 14)}</button>
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

    async render() {
        await this.fetchExtraData();
        
        const c = this.collection;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        modal.id = 'collection-editor-overlay';
        
        window._emRemoveThemeCol = (themeId) => {
            const cb = modal.querySelector(`#themes-list input[value="${themeId}"]`);
            if (cb) {
                cb.checked = false;
                cb.dispatchEvent(new Event('change'));
            }
            this._rebuildThemeChips(modal);
        };

        window._emThemeChangeCol = () => { this._rebuildThemeChips(modal); };
        window._emFilterThemesCol = (q) => { Utils.filterThemeCheckboxList(q, 'themes-list'); };

        if (c.contents) {
            try {
                const list = typeof c.contents === 'string' ? JSON.parse(c.contents) : c.contents;
                this.contents = Array.isArray(list) ? list : [];
            } catch (e) {
                console.error('Error parsing contents:', e);
                this.contents = [];
            }
        } else {
            this.contents = [];
        }

        modal.innerHTML = `
            <div class="ds-modal ds-modal--large" id="collection-editor-modal">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${icon('edit', 18)}
                        Редагування збірника
                    </div>
                    <button class="ds-modal-close">&times;</button>
                </div>
                <div class="ds-modal-body">
                    <div class="editor-tabs-segmented" style="margin-bottom: 20px;">
                        <button class="editor-tab-btn is-active" data-tab="info">Основна інформація</button>
                        <button class="editor-tab-btn" data-tab="contents">Зміст</button>
                    </div>

                    <form id="edit-collection-form">
                        <!-- Вкладка: Основна інформація -->
                        <div class="editor-tab-content is-active" id="tab-info">
                            <div class="admin-form-grid">
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('hash', 14)} CV ID</label>
                                    <input type="number" name="cv_id" class="admin-input" value="${fieldValue(c.cv_id)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('link', 14)} CV Slug</label>
                                    <input type="text" name="cv_slug" class="admin-input" value="${fieldValue(c.cv_slug)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('hash', 14)} Номер</label>
                                    <input type="text" name="issue_number" class="admin-input" value="${fieldValue(c.issue_number)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('type', 14)} Назва</label>
                                    <input type="text" name="name" class="admin-input" value="${fieldValue(c.name)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('calendar', 14)} Дата обкладинки</label>
                                    <input type="text" name="cover_date" class="admin-input" value="${fieldValue(c.cover_date)}" placeholder="YYYY-MM-DD">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('calendar', 14)} Дата виходу</label>
                                    <input type="text" name="release_date" class="admin-input" value="${fieldValue(c.release_date)}" placeholder="YYYY-MM-DD">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('hash', 14)} ISBN</label>
                                    <input type="text" name="isbn" class="admin-input" value="${fieldValue(c.isbn)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('hash', 14)} Сторінок</label>
                                    <input type="number" name="pages" class="admin-input" value="${fieldValue(c.pages)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('check', 14)} Статус достовірності</label>
                                    <select name="verification_status" class="admin-input">
                                        <option value="unverified" ${c.verification_status === 'unverified' ? 'selected' : ''}>Неперевірено</option>
                                        <option value="open_sources" ${c.verification_status === 'open_sources' ? 'selected' : ''}>З інтернету</option>
                                        <option value="physical" ${c.verification_status === 'physical' ? 'selected' : ''}>З примірника</option>
                                    </select>
                                </div>

                                ${this._imgFieldHTML('image', 'Обкладинка', c.image, icon('image', 14))}

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('externalLink', 14)} Посилання на сайт джерела</label>
                                    <input type="url" name="site_link" class="admin-input" value="${fieldValue(c.site_link)}" placeholder="https://...">
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('list', 14)} Синопсис (UA)</label>
                                    <textarea name="synopsis_ua" class="admin-textarea">${fieldValue(c.synopsis_ua)}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('list', 14)} Синопсис (EN)</label>
                                    <textarea name="synopsis" class="admin-textarea">${fieldValue(c.synopsis)}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('list', 14)} Опис (Description)</label>
                                    <textarea name="description" class="admin-textarea">${fieldValue(c.description)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Вкладка: Зміст -->
                        <div class="editor-tab-content" id="tab-contents">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--text);">Розділи</h3>
                            <div id="col-contents-editor-container"></div>
                        </div>
                    </form>
                </div>
                <div class="ds-modal-footer">
                    <button class="btn-admin btn-admin--secondary" id="edit-cancel">Скасувати</button>
                    ${(() => {
                        const role = currentUser ? currentUser.role : null;
                        if (role === 'admin') {
                            return `
                                <button class="btn-admin btn-admin--primary btn-admin--purple" id="edit-save-direct">Записати в БД</button>
                                <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">Записати і прийняти</button>
                            `;
                        } else if (role === 'moderator' || role === 'editor') {
                            return `
                                <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">Записати і прийняти</button>
                            `;
                        } else {
                            return `
                                <input type="text" id="edit-propose-comment" class="admin-input" placeholder="Коментар до вашої правки..." style="margin-right: auto; max-width: 300px; font-size: 0.85rem; padding: 6px 10px; height: 32px;">
                                <button class="btn-admin btn-admin--primary btn-admin--yellow" id="edit-save-propose" style="height: 32px; padding: 0 16px; font-size: 13px;">Запропонувати</button>
                            `;
                        }
                    })()}
                </div>
            </div>
        `;

        modal.querySelector('.ds-modal-close').addEventListener('click', () => this.close());
        modal.querySelector('#edit-cancel').addEventListener('click', () => this.close());
        
        modal.querySelector('#edit-save-direct')?.addEventListener('click', () => this.save('direct'));
        modal.querySelector('#edit-save-approve')?.addEventListener('click', () => this.save('approve'));
        modal.querySelector('#edit-save-propose')?.addEventListener('click', () => this.save('propose'));
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        const tabBtns = modal.querySelectorAll('.editor-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                tabBtns.forEach(b => b.classList.remove('is-active'));
                modal.querySelectorAll('.editor-tab-content').forEach(pane => pane.classList.remove('is-active'));

                btn.classList.add('is-active');
                const targetTab = btn.dataset.tab;
                modal.querySelector(`#tab-${targetTab}`).classList.add('is-active');
            });
        });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        this.modal = modal;
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        this.initImageHandlers(modal);
        this._renderContentsEditor(modal);
    }

    _renderContentsEditor(modal) {
        const container = modal.querySelector('#col-contents-editor-container');
        if (!container) return;

        let html = `
            <div class="col-contents-editor-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        `;

        this.contents.forEach((item, index) => {
            html += `
                <div class="col-content-row" style="display: flex; align-items: center; gap: 12px;">
                    <input type="text" class="admin-input col-content-input" data-index="${index}" value="${escapeHtmlAttribute(item)}" style="flex: 1;" placeholder="Розділ ${index + 1}">
                    <button type="button" class="btn-remove-content" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 4px;" title="Видалити">
                        ${icon('x', 14)}
                    </button>
                </div>
            `;
        });

        html += `
            </div>
            <div class="col-content-add-row" style="display: flex; gap: 12px; align-items: center;">
                <input type="text" id="new-content-name" class="admin-input" style="flex: 1;" placeholder="Назва нового розділу">
                <button type="button" id="btn-add-content-row" style="
                    background: var(--bg-success-subtle, #e6f7ed);
                    color: var(--text-success, #1f9d55);
                    border: 1px solid var(--border-success-subtle, #d3f2df);
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    white-space: nowrap;
                    font-size: 14px;
                    height: 38px;
                ">
                    ${icon('plus', 14)} Додати
                </button>
            </div>
        `;

        container.innerHTML = html;

        // Add event listeners
        const inputs = container.querySelectorAll('.col-content-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.contents[index] = e.target.value;
            });
        });

        const removeBtns = container.querySelectorAll('.btn-remove-content');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.contents.splice(index, 1);
                this._renderContentsEditor(modal);
            });
        });

        const newNameInput = container.querySelector('#new-content-name');
        const addBtn = container.querySelector('#btn-add-content-row');

        const doAdd = () => {
            const val = newNameInput.value.trim();
            if (val) {
                this.contents.push(val);
                this._renderContentsEditor(modal);
            }
        };

        addBtn.addEventListener('click', doAdd);
        newNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doAdd();
            }
        });
    }

    _rebuildThemeChips(modal) {
        const container = modal.querySelector('#col-theme-chips');
        if (!container) return;
        const checked = modal.querySelectorAll('#themes-list input[type="checkbox"]:checked');
        const selectedThemes = Array.from(checked).map(cb => ({
            id: parseInt(cb.value),
            name: cb.dataset.uaName || cb.closest('label')?.querySelector('.theme-cb-label')?.textContent?.trim() || '',
            type: cb.dataset.type || 'theme',
        }));
        container.innerHTML = Utils.buildThemeChipsHTML(selectedThemes, 'window._emRemoveThemeCol');
    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            this.modal.remove();
            this.modal = null;
            document.body.classList.remove('modal-open');
        }
    }

    async save(actionType = 'direct') {
        const form = this.modal.querySelector('#edit-collection-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        ['cv_id', 'pages'].forEach(key => {
            data[key] = data[key] ? parseInt(data[key]) : null;
        });

        // Save stringified array of contents
        data.contents = JSON.stringify((this.contents || []).map(s => s.trim()).filter(s => s));

        let saveBtnId = '#edit-save-propose';
        let btnText = 'Запропонувати';
        if (actionType === 'direct') {
            saveBtnId = '#edit-save-direct';
            btnText = 'Записати в БД';
        } else if (actionType === 'approve') {
            saveBtnId = '#edit-save-approve';
            btnText = 'Записати і прийняти';
        }

        const saveBtn = this.modal.querySelector(saveBtnId);
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Збереження...';
        }

        let comment = '';
        if (actionType === 'propose') {
            const commentInput = this.modal.querySelector('#edit-propose-comment');
            if (commentInput) comment = commentInput.value.trim();
        }

        try {
            const fileInput = form.querySelector('input[name="image_file"]');
            if (fileInput && fileInput.files.length > 0) {
                const uploadData = new FormData();
                uploadData.append('file', fileInput.files[0]);
                const uploadRes = await API.upload('/images/upload/issue', uploadData);
                data.image = uploadRes.url;
            }

            if (actionType === 'direct') {
                await API.put(`/collections/${this.collection.id}`, data);
            } else {
                const autoApprove = actionType === 'approve';
                await API.post('/edits', {
                    entity_type: 'collection',
                    entity_id: this.collection.id,
                    patch_data: data,
                    auto_approve: autoApprove,
                    comment: comment
                });
            }

            this.close();
            if (this.onSave) this.onSave();
        } catch (err) {
            alert('Помилка збереження: ' + (err.message || 'Невідома помилка'));
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = btnText;
            }
        }
    }
}