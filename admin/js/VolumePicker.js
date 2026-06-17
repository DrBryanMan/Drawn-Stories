import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl } from '/static/js/helpers/image.js';

const ICON = {
    search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    info: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    alert: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
};

export class VolumePicker {
    constructor(options = {}) {
        this.title = options.title || 'Вибрати том';
        this.onSelect = options.onSelect || (() => {});
        this.excludeId = options.excludeId || null;
        this.disabledIds = options.disabledIds || [];
        this.themeId = options.themeId || null;
        this.modal = null;
        this.searchTimeout = null;
    }

    render() {
        const modal = document.createElement('div');
        modal.className = 'ds-modal-overlay';
        modal.innerHTML = `
            <div class="ds-modal ds-modal--large">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">
                        ${ICON.search}
                        ${this.title}
                    </div>
                    <button class="ds-modal-close">&times;</button>
                </div>
                <div class="ds-modal-body">
                    <div class="volume-picker-grid">
                        <div class="admin-form-group admin-form-group--full">
                            <label class="admin-label">Назва</label>
                            <input type="text" id="vp-search-name" class="admin-input" placeholder="Пошук за назвою...">
                        </div>
                        <div class="admin-form-group">
                            <label class="admin-label">ID Бази</label>
                            <input type="number" id="vp-search-id" class="admin-input" placeholder="Напр. 123">
                        </div>
                        <div class="admin-form-group">
                            <label class="admin-label">ID Comic Vine</label>
                            <input type="number" id="vp-search-cv-id" class="admin-input" placeholder="Напр. 45678">
                        </div>
                        <div class="admin-form-group">
                            <label class="admin-label">MAL ID</label>
                            <input type="number" id="vp-search-mal-id" class="admin-input" placeholder="Напр. 10456">
                        </div>
                        <div class="admin-form-group">
                            <label class="admin-label">Hikka Slug</label>
                            <input type="text" id="vp-search-hikka" class="admin-input" placeholder="Напр. berserk або 099f23">
                        </div>
                    </div>
                    <div id="vp-results" class="volume-picker-results">
                        <div class="volume-picker-empty">
                            ${ICON.info}
                            <p>Почніть вводити назву або будь-який ID для пошуку</p>
                        </div>
                    </div>
                </div>
                <div class="ds-modal-footer">
                    <button class="btn-admin btn-admin--secondary" id="vp-cancel">Скасувати</button>
                </div>
            </div>
        `;

        modal.querySelector('.ds-modal-close').addEventListener('click', () => this.close());
        modal.querySelector('#vp-cancel').addEventListener('click', () => this.close());
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        this._handleEsc = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._handleEsc);

        const inputs = [
            '#vp-search-name', 
            '#vp-search-id', 
            '#vp-search-cv-id', 
            '#vp-search-mal-id', 
            '#vp-search-hikka'
        ];
        
        inputs.forEach(selector => {
            const el = modal.querySelector(selector);
            el.addEventListener('input', () => this.handleSearch());
            el.addEventListener('focus', () => {
                // Clear other inputs when one is focused
                inputs.forEach(s => {
                    if (s !== selector) {
                        const other = modal.querySelector(s);
                        if (other.value) {
                            other.value = '';
                        }
                    }
                });
            });
        });

        this.modal = modal;
        document.body.appendChild(modal);
        modal.querySelector('#vp-search-name').focus();
        this.showHint();
    }

    handleSearch() {
        clearTimeout(this.searchTimeout);
        const name = this.modal.querySelector('#vp-search-name').value.trim();
        const id = this.modal.querySelector('#vp-search-id').value.trim();
        const cvId = this.modal.querySelector('#vp-search-cv-id').value.trim();
        const malId = this.modal.querySelector('#vp-search-mal-id').value.trim();
        const hikka = this.modal.querySelector('#vp-search-hikka').value.trim();

        if (!name && !id && !cvId && !malId && !hikka) {
            this.showHint();
            return;
        }

        this.searchTimeout = setTimeout(() => this.performSearch({
            search: name,
            id: id,
            cv_id: cvId,
            mal_id: malId,
            hikka_slug: hikka
        }), 300);
    }

    async showHint() {
        const resultsEl = this.modal.querySelector('#vp-results');
        
        if (this.themeId) {
            resultsEl.innerHTML = '<div class="volume-picker-empty"><p>Завантаження рекомендацій...</p></div>';
            try {
                const res = await API.get('/catalog/volumes/suggestions', { theme_id: this.themeId, limit: 10 });
                const volumes = res.items || [];
                
                if (volumes.length > 0) {
                    resultsEl.innerHTML = `
                        ${volumes.map(v => {
                            const isDisabled = this.disabledIds.includes(v.id);
                            return `
                                <div class="volume-picker-item ${isDisabled ? 'volume-picker-item--disabled' : ''}" data-id="${v.id}" ${isDisabled ? 'title="Вже додано"' : ''}>
                                    <img src="${comicVineImageUrl(v.cv_img || v.hikka_img) || '/static/images/no-cover.png'}" alt="">
                                    <div class="volume-picker-item-info">
                                        <div class="volume-picker-item-title">${v.name_uk || v.name}</div>
                                        <div class="volume-picker-item-meta">
                                            ${v.start_year || ''} • ${v.publisher_name || 'Невідоме видавництво'} • ID: ${v.id}
                                            ${v.children_count !== undefined ? ` • ${v.children_count} томів` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    `;

                    resultsEl.querySelectorAll('.volume-picker-item').forEach(el => {
                        el.addEventListener('click', () => {
                            if (el.classList.contains('volume-picker-item--disabled')) return;
                            const id = parseInt(el.dataset.id);
                            const volume = volumes.find(v => v.id === id);
                            this.onSelect(volume);
                            this.close();
                        });
                    });
                    return;
                }
            } catch (err) {
                console.error('Suggestions fetch error:', err);
            }
        }

        resultsEl.innerHTML = `
            <div class="volume-picker-empty">
                ${ICON.info}
                <p>Почніть вводити назву або будь-який ID для пошуку</p>
            </div>
        `;
    }

    async performSearch(searchParams) {
        const resultsEl = this.modal.querySelector('#vp-results');
        resultsEl.innerHTML = '<div class="volume-picker-empty"><p>Завантаження...</p></div>';

        try {
            const params = { limit: 50 };
            if (this.themeId) params.theme_id = this.themeId;
            if (searchParams.search) params.search = searchParams.search;
            if (searchParams.id) params.id = searchParams.id;
            if (searchParams.cv_id) params.cv_id = searchParams.cv_id;
            if (searchParams.mal_id) params.mal_id = searchParams.mal_id;
            if (searchParams.hikka_slug) params.hikka_slug = searchParams.hikka_slug;

            const res = await API.get('/catalog/volumes', params);
            let volumes = res.items || res.data || [];

            if (this.excludeId) {
                volumes = volumes.filter(v => v.id !== this.excludeId);
            }

            if (volumes.length === 0) {
                resultsEl.innerHTML = `
                    <div class="volume-picker-empty">
                        ${ICON.alert}
                        <p>Нічого не знайдено за вашим запитом</p>
                    </div>
                `;
                return;
            }

            resultsEl.innerHTML = volumes.map(v => {
                const isDisabled = this.disabledIds.includes(v.id);
                return `
                    <div class="volume-picker-item ${isDisabled ? 'volume-picker-item--disabled' : ''}" data-id="${v.id}" ${isDisabled ? 'title="Вже додано"' : ''}>
                        <img src="${comicVineImageUrl(v.cv_img || v.hikka_img) || '/static/images/no-cover.png'}" alt="">
                        <div class="volume-picker-item-info">
                            <div class="volume-picker-item-title">${v.name_uk || v.name}</div>
                            <div class="volume-picker-item-meta">
                                ${v.start_year || ''} • ${v.publisher_name || 'Невідоме видавництво'} • ID: ${v.id}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            resultsEl.querySelectorAll('.volume-picker-item').forEach(el => {
                el.addEventListener('click', () => {
                    if (el.classList.contains('volume-picker-item--disabled')) return;
                    const id = parseInt(el.dataset.id);
                    const volume = volumes.find(v => v.id === id);
                    this.onSelect(volume);
                    this.close();
                });
            });

        } catch (err) {
            let errorMsg = err.message;
            if (errorMsg === 'Not Found') {
                errorMsg = 'Помилка: Ендпоінт пошуку не знайдено на сервері';
            } else if (errorMsg === 'Method Not Allowed') {
                errorMsg = 'Помилка: цей метод запиту не дозволений сервером';
            }
            resultsEl.innerHTML = `<div class="volume-picker-empty">
                ${ICON.alert}
                <p>${errorMsg}</p>
            </div>`;
        }
    }

    close() {
        if (this.modal) {
            document.removeEventListener('keydown', this._handleEsc);
            this.modal.remove();
            this.modal = null;
        }
    }
}
