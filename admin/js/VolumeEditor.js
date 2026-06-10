import { API } from '/static/js/helpers/api.js';
import { LANG_MAP } from '/static/js/helpers/lang.js';
import * as Utils from './editorUtils.js';

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
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
};

export class VolumeEditor {
    constructor(volume, onSave) {
        this.volume = volume;
        this.onSave = onSave;
        this.modal = null;
        this.allThemes = [];
        this.currentThemeIds = new Set();
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
        } catch (err) {
            console.error('Error fetching extra data:', err);
        }
    }

    async render() {
        await this.fetchExtraData();
        
        const v = this.volume;
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        
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
                    <form id="edit-volume-form">
                        <div class="admin-form-grid">
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.hash} CV ID</label>
                                <input type="number" name="cv_id" class="admin-input" value="${v.cv_id || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.link} CV Slug</label>
                                <input type="text" name="cv_slug" class="admin-input" value="${v.cv_slug || ''}">
                            </div>
                            
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.database} MAL ID</label>
                                <input type="number" name="mal_id" class="admin-input" value="${v.mal_id || ''}" placeholder="напр. 123456">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.link2} Hikka Slug</label>
                                <input type="text" name="hikka_slug" class="admin-input" value="${v.hikka_slug || ''}" placeholder="напр. berserk-ek0mv">
                            </div>

                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.hash} LocG ID</label>
                                <input type="number" name="locg_id" class="admin-input" value="${v.locg_id || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.link} LocG Slug</label>
                                <input type="text" name="locg_slug" class="admin-input" value="${v.locg_slug || ''}">
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

                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.image} Обкладинка (URL)</label>
                                <input type="text" name="cv_img" class="admin-input" value="${v.cv_img || v.hikka_img || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.layout} Банер (URL)</label>
                                <input type="text" name="cover_img" class="admin-input" value="${v.cover_img || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.externalLink} Посилання на сайт джерела</label>
                                <input type="url" name="site_link" class="admin-input" value="${v.site_link || ''}" placeholder="https://...">
                            </div>

                            <div class="admin-form-group admin-form-group--full">
                                <label class="admin-label">${ICON.languages} Мова</label>
                                <input type="hidden" name="lang" id="lang-hidden" value="${v.lang || ''}">
                                <div id="lang-chips" style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.2rem;">
                                    <span class="lang-chip${!v.lang ? ' lang-chip--active' : ''}"
                                        data-code="" onclick="window._emSelectLang(this)">— ?</span>
                                    ${Object.entries(LANG_MAP).map(([code, { flag, label }]) =>
                                        `<span class="lang-chip${v.lang === code ? ' lang-chip--active' : ''}"
                                            data-code="${code}" onclick="window._emSelectLang(this)" title="${label}">${flag}</span>`
                                    ).join('')}
                                </div>
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
                                <div id="vol-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.5rem; min-height:0; align-items:center;">
                                    ${Utils.buildThemeChipsHTML(this.allThemes.filter(t => this.currentThemeIds.has(t.id)), 'window._emRemoveThemeVol')}
                                </div>
                                <input type="text" id="theme-search" class="admin-input" placeholder="Пошук тем..." style="margin-bottom:0.5rem; width:100%;"
                                    oninput="window._emFilterThemesVol(this.value)">
                                <div id="themes-list" class="themes-checkbox-list">
                                    ${Utils.buildThemeCheckboxListHTML(this.allThemes, this.currentThemeIds, 'window._emThemeChangeVol')}
                                </div>
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

        Utils.initPublisherSearch({
            inputId: 'vol-pub-input',
            hiddenId: 'vol-pub-id',
            resultsId: 'vol-pub-results',
            chipId: 'vol-pub-chip',
            API
        });
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

    async save() {
        const form = this.modal.querySelector('#edit-volume-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        ['cv_id', 'mal_id', 'locg_id', 'start_year', 'publisher'].forEach(key => {
            data[key] = data[key] ? parseInt(data[key]) : null;
        });
        
        const themeCheckboxes = this.modal.querySelectorAll('#themes-list input[type="checkbox"]:checked');
        data.theme_ids = Array.from(themeCheckboxes).map(cb => parseInt(cb.value));

        const saveBtn = this.modal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Збереження...';

        try {
            await API.put(`/volumes/${this.volume.id}`, data);
            this.close();
            if (this.onSave) this.onSave();
        } catch (err) {
            alert('Помилка збереження: ' + (err.message || 'Невідома помилка'));
            saveBtn.disabled = false;
            saveBtn.textContent = 'Зберегти зміни';
        }
    }
}
