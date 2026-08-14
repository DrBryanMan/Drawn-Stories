import { API } from '/static/js/helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { currentUser } from '/static/js/shell.js';
import { icon } from '/static/js/helpers/icons.js';
import { t } from '../../helpers/i18n.js';
import { fuzzySearchCharacters } from '../../helpers/fuse.js';

const fieldValue = (value) => escapeHtmlAttribute(value ?? '');

export class MangaChapterEditor {
    constructor(chapter, characters, onSave) {
        this.chapter = { ...chapter };
        this.characters = (characters || []).map(c => ({
            id: c.character_id || c.id,
            character_id: c.character_id || c.id,
            name: c.name || '',
            name_uk: c.name_uk || '',
            real_name: c.real_name || '',
            real_name_uk: c.real_name_uk || '',
            image: c.image || null,
            role: c.role || 'main'
        }));
        this.onSave = onSave;
        this.modal = null;
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
                    previewImg.src = isRemote ? normalizeImageUrl(src) : src;
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
                        <input type="text" name="${name}" value="${fieldValue(value)}" placeholder="URL зображення..." class="admin-input gam-img-url-input" autocomplete="off">
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

    render() {
        const c = this.chapter;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        modal.id = 'manga-chapter-editor-overlay';

        const role = currentUser ? currentUser.role : null;
        const isPrivileged = role === 'admin' || role === 'moderator' || role === 'editor';

        modal.innerHTML = `
            <div class="ds-modal ds-modal--large" id="manga-chapter-editor-modal">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${icon('edit', 18)}
                        Редагування розділу манґи
                    </div>
                    <button class="ds-modal-close btn-modal-close-trigger">&times;</button>
                </div>
                <div class="ds-modal-body">
                    <div class="editor-tabs-segmented" style="margin-bottom: 20px;">
                        <button class="editor-tab-btn is-active" data-tab="info">${t('tab_main')}</button>
                        <button class="editor-tab-btn" data-tab="characters">${t('characters')}</button>
                    </div>

                    <form id="edit-manga-chapter-form">
                        <!-- Вкладка: Основна інформація -->
                        <div class="editor-tab-content is-active" id="tab-info">
                            <div class="admin-form-grid">
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('hash', 14)} Номер розділу *</label>
                                    <input type="text" name="chapter_number" class="admin-input" value="${fieldValue(c.chapter_number)}" required placeholder="Наприклад, 1 або 1.5">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('book', 14)} Кількість сторінок</label>
                                    <input type="number" name="pages" class="admin-input" value="${fieldValue(c.pages)}" placeholder="Наприклад, 24">
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('type', 14)} Назва оригінальна (name)</label>
                                    <input type="text" name="name" class="admin-input" value="${fieldValue(c.name)}">
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('type', 14)} Назва українська (name_uk)</label>
                                    <input type="text" name="name_uk" class="admin-input" value="${fieldValue(c.name_uk)}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('type', 14)} Назва англійська (name_en)</label>
                                    <input type="text" name="name_en" class="admin-input" value="${fieldValue(c.name_en)}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${icon('type', 14)} Назва нативна (name_native)</label>
                                    <input type="text" name="name_native" class="admin-input" value="${fieldValue(c.name_native)}" placeholder="японська тощо">
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('calendar', 14)} Дата релізу (YYYY-MM-DD)</label>
                                    <input type="text" name="release_date" class="admin-input" value="${fieldValue(c.release_date)}" placeholder="YYYY-MM-DD">
                                </div>

                                ${this._imgFieldHTML('image', 'Обкладинка розділу', c.image, icon('imagePlaceholder', 14))}

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${icon('list', 14)} Синопсис розділу</label>
                                    <textarea name="synopsis" class="admin-textarea" rows="4">${fieldValue(c.synopsis)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Вкладка: Появи персонажів -->
                        <div class="editor-tab-content" id="tab-characters">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Персонажі у розділі</h3>
                                <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-chapter-character" style="font-size: 12px; height: 32px; padding: 0 12px;">
                                    ${icon('plus', 14)} Додати персонажа
                                </button>
                            </div>
                            <div id="chapter-character-search-wrap"></div>
                            <div id="chapter-characters-list-container" style="margin-top: 12px;"></div>
                        </div>
                    </form>
                </div>

                <div class="ds-modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--border-s);">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${role === 'admin' && this.chapter && this.chapter.id ? `
                            <button type="button" class="btn-admin btn-admin--danger" id="chapter-modal-delete-btn" title="${t('delete_from_db')}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
                                ${icon('trash', 14)}
                            </button>
                        ` : ''}
                        ${!isPrivileged ? `
                            <input type="text" id="edit-propose-comment" class="admin-input" placeholder="${t('edit_comment_placeholder')}" style="max-width: 260px; font-size: 12px; height: 32px; margin-bottom: 0;">
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-admin btn-admin--secondary btn-modal-close-trigger" type="button">${t('cancel')}</button>
                        ${(() => {
                            if (role === 'admin') {
                                return `
                                    <button class="btn-admin btn-admin--primary btn-admin--purple" id="edit-save-direct">${t('save_to_db')}</button>
                                    <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">${t('save_and_approve')}</button>
                                `;
                            } else if (role === 'moderator' || role === 'editor') {
                                return `
                                    <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">${t('save_and_approve')}</button>
                                `;
                            } else {
                                return `
                                    <button class="btn-admin btn-admin--primary btn-admin--yellow" id="edit-save-propose" style="height: 32px; padding: 0 16px; font-size: 13px;">${t('propose_edit')}</button>
                                `;
                            }
                        })()}
                    </div>
                </div>
            </div>
        `;

        // Bind tabs
        const tabBtns = modal.querySelectorAll('.editor-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                tabBtns.forEach(b => b.classList.remove('is-active'));
                modal.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('is-active'));

                btn.classList.add('is-active');
                const targetTab = btn.dataset.tab;
                modal.querySelector(`#tab-${targetTab}`).classList.add('is-active');
            });
        });

        // Close handlers
        modal.querySelectorAll('.btn-modal-close-trigger').forEach(btn => btn.addEventListener('click', () => this.close()));
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        this._handleEsc = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._handleEsc);

        // Delete from DB button
        const deleteBtn = modal.querySelector('#chapter-modal-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm(`Ви впевнені, що хочете остаточно видалити цей розділ?`)) return;
                try {
                    await API.delete(`/manga-chapters/${this.chapter.id}`);
                    this.close();
                    if (this.chapter.volume_id) {
                        window.location.hash = `#/volumes/${this.chapter.volume_id}`;
                    } else {
                        window.location.hash = '#/manga-chapters';
                    }
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                }
            });
        }

        // Save buttons
        modal.querySelector('#edit-save-direct')?.addEventListener('click', () => this.save('direct'));
        modal.querySelector('#edit-save-approve')?.addEventListener('click', () => this.save('approve'));
        modal.querySelector('#edit-save-propose')?.addEventListener('click', () => this.save('propose'));

        this.modal = modal;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        this.initImageHandlers(modal);
        this.renderCharactersList();
        this.initCharacterSearch();
    }

    renderCharactersList() {
        const container = this.modal.querySelector('#chapter-characters-list-container');
        if (!container) return;

        if (this.characters.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px; border: 1px dashed var(--border-s); border-radius: var(--r);">
                    Персонажі ще не додані до цього розділу.
                </div>
            `;
            return;
        }

        const roleOptions = [
            { value: 'main', label: t('role_main_char') },
            { value: 'supporting', label: t('role_supporting_char') },
            { value: 'minor', label: t('role_minor_char') },
            { value: 'cameo', label: t('role_cameo') }
        ];

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px;">
                ${this.characters.map((char, index) => {
                    const imgUrl = char.image ? normalizeImageUrl(char.image) : '';
                    const displayName = char.name_uk || char.name || char.real_name_uk || char.real_name || 'Персонаж';
                    const subName = (char.name_uk || char.name) && (char.real_name_uk || char.real_name)
                        ? (char.real_name_uk || char.real_name)
                        : '';

                    return `
                        <div class="chapter-char-card" style="
                            display: flex; align-items: center; gap: 10px; padding: 8px 10px;
                            background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r);
                        ">
                            <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--bg-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${imgUrl 
                                    ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover;">`
                                    : `<span style="color: var(--text-muted);">${icon('imagePlaceholder', 16)}</span>`}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text);">
                                    ${escapeHtmlAttribute(displayName)}
                                </div>
                                ${subName ? `
                                    <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${escapeHtmlAttribute(subName)}
                                    </div>
                                ` : ''}
                                <select class="admin-input char-role-select" data-index="${index}" style="margin-top: 4px; padding: 2px 6px; font-size: 11px; height: 26px; width: 100%;">
                                    ${roleOptions.map(opt => `
                                        <option value="${opt.value}" ${char.role === opt.value ? 'selected' : ''}>${opt.label}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-char" data-index="${index}" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Видалити">
                                ${icon('trash', 13)}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.char-role-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.characters[idx].role = e.target.value;
            });
        });

        container.querySelectorAll('.btn-delete-char').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                this.characters.splice(idx, 1);
                this.renderCharactersList();
            });
        });
    }

    initCharacterSearch() {
        const btn = this.modal.querySelector('#btn-add-chapter-character');
        const container = this.modal.querySelector('#chapter-character-search-wrap');
        if (!btn || !container) return;

        btn.addEventListener('click', () => {
            let wrap = container.querySelector('.chapter-char-search-wrapper');
            if (wrap) {
                wrap.remove();
                return;
            }

            wrap = document.createElement('div');
            wrap.className = 'chapter-char-search-wrapper';
            wrap.style.cssText = 'margin-top: 8px; position: relative; width: 100%; display: flex; flex-direction: column; gap: 4px;';
            wrap.innerHTML = `
                <input type="text" class="admin-input chapter-char-search-input" placeholder="Введіть ім'я персонажа для пошуку..." autocomplete="off" style="margin-bottom: 0;">
                <div class="chapter-char-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r); z-index: 10; max-height: 220px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
            `;

            container.appendChild(wrap);

            const input = wrap.querySelector('.chapter-char-search-input');
            const results = wrap.querySelector('.chapter-char-search-results');
            input.focus();

            let timeout = null;
            input.addEventListener('input', () => {
                const q = input.value.trim();
                clearTimeout(timeout);
                if (!q) {
                    results.style.display = 'none';
                    results.innerHTML = '';
                    return;
                }

                results.style.display = 'block';
                results.innerHTML = '<div style="padding: 8px 12px; font-size: 12px; color: var(--text-muted);">Пошук...</div>';

                timeout = setTimeout(async () => {
                    try {
                        let items = await API.get(`/issues/appearances/search/characters`, { search: q });
                        items = await fuzzySearchCharacters(items || [], q);
                        if (!items || items.length === 0) {
                            results.innerHTML = '<div style="padding: 8px 12px; font-size: 12px; color: var(--text-muted);">Нічого не знайдено</div>';
                            return;
                        }

                        results.innerHTML = items.map(item => {
                            const img = item.image ? normalizeImageUrl(item.image) : '';
                            const avatarHTML = img
                                ? `<img src="${escapeHtmlAttribute(img)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                                : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">?</div>`;
                            
                            const displayName = item.name_uk || item.name || item.real_name_uk || item.real_name || 'Персонаж';
                            const subtitle = (item.name_uk || item.name) && (item.real_name_uk || item.real_name)
                                ? ` <span style="font-size: 11px; color: var(--text-muted);">(${escapeHtmlAttribute(item.real_name_uk || item.real_name)})</span>`
                                : '';

                            return `
                                <div class="char-search-result-row" 
                                    data-id="${item.id}"
                                    data-name="${escapeHtmlAttribute(item.name || '')}"
                                    data-name-uk="${escapeHtmlAttribute(item.name_uk || '')}"
                                    data-real-name="${escapeHtmlAttribute(item.real_name || '')}"
                                    data-real-name-uk="${escapeHtmlAttribute(item.real_name_uk || '')}"
                                    data-image="${escapeHtmlAttribute(item.image || '')}"
                                    style="
                                        display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px;
                                        border-bottom: 1px solid var(--border-s); transition: background var(--t); color: var(--text);
                                    "
                                >
                                    ${avatarHTML}
                                    <span>${escapeHtmlAttribute(displayName)}${subtitle}</span>
                                </div>
                            `;
                        }).join('');

                        results.querySelectorAll('.char-search-result-row').forEach(row => {
                            row.addEventListener('click', () => {
                                const charId = parseInt(row.dataset.id);
                                const exists = this.characters.some(c => (c.character_id || c.id) === charId);
                                if (!exists) {
                                    this.characters.push({
                                        id: charId,
                                        character_id: charId,
                                        name: row.dataset.name,
                                        name_uk: row.dataset.nameUk,
                                        real_name: row.dataset.realName,
                                        real_name_uk: row.dataset.realNameUk,
                                        image: row.dataset.image || null,
                                        role: 'main'
                                    });
                                    this.renderCharactersList();
                                }
                                wrap.remove();
                            });
                        });
                    } catch (err) {
                        results.innerHTML = `<div style="padding: 8px 12px; font-size: 12px; color: var(--text-danger);">Помилка пошуку</div>`;
                    }
                }, 250);
            });

            const closeSearch = (e) => {
                if (wrap && !wrap.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                    wrap.remove();
                    document.removeEventListener('click', closeSearch);
                }
            };
            document.addEventListener('click', closeSearch);
        });
    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            document.body.style.overflow = '';
            this.modal.remove();
            this.modal = null;
        }
    }

    async save(actionType = 'direct') {
        const form = this.modal.querySelector('#edit-manga-chapter-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const chNumber = (data.chapter_number || '').trim();
        if (!chNumber) {
            alert('Будь ласка, вкажіть номер розділу');
            return;
        }

        data.chapter_number = chNumber;
        data.pages = data.pages ? parseInt(data.pages) : null;
        data.name = data.name ? data.name.trim() : null;
        data.name_uk = data.name_uk ? data.name_uk.trim() : null;
        data.name_en = data.name_en ? data.name_en.trim() : null;
        data.name_native = data.name_native ? data.name_native.trim() : null;
        data.release_date = data.release_date ? data.release_date.trim() : null;
        data.synopsis = data.synopsis ? data.synopsis.trim() : null;

        data.characters = this.characters.map(c => ({
            character_id: c.character_id || c.id,
            role: c.role || 'main'
        }));

        let saveBtnId = '#edit-save-propose';
        let btnText = t('propose_edit');
        if (actionType === 'direct') {
            saveBtnId = '#edit-save-direct';
            btnText = t('save_to_db');
        } else if (actionType === 'approve') {
            saveBtnId = '#edit-save-approve';
            btnText = t('save_and_approve');
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
                await API.put(`/manga-chapters/${this.chapter.id}`, data);
            } else {
                const autoApprove = actionType === 'approve';
                await API.post('/edits', {
                    entity_type: 'manga_chapter',
                    entity_id: this.chapter.id,
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
