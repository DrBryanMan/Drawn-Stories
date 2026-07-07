import { API } from '/static/js/helpers/api.js';
import { LANG_MAP } from '/static/js/helpers/lang.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { STAFF_ROLES, getRoleSortIndex } from '/static/js/helpers/staff.js';
import * as Utils from './editorUtils.js';
import { openEditCharacterModal } from './EditCharacterModal.js';
import { currentUser } from '/static/js/shell.js';

const ICON = {
    hash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    link2: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
    database: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
    type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    languages: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
    building: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="18"></line><line x1="15" y1="22" x2="15" y2="18"></line><line x1="18" y1="22" x2="18" y2="18"></line><line x1="6" y1="22" x2="6" y2="18"></line><line x1="9" y1="6" x2="9" y2="6"></line><line x1="15" y1="6" x2="15" y2="6"></line><line x1="9" y1="10" x2="9" y2="10"></line><line x1="15" y1="10" x2="15" y2="10"></line><line x1="9" y1="14" x2="9" y2="14"></line><line x1="15" y1="14" x2="15" y2="14"></line></svg>',
    tags: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 10-10 10-10-10L12 2Z"></path><path d="m7 7 3 3"></path><path d="m7 17 3-3"></path></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    layout: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="10" y1="14" x2="22" y2="3"></line></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
};

export class VolumeEditor {
    constructor(volume, onSave) {
        this.volume = volume;
        this.onSave = onSave;
        this.modal = null;
        this.allThemes = [];
        this.currentThemeIds = new Set();
        this.staff = [];
        this.characters = [];
    }

    async fetchExtraData() {
        try {
            const [themesRes, volRes] = await Promise.all([
                API.get('/themes', { limit: 1000 }),
                API.get(`/volumes/${this.volume.id}`)
            ]);
            this.allThemes = themesRes.items || themesRes.data || [];
            this.currentThemeIds = new Set((volRes.themes || []).map(t => t.id));
            this.volume = { ...this.volume, ...volRes.volume };
            const rawStaff = volRes.staff || [];
            const groupedStaff = new Map();
            rawStaff.forEach(p => {
                const pid = p.person_id || p.id;
                if (!groupedStaff.has(pid)) {
                    groupedStaff.set(pid, {
                        person_id: pid,
                        name: p.name,
                        image: p.image,
                        roles: [p.role || 'writer']
                    });
                } else {
                    const existing = groupedStaff.get(pid);
                    if (p.role && !existing.roles.includes(p.role)) {
                        existing.roles.push(p.role);
                    }
                }
            });
            this.staff = Array.from(groupedStaff.values());
            this.characters = volRes.characters || [];
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

            // Initial preview
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

    _imgFieldHTML(name, label, value, icon, isBanner = false) {
        const previewWidth = isBanner ? '280px' : '140px';
        const previewHeight = isBanner ? '120px' : '180px';
        const gridTemplate = isBanner ? '1fr' : '1fr 140px';
        
        return `
            <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">${icon} ${label}</label>
                <div class="gam-image-field-container" style="display: grid; grid-template-columns: ${gridTemplate}; gap: 16px; align-items: start; position: relative;">
                    <div class="gam-image-inputs" style="display: flex; flex-direction: column; gap: 8px; ${isBanner ? `padding-right: ${parseInt(previewWidth) + 16}px; min-height: ${previewHeight};` : ''}">
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
                        width: ${previewWidth}; height: ${previewHeight}; border: 2px dashed var(--border); border-radius: 8px;
                        display: flex; align-items: center; justify-content: center; overflow: hidden;
                        background: var(--bg-body); position: ${isBanner ? 'absolute' : 'relative'};
                        ${isBanner ? 'right: 0; top: 0;' : ''}
                    ">
                        <div class="gam-preview-placeholder" style="color: var(--text-muted); text-align: center; padding: 10px;">
                            <svg width="${isBanner ? '24' : '32'}" height="${isBanner ? '24' : '32'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 4px;">
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

    _buildRoleSelect(currentRoles, staffIndex) {
        if (!Array.isArray(currentRoles)) currentRoles = [currentRoles];
        const roles = currentRoles.filter(Boolean).map(r => r.trim().toLowerCase());
        
        const standardKeys = Object.keys(STAFF_ROLES);
        const sortedKeys = standardKeys.sort((a, b) => getRoleSortIndex(a) - getRoleSortIndex(b));
        
        let allKeys = Array.from(new Set([...sortedKeys, ...roles]));
        
        let optionsHtml = '';
        for (const key of allKeys) {
            const isChecked = roles.includes(key);
            const label = STAFF_ROLES[key] || escapeHtmlAttribute(key);
            optionsHtml += `
                <label class="staff-role-option" onclick="event.stopPropagation()">
                    <input type="checkbox" value="${key}" data-staff-idx="${staffIndex}" ${isChecked ? 'checked' : ''}>
                    ${label}
                </label>
            `;
        }
        
        let buttonLabel = 'Оберіть ролі...';
        if (roles.length > 0) {
            buttonLabel = roles.map(r => STAFF_ROLES[r] || escapeHtmlAttribute(r)).join(', ');
        }
        
        return `
            <div class="staff-role-multiselect" data-staff-idx="${staffIndex}">
                <div class="staff-role-text-toggle" onclick="const p = this.parentElement; document.querySelectorAll('.staff-role-multiselect.open').forEach(el => { if(el !== p) el.classList.remove('open'); }); p.classList.toggle('open'); event.stopPropagation();" title="Змінити ролі">
                    ${buttonLabel}
                </div>
                <div class="staff-role-dropdown" onclick="event.stopPropagation()">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    renderStaffList() {
        const container = this.modal.querySelector('#volume-staff-container');
        if (!container) return;
        
        if (this.staff.length === 0) {
            container.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); padding: 8px; text-align: center; border: 1px dashed var(--border-s); border-radius: var(--r);">
                     Немає призначених авторів.
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="staff-editor-grid">
                ${this.staff.map((person, idx) => {
                    const personImg = person.image ? comicVineImageUrl(person.image) : '';
                    const imgHTML = personImg
                        ? `<img class="staff-editor-avatar" src="${escapeHtmlAttribute(personImg)}" alt="${escapeHtmlAttribute(person.name)}">`
                        : `<div class="staff-editor-avatar staff-editor-avatar--empty"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>`;
                    
                    return `
                        <div class="staff-editor-card" data-idx="${idx}">
                            ${imgHTML}
                            <div class="staff-editor-info">
                                <span class="staff-editor-name" title="${escapeHtmlAttribute(person.name)}">${escapeHtmlAttribute(person.name)}</span>
                                <div style="display: flex; gap: 8px; margin-top: 4px; width: 100%;">
                                    ${this._buildRoleSelect(person.roles, idx)}
                                </div>
                            </div>
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-staff" data-staff-idx="${idx}" style="opacity: .5; padding: 0; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.querySelectorAll('.staff-role-dropdown input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.staffIdx);
                const val = e.target.value;
                if (!this.staff[idx].roles) this.staff[idx].roles = [];
                if (e.target.checked) {
                    if (!this.staff[idx].roles.includes(val)) this.staff[idx].roles.push(val);
                } else {
                    this.staff[idx].roles = this.staff[idx].roles.filter(r => r !== val);
                }
                
                const multiselect = e.target.closest('.staff-role-multiselect');
                const btn = multiselect.querySelector('.staff-role-text-toggle');
                let buttonLabel = 'Оберіть ролі...';
                if (this.staff[idx].roles.length > 0) {
                    buttonLabel = this.staff[idx].roles.map(r => STAFF_ROLES[r] || escapeHtmlAttribute(r)).join(', ');
                }
                btn.textContent = buttonLabel;
            });
        });
        
        if (!this._globalClickAdded) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.staff-role-multiselect.open').forEach(el => el.classList.remove('open'));
            });
            this._globalClickAdded = true;
        }
        
        container.querySelectorAll('.btn-delete-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.staffIdx);
                this.staff.splice(idx, 1);
                this.renderStaffList();
            });
        });
    }

    renderCharactersList() {
        const container = this.modal.querySelector('#volume-characters-container');
        if (!container) return;
        
        if (this.characters.length === 0) {
            container.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); padding: 8px; text-align: center; border: 1px dashed var(--border-s); border-radius: var(--r);">
                    Немає доданих персонажів.
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${this.characters.map((char, idx) => {
                    const displayName = char.name_uk || char.name || 'Невідомий персонаж';
                    const img = char.image ? comicVineImageUrl(char.image) : '';
                    const avatarHTML = img
                        ? `<img src="${escapeHtmlAttribute(img)}" style="width: 40px; height: auto; aspect-ratio: 3 / 4; border-radius: var(--r); object-fit: cover;">`
                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-muted);">?</div>`;
                    
                    return `
                        <div class="appearance-editor-card" style="
                            display: grid; grid-template-columns: 1.5fr 120px 32px 32px;
                            align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-card);
                            border: 1px solid var(--border-s); border-radius: var(--r);
                        ">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatarHTML}
                                <div style="font-weight: 600; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${escapeHtmlAttribute(displayName)}
                                </div>
                            </div>
                            
                            <select class="admin-input appearance-item-role" data-idx="${idx}" style="height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                <option value="main" ${char.role === 'main' ? 'selected' : ''}>Основний</option>
                                <option value="supporting" ${char.role === 'supporting' ? 'selected' : ''}>Другорядний</option>
                            </select>

                            <button type="button" class="btn-admin btn-admin--secondary btn-edit-character-modal" data-idx="${idx}" style="padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;" title="Редагувати профіль персонажа">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-character" data-idx="${idx}" style="padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.querySelectorAll('.appearance-item-role').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this.characters[idx].role = e.target.value;
            });
        });

        container.querySelectorAll('.btn-edit-character-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const char = this.characters[idx];
                openEditCharacterModal(char, (updatedChar) => {
                    if (updatedChar === null) {
                        this.characters.splice(idx, 1);
                    } else {
                        this.characters[idx] = {
                            ...char,
                            name: updatedChar.name,
                            name_uk: updatedChar.name_uk,
                            name_ro: updatedChar.name_ro,
                            real_name: updatedChar.real_name,
                            real_name_uk: updatedChar.real_name_uk,
                            creators: updatedChar.creators,
                            image: updatedChar.image,
                            portret_img: updatedChar.portret_img,
                            costume_img: updatedChar.costume_img,
                            portret_costume_img: updatedChar.portret_costume_img
                        };
                    }
                    this.renderCharactersList();
                });
            });
        });
        
        container.querySelectorAll('.btn-delete-character').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                this.characters.splice(idx, 1);
                this.renderCharactersList();
            });
        });
    }

    initStaffSearch() {
        const btn = this.modal.querySelector('#btn-add-volume-staff');
        const container = this.modal.querySelector('#volume-staff-search-wrap');
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
                <div class="staff-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r); z-index: 10; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
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
                                     color: var(--text);
                                 ">
                                     ${imgHTML}
                                     <span>${escapeHtmlAttribute(p.name)}</span>
                                 </div>
                             `;
                         }).join('');
                         
                         results.querySelectorAll('.staff-search-result-item').forEach(item => {
                             item.addEventListener('click', () => {
                                 const personId = parseInt(item.dataset.id);
                                 const name = item.dataset.name;
                                 const image = item.dataset.image;
                                 
                                 const exists = this.staff.some(x => x.person_id === personId);
                                 if (!exists) {
                                     this.staff.push({
                                         person_id: personId,
                                         name: name,
                                         image: image,
                                         roles: ['writer']
                                     });
                                     this.renderStaffList();
                                 }
                                 wrap.remove();
                             });
                         });
                     } catch (err) {
                         console.error(err);
                     }
                }, 300);
            });
        });
    }

    initCharacterSearch() {
        const btn = this.modal.querySelector('#btn-add-volume-character');
        const container = this.modal.querySelector('#volume-characters-search-wrap');
        if (!btn || !container) return;
        
        btn.addEventListener('click', () => {
            let wrap = container.querySelector('.character-search-wrapper');
            if (wrap) {
                wrap.remove();
                return;
            }
            
            wrap = document.createElement('div');
            wrap.className = 'character-search-wrapper';
            wrap.style.cssText = 'margin-top: 8px; position: relative; width: 100%; display: flex; flex-direction: column; gap: 4px;';
            wrap.innerHTML = `
                <input type="text" class="admin-input character-search-input" placeholder="Введіть ім'я персонажа для пошуку..." autocomplete="off">
                <div class="character-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r); z-index: 10; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
            `;
            
            container.appendChild(wrap);
            
            const input = wrap.querySelector('.character-search-input');
            const DefenseResults = wrap.querySelector('.character-search-results');
            input.focus();
            
            let timeout = null;
            input.addEventListener('input', () => {
                const q = input.value.trim();
                clearTimeout(timeout);
                if (!q) {
                     DefenseResults.style.display = 'none';
                     DefenseResults.innerHTML = '';
                     return;
                }
                 
                DefenseResults.style.display = 'block';
                DefenseResults.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Пошук...</div>';
                 
                timeout = setTimeout(async () => {
                     try {
                         const res = await API.get('/issues/appearances/search/characters', { search: q });
                         const items = res || [];
                         if (items.length === 0) {
                             DefenseResults.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Нічого не знайдено</div>';
                             return;
                         }
                         
                         DefenseResults.innerHTML = items.map(c => {
                             const img = c.image ? comicVineImageUrl(c.image) : '';
                             const imgHTML = img
                                 ? `<img src="${escapeHtmlAttribute(img)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                                 : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">?</div>`;
                             const displayName = c.name_uk || c.name || 'Невідомий персонаж';
                             return `
                                 <div class="character-search-result-item" data-id="${c.id}" data-name="${escapeHtmlAttribute(c.name)}" data-name-uk="${escapeHtmlAttribute(c.name_uk || '')}" data-image="${escapeHtmlAttribute(c.image || '')}" style="
                                     display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px;
                                     border-bottom: 1px solid var(--border-s); transition: background var(--t);
                                     color: var(--text);
                                 ">
                                     ${imgHTML}
                                     <span>${escapeHtmlAttribute(displayName)}</span>
                                 </div>
                             `;
                         }).join('');
                         
                         DefenseResults.querySelectorAll('.character-search-result-item').forEach(item => {
                             item.addEventListener('click', () => {
                                 const charId = parseInt(item.dataset.id);
                                 const name = item.dataset.name;
                                 const nameUk = item.dataset.nameUk;
                                 const image = item.dataset.image;
                                 
                                 const exists = this.characters.some(x => x.id === charId);
                                 if (!exists) {
                                     this.characters.push({
                                         id: charId,
                                         name: name,
                                         name_uk: nameUk || null,
                                         image: image,
                                         role: 'main'
                                     });
                                     this.renderCharactersList();
                                 }
                                 wrap.remove();
                             });
                         });
                     } catch (err) {
                         console.error(err);
                     }
                }, 300);
            });
        });
    }

    async render() {
        await this.fetchExtraData();
        
        const v = this.volume;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        
        const isPrivileged = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
        const readOnlyAttr = isPrivileged ? '' : ' readonly';
        const groupClass = isPrivileged ? '' : ' not-allowed';

        const role = currentUser ? currentUser.role : null;
        let footerButtonsHTML = '';
        if (role === 'admin') {
            footerButtonsHTML = `
                <button class="btn-admin btn-admin--primary btn-admin--purple" id="edit-save-direct">Записати в БД</button>
                <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">Записати і прийняти</button>
            `;
        } else if (role === 'moderator' || role === 'editor') {
            footerButtonsHTML = `
                <button class="btn-admin btn-admin--primary btn-admin--green" id="edit-save-approve">Записати і прийняти</button>
            `;
        } else {
            footerButtonsHTML = `
                <input type="text" id="edit-propose-comment" class="admin-input" placeholder="Коментар до вашої правки (необов'язково)..." style="margin-right: auto; max-width: 400px; font-size: 0.85rem; padding: 6px 10px; height: 32px;">
                <button class="btn-admin btn-admin--primary btn-admin--yellow" id="edit-save-propose" style="height: 32px; padding: 0 16px; font-size: 13px;">Запропонувати</button>
            `;
        }
        
        window._emSelectLang = (el) => {
            modal.querySelectorAll('#lang-chips .lang-chip').forEach(c => c.classList.remove('lang-chip--active'));
            el.classList.add('lang-chip--active');
            modal.querySelector('#lang-hidden').value = el.dataset.code;
        };

        window._emRemoveThemeVol = (themeId) => {
            const cb = modal.querySelector(`#themes-list input[value="${themeId}"]`);
            if (cb) {
                cb.checked = false;
                cb.dispatchEvent(new Event('change'));
            }
            this._rebuildThemeChips(modal);
        };

        window._emThemeChangeVol = () => { this._rebuildThemeChips(modal); };
        window._emFilterThemesVol = (q) => { Utils.filterThemeCheckboxList(q, 'themes-list'); };

        modal.innerHTML = `
            <div class="ds-modal ds-modal--large">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${ICON.edit}
                        Редагування тому
                    </div>
                    <button class="ds-modal-close">&times;</button>
                </div>
                <div class="ds-modal-body">
                    <div class="editor-tabs-segmented">
                        <button class="editor-tab-btn is-active" data-tab="info">Основна інформація</button>
                        <button class="editor-tab-btn" data-tab="staff">Персонал</button>
                        <button class="editor-tab-btn" data-tab="appearances">Появи</button>
                    </div>

                    <form id="edit-volume-form">
                        <!-- Вкладка: Основна інформація -->
                        <div class="editor-tab-content is-active" id="tab-info">
                            <div class="admin-form-grid">
                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.hash} CV ID</label>
                                    <input type="number" name="cv_id" class="admin-input" value="${v.cv_id || ''}"${readOnlyAttr}>
                                </div>
                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.link} CV Slug</label>
                                    <input type="text" name="cv_slug" class="admin-input" value="${v.cv_slug || ''}"${readOnlyAttr}>
                                </div>
                                
                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.database} MAL ID</label>
                                    <input type="number" name="mal_id" class="admin-input" value="${v.mal_id || ''}" placeholder="напр. 123456"${readOnlyAttr}>
                                </div>
                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.link2} Hikka Slug</label>
                                    <input type="text" name="hikka_slug" class="admin-input" value="${v.hikka_slug || ''}" placeholder="напр. berserk-ek0mv"${readOnlyAttr}>
                                </div>

                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.hash} LocG ID</label>
                                    <input type="number" name="locg_id" class="admin-input" value="${v.locg_id || ''}"${readOnlyAttr}>
                                </div>
                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.link} LocG Slug</label>
                                    <input type="text" name="locg_slug" class="admin-input" value="${v.locg_slug || ''}"${readOnlyAttr}>
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.calendar} Рік початку</label>
                                    <input type="number" name="start_year" class="admin-input" value="${v.start_year || ''}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.type} Назва</label>
                                    <input type="text" name="name" class="admin-input" value="${v.name || ''}">
                                </div>

                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.type} Рідна назва</label>
                                    <input type="text" name="name_native" class="admin-input" value="${v.name_native || ''}">
                                </div>
                                <div class="admin-form-group">
                                    <label class="admin-label">${ICON.type} Назва UA</label>
                                    <input type="text" name="name_uk" class="admin-input" value="${v.name_uk || ''}">
                                </div>

                                ${this._imgFieldHTML('cv_img', 'Обкладинка', v.cv_img, ICON.image)}
                                ${this._imgFieldHTML('cover_img', 'Банер', v.cover_img, ICON.layout, true)}

                                <div class="admin-form-group${groupClass}">
                                    <label class="admin-label">${ICON.externalLink} Посилання на сайт джерела</label>
                                    <input type="url" name="site_link" class="admin-input" value="${v.site_link || ''}" placeholder="https://..."${readOnlyAttr}>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.languages} Мова</label>
                                    <input type="hidden" name="lang" id="lang-hidden" value="${v.lang || ''}">
                                    <div id="lang-chips" style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.2rem;">
                                        <span class="lang-chip${!v.lang ? ' lang-chip--active' : ''}"
                                            data-code="" onclick="window._emSelectLang(this)">—</span>
                                        ${Object.entries(LANG_MAP).map(([code, { flag, label }]) =>
                                            `<span class="lang-chip${v.lang === code ? ' lang-chip--active' : ''}"
                                                data-code="${code}" onclick="window._emSelectLang(this)" title="${label}">${flag}</span>`
                                        ).join('')}
                                    </div>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Синопсис (UA)</label>
                                    <textarea name="synopsis_ua" class="admin-textarea">${v.synopsis_ua || ''}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Синопсис (EN)</label>
                                    <textarea name="synopsis" class="admin-textarea">${v.synopsis || ''}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Опис</label>
                                    <textarea name="description" class="admin-textarea">${v.description || ''}</textarea>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.building} Видавництво</label>
                                    <div id="vol-pub-search-container">
                                        ${Utils.publisherSearchHTML({
                                            publisherId: v.publisher || '',
                                            publisherName: v.publisher_name || '',
                                            inputId: 'vol-pub-input',
                                            hiddenId: 'vol-pub-id',
                                            resultsId: 'vol-pub-results',
                                            chipId: 'vol-pub-chip',
                                            ICON: ICON
                                        })}
                                    </div>
                                </div>

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.tags} Теми</label>
                                    <input type="text" id="theme-search" class="admin-input" placeholder="Пошук тем..." style="margin-bottom:0.5rem; width:100%;"
                                        oninput="window._emFilterThemesVol(this.value)">
                                    <div id="themes-list" class="themes-checkbox-list">
                                        ${Utils.buildThemeCheckboxListHTML(this.allThemes, this.currentThemeIds, 'window._emThemeChangeVol')}
                                    </div>
                                    <div id="vol-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.5rem; min-height:0; align-items:center;">
                                        ${Utils.buildThemeChipsHTML(this.allThemes.filter(t => this.currentThemeIds.has(t.id)), 'window._emRemoveThemeVol')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Вкладка: Персонал -->
                        <div class="editor-tab-content" id="tab-staff">
                            <div class="admin-form-group admin-form-group--full" style="background: var(--bg-body); padding: 16px; border-radius: var(--r); border: 1px solid var(--border-s); margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text);">Персонал тома</h4>
                                    <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-volume-staff" style="padding: 4px 12px; font-size: 12px; height: 28px;">+ Додати автора</button>
                                </div>
                                <div id="volume-staff-container"></div>
                                <div id="volume-staff-search-wrap"></div>
                            </div>
                        </div>

                        <!-- Вкладка: Появи -->
                        <div class="editor-tab-content" id="tab-appearances">
                            <div class="admin-form-group admin-form-group--full" style="background: var(--bg-body); padding: 16px; border-radius: var(--r); border: 1px solid var(--border-s); margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text);">Персонажі тома</h4>
                                    <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-volume-character" style="padding: 4px 12px; font-size: 12px; height: 28px;">+ Додати персонажа</button>
                                </div>
                                <div id="volume-characters-container"></div>
                                <div id="volume-characters-search-wrap"></div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="ds-modal-footer">
                    <button class="btn-admin btn-admin--secondary" id="edit-cancel">Скасувати</button>
                    ${footerButtonsHTML}
                </div>
            </div>
        `;

        modal.querySelector('.ds-modal-close').addEventListener('click', () => this.close());
        modal.querySelector('#edit-cancel').addEventListener('click', () => this.close());
        
        const saveDirectBtn = modal.querySelector('#edit-save-direct');
        if (saveDirectBtn) {
            saveDirectBtn.addEventListener('click', () => this.save('direct'));
        }
        const saveApproveBtn = modal.querySelector('#edit-save-approve');
        if (saveApproveBtn) {
            saveApproveBtn.addEventListener('click', () => this.save('approve'));
        }
        const saveProposeBtn = modal.querySelector('#edit-save-propose');
        if (saveProposeBtn) {
            saveProposeBtn.addEventListener('click', () => this.save('propose'));
        }

        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        // Tab selection click handler
        const tabBtns = modal.querySelectorAll('.editor-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.toggle('is-active', b === btn));
                modal.querySelectorAll('.editor-tab-content').forEach(c => {
                    c.classList.toggle('is-active', c.id === `tab-${tab}`);
                });
            });
        });

        this.modal = modal;
        document.body.appendChild(modal);

        this.initImageHandlers(modal);

        Utils.initPublisherSearch({
            inputId: 'vol-pub-input',
            hiddenId: 'vol-pub-id',
            resultsId: 'vol-pub-results',
            chipId: 'vol-pub-chip',
            API
        });

        // Render staff and characters initially
        this.renderStaffList();
        this.renderCharactersList();

        // Initialize search events
        this.initStaffSearch();
        this.initCharacterSearch();
    }

    _rebuildThemeChips(modal) {
        const container = modal.querySelector('#vol-theme-chips');
        if (!container) return;
        const checked = modal.querySelectorAll('#themes-list input[type="checkbox"]:checked');
        const selectedThemes = Array.from(checked).map(cb => ({
            id: parseInt(cb.value),
            name: cb.dataset.uaName || cb.closest('label')?.querySelector('.theme-cb-label')?.textContent?.trim() || '',
            type: cb.dataset.type || 'theme',
        }));
        container.innerHTML = Utils.buildThemeChipsHTML(selectedThemes, 'window._emRemoveThemeVol');
    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            this.modal.remove();
            this.modal = null;
        }
    }

    async save(actionType = 'direct') {
        const form = this.modal.querySelector('#edit-volume-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        ['cv_id', 'mal_id', 'locg_id', 'start_year', 'publisher'].forEach(key => {
            data[key] = data[key] ? parseInt(data[key]) : null;
        });
        
        const themeCheckboxes = this.modal.querySelectorAll('#themes-list input[type="checkbox"]:checked');
        data.theme_ids = Array.from(themeCheckboxes).map(cb => parseInt(cb.value));

        // Add staff and characters data
        data.staff = this.staff.flatMap(s => (s.roles || []).map(r => ({
            person_id: s.person_id,
            role: r
        })));
        data.characters = this.characters;

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
            if (commentInput) {
                comment = commentInput.value.trim();
            }
        }

        try {
            // Handle file uploads
            const fileFields = ['cv_img', 'cover_img'];
            for (const field of fileFields) {
                const fileInput = form.querySelector(`input[name="${field}_file"]`);
                if (fileInput && fileInput.files.length > 0) {
                    const uploadData = new FormData();
                    uploadData.append('file', fileInput.files[0]);
                    const uploadRes = await API.upload('/images/upload/volume', uploadData);
                    data[field] = uploadRes.url;
                }
            }

            if (actionType === 'direct') {
                await API.put(`/volumes/${this.volume.id}`, data);
            } else {
                const autoApprove = actionType === 'approve';
                await API.post('/edits', {
                    entity_type: 'volume',
                    entity_id: this.volume.id,
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
