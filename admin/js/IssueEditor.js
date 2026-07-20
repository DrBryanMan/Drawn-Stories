import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { STAFF_ROLES, getRoleSortIndex } from '/static/js/helpers/staff.js';
import { openAddReprintModal } from '/static/js/components/addReprintModal.js';
import { openEditCharacterModal } from './EditCharacterModal.js';

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

function parsePersonas(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'object') return [parsed];
    } catch (e) {}
    return [];
}

export class IssueEditor {
    constructor(issue, stories, persons, reprints, appearances, onSave) {
        this.issue = issue;
        // Відфільтровуємо імпортовані історії
        const localStories = (stories || []).filter(s => !s.is_imported && !s.is_virtual);
        this.stories = JSON.parse(JSON.stringify(localStories));
        if (this.stories.length === 0) {
            this.stories.push({
                id: null,
                name_original: this.issue.name || '',
                name_ua: this.issue.name_uk || '',
                order_num: 1
            });
        } else if (this.stories.length > 0) {
            this.stories[0].name_original = this.issue.name || '';
            this.stories[0].name_ua = this.issue.name_uk || '';
        }
        this.reprints = JSON.parse(JSON.stringify(reprints || []));
        this.onSave = onSave;
        this.modal = null;
        
        // Відфільтровуємо імпортований стаф і прив'язуємо лише локальний стаф до індексів історій
        const localPersons = (persons || []).filter(p => !p.is_imported);
        const groupedStaff = new Map();
        localPersons.forEach(p => {
            let storyIndex = 0;
            if (p.story_id) {
                storyIndex = this.stories.findIndex(s => s.id === p.story_id || s.client_story_id === p.story_id);
                if (storyIndex === -1) storyIndex = 0;
            }
            const key = `${p.person_id}_${storyIndex}`;
            if (!groupedStaff.has(key)) {
                groupedStaff.set(key, {
                    id: p.id,
                    person_id: p.person_id,
                    name: p.name,
                    image: p.image,
                    roles: [p.role || 'writer'],
                    story_index: storyIndex
                });
            } else {
                const existing = groupedStaff.get(key);
                if (p.role && !existing.roles.includes(p.role)) {
                    existing.roles.push(p.role);
                }
            }
        });
        this.staff = Array.from(groupedStaff.values());

        // Ініціалізуємо локальні появи
        this.appearances = {
            characters: (appearances?.characters || []).map(c => ({
                id: c.id,
                name: c.name,
                name_uk: c.name_uk || null,
                real_name: c.real_name || null,
                real_name_uk: c.real_name_uk || null,
                creators: c.creators || null,
                image: c.image || null,
                portret_img: c.portret_img || null,
                costume_img: c.costume_img || null,
                portret_costume_img: c.portret_costume_img || null,
                personas: c.personas || [],
                persona_idx: (c.persona_idx !== undefined && c.persona_idx !== null && c.persona_idx !== '') ? parseInt(c.persona_idx, 10) : null,
                cv_slug: c.cv_slug,
                story_num: c.story_num || 0,
                status: c.status || '',
                comment: c.comment || '',
                role: c.role || 'main',
                team_id: c.team_id || null
            })),
            teams: (appearances?.teams || []).map(t => ({
                id: t.id,
                name: t.name,
                name_uk: t.name_uk || null,
                cv_slug: t.cv_slug,
                story_num: t.story_num || 0,
                status: t.status || '',
                comment: t.comment || ''
            })),
            locations: (appearances?.locations || []).map(l => ({
                id: l.id,
                name: l.name,
                name_uk: l.name_uk || null,
                cv_slug: l.cv_slug,
                story_num: l.story_num || 0,
                status: l.status || '',
                comment: l.comment || ''
            })),
            concepts: (appearances?.concepts || []).map(c => ({
                id: c.id,
                name: c.name,
                name_uk: c.name_uk || null,
                cv_slug: c.cv_slug,
                story_num: c.story_num || 0,
                status: c.status || '',
                comment: c.comment || ''
            })),
            objects: (appearances?.objects || []).map(o => ({
                id: o.id,
                name: o.name,
                name_uk: o.name_uk || null,
                cv_slug: o.cv_slug,
                story_num: o.story_num || 0,
                status: o.status || '',
                comment: o.comment || ''
            }))
        };
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
        let options = '';
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

    _buildAppearanceStorySelect(currentStoryNum, typeKey, globalIdx) {
        let options = `<option value="0" ${currentStoryNum === 0 ? 'selected' : ''}>Основна історія</option>`;
        this.stories.forEach((story, idx) => {
            const orderNum = story.order_num ?? (idx + 1);
            const title = story.name_ua || story.name_original || `Історія ${orderNum}`;
            options += `<option value="${orderNum}" ${currentStoryNum === orderNum ? 'selected' : ''}>Історія ${orderNum}: ${escapeHtmlAttribute(title)}</option>`;
        });
        return `
            <select class="admin-input appearance-story-assignment-select" data-type="${typeKey}" data-index="${globalIdx}" style="height: 32px; padding: 2px 8px; font-size: 12px; max-width: 150px;">
                ${options}
            </select>
        `;
    }

    renderAppearancesForStory(storyNum) {
        const container = this.modal ? this.modal.querySelector('#appearances-by-story-container') : null;
        if (!container) return;

        const modalBody = this.modal ? this.modal.querySelector('.ds-modal-body') : null;
        const prevScrollTop = modalBody ? modalBody.scrollTop : 0;

        const types = [
            { key: 'characters', title: 'Персонажі' },
            { key: 'teams', title: 'Команди та Організації' },
            { key: 'locations', title: 'Локації' },
            { key: 'concepts', title: 'Концепти' },
            { key: 'objects', title: 'Предмети' }
        ];

        const teamsOfThisStory = this.appearances.teams.filter(t => t.story_num === storyNum);

        let html = '';

        types.forEach(type => {
            const list = this.appearances[type.key].filter(item => item.story_num === storyNum);
            
            let listHTML = '';
            if (list.length === 0) {
                listHTML = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; padding: 6px 8px; border: 1px dashed var(--border-s); border-radius: var(--r); text-align: center;">Немає появ у цій категорії.</div>`;
            } else {
                listHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${list.map(item => {
                            const globalIdx = this.appearances[type.key].findIndex(x => x === item);
                            
                            let roleSelectHTML = '';
                            let teamSelectHTML = '';
                            let personaSelectHTML = '';

                            if (type.key === 'characters') {
                                roleSelectHTML = `
                                    <select class="admin-input appearance-item-role" data-type="${type.key}" data-index="${globalIdx}" style="width: 100%; height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                        <option value="main" ${item.role === 'main' ? 'selected' : ''}>Основний</option>
                                        <option value="supporting" ${item.role === 'supporting' ? 'selected' : ''}>Другорядний</option>
                                        <option value="minor" ${item.role === 'minor' ? 'selected' : ''}>Інші</option>
                                        <option value="cameo" ${item.role === 'cameo' ? 'selected' : ''}>Камео</option>
                                    </select>
                                `;

                                const teamOptions = teamsOfThisStory.map(team => `
                                    <option value="${team.id}" ${item.team_id === team.id ? 'selected' : ''}>${escapeHtmlAttribute(team.name_uk || team.name)}</option>
                                `).join('');
                                
                                teamSelectHTML = `
                                    <select class="admin-input appearance-item-team" data-type="${type.key}" data-index="${globalIdx}" style="width: 100%; height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                        <option value="">-- Без команди --</option>
                                        ${teamOptions}
                                    </select>
                                `;

                                const charPersonas = parsePersonas(item.personas);
                                const personaOptions = charPersonas.map((p, pIdx) => `
                                    <option value="${pIdx}" ${item.persona_idx === pIdx ? 'selected' : ''}>${escapeHtmlAttribute(p.name_uk || p.name)}</option>
                                `).join('');

                                personaSelectHTML = `
                                    <select class="admin-input appearance-item-persona" data-type="${type.key}" data-index="${globalIdx}" style="width: 100%; height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                        <option value="">-- Без особистості --</option>
                                        ${personaOptions}
                                    </select>
                                `;
                            }

                            let nameHTML = '';
                            if (type.key === 'characters') {
                                const primaryName = item.name_uk || item.name || item.real_name_uk || item.real_name || 'Невідомий персонаж';
                                const hasMainName = !!(item.name_uk || item.name);
                                const subRealName = item.real_name_uk || item.real_name;
                                const showRealName = hasMainName && subRealName;
                                nameHTML = `
                                    <div style="font-weight: 600; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25;" title="${escapeHtmlAttribute(primaryName)}">
                                        ${escapeHtmlAttribute(primaryName)}
                                        ${showRealName ? `<div style="font-size: 10px; color: var(--text-muted); font-weight: normal; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlAttribute(subRealName)}</div>` : ''}
                                    </div>
                                `;
                            } else {
                                const displayName = item.name_uk || item.name;
                                nameHTML = `
                                    <div style="font-weight: 600; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtmlAttribute(displayName)}">
                                        ${escapeHtmlAttribute(displayName)}
                                    </div>
                                `;
                            }

                            if (type.key === 'characters') {
                                return `
                                    <div class="appearance-editor-card appearance-character-card" style="
                                        display: flex; flex-direction: column; gap: 8px; padding: 8px 12px; background: var(--bg-card);
                                        border: 1px solid var(--border-s); border-radius: var(--r, 6px);
                                    ">
                                        <!-- Header Row: Character Name & Edit/Delete Buttons -->
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                                ${item.image ? `<img src="${escapeHtmlAttribute(comicVineImageUrl(item.image))}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">` : ''}
                                                ${nameHTML}
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                                <button type="button" class="btn-admin btn-admin--secondary btn-edit-character-modal" data-index="${globalIdx}" style="padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;" title="Редагувати профіль персонажа">
                                                    ${ICON.edit}
                                                </button>
                                                <button type="button" class="btn-admin btn-admin--danger btn-delete-appearance-item" data-type="${type.key}" data-index="${globalIdx}" style="padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;" title="Видалити появу">
                                                    ${ICON.trash}
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Controls Row: Story, Persona, Team, Status, Role, Comment -->
                                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-items: center;">
                                            <div>${this._buildAppearanceStorySelect(item.story_num, type.key, globalIdx)}</div>
                                            <div>${personaSelectHTML}</div>
                                            <div>${teamSelectHTML}</div>
                                            <div>
                                                <select class="admin-input appearance-item-status" data-type="${type.key}" data-index="${globalIdx}" style="height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0; width: 100%;">
                                                    <option value="" ${!item.status ? 'selected' : ''}>-- Статус --</option>
                                                    <option value="flashback" ${item.status === 'flashback' ? 'selected' : ''}>Flashback</option>
                                                    <option value="first appear" ${item.status === 'first appear' ? 'selected' : ''}>First appear</option>
                                                    <option value="death" ${item.status === 'death' ? 'selected' : ''}>Death</option>
                                                    <option value="cameo" ${item.status === 'cameo' ? 'selected' : ''}>Cameo</option>
                                                </select>
                                            </div>
                                            <div>${roleSelectHTML}</div>
                                            <div>
                                                <input type="text" class="admin-input appearance-item-comment" data-type="${type.key}" data-index="${globalIdx}" value="${escapeHtmlAttribute(item.comment || '')}" placeholder="Коментар..." style="height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0; width: 100%;">
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }

                            return `
                                <div class="appearance-editor-card" style="
                                    display: grid; grid-template-columns: 1.5fr 150px 125px 1.2fr 32px 32px;
                                    align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-card);
                                    border: 1px solid var(--border-s); border-radius: var(--r);
                                ">
                                    ${nameHTML}
                                    
                                    ${this._buildAppearanceStorySelect(item.story_num, type.key, globalIdx)}
                                    
                                    <select class="admin-input appearance-item-status" data-type="${type.key}" data-index="${globalIdx}" style="height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                        <option value="" ${!item.status ? 'selected' : ''}>-- Статус --</option>
                                        <option value="flashback" ${item.status === 'flashback' ? 'selected' : ''}>Flashback</option>
                                        <option value="first appear" ${item.status === 'first appear' ? 'selected' : ''}>First appear</option>
                                        <option value="death" ${item.status === 'death' ? 'selected' : ''}>Death</option>
                                        <option value="cameo" ${item.status === 'cameo' ? 'selected' : ''}>Cameo</option>
                                    </select>
                                    
                                    <input type="text" class="admin-input appearance-item-comment" data-type="${type.key}" data-index="${globalIdx}" value="${escapeHtmlAttribute(item.comment || '')}" placeholder="Коментар" style="height: 32px; font-size: 12px; padding: 2px 8px; margin-bottom: 0;">
                                    
                                    <button type="button" class="btn-admin btn-admin--secondary btn-edit-entity-modal" data-type="${type.key}" data-index="${globalIdx}" style="padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;" title="Редагувати назву">
                                        ${ICON.edit}
                                    </button>
                                    
                                    <button type="button" class="btn-admin btn-admin--danger btn-delete-appearance-item" data-type="${type.key}" data-index="${globalIdx}" style="padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 0;">
                                        ${ICON.trash}
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            html += `
                <div class="appearance-section-block" style="margin-bottom: 20px; background: var(--bg-body); padding: 12px; border-radius: var(--r); border: 1px solid var(--border-s);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <h5 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 13px; color: var(--text);">${type.title}</h5>
                        <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-appearance-${type.key}" style="padding: 2px 8px; font-size: 11px; height: 24px;">+ Додати</button>
                    </div>
                    <div id="appearance-list-${type.key}">
                        ${listHTML}
                    </div>
                    <div id="appearance-search-wrap-${type.key}"></div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Listeners for inputs
        container.querySelectorAll('.appearance-item-persona').forEach(select => {
            select.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                const val = e.target.value;
                this.appearances[type][idx].persona_idx = (val !== "" && val !== null && val !== undefined) ? parseInt(val, 10) : null;
            });
        });

        // Listeners for inputs
        container.querySelectorAll('.appearance-item-status').forEach(select => {
            select.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                this.appearances[type][idx].status = e.target.value || null;
            });
        });

        container.querySelectorAll('.appearance-item-comment').forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                this.appearances[type][idx].comment = e.target.value;
            });
        });

        container.querySelectorAll('.appearance-item-role').forEach(select => {
            select.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                this.appearances[type][idx].role = e.target.value;
            });
        });

        // Story assignment change listener
        container.querySelectorAll('.appearance-story-assignment-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                const newStoryNum = parseInt(e.target.value);
                this.appearances[type][idx].story_num = newStoryNum;
                this.renderAppearancesForStory(storyNum);
            });
        });

        container.querySelectorAll('.btn-delete-appearance-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const idx = parseInt(e.currentTarget.dataset.index);
                this.appearances[type].splice(idx, 1);
                this.renderAppearancesForStory(storyNum);
            });
        });

        // Team assignment change listener
        container.querySelectorAll('.appearance-item-team').forEach(select => {
            select.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const idx = parseInt(e.target.dataset.index);
                const val = e.target.value;
                this.appearances[type][idx].team_id = val ? parseInt(val) : null;
            });
        });

        // Edit character modal listener
        container.querySelectorAll('.btn-edit-character-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                const char = this.appearances.characters[idx];
                openEditCharacterModal(char, (updatedChar) => {
                    if (updatedChar === null) {
                        this.appearances.characters.splice(idx, 1);
                    } else {
                        this.appearances.characters[idx] = {
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
                    this.renderAppearancesForStory(storyNum);
                });
            });
        });

        // Edit entity modal listener (teams, locations, concepts, objects)
        container.querySelectorAll('.btn-edit-entity-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const idx = parseInt(e.currentTarget.dataset.index);
                const item = this.appearances[type][idx];
                this.openEditAppearanceModal(type, item, (updatedItem) => {
                    this.appearances[type][idx] = {
                        ...item,
                        name: updatedItem.name,
                        name_uk: updatedItem.name_uk
                    };
                    this.renderAppearancesForStory(storyNum);
                });
            });
        });

        // Initialize searches
        types.forEach(type => {
            this.initAppearanceSearch(type.key, `btn-add-appearance-${type.key}`, `appearance-search-wrap-${type.key}`, storyNum);
        });

        if (modalBody) {
            modalBody.scrollTop = prevScrollTop;
        }
    }

    initAppearanceSearch(typeKey, btnId, containerId, targetStoryNum) {
        const btn = this.modal.querySelector(`#${btnId}`);
        const container = this.modal.querySelector(`#${containerId}`);
        if (!btn || !container) return;
        
        btn.addEventListener('click', () => {
            let wrap = container.querySelector('.appearance-search-wrapper');
            if (wrap) {
                wrap.remove();
                return;
            }
            
            wrap = document.createElement('div');
            wrap.className = 'appearance-search-wrapper';
            wrap.style.cssText = 'margin-top: 8px; position: relative; width: 100%; display: flex; flex-direction: column; gap: 4px;';
            wrap.innerHTML = `
                <input type="text" class="admin-input appearance-search-input" placeholder="Введіть назву для пошуку..." autocomplete="off" style="margin-bottom: 0;">
                <div class="appearance-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r); z-index: 10; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
            `;
            
            container.appendChild(wrap);
            
            const input = wrap.querySelector('.appearance-search-input');
            const results = wrap.querySelector('.appearance-search-results');
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
                        const res = await API.get(`/issues/appearances/search/${typeKey}`, { search: q });
                        const items = res || [];
                        if (items.length === 0) {
                            results.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Нічого не знайдено</div>';
                            return;
                        }
                        
                        results.innerHTML = items.map(item => {
                            let avatarHTML = '';
                            if (typeKey === 'characters') {
                                const img = item.image ? comicVineImageUrl(item.image) : '';
                                avatarHTML = img
                                    ? `<img src="${escapeHtmlAttribute(img)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                                    : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">?</div>`;
                            }
                            const displayName = typeKey === 'characters' 
                                ? (item.name_uk || item.name || item.real_name_uk || item.real_name || 'Невідомий персонаж') 
                                : (item.name_uk || item.name);
                            const subtitle = typeKey === 'characters' && (item.name_uk || item.name) && (item.real_name_uk || item.real_name)
                                ? ` <span style="font-size: 11px; color: var(--text-muted);">(${escapeHtmlAttribute(item.real_name_uk || item.real_name)})</span>`
                                : '';
                            return `
                                <div class="appearance-search-result-item" 
                                    data-id="${item.id}" 
                                    data-name="${escapeHtmlAttribute(item.name)}" 
                                    data-name-uk="${escapeHtmlAttribute(item.name_uk || '')}"
                                    data-real-name="${escapeHtmlAttribute(item.real_name || '')}"
                                    data-real-name-uk="${escapeHtmlAttribute(item.real_name_uk || '')}"
                                    data-creators="${escapeHtmlAttribute(item.creators || '')}"
                                    data-slug="${escapeHtmlAttribute(item.cv_slug || '')}" 
                                    data-image="${escapeHtmlAttribute(item.image || '')}" 
                                    data-personas="${escapeHtmlAttribute(typeof item.personas === 'string' ? item.personas : JSON.stringify(item.personas || []))}"
                                    style="
                                        display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px;
                                        border-bottom: 1px solid var(--border-s); transition: background var(--t);
                                        color: var(--text);
                                    "
                                >
                                    ${avatarHTML}
                                    <span>${escapeHtmlAttribute(displayName)}${subtitle}</span>
                                </div>
                            `;
                        }).join('');
                        
                        results.querySelectorAll('.appearance-search-result-item').forEach(el => {
                            el.addEventListener('click', () => {
                                const entityId = parseInt(el.dataset.id);
                                const name = el.dataset.name;
                                const slug = el.dataset.slug;
                                const image = el.dataset.image;
                                
                                const exists = this.appearances[typeKey].some(x => x.id === entityId && x.story_num === targetStoryNum);
                                if (!exists) {
                                    const baseObj = {
                                        id: entityId,
                                        name: name,
                                        image: image || null,
                                        cv_slug: slug,
                                        story_num: targetStoryNum,
                                        status: '',
                                        comment: ''
                                    };
                                    if (typeKey === 'characters') {
                                        baseObj.role = 'main';
                                        baseObj.team_id = null;
                                        baseObj.name_uk = el.dataset.nameUk || null;
                                        baseObj.real_name = el.dataset.realName || null;
                                        baseObj.real_name_uk = el.dataset.realNameUk || null;
                                        baseObj.creators = el.dataset.creators || null;
                                        baseObj.personas = el.dataset.personas ? parsePersonas(el.dataset.personas) : [];
                                        baseObj.persona_idx = null;
                                    } else {
                                        baseObj.name_uk = el.dataset.nameUk || null;
                                    }
                                    this.appearances[typeKey].push(baseObj);
                                }
                                
                                wrap.remove();
                                this.renderAppearancesForStory(targetStoryNum);
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



    openEditAppearanceModal(typeKey, item, onUpdate) {
        const modalId = 'admin-edit-appearance-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();
        
        const titleMap = {
            teams: 'команди',
            locations: 'локації',
            concepts: 'концепту',
            objects: 'предмета'
        };
        const displayTitle = titleMap[typeKey] || 'сутності';
        
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'admin-modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div class="admin-modal-content" style="
                background: var(--bg-card); border: 1px solid var(--border-s);
                border-radius: var(--r-lg); width: 450px; padding: 24px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: flex;
                flex-direction: column; gap: 16px; position: relative;
            ">
                <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 16px; color: var(--text);">Редагування ${displayTitle}</h4>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Оригінальна назва</label>
                    <input type="text" id="edit-entity-name" class="admin-input" value="${escapeHtmlAttribute(item.name || '')}" style="margin-bottom: 0;">
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Українська назва</label>
                    <input type="text" id="edit-entity-name-uk" class="admin-input" value="${escapeHtmlAttribute(item.name_uk || '')}" style="margin-bottom: 0;">
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                    <button type="button" class="btn-admin btn-admin--secondary btn-close-entity-modal" style="margin-bottom: 0;">Скасувати</button>
                    <button type="button" class="btn-admin btn-admin--primary btn-save-entity-modal" style="margin-bottom: 0;">Зберегти</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const close = () => modal.remove();
        modal.querySelector('.btn-close-entity-modal').addEventListener('click', close);
        
        modal.querySelector('.btn-save-entity-modal').addEventListener('click', async () => {
            const updated = {
                name: modal.querySelector('#edit-entity-name').value.trim(),
                name_uk: modal.querySelector('#edit-entity-name-uk').value.trim() || null
            };
            
            if (!updated.name) {
                alert('Оригінальна назва обов\'язкова');
                return;
            }
            
            try {
                await API.put(`/issues/appearances/${typeKey}/${item.id}`, updated);
                onUpdate(updated);
                close();
            } catch (err) {
                alert('Помилка збереження: ' + err.message);
            }
        });
    }

    renderAppearanceStoryOptions() {
        const select = this.modal.querySelector('#appearance-story-select');
        if (!select) return;
        
        const currentValue = select.value ? parseInt(select.value) : 0;
        
        let html = '';
        this.stories.forEach((story, idx) => {
            const orderNum = story.order_num ?? (idx + 1);
            const title = story.name_ua || story.name_original || `Історія ${idx + 1}`;
            const val = idx === 0 ? 0 : orderNum;
            html += `<option value="${val}">Історія ${idx + 1}: ${escapeHtmlAttribute(title)}</option>`;
        });
        
        select.innerHTML = html;
        select.value = String(currentValue);
        
        if (select.value !== String(currentValue)) {
            select.value = '0';
        }
    }

    renderStaffList(containerId, storyIndex) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;
        
        const filtered = this.staff
            .map((s, idx) => ({ s, idx }))
            .filter(item => item.s.story_index === storyIndex)
            .sort((a, b) => getRoleSortIndex((a.s.roles || [])[0]) - getRoleSortIndex((b.s.roles || [])[0]));
        
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
                                    ${this._buildRoleSelect(person.roles, item.idx)}
                                    ${this._buildAssignmentSelect(person.story_index, item.idx)}
                                </div>
                            </div>
                            <button type="button" class="btn-admin btn-admin--danger btn-delete-staff" data-staff-idx="${item.idx}" style="opacity: .5; padding: 0; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
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
                    
                    const issueName = isOriginal ? r.reprint_name : r.original_name;
                    let displayTitle = '';
                    if (r.story_num === 0 || r.story_num === null || r.story_num === undefined) {
                        const storyName = r.story_name_ua || r.story_name_original || issueName || 'Без назви';
                        displayTitle = `Історія 1: ${storyName}`;
                    } else {
                        const storyName = r.story_name_ua || r.story_name_original || 'Без назви';
                        displayTitle = `Історія ${r.story_num}: ${storyName}`;
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
                            <div style="display: flex; gap: 6px;">
                                <button type="button" class="btn-admin btn-admin--secondary btn-edit-reprint" data-reprint-id="${r.id}" style="padding: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    ${ICON.edit}
                                </button>
                                <button type="button" class="btn-admin btn-admin--danger btn-delete-reprint" data-link-id="${r.id}" style="padding: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    ${ICON.trash}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.btn-edit-reprint').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reprintLinkId = parseInt(e.currentTarget.dataset.reprintId);
                const r = this.reprints.find(item => item.id === reprintLinkId);
                if (!r) return;

                const isOriginal = r.original_id === this.issue.id;
                
                // Збираємо спрощену картку випуску, який має бути обраний в модалі
                const preselectedIssue = {
                    id: isOriginal ? r.reprint_id : r.original_id,
                    name: isOriginal ? r.reprint_name : r.original_name,
                    issue_number: isOriginal ? r.reprint_number : r.original_number,
                    volume_name: isOriginal ? r.reprint_volume_name : r.original_volume_name,
                    volume_name_uk: isOriginal ? r.reprint_volume_name_uk : r.original_volume_name_uk,
                    image: isOriginal ? r.reprint_image : r.original_image
                };

                openAddReprintModal({
                    issueId: this.issue.id,
                    stories: this.stories,
                    reprintLinkId: reprintLinkId,
                    preselectedIssue: preselectedIssue,
                    preselectedRole: isOriginal ? 'original' : 'reprint', // оскільки поточний є оригіналом, то обраний випуск є репринтом (role='reprint'), і навпаки
                    preselectedForeignName: r.story_foreign_name,
                    preselectedStoryOrder: r.story_num !== null ? r.story_num : 0,
                    onAdd: async () => {
                        try {
                            const res = await API.get(`/issues/${this.issue.id}`);
                            this.reprints = res.reprints || [];
                            this.renderReprintsList();
                        } catch (err) {
                            console.error('Помилка оновлення списку репринтів після редагування:', err);
                        }
                    }
                });
            });
        });

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
                                    roles: ['writer'],
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
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn-admin btn-admin--danger btn-clear-story-staff" data-index="${index}" style="padding: 2px 8px; font-size: 11px; height: 24px;">Видалити всіх</button>
                            <button type="button" class="btn-admin btn-admin--secondary" id="btn-add-story-staff-${index}" style="padding: 2px 8px; font-size: 11px; height: 24px;">+ Додати автора</button>
                        </div>
                    </div>
                    <div id="story-staff-container-${index}"></div>
                    <div id="story-staff-search-wrap-${index}"></div>
                </div>
            `;

            row.querySelector('.story-input-original').addEventListener('input', (e) => {
                this.stories[index].name_original = e.target.value;
                this.renderAllStaffLists(); // Щоб оновити назви у селектах призначення
                
                if (index === 0) {
                    this.issue.name = e.target.value;
                }
            });
            row.querySelector('.story-input-ua').addEventListener('input', (e) => {
                this.stories[index].name_ua = e.target.value;
                this.renderAllStaffLists();
                
                if (index === 0) {
                    this.issue.name_uk = e.target.value;
                }
            });
            row.querySelector('.story-input-order').addEventListener('input', (e) => {
                this.stories[index].order_num = parseInt(e.target.value) || 0;
            });

            row.querySelector('.btn-delete-story-row').addEventListener('click', () => {
                const targetOrderNum = this.stories[index].order_num ?? (index + 1);
                // Якщо ми видаляємо історію, перепризначимо її авторів на основний випуск
                this.staff.forEach(s => {
                    if (s.story_index === index) {
                        s.story_index = -1;
                    } else if (s.story_index > index) {
                        s.story_index -= 1;
                    }
                });
                
                // Якщо ми видаляємо історію, перепризначимо її появам story_num на 0
                const appearance_types = ["characters", "teams", "locations", "concepts", "objects"];
                appearance_types.forEach(t => {
                    this.appearances[t].forEach(item => {
                        if (item.story_num === targetOrderNum) {
                            item.story_num = 0;
                        }
                    });
                });

                this.stories.splice(index, 1);
                this.renderStoryRows();
                this.renderAppearanceStoryOptions();
                const activeStoryNum = parseInt(this.modal.querySelector('#appearance-story-select').value);
                this.renderAppearancesForStory(activeStoryNum);
            });

            row.querySelector('.btn-clear-story-staff').addEventListener('click', () => {
                if (!confirm('Ви впевнені, що хочете видалити всіх авторів цієї історії?')) return;
                this.staff = this.staff.filter(s => s.story_index !== index);
                this.renderAllStaffLists();
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
                <div class="ds-modal-body" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 20px;">
                    <div class="editor-tabs-segmented">
                        <button class="editor-tab-btn is-active" data-tab="info">Основна інформація</button>
                        <button class="editor-tab-btn" data-tab="stories">Історії</button>
                        <button class="editor-tab-btn" data-tab="appearances">Появи</button>
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

                                ${this._imgFieldHTML('image', 'Обкладинка випуску', i.image, ICON.image)}

                                <div class="admin-form-group admin-form-group--full">
                                    <label class="admin-label">${ICON.alignLeft} Опис випуску</label>
                                    <textarea name="description" class="admin-textarea">${i.description || ''}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Вкладка: Історії -->
                        <div class="editor-tab-content" id="tab-stories">
                            <h4 style="font-family: var(--font-oswald); text-transform: uppercase; font-size: 15px; color: var(--text); border-bottom: 1px solid var(--border-s); margin-bottom: 1em;">Історії випуску</h4>
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

                        <!-- Вкладка: Появи -->
                        <div class="editor-tab-content" id="tab-appearances">
                            <div class="appearances-editor-container">
                                <div class="admin-form-group" style="margin-bottom: 20px;">
                                    <label class="admin-label">Оберіть історію для редагування появ:</label>
                                    <select id="appearance-story-select" class="admin-input" style="height: 38px; margin-bottom: 0;">
                                    </select>
                                </div>
                                <div id="appearances-by-story-container">
                                </div>
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
            this.renderAppearanceStoryOptions();
        });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        this.modal = modal;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';



        this.initImageHandlers(modal);
        this.renderStoryRows();
        this.renderReprintsList();
        
        this.renderAppearanceStoryOptions();
        this.renderAppearancesForStory(0);
        
        modal.querySelector('#appearance-story-select').addEventListener('change', (e) => {
            this.renderAppearancesForStory(parseInt(e.target.value));
        });
        
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
        

    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            document.body.style.overflow = '';
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
        data.name = this.issue.name || '';
        data.name_uk = this.issue.name_uk || '';
        
        // Передаємо оновлений стаф
        data.staff = this.staff.flatMap(s => (s.roles || []).map(r => ({
            person_id: s.person_id,
            role: r,
            story_index: s.story_index
        })));

        // Передаємо оновлені появи
        data.characters = this.appearances.characters;
        data.teams = this.appearances.teams;
        data.locations = this.appearances.locations;
        data.concepts = this.appearances.concepts;
        data.objects = this.appearances.objects;

        const saveBtn = this.modal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';

        try {
            const fileInput = form.querySelector('input[name="image_file"]');
            if (fileInput && fileInput.files.length > 0) {
                const uploadData = new FormData();
                uploadData.append('file', fileInput.files[0]);
                const uploadRes = await API.upload('/images/upload/issue', uploadData);
                data['image'] = uploadRes.url;
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
