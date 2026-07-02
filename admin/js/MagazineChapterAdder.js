import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';

const ICON = {
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>'
};

export class MagazineChapterAdder {
    constructor(issue, chapters, onSuccess) {
        this.issue = issue;
        this.chapters = chapters;
        this.onSuccess = onSuccess;
        
        this.modal = null;
        this.activeTab = 'series'; // 'series', 'magazine', 'ongoing'
        this.viewMode = 'select-series'; // 'select-series', 'select-chapter', 'create-chapter'
        
        this.selectedVolume = null;
        this.chaptersOfVolume = [];
        this.addedVolumeIds = new Set(chapters.map(ch => ch.manga_volume_id));
        
        // Cache for loaded series of the magazine
        this.magazineSeries = [];
        this.ongoingSeries = [];
        
        // Search inputs state
        this.searchText = '';
        this.malIdText = '';
        this.volumeIdText = '';
        
        this.debounceTimer = null;
    }

    _getRecentIds() {
        try {
            return JSON.parse(localStorage.getItem('magazine_recent_volumes') || '[]').map(Number).filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    _addToRecent(volumeId) {
        try {
            let recent = this._getRecentIds();
            recent = [Number(volumeId), ...recent.filter(id => id !== Number(volumeId))].slice(0, 25);
            localStorage.setItem('magazine_recent_volumes', JSON.stringify(recent));
        } catch (e) {
            console.error('Failed to update recent list:', e);
        }
    }

    async render() {
        const modalHtml = `
            <style>
                .chapter-label-chip {
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    cursor: pointer;
                    border: 1px solid var(--border-s);
                    background: var(--bg-card);
                    color: var(--text-muted);
                    transition: all 0.15s ease;
                    user-select: none;
                    text-align: center;
                }
                .chapter-label-chip:hover {
                    border-color: var(--border);
                    color: var(--text);
                }
                .chapter-label-chip[data-label="lead"].is-active {
                    background: #fef3c7 !important;
                    color: #d97706 !important;
                    border-color: #f59e0b !important;
                }
                .chapter-label-chip[data-label="color"].is-active {
                    background: #fce7f3 !important;
                    color: #db2777 !important;
                    border-color: #ec4899 !important;
                }
                .chapter-label-chip[data-label="debut"].is-active {
                    background: #dcfce7 !important;
                    color: #15803d !important;
                    border-color: #22c55e !important;
                }
                .chapter-label-chip[data-label="final"].is-active {
                    background: #fee2e2 !important;
                    color: #b91c1c !important;
                    border-color: #ef4444 !important;
                }
                .chapter-label-chip[data-label="digital"].is-active {
                    background: #e0f2fe !important;
                    color: #0369a1 !important;
                    border-color: #0284c7 !important;
                }
                .chapter-select-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-s);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .chapter-select-row:hover:not(.is-added) {
                    background: var(--bg-card-h);
                    border-color: var(--accent);
                    transform: translateX(2px);
                }
                .chapter-select-row.is-selected {
                    background: color-mix(in srgb, var(--accent) 8%, var(--bg-card)) !important;
                    border-color: var(--accent) !important;
                    box-shadow: 0 0 0 1px var(--accent);
                }
                .chapter-select-row.is-added {
                    opacity: 0.4;
                    cursor: default;
                }
            </style>
            <div class="ds-modal-overlay" id="chapter-adder-overlay" style="display: flex; z-index: 1000;">
                <div class="ds-modal ds-modal--large" style="max-width: 900px; width: 90%; display: flex; flex-direction: column; max-height: 85vh;">
                    <div class="ds-modal-header" style="flex-shrink: 0;">
                        <div class="ds-modal-title" id="chapter-adder-title">${ICON.plus} Додати серії</div>
                        <button class="ds-modal-close" id="chapter-adder-close">${ICON.x}</button>
                    </div>
                    <div class="ds-modal-body" id="chapter-adder-body" style="flex-grow: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; align-items: stretch;">
                        <!-- Content will be rendered dynamically here -->
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('chapter-adder-overlay');
        
        // Bind close events
        this.modal.querySelector('#chapter-adder-close').onclick = () => this.close();
        this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
        
        this._keydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'Enter') {
                if (e.target.tagName === 'BUTTON') return;
                
                if (this.viewMode === 'select-chapter') {
                    const submitBtn = document.getElementById('submit-add-chapter');
                    if (submitBtn && !submitBtn.disabled) {
                        const activeRow = this.modal.querySelector('.chapter-select-row.is-selected');
                        if (activeRow) {
                            const activeChapterId = Number(activeRow.getAttribute('data-id'));
                            if (activeChapterId) {
                                e.preventDefault();
                                this.submitAddChapterToIssue(activeChapterId);
                            }
                        }
                    }
                } else if (this.viewMode === 'create-chapter') {
                    e.preventDefault();
                    this.submitCreateChapter();
                }
            }
        };
        document.addEventListener('keydown', this._keydownHandler);

        // Fetch magazine series in background
        this.fetchMagazineSeries();

        // Initial view rendering
        this.switchView('select-series');
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        document.removeEventListener('keydown', this._keydownHandler);
    }

    switchView(viewMode) {
        this.viewMode = viewMode;
        const container = document.getElementById('chapter-adder-body');
        if (!container) return;

        if (viewMode === 'select-series') {
            document.getElementById('chapter-adder-title').innerHTML = `${ICON.plus} Додати серії`;
            this.renderSelectSeriesView(container);
        } else if (viewMode === 'select-chapter') {
            const name = this.selectedVolume.name_uk || this.selectedVolume.name || 'Серія';
            document.getElementById('chapter-adder-title').innerHTML = `
                <button id="adder-back-btn" class="btn-admin btn-admin--secondary" style="padding: 4px 8px; margin-right: 12px; height: auto; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0;">
                    ${ICON.arrowLeft} Назад
                </button>
                Вибір розділу для: ${escapeHtmlAttribute(name)}
            `;
            this.renderSelectChapterView(container);
            
            // Bind back button
            document.getElementById('adder-back-btn').onclick = () => this.switchView('select-series');
        } else if (viewMode === 'create-chapter') {
            document.getElementById('chapter-adder-title').innerHTML = `
                <button id="adder-back-to-ch-btn" class="btn-admin btn-admin--secondary" style="padding: 4px 8px; margin-right: 12px; height: auto; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0;">
                    ${ICON.arrowLeft} Назад
                </button>
                Створити новий розділ
            `;
            this.renderCreateChapterView(container);
            
            // Bind back button
            document.getElementById('adder-back-to-ch-btn').onclick = () => this.switchView('select-chapter');
        }
    }

    // --- VIEW: SELECT SERIES ---
    renderSelectSeriesView(container) {
        container.innerHTML = `
            <div class="editor-tabs-segmented" style="margin-bottom: 20px; width: 100%;">
                <button class="editor-tab-btn ${this.activeTab === 'series' ? 'is-active' : ''}" data-tab="series">Серії</button>
                <button class="editor-tab-btn ${this.activeTab === 'magazine' ? 'is-active' : ''}" data-tab="magazine">Журнал</button>
                <button class="editor-tab-btn ${this.activeTab === 'ongoing' ? 'is-active' : ''}" data-tab="ongoing">Онгоінги</button>
            </div>
            
            <div class="search-filters-row" style="display: flex; gap: 12px; flex-shrink: 0; width: 100%;">
                <div style="flex-grow: 1; position: relative;">
                    <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">${ICON.search}</span>
                    <input type="text" id="series-search-input" placeholder="Шукати за назвою..." value="${escapeHtmlAttribute(this.searchText)}" style="width: 100%; padding: 10px 12px 10px 36px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                </div>
                <input type="number" id="series-mal-input" placeholder="MAL ID" value="${escapeHtmlAttribute(this.malIdText)}" style="width: 120px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                <input type="number" id="series-local-input" placeholder="Volume ID" value="${escapeHtmlAttribute(this.volumeIdText)}" style="width: 120px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
            </div>
            
            <div class="series-results-container" style="flex-grow: 1; overflow-y: auto; max-height: 50vh; min-height: 200px; width: 100%; display: block;">
                <div id="series-results-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; width: 100%;">
                    <!-- Results will be loaded here -->
                </div>
            </div>
        `;

        // Bind events
        container.querySelectorAll('.editor-tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                const target = e.target.closest('.editor-tab-btn');
                if (!target) return;
                this.activeTab = target.getAttribute('data-tab');
                container.querySelectorAll('.editor-tab-btn').forEach(b => {
                    b.classList.remove('is-active');
                });
                target.classList.add('is-active');
                this.loadSeriesData();
            };
        });

        const onSearchChange = () => {
            this.searchText = document.getElementById('series-search-input').value;
            this.malIdText = document.getElementById('series-mal-input').value;
            this.volumeIdText = document.getElementById('series-local-input').value;
            
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.loadSeriesData(), 300);
        };

        document.getElementById('series-search-input').oninput = onSearchChange;
        document.getElementById('series-mal-input').oninput = onSearchChange;
        document.getElementById('series-local-input').oninput = onSearchChange;

        // Load data immediately
        this.loadSeriesData();
    }

    async fetchMagazineSeries() {
        try {
            const [resAll, resOngoing] = await Promise.all([
                API.get(`/magazines/${this.issue.magazine_db_id}/all-series`, { limit: 100 }),
                API.get(`/magazines/${this.issue.magazine_db_id}/all-series`, { limit: 100, ongoing: true })
            ]);
            this.magazineSeries = resAll.items || [];
            this.ongoingSeries = resOngoing.items || [];
            
            // If active tab is magazine or ongoing, update view
            if (this.activeTab === 'magazine' || this.activeTab === 'ongoing') {
                this.loadSeriesData();
            }
        } catch (e) {
            console.error('Failed to load magazine series:', e);
        }
    }

    async loadSeriesData() {
        const grid = document.getElementById('series-results-grid');
        if (!grid) return;

        grid.innerHTML = '<div style="grid-column: 1/-1; display: flex; align-items: center; justify-content: center; height: 150px; color: var(--text-muted);">Завантаження...</div>';

        try {
            let items = [];

            if (this.activeTab === 'series') {
                // If all fields are empty, load recent IDs
                if (!this.searchText.trim() && !this.malIdText.trim() && !this.volumeIdText.trim()) {
                    const recentIds = this._getRecentIds();
                    if (recentIds.length > 0) {
                        const res = await API.get('/catalog/volumes', { ids: recentIds.join(','), limit: 25 });
                        items = res.items || [];
                        
                        // Sort back according to recent order
                        const idMap = new Map(items.map(item => [item.id, item]));
                        items = recentIds.map(id => idMap.get(id)).filter(Boolean);
                    } else {
                        grid.innerHTML = '<div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 150px; color: var(--text-muted); gap: 8px;"><div>Немає нещодавно доданих серій.</div><div style="font-size: 13px;">Спробуйте скористатися пошуком вище.</div></div>';
                        return;
                    }
                } else {
                    // Make search request
                    const params = { has_mal: true, limit: 50 };
                    if (this.searchText.trim()) params.search = this.searchText.trim();
                    if (this.malIdText.trim()) params.mal_id = this.malIdText.trim();
                    if (this.volumeIdText.trim()) params.id = this.volumeIdText.trim();

                    const res = await API.get('/catalog/volumes', params);
                    items = res.items || [];
                }
            } else {
                // Local filtering for 'magazine' or 'ongoing' tabs
                const baseList = this.activeTab === 'ongoing' ? this.ongoingSeries : this.magazineSeries;
                
                items = baseList.filter(item => {
                    if (this.volumeIdText.trim() && String(item.id) !== this.volumeIdText.trim()) return false;
                    if (this.malIdText.trim() && String(item.mal_id) !== this.malIdText.trim()) return false;
                    if (this.searchText.trim()) {
                        const searchLower = this.searchText.toLowerCase();
                        const nameLower = (item.name || '').toLowerCase();
                        const nameUkLower = (item.name_uk || '').toLowerCase();
                        if (!nameLower.includes(searchLower) && !nameUkLower.includes(searchLower)) return false;
                    }
                    return true;
                });
            }

            // Sort so already added volumes are placed at the end of the array
            items.sort((a, b) => {
                const aAdded = this.addedVolumeIds.has(a.id) ? 1 : 0;
                const bAdded = this.addedVolumeIds.has(b.id) ? 1 : 0;
                return aAdded - bAdded;
            });

            this.renderSeriesGrid(grid, items);
        } catch (e) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0;">Помилка завантаження: ${e.message}</div>`;
        }
    }

    renderSeriesGrid(grid, items) {
        if (!items || items.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; display: flex; align-items: center; justify-content: center; height: 150px; color: var(--text-muted);">Нічого не знайдено.</div>';
            return;
        }

        grid.innerHTML = items.map(item => {
            const cover = comicVineImageUrl(item.cv_img || item.hikka_img || item.cover_img);
            const isAdded = this.addedVolumeIds.has(item.id);
            const title = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
            const origTitle = item.name_uk && item.name_uk !== item.name ? item.name : '';
            
            return `
                <div class="series-select-card ${isAdded ? 'is-disabled' : ''}" 
                     data-id="${item.id}"
                     style="display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 8px; overflow: hidden; cursor: ${isAdded ? 'default' : 'pointer'}; position: relative; transition: border-color 0.2s; opacity: ${isAdded ? '0.4' : '1'};">
                    <div style="aspect-ratio: 2 / 3; position: relative; background: var(--bg-body); overflow: hidden; flex-shrink: 0;">
                        ${cover 
                            ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>'}
                        ${isAdded ? `
                            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: bold; text-transform: uppercase; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                                Вже додано
                            </div>
                        ` : ''}
                    </div>
                    <div style="padding: 10px; flex-grow: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-main); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${title}">${title}</div>
                        ${origTitle ? `<div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtmlAttribute(origTitle)}">${escapeHtmlAttribute(origTitle)}</div>` : ''}
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: auto; display: flex; justify-content: space-between;">
                            <span>ID: ${item.id}</span>
                            ${item.mal_id ? `<span>MAL: ${item.mal_id}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks
        grid.querySelectorAll('.series-select-card').forEach(card => {
            const id = Number(card.getAttribute('data-id'));
            const isAdded = card.classList.contains('is-disabled');
            if (isAdded) return;

            card.onclick = () => {
                const vol = items.find(i => i.id === id);
                if (vol) this.selectVolume(vol);
            };
        });
    }

    async selectVolume(volume) {
        this.selectedVolume = volume;
        this.switchView('select-chapter');
        
        try {
            // Fetch chapters of the volume
            const res = await API.get(`/manga-chapters/by-volume/${volume.id}`);
            
            // Sort chapters from newest to oldest (by chapter_number numerically/alphabetically descending, and by ID descending)
            this.chaptersOfVolume = (res || []).sort((a, b) => {
                const numA = parseFloat(a.chapter_number) || 0;
                const numB = parseFloat(b.chapter_number) || 0;
                if (numA !== numB) {
                    return numB - numA; // Descending
                }
                return b.id - a.id;
            });
            
            // Re-render Selection panel with populated chapters
            const container = document.getElementById('chapter-adder-body');
            if (container) this.renderSelectChapterView(container);
        } catch (e) {
            console.error('Failed to load volume chapters:', e);
            const listContainer = document.getElementById('chapters-list-container');
            if (listContainer) {
                listContainer.innerHTML = `<div style="color: var(--red); text-align: center; padding: 20px;">Помилка: ${e.message}</div>`;
            }
        }
    }

    // --- VIEW: SELECT CHAPTER ---
    renderSelectChapterView(container) {
        // Calculate auto-incremented order num
        let nextOrder = 1;
        if (this.chapters && this.chapters.length > 0) {
            const maxOrder = Math.max(...this.chapters.map(c => c.order_num || 0));
            nextOrder = maxOrder + 1;
        }

        container.innerHTML = `
            <div style="display: flex; gap: 24px; flex-grow: 1; min-height: 300px; max-height: 55vh; overflow: hidden; width: 100%;">
                <!-- Chapters list (Left) -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid var(--border-s); padding-right: 24px; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text-main);">Виберіть розділ серії:</h4>
                        <button id="btn-to-create-chapter" class="btn-admin btn-admin--secondary" style="height: 30px; font-size: 12px; padding: 0 10px; gap: 4px; margin-bottom: 0;">
                            ${ICON.plus} Створити новий
                        </button>
                    </div>
                    <div id="chapters-list-container" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px;">
                        <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">Завантаження розділів...</div>
                    </div>
                </div>
                
                <!-- Chapter settings (Right) -->
                <div style="width: 280px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px;">
                    <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text-main);">Параметри додавання:</h4>
                    
                    <div id="selected-chapter-preview" style="background: var(--bg-input); border: 1px solid var(--border-s); border-radius: 8px; padding: 12px; font-size: 13px; color: var(--text-muted); text-align: center;">
                        Виберіть розділ зі списку зліва
                    </div>
                    
                    <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Порядок у випуску</label>
                        <input type="number" id="add-chapter-order" value="${nextOrder}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                    </div>
                    
                    <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Мітки</label>
                        <div id="label-chips-container" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;">
                            <span class="chapter-label-chip" data-label="lead" onclick="this.classList.toggle('is-active')">Lead</span>
                            <span class="chapter-label-chip" data-label="color" onclick="this.classList.toggle('is-active')">Color</span>
                            <span class="chapter-label-chip" data-label="debut" onclick="this.classList.toggle('is-active')">Debut</span>
                            <span class="chapter-label-chip" data-label="final" onclick="this.classList.toggle('is-active')">Final</span>
                            <span class="chapter-label-chip" data-label="digital" onclick="this.classList.toggle('is-active')">Digital Exclusive</span>
                        </div>
                    </div>
                    
                    <button id="submit-add-chapter" class="btn-admin btn-admin--primary" disabled style="width: 100%; font-weight: bold; cursor: not-allowed; opacity: 0.5; margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 0;">
                        ${ICON.plus} Додати до випуску
                    </button>
                </div>
            </div>
        `;

        // Bind create-chapter button
        document.getElementById('btn-to-create-chapter').onclick = () => this.switchView('create-chapter');

        // Populate chapters list if already loaded
        if (this.chaptersOfVolume.length > 0 || this.viewMode === 'select-chapter') {
            this.renderChaptersList();
        }
    }

    renderChaptersList(selectedChapterId = null) {
        const container = document.getElementById('chapters-list-container');
        if (!container) return;

        if (this.chaptersOfVolume.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">У цієї серії немає зареєстрованих розділів.</div>';
            return;
        }

        const alreadyInThisIssue = new Set(this.chapters.map(c => c.chapter_id));

        container.innerHTML = this.chaptersOfVolume.map(ch => {
            const isAdded = alreadyInThisIssue.has(ch.id);
            const isSelected = selectedChapterId === ch.id;
            const title = escapeHtmlAttribute(ch.name || 'Без назви');
            const releaseDate = ch.release_date || '';
            
            return `
                <div class="chapter-select-row ${isAdded ? 'is-added' : ''} ${isSelected ? 'is-selected' : ''}" 
                     data-id="${ch.id}">
                    <div style="min-width: 0; flex-grow: 1; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="font-weight: 700; color: var(--accent); margin-right: 8px;">Розд. ${escapeHtmlAttribute(ch.chapter_number)}</span>
                            <span style="color: var(--text-main); font-size: 13px;" title="${title}">${title}</span>
                        </div>
                        ${releaseDate ? `<span style="font-size: 11px; color: var(--text-muted);">Вихід: ${escapeHtmlAttribute(releaseDate)}</span>` : ''}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); flex-shrink: 0; margin-left: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        ${ch.pages ? `<span>${ch.pages} стор.</span>` : ''}
                        ${isAdded ? '<span style="color: var(--text-muted); font-weight: bold; text-transform: uppercase; font-size: 10px;">Вже є</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        let activeChapterId = selectedChapterId;

        // Bind clicks
        container.querySelectorAll('.chapter-select-row').forEach(row => {
            const id = Number(row.getAttribute('data-id'));
            if (alreadyInThisIssue.has(id)) return;

            row.onclick = () => {
                // Select this row
                container.querySelectorAll('.chapter-select-row').forEach(r => {
                    r.classList.remove('is-selected');
                });
                row.classList.add('is-selected');
                
                activeChapterId = id;
                this.updateSelectedChapterPreview(id);
            };
        });

        // Submit add chapter button
        const submitBtn = document.getElementById('submit-add-chapter');
        submitBtn.onclick = () => {
            if (activeChapterId) this.submitAddChapterToIssue(activeChapterId);
        };
    }

    updateSelectedChapterPreview(chapterId) {
        const ch = this.chaptersOfVolume.find(c => c.id === chapterId);
        const preview = document.getElementById('selected-chapter-preview');
        const submitBtn = document.getElementById('submit-add-chapter');
        
        if (ch && preview && submitBtn) {
            preview.innerHTML = `
                <div style="font-weight: bold; color: var(--accent); font-size: 14px; margin-bottom: 4px;">Розділ ${escapeHtmlAttribute(ch.chapter_number)}</div>
                <div style="color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlAttribute(ch.name || 'Без назви')}</div>
                ${ch.pages ? `<div style="font-size: 11px; margin-top: 4px;">${ch.pages} сторінок</div>` : ''}
                ${ch.release_date ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Дата виходу: ${escapeHtmlAttribute(ch.release_date)}</div>` : ''}
            `;
            preview.style.borderColor = 'var(--accent)';
            preview.style.background = 'color-mix(in srgb, var(--accent) 3%, var(--bg-input))';
            
            submitBtn.removeAttribute('disabled');
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.opacity = '1';
        }
    }

    // --- VIEW: CREATE CHAPTER ---
    renderCreateChapterView(container) {
        const defaultDate = this.issue.release_date || this.issue.cover_date || '';

        // Suggest the next chapter number based on the highest numerical chapter_number in the list
        let suggestedNum = '';
        if (this.chaptersOfVolume.length > 0) {
            const numbers = this.chaptersOfVolume
                .map(ch => parseFloat(ch.chapter_number))
                .filter(num => !isNaN(num));
            if (numbers.length > 0) {
                const maxNum = Math.max(...numbers);
                suggestedNum = String(maxNum + 1);
            }
        }

        container.innerHTML = `
            <div style="max-width: 450px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 16px; padding: 12px 0;">
                <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Номер розділу *</label>
                    <input type="text" id="create-chapter-number" placeholder="Наприклад: 61, 61.5, 62" value="${suggestedNum}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                </div>
                
                <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Назва розділу (необов'язково)</label>
                    <input type="text" id="create-chapter-name" placeholder="Назва розділу українською або англійською" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                </div>
                
                <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Кількість сторінок (необов'язково)</label>
                    <input type="number" id="create-chapter-pages" placeholder="Наприклад: 19" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                </div>
                
                <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Дата виходу *</label>
                    <input type="date" id="create-chapter-date" value="${defaultDate}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 12px;">
                    <button id="cancel-create-chapter" class="btn-admin btn-admin--secondary" style="flex: 1; justify-content: center; height: 42px; margin-bottom: 0;">Скасувати</button>
                    <button id="submit-create-chapter" class="btn-admin btn-admin--primary" style="flex: 1; justify-content: center; height: 42px; margin-bottom: 0;">Створити розділ</button>
                </div>
            </div>
        `;

        // Bind cancel
        document.getElementById('cancel-create-chapter').onclick = () => this.switchView('select-chapter');
        
        // Bind submit
        document.getElementById('submit-create-chapter').onclick = () => this.submitCreateChapter();
    }

    async submitCreateChapter() {
        const num = document.getElementById('create-chapter-number').value.trim();
        const name = document.getElementById('create-chapter-name').value.trim();
        const pages = document.getElementById('create-chapter-pages').value.trim();
        const date = document.getElementById('create-chapter-date').value;

        if (!num) {
            alert('Будь ласка, вкажіть номер розділу');
            return;
        }

        const submitBtn = document.getElementById('submit-create-chapter');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Збереження...';

        try {
            const res = await API.post('/manga-chapters', {
                volume_id: this.selectedVolume.id,
                chapter_number: num,
                name: name || null,
                pages: pages ? Number(pages) : null,
                release_date: date || null
            });

            // Reload and sort chapters of this volume
            const rawChapters = await API.get(`/manga-chapters/by-volume/${this.selectedVolume.id}`);
            this.chaptersOfVolume = (rawChapters || []).sort((a, b) => {
                const numA = parseFloat(a.chapter_number) || 0;
                const numB = parseFloat(b.chapter_number) || 0;
                if (numA !== numB) {
                    return numB - numA;
                }
                return b.id - a.id;
            });
            
            // Switch back to selection view and highlight newly created chapter
            this.switchView('select-chapter');
            this.renderChaptersList(res.id);
            this.updateSelectedChapterPreview(res.id);
        } catch (e) {
            alert('Помилка створення розділу: ' + e.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Створити розділ';
        }
    }

    async submitAddChapterToIssue(chapterId) {
        const orderInput = document.getElementById('add-chapter-order');
        const labelChips = document.querySelectorAll('#label-chips-container .chapter-label-chip.is-active');
        
        const orderNum = orderInput ? Number(orderInput.value) : null;
        const label = labelChips.length > 0 
            ? Array.from(labelChips).map(c => c.getAttribute('data-label')).join(',') 
            : null;
        
        const submitBtn = document.getElementById('submit-add-chapter');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Додавання...';
        }

        try {
            const res = await API.post(`/magazines/issues/${this.issue.id}/chapters`, {
                manga_id: this.selectedVolume.id,
                manga_chapter_id: chapterId,
                order_num: orderNum,
                label: label
            });

            // Add volume to recent list
            this._addToRecent(this.selectedVolume.id);
            
            // Mark as added locally so it shows as disabled if the user opens the same series again
            this.chapters.push({ 
                manga_chapter_id: chapterId, 
                manga_volume_id: this.selectedVolume.id,
                order_num: res.order_num || orderNum
            });
            this.addedVolumeIds.add(this.selectedVolume.id);
            
            // Trigger parent page refresh
            if (this.onSuccess) {
                this.onSuccess(); // Non-blocking background refresh
            }
            
            // Return to series selection instead of closing
            this.switchView('select-series');
        } catch (e) {
            alert('Помилка додавання розділу до випуску: ' + e.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Додати до випуску';
            }
        }
    }
}
