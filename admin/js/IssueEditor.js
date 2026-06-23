import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { STAFF_ROLES, getRoleSortIndex } from '/static/js/helpers/staff.js';
import { openAddReprintModal } from '/static/js/components/addReprintModal.js';

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
    constructor(issue, stories, persons, reprints, onSave) {
        this.issue = issue;
        this.stories = JSON.parse(JSON.stringify(stories || []));
        this.reprints = JSON.parse(JSON.stringify(reprints || []));
        this.onSave = onSave;
        this.modal = null;
        
        // Ініціалізуємо стаф з прив'язкою до індексів історій
        this.staff = (persons || []).map(p => {
            let storyIndex = -1;
            if (p.story_id) {
                storyIndex = this.stories.findIndex(s => s.id === p.story_id);
            }
            return {
                id: p.id,
                person_id: p.person_id,
                name: p.name,
                image: p.image,
                role: p.role || 'writer',
                story_index: storyIndex
            };
        });
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

    _buildAssignmentSelect(currentValue, staffIndex) {
        let options = `<option value="-1" ${currentValue === -1 ? 'selected' : ''}>Основна</option>`;
        this.stories.forEach((story, idx) => {
            const title = story.name_ua || story.name_original || `Історія ${idx + 1}`;
            options += `<option value="${idx}" ${currentValue === idx ? 'selected' : ''}>${escapeHtmlAttribute(title)}</option>`;
        });
        return `
            <select class="admin-input staff-assignment-select" data-staff-idx="${staffIndex}" style="height: 25px; padding: 4px 8px; font-size: 13px; max-width: 160px;">
                ${options}
            </select>
        `;
    }

    _buildRoleSelect(currentValue, staffIndex) {
        let options = '';
        const standardKeys = Object.keys(STAFF_ROLES);
        const cleanCurrent = currentValue ? currentValue.trim().toLowerCase() : '';
        
        if (cleanCurrent && !standardKeys.includes(cleanCurrent)) {
            options += `<option value="${currentValue}" selected>${escapeHtmlAttribute(currentValue)}</option>`;
        }
        
        const sortedKeys = Object.keys(STAFF_ROLES).sort((a, b) => getRoleSortIndex(a) - getRoleSortIndex(b));
        for (const key of sortedKeys) {
            options += `<option value="${key}" ${cleanCurrent === key ? 'selected' : ''}>${STAFF_ROLES[key]}</option>`;
        }
        
        return `
            <select class="admin-input staff-role-select" data-staff-idx="${staffIndex}" style="height: 25px; padding: 4px 8px; font-size: 13px; max-width: 140px;">
                ${options}
            </select>
        `;
    }

    renderStaffList(containerId, storyIndex) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;
        
        const filtered = this.staff
            .map((s, idx) => ({ s, idx }))
            .filter(item => item.s.story_index === storyIndex)
            .sort((a, b) => getRoleSortIndex(a.s.role) - getRoleSortIndex(b.s.role));
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); padding: 8px; text-align: center; border: 1px dashed var(--border-s); border-radius: var(--r);">
                    Немає призначених творців.
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="staff-editor-grid">
                ${filtered.map(item => {
                    const person = item.s;
                    const personImg = person.image ? comicVineImageUrl(person.image) : '';
                    const imgHTML = personImg
                        ? `<img class="staff-editor-avatar" src="${escapeHtmlAttribute(personImg)}" alt="${escapeHtmlAttribute(person.name)}">`
                        : `<div class="staff-editor-avatar staff-editor-avatar--empty"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>`;
                    
                    return `
                        <div class="staff-editor-card" data-idx="${item.idx}">
                            ${imgHTML}
                            <div class="staff-editor-info">
                                <span class="staff-editor-name" title="${escapeHtmlAttribute(person.name)}">${escapeHtmlAttribute(person.name)}</span>
                                <div style="display: flex; gap: 8px; margin-top: 4px; width: 100%;">
                                    ${this._buildRoleSelect(person.role, item.idx)}
                                    ${this._buildAssignmentSelect(person.story_index, item.idx)}
                                </div>
                            </div>
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-staff" data-staff-idx="${item.idx}" style="opacity: .5; padding: 0; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; align-self: end;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.querySelectorAll('.staff-role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.staffIdx);
                this.staff[idx].role = e.target.value;
            });
        });
        
        container.querySelectorAll('.staff-assignment-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.staffIdx);
                const newVal = parseInt(e.target.value);
                this.staff[idx].story_index = newVal;
                this.renderAllStaffLists();
            });
        });
        
        container.querySelectorAll('.btn-delete-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.staffIdx);
                this.staff.splice(idx, 1);
                this.renderAllStaffLists();
            });
        });
    }

    renderAllStaffLists() {
        this.renderStaffList('main-staff-container', -1);
        this.stories.forEach((story, index) => {
            this.renderStaffList(`story-staff-container-${index}`, index);
        });
    }

    renderReprintsList() {
        const container = this.modal.querySelector('#reprints-list-container');
        if (!container) return;

        if (this.reprints.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">
                    Немає доданих репринтів. Натисніть "+ Додати репринт" вище.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="reprints-editor-list" style="display: flex; flex-direction: column; gap: 8px;">
                ${this.reprints.map(r => {
                    const isOriginal = r.original_id === this.issue.id;
                    const volName = isOriginal 
                        ? (r.reprint_volume_name_uk || r.reprint_volume_name || '') 
                        : (r.original_volume_name_uk || r.original_volume_name || '');
                    const issueNum = isOriginal ? r.reprint_number : r.original_number;
                    
                    let displayTitle = 'Основна історія';
                    if (r.story_id) {
                        displayTitle = r.story_name_ua || r.story_name_original || 'Історія';
                    } else {
                        const issueName = isOriginal ? r.reprint_name : r.original_name;
                        if (issueName) displayTitle = issueName;
                    }

                    const reprintLang = r.reprint_volume_lang || '';
                    const langPrefix = reprintLang ? `${reprintLang.toLowerCase()}: ` : '';
                    const foreignNameHtml = r.story_foreign_name 
                        ? `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">${langPrefix}${escapeHtmlAttribute(r.story_foreign_name)}</div>`
                        : '';

                    return `
                        <div class="reprint-editor-card" style="
                            display: flex; align-items: center; justify-content: space-between;
                            padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border-s);
                            border-radius: var(--r); gap: 12px;
                        ">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
                                    ${escapeHtmlAttribute(volName)} #${escapeHtmlAttribute(issueNum || '—')}
                                </div>
                                <div style="font-size: 14px; font-weight: 500;">
                                    ${escapeHtmlAttribute(displayTitle)}
                                </div>
                                ${foreignNameHtml}
                            </div>
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-reprint" data-link-id="${r.id}" style="padding: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${ICON.trash}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.btn-delete-reprint').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const linkId = parseInt(e.currentTarget.dataset.linkId);
                if (!confirm('Ви впевнені, що хочете видалити цей репринт?')) return;
                
                try {
                    await API.delete(`/issues/reprints/${linkId}`);
                    this.reprints = this.reprints.filter(r => r.id !== linkId);
                    this.renderReprintsList();
                } catch (err) {
                    alert('Помилка видалення репринту: ' + err.message);
                }
            });
        });
    }

    initStaffSearch(btnId, containerId, targetStoryIndex) {
        const btn = this.modal.querySelector(`#${btnId}`);
        const container = this.modal.querySelector(`#${containerId}`);
        if (!btn || !container) return;
        
        btn.addEventListener('click', () => {
            let wrap = container.querySelector('.staff-search-wrapper');
            if (wrap) {
                wrap.remove();
                return;
            }
            
            wrap = document.createElement('div');
            wrap.className = 'staff-search-wrapper';
            wrap.style.cssText = 'margin-top: 8px; position: relative; width: 100%; display: flex; flex-direction: column; gap: 4px;';
            wrap.innerHTML = `
                <input type="text" class="admin-input staff-search-input" placeholder="Введіть ім'я автора для пошуку..." autocomplete="off">
                <div class="staff-search-results" style="display: none;"></div>
            `;
            
            container.appendChild(wrap);
            
            const input = wrap.querySelector('.staff-search-input');
            const results = wrap.querySelector('.staff-search-results');
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
                results.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Пошук...</div>';
                
                timeout = setTimeout(async () => {
                    try {
                        const res = await API.get('/personnel', { search: q, limit: 8 });
                        const items = res.items || [];
                        if (items.length === 0) {
                            results.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Нічого не знайдено</div>';
                            return;
                        }
                        
                        results.innerHTML = items.map(p => {
                            const personImg = p.image ? comicVineImageUrl(p.image) : '';
                            const imgHTML = personImg
                                ? `<img src="${escapeHtmlAttribute(personImg)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                                : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">?</div>`;
                            return `
                                <div class="staff-search-result-item" data-id="${p.id}" data-name="${escapeHtmlAttribute(p.name)}" data-image="${escapeHtmlAttribute(p.image || '')}" style="
                                    display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px;
                                    border-bottom: 1px solid var(--border-s); transition: background var(--t);
                                ">
                                    ${imgHTML}
                                    <span>${escapeHtmlAttribute(p.name)}</span>
                                </div>
                            `;
                        }).join('');
                        
                        results.querySelectorAll('.staff-search-result-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const target = item;
                                const personId = parseInt(target.dataset.id);
                                const name = target.dataset.name;
                                const image = target.dataset.image;
                                
                                this.staff.push({
                                    id: null,
                                    person_id: personId,
                                    name: name,
                                    image: image,
                                    role: 'writer',
                                    story_index: targetStoryIndex
                                });
                                
                                wrap.remove();
                                this.renderAllStaffLists();
                            });
                        });
                    } catch (err) {
                        results.innerHTML = `<div style="padding: 8px; font-size: 12px; color: var(--text-danger);">Помилка пошуку</div>`;
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

    renderStoryRows() {
        const container = this.modal.querySelector('#stories-editor-container');
        if (!container) return;

        if (this.stories.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;" id="no-stories-msg">
                    У цьому випуску поки немає історій. Натисніть кнопку нижче, щоб додати першу.
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        this.stories.forEach((story, index) => {
            const row = document.createElement('div');
            row.className = 'stories-editor-item';
            row.dataset.index = index;

            row.innerHTML = `
                <div class="admin-form-group">
                    <label class="admin-label">Оригінальна назва</label>
                    <input type="text" class="admin-input story-input-original" value="${escapeHtmlAttribute(story.name_original || '')}">
                </div>
                <div class="admin-form-group">
                    <label class="admin-label">Укр. назва</label>
                    <input type="text" class="admin-input story-input-ua" value="${escapeHtmlAttribute(story.name_ua || '')}">
                </div>
                <div class="admin-form-group">
                    <label class="admin-label">Порядок</label>
                    <input type="number" class="admin-input story-input-order" value="${story.order_num ?? 0}">
                </div>
                <button type="button" class="btn-admin btn-admin--danger btn-delete-story-row" style="height: 38px; display: flex; align-items: center; justify-content: center; padding: 0 12px; margin-bottom: 0;">
                    ${ICON.trash}
                </button>
                <div class="admin-form-group admin-form-group--full" style="margin-top: 8px; border-top: 1px solid var(--border-s); padding-top: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Творці історії</span>
                        <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-story-staff-${index}" style="padding: 2px 8px; font-size: 11px; height: 24px;">+ Додати автора</button>
                    </div>
                    <div id="story-staff-container-${index}"></div>
                    <div id="story-staff-search-wrap-${index}"></div>
                </div>
            `;

            row.querySelector('.story-input-original').addEventListener('input', (e) => {
                this.stories[index].name_original = e.target.value;
                this.renderAllStaffLists(); // Щоб оновити назви у селектах призначення
            });
            row.querySelector('.story-input-ua').addEventListener('input', (e) => {
                this.stories[index].name_ua = e.target.value;
                this.renderAllStaffLists();
            });
            row.querySelector('.story-input-order').addEventListener('input', (e) => {
                this.stories[index].order_num = parseInt(e.target.value) || 0;
            });

            row.querySelector('.btn-delete-story-row').addEventListener('click', () => {
                // Якщо ми видаляємо історію, перепризначимо її авторів на основний випуск
                this.staff.forEach(s => {
                    if (s.story_index === index) {
                        s.story_index = -1;
                    } else if (s.story_index > index) {
                        s.story_index -= 1;
                    }
                });
                this.stories.splice(index, 1);
                this.renderStoryRows();
            });

            container.appendChild(row);
            
            // Рендеримо стаф для цієї історії
            this.renderStaffList(`story-staff-container-${index}`, index);
            this.initStaffSearch(`btn-add-story-staff-${index}`, `story-staff-search-wrap-${index}`, index);
        });
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
                    <div class="editor-tabs-segmented">
                        <button class="editor-tab-btn is-active" data-tab="info">Основна інформація</button>
                        <button class="editor-tab-btn" data-tab="stories">Історії</button>
                        <button class="editor-tab-btn" data-tab="reprints">Репрінти</button>
                    </div>

                    <form id="edit-issue-form">
                        <!-- Вкладка: Основна інформація -->
                        <div class="editor-tab-content is-active" id="tab-info">
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

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.book} Кількість сторінок</label>
                                    <input type="text" name="pages" class="admin-input" value="${i.pages || ''}" placeholder="Наприклад, 32 стор.">
                                </div>

                                ${this._imgFieldHTML('cv_img', 'Обкладинка випуску', i.cv_img, ICON.image)}

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Опис випуску</label>
                                    <textarea name="description" class="admin-textarea">${i.description || ''}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Вкладка: Історії -->
                        <div class="editor-tab-content" id="tab-stories">
                            <div class="admin-form-group admin-form-group--full" style="background: var(--bg-body); padding: 16px; border-radius: var(--r); border: 1px solid var(--border-s); margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text);">Основний персонал випуску</h4>
                                    <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-main-staff" style="padding: 4px 12px; font-size: 12px; height: 28px;">+ Додати автора</button>
                                </div>
                                <div id="main-staff-container"></div>
                                <div id="main-staff-search-wrap"></div>
                            </div>
                            
                            <h4 style="margin: 20px 0 12px; font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text); border-bottom: 1px solid var(--border-s); padding-bottom: 6px;">Історії випуску</h4>
                            <div class="stories-editor-list" id="stories-editor-container">
                                <!-- Рядки історій -->
                            </div>
                            <div class="stories-editor-actions">
                                <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-story-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Додати історію
                                </button>
                            </div>
                        </div>

                        <!-- Вкладка: Репрінти -->
                        <div class="editor-tab-content" id="tab-reprints">
                            <div class="admin-form-group admin-form-group--full" style="background: var(--bg-body); padding: 16px; border-radius: var(--r); border: 1px solid var(--border-s); margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text);">Репрінти випуску</h4>
                                    <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-reprint" style="padding: 4px 12px; font-size: 12px; height: 28px;">+ Додати репринт</button>
                                </div>
                                <div id="reprints-list-container"></div>
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

        modal.querySelector('#btn-add-story-row').addEventListener('click', () => {
            const nextOrder = this.stories.length 
                ? Math.max(...this.stories.map(s => s.order_num || 0)) + 1 
                : 1;
            this.stories.push({
                id: null,
                name_original: '',
                name_ua: '',
                order_num: nextOrder
            });
            this.renderStoryRows();
            this.renderAllStaffLists(); // перерендерити списки для нових опцій селекту
        });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        this.modal = modal;
        document.body.appendChild(modal);

        this.initImageHandlers(modal);
        this.renderStoryRows();
        this.renderReprintsList();
        
        modal.querySelector('#btn-add-reprint').addEventListener('click', () => {
            openAddReprintModal({
                issueId: this.issue.id,
                stories: this.stories,
                alreadyIds: new Set(this.reprints.map(r => r.original_id === this.issue.id ? r.reprint_id : r.original_id)),
                onAdd: async () => {
                    try {
                        const res = await API.get(`/issues/${this.issue.id}`);
                        this.reprints = res.reprints || [];
                        this.renderReprintsList();
                    } catch (err) {
                        console.error('Помилка оновлення списку репринтів:', err);
                    }
                }
            });
        });
        
        // Рендеримо основний стаф випуску
        this.renderStaffList('main-staff-container', -1);
        this.initStaffSearch('btn-add-main-staff', 'main-staff-search-wrap', -1);
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

        data.stories = this.stories;
        
        // Передаємо оновлений стаф
        data.staff = this.staff.map(s => ({
            person_id: s.person_id,
            role: s.role,
            story_index: s.story_index
        }));

        const saveBtn = this.modal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';

        try {
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
