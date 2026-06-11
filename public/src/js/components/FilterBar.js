import { escapeHtmlAttribute } from '../helpers/image.js';
import { API } from '../helpers/api.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

// Custom icons for the list select options (matching volumeDetail.js)
const LIST_ICONS = {
    'all': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    'Planned': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'Reading': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'Completed': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'On Hold': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>',
    'Dropped': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    'favorites': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
};

const LIST_COLORS = {
    'all': { color: '#64748b', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
    'Planned': { color: '#2563eb', bg: 'color-mix(in srgb, #2563eb 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #2563eb 20%, var(--border-s))' },
    'Reading': { color: '#16a34a', bg: 'color-mix(in srgb, #16a34a 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #16a34a 20%, var(--border-s))' },
    'Completed': { color: '#059669', bg: 'color-mix(in srgb, #059669 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #059669 20%, var(--border-s))' },
    'On Hold': { color: '#d97706', bg: 'color-mix(in srgb, #d97706 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #d97706 20%, var(--border-s))' },
    'Dropped': { color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #dc2626 20%, var(--border-s))' },
    'favorites': { color: '#e11d48', bg: 'color-mix(in srgb, #e11d48 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #e11d48 20%, var(--border-s))' }
};

export function mountFilterBar(container, {
    resultsCount = 0,
    resultsLabel = 'Знайдено',
    showResults = true,

    showSearch = true,
    searchPlaceholder = 'Пошук...',
    searchValue = '',
    onSearch, // callback(value)

    showExtraSelect = false,
    extraSelectId = 'extra-select',
    extraSelectValue = '',
    extraSelectOptions = [], // array of { value, label }
    onExtraSelectChange, // callback(value)

    showSort = true,
    sortId = 'sort-select',
    sortValue = '',
    sortOptions = [], // array of { value, label }
    onSortChange, // callback(value)

    showSortOrder = true,
    sortOrderId = 'sort-order-btn',
    sortOrderValue = 'desc', // 'asc'|'desc'
    onSortOrderChange, // callback(direction)

    showFiltersBtn = false,
    filtersBtnId = 'open-filters-btn',
    filtersBtnActive = false,
    onFiltersBtnClick, // callback()
}) {
    if (!container) return null;

    const defaultOpt = extraSelectOptions.find(o => o.value === extraSelectValue) || extraSelectOptions[0] || { value: '', label: '' };
    const defaultOptMeta = LIST_COLORS[defaultOpt.value] || { color: '#64748b', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' };
    const defaultOptIcon = LIST_ICONS[defaultOpt.value] || '';

    container.innerHTML = `
        <div class="filter-bar">
            ${showResults ? `
                <div class="filter-section results-section">
                    <div class="results-label">${escapeHtmlAttribute(resultsLabel)}</div>
                    <div class="results-value" data-filter-bar-count>${resultsCount.toLocaleString('uk-UA')}</div>
                </div>
            ` : ''}

            ${showSearch ? `
                <div class="filter-section search-section">
                    <div class="search-inner">
                        <span class="search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input type="text" placeholder="${escapeHtmlAttribute(searchPlaceholder)}" class="search-input-pill" data-filter-bar-search value="${escapeHtmlAttribute(searchValue)}" autocomplete="off">
                        <div class="search-suggestions" data-search-suggestions hidden></div>
                    </div>
                </div>
            ` : ''}

            <div class="filter-section filters-section">
                ${showExtraSelect ? `
                    <div class="filter-group">
                        <select class="filter-select readlist-select" id="${escapeHtmlAttribute(extraSelectId)}">
                            <button>
                                <span class="readlist-select-chosen">
                                    <span class="readlist-icon" style="color: ${defaultOptMeta.color}">${defaultOptIcon}</span>
                                    <span class="select-label">${escapeHtmlAttribute(defaultOpt.label)}</span>
                                </span>
                                <span class="select-chevron-v">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                                </span>
                            </button>
                            ${extraSelectOptions.map(opt => {
                                const meta = LIST_COLORS[opt.value] || { color: '#64748b' };
                                const icon = LIST_ICONS[opt.value] || '';
                                return `
                                    <option value="${opt.value}"${opt.value === extraSelectValue ? ' selected' : ''}>
                                        <span class="readlist-icon" style="color: ${meta.color}">${icon}</span>
                                        <span>${escapeHtmlAttribute(opt.label)}</span>
                                    </option>
                                `;
                            }).join('')}
                        </select>
                    </div>
                ` : ''}

                ${showSort ? `
                    <div class="catalog-sort-slot" id="catalog-sort-quick-slot">
                        <div class="filter-group" id="catalog-sort-controls">
                            <select class="filter-select" id="${escapeHtmlAttribute(sortId)}">
                                <button>
                                    <span class="select-label">${escapeHtmlAttribute(sortOptions.find(o => o.value === sortValue)?.label || sortOptions[0]?.label || '')}</span>
                                    <span class="select-chevron-v">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                                    </span>
                                </button>
                                ${sortOptions.map(opt => `
                                    <option value="${opt.value}"${opt.value === sortValue ? ' selected' : ''}>
                                        <span>${escapeHtmlAttribute(opt.label)}</span>
                                    </option>
                                `).join('')}
                            </select>

                            ${showSortOrder ? `
                                <button class="filter-btn-icon sort-order-btn" id="${escapeHtmlAttribute(sortOrderId)}" type="button">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" data-sort-order-icon>
                                        ${sortOrderValue === 'asc' 
                                            ? '<path d="M5 6h6M5 12h10M5 18h14"/>' 
                                            : '<path d="M5 6h14M5 12h10M5 18h6"/>'
                                        }
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${showFiltersBtn ? `
                    <button class="filter-btn-icon btn-filters-panel ${filtersBtnActive ? 'is-active' : ''}" id="${escapeHtmlAttribute(filtersBtnId)}" title="Фільтри" aria-expanded="${filtersBtnActive}">
                        ${filtersBtnActive ? `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="5" y="4" width="14" height="16" rx="2"/>
                                <path d="M10 4v16"/>
                                <path d="m13 9 3 3-3 3"/>
                            </svg>
                        ` : `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="5" y="4" width="14" height="16" rx="2"/>
                                <path d="M10 4v16"/>
                                <path d="m16 9-3 3 3 3"/>
                            </svg>
                        `}
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    // ── Element references ─────────────────────────────
    const countEl = container.querySelector('[data-filter-bar-count]');
    const searchInput = container.querySelector('[data-filter-bar-search]');
    const suggestionsEl = container.querySelector('[data-search-suggestions]');
    const extraSelect = container.querySelector(`#${extraSelectId}`);
    const sortSelect = container.querySelector(`#${sortId}`);
    const sortOrderBtn = container.querySelector(`#${sortOrderId}`);
    const filtersBtn = container.querySelector(`#${filtersBtnId}`);

    // ── Suggestions Logic ──────────────────────────────
    let suggestionsFuse = null;
    let suggestionsData = [];

    const showSuggestions = async (query) => {
        if (!query || query.length < 2) {
            suggestionsEl.hidden = true;
            return;
        }

        try {
            // Fetch a small batch of potential matches from backend
            const data = await API.get('/catalog', { search: query, limit: 30 });
            suggestionsData = data.items || [];
            
            if (suggestionsData.length === 0) {
                suggestionsEl.hidden = true;
                return;
            }

            // Use Fuse.js to rank/filter the suggestions for better fuzzy matching on the client
            suggestionsFuse = new Fuse(suggestionsData, {
                keys: ['name', 'name_en', 'name_uk'],
                threshold: 0.4,
                includeMatches: true
            });

            const results = suggestionsFuse.search(query);
            const itemsToShow = results.length > 0 ? results.map(r => r.item) : suggestionsData.slice(0, 8);

            suggestionsEl.innerHTML = itemsToShow.slice(0, 8).map(item => `
                <div class="suggestion-item" data-suggestion-id="${item.id}" data-suggestion-type="${item.type || 'volume'}">
                    <div class="suggestion-name">${escapeHtmlAttribute(item.name)}</div>
                    <div class="suggestion-meta">${item.publisher_name || ''} ${item.start_year ? `(${item.start_year})` : ''}</div>
                </div>
            `).join('');
            suggestionsEl.hidden = false;
        } catch (err) {
            console.error('Suggestions error:', err);
            suggestionsEl.hidden = true;
        }
    };

    // ── Helper to sync extra readlist select style ──────
    const syncExtraSelectStyle = () => {
        if (!extraSelect) return;
        const val = extraSelect.value;
        const opt = extraSelectOptions.find(o => o.value === val) || { value: '', label: '' };
        const meta = LIST_COLORS[val] || { color: '#64748b', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' };
        const icon = LIST_ICONS[val] || '';

        const iconEl = extraSelect.querySelector('.readlist-select-chosen .readlist-icon');
        const labelEl = extraSelect.querySelector('.readlist-select-chosen .select-label');
        if (iconEl) { iconEl.innerHTML = icon; iconEl.style.color = meta.color; }
        if (labelEl) labelEl.textContent = opt.label;

        if (meta.bg) {
            extraSelect.style.setProperty('background-color', meta.bg, 'important');
        } else {
            extraSelect.style.removeProperty('background-color');
        }
        if (meta.borderColor) {
            extraSelect.style.setProperty('border-color', meta.borderColor, 'important');
        } else {
            extraSelect.style.removeProperty('border-color');
        }
    };

    if (extraSelect) {
        syncExtraSelectStyle();
    }

    // ── Bind events ────────────────────────────────────
    if (searchInput && onSearch) {
        let searchTimer = null;
        let suggestionTimer = null;

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            clearTimeout(searchTimer);
            clearTimeout(suggestionTimer);

            searchTimer = setTimeout(() => {
                onSearch(val);
            }, 500); // Increased debounce for main search

            suggestionTimer = setTimeout(() => {
                showSuggestions(val.trim());
            }, 200);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                clearTimeout(suggestionTimer);
                suggestionsEl.hidden = true;
                onSearch(searchInput.value);
            }
        });
    }

    if (suggestionsEl) {
        suggestionsEl.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (!item) return;

            const id = item.dataset.suggestionId;
            const type = item.dataset.suggestionType;
            
            if (type === 'volume') {
                window.location.hash = `#/volumes/${id}`;
            } else {
                // For issues or other types, we might just set search query
                searchInput.value = item.querySelector('.suggestion-name').textContent;
                onSearch(searchInput.value);
            }
            suggestionsEl.hidden = true;
        });
    }

    document.addEventListener('click', (e) => {
        if (searchInput && !searchInput.contains(e.target) && suggestionsEl && !suggestionsEl.contains(e.target)) {
            suggestionsEl.hidden = true;
        }
    });

    if (extraSelect && onExtraSelectChange) {
        extraSelect.addEventListener('change', (e) => {
            syncExtraSelectStyle();
            onExtraSelectChange(e.target.value);
        });
    }

    if (sortSelect && onSortChange) {
        sortSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const label = sortSelect.querySelector('.select-label');
            if (label) {
                label.textContent = sortOptions.find(o => o.value === val)?.label || '';
            }
            onSortChange(val);
        });
    }

    if (sortOrderBtn && onSortOrderChange) {
        sortOrderBtn.addEventListener('click', () => {
            const iconSvg = sortOrderBtn.querySelector('[data-sort-order-icon]');
            const isDesc = iconSvg.querySelector('path[d*="M5 6h14"]') || !iconSvg.querySelector('path[d*="M5 6h6"]');
            const nextOrder = isDesc ? 'asc' : 'desc';
            
            if (nextOrder === 'asc') {
                iconSvg.innerHTML = '<path d="M5 6h6M5 12h10M5 18h14"/>';
            } else {
                iconSvg.innerHTML = '<path d="M5 6h14M5 12h10M5 18h6"/>';
            }
            onSortOrderChange(nextOrder);
        });
    }

    if (filtersBtn && onFiltersBtnClick) {
        filtersBtn.addEventListener('click', () => {
            onFiltersBtnClick();
        });
    }

    return {
        updateCount(newCount) {
            if (countEl) {
                countEl.textContent = newCount.toLocaleString('uk-UA');
            }
        },
        setSearchValue(val) {
            if (searchInput) searchInput.value = val;
        },
        setExtraSelectValue(val) {
            if (extraSelect) {
                extraSelect.value = val;
                syncExtraSelectStyle();
            }
        },
        setSortValue(val) {
            if (sortSelect) {
                sortSelect.value = val;
                const label = sortSelect.querySelector('.select-label');
                if (label) {
                    label.textContent = sortOptions.find(o => o.value === val)?.label || '';
                }
            }
        },
        setSortOrder(order) {
            if (sortOrderBtn) {
                const iconSvg = sortOrderBtn.querySelector('[data-sort-order-icon]');
                if (order === 'asc') {
                    iconSvg.innerHTML = '<path d="M5 6h6M5 12h10M5 18h14"/>';
                } else {
                    iconSvg.innerHTML = '<path d="M5 6h14M5 12h10M5 18h6"/>';
                }
            }
        },
        setFiltersBtnActive(active) {
            if (filtersBtn) {
                filtersBtn.classList.toggle('is-active', active);
                filtersBtn.setAttribute('aria-expanded', String(active));
                filtersBtn.innerHTML = active ? `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="4" width="14" height="16" rx="2"/>
                        <path d="M10 4v16"/>
                        <path d="m13 9 3 3-3 3"/>
                    </svg>
                ` : `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="4" width="14" height="16" rx="2"/>
                        <path d="M10 4v16"/>
                        <path d="m16 9-3 3 3 3"/>
                    </svg>
                `;
            }
        }
    };
}
