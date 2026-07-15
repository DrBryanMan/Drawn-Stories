import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import * as Utils from './editorUtils.js';

const ICON = {
    hash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    link2: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
    database: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
    type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
    building: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="18"></line><line x1="15" y1="22" x2="15" y2="18"></line><line x1="18" y1="22" x2="18" y2="18"></line><line x1="6" y1="22" x2="6" y2="18"></line></svg>',
    tags: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 10-10 10-10-10L12 2Z"></path><path d="m7 7 3 3"></path><path d="m7 17 3-3"></path></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="10" y1="14" x2="22" y2="3"></line></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    shieldCheck: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
};

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

    _imgFieldHTML(name, label, value, icon) {
        return `
            <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">${icon} ${label}</label>
                <div class="gam-image-field-container" style="display: grid; grid-template-columns: 1fr 140px; gap: 16px; align-items: start; position: relative;">
                    <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px;">
                        <input type="url" name="${name}" value="${fieldValue(value)}" placeholder="URL зображення..." class="admin-input gam-img-url-input">
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

    async render() {
        await this.fetchExtraData();
        
        const c = this.collection;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        
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
            <div class="ds-modal ds-modal--large">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${ICON.edit}
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
                                    <label class="admin-label">${ICON.hash} CV ID</label>
                                    <input type="number" name="cv_id" class="admin-input" value="${fieldValue(c.cv_id)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.link} CV Slug</label>
                                    <input type="text" name="cv_slug" class="admin-input" value="${fieldValue(c.cv_slug)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.hash} Номер</label>
                                    <input type="text" name="issue_number" class="admin-input" value="${fieldValue(c.issue_number)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.type} Назва</label>
                                    <input type="text" name="name" class="admin-input" value="${fieldValue(c.name)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.calendar} Дата обкладинки</label>
                                    <input type="text" name="cover_date" class="admin-input" value="${fieldValue(c.cover_date)}" placeholder="YYYY-MM-DD">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.calendar} Дата виходу</label>
                                    <input type="text" name="release_date" class="admin-input" value="${fieldValue(c.release_date)}" placeholder="YYYY-MM-DD">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.hash} ISBN</label>
                                    <input type="text" name="isbn" class="admin-input" value="${fieldValue(c.isbn)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.hash} Сторінок</label>
                                    <input type="number" name="pages" class="admin-input" value="${fieldValue(c.pages)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.shieldCheck} Статус достовірності</label>
                                    <select name="verification_status" class="admin-input">
                                        <option value="unverified" ${c.verification_status === 'unverified' ? 'selected' : ''}>Неперевірено</option>
                                        <option value="open_sources" ${c.verification_status === 'open_sources' ? 'selected' : ''}>З інтернету</option>
                                        <option value="physical" ${c.verification_status === 'physical' ? 'selected' : ''}>З примірника</option>
                                    </select>
                                </div>

                                ${this._imgFieldHTML('image', 'Обкладинка', c.image, ICON.image)}

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.externalLink} Посилання на сайт джерела</label>
                                    <input type="url" name="site_link" class="admin-input" value="${fieldValue(c.site_link)}" placeholder="https://...">
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Синопсис (UA)</label>
                                    <textarea name="synopsis_ua" class="admin-textarea">${fieldValue(c.synopsis_ua)}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Синопсис (EN)</label>
                                    <textarea name="synopsis" class="admin-textarea">${fieldValue(c.synopsis)}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Опис (Description)</label>
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
                    <button class="btn-admin btn-admin--primary" id="edit-save">Зберегти зміни</button>
                </div>
            </div>
        `;

        modal.querySelector('.ds-modal-close').addEventListener('click', () => this.close());
        modal.querySelector('#edit-cancel').addEventListener('click', () => this.close());
        modal.querySelector('#edit-save').addEventListener('click', () => this.save());
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
                        ${ICON.x}
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
                    ${ICON.plus} Додати
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
        }
    }

    async save() {
        const form = this.modal.querySelector('#edit-collection-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        ['cv_id', 'pages'].forEach(key => {
            data[key] = data[key] ? parseInt(data[key]) : null;
        });

        // Save stringified array of contents
        data.contents = JSON.stringify((this.contents || []).map(s => s.trim()).filter(s => s));

        const saveBtn = this.modal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';

        try {
            const fileInput = form.querySelector('input[name="image_file"]');
            if (fileInput && fileInput.files.length > 0) {
                const uploadData = new FormData();
                uploadData.append('file', fileInput.files[0]);
                const uploadRes = await API.upload('/images/upload/issue', uploadData);
                data.image = uploadRes.url;
            }

            await API.put(`/collections/${this.collection.id}`, data);
            this.close();
            if (this.onSave) this.onSave();
        } catch (err) {
            alert('Помилка збереження: ' + (err.message || 'Невідома помилка'));
            saveBtn.disabled = false;
            saveBtn.textContent = 'Зберегти зміни';
        }
    }
}