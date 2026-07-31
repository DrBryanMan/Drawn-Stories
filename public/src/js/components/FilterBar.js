import { escapeHtmlAttribute } from '../helpers/image.js';
import { t } from '../helpers/i18n.js';
import { icon } from '../helpers/icons.js';

const LIST_COLORS = {
    'all': { color: 'var(--status-default)', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
    'Planned': { color: 'var(--status-planned)', bg: 'color-mix(in srgb, var(--status-planned) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-planned) 20%, var(--border-s))' },
    'Reading': { color: 'var(--status-reading)', bg: 'color-mix(in srgb, var(--status-reading) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-reading) 20%, var(--border-s))' },
    'Completed': { color: 'var(--status-completed)', bg: 'color-mix(in srgb, var(--status-completed) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-completed) 20%, var(--border-s))' },
    'On Hold': { color: 'var(--status-on-hold)', bg: 'color-mix(in srgb, var(--status-on-hold) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-on-hold) 20%, var(--border-s))' },
    'Dropped': { color: 'var(--status-dropped)', bg: 'color-mix(in srgb, var(--status-dropped) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-dropped) 20%, var(--border-s))' },
    'favorites': { color: '#e11d48', bg: 'color-mix(in srgb, #e11d48 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #e11d48 20%, var(--border-s))' }
};

// ── Рендеринг результатів ───────────────────────────────────
function renderResults(showResults, resultsLabel, resultsCount) {
    if (!showResults) return '';
    return `
        <div class="filter-section results-section">
            <div class="results-label">${escapeHtmlAttribute(resultsLabel)}</div>
            <div class="results-value" data-filter-bar-count>${resultsCount.toLocaleString('uk-UA')}</div>
        </div>
    `;
}

// ── Рендеринг пошуку ─────────────────────────────────────────
function renderSearch(showSearch, searchPlaceholder, searchValue) {
    if (!showSearch) return '';
    return `
        <div class="filter-section search-section">
            <div class="search-inner">
                <span class="search-icon">
                    ${icon('search', 15, { strokeWidth: 2.5 })}
                </span>
                <input type="text" placeholder="${escapeHtmlAttribute(searchPlaceholder)}" class="search-input-pill" data-filter-bar-search value="${escapeHtmlAttribute(searchValue)}" autocomplete="off">
            </div>
        </div>
    `;
}

// ── Рендеринг додаткового селекту (напр. Списків користувача) ──
function renderExtraSelect(showExtraSelect, extraSelectId, extraSelectValue, extraSelectOptions) {
    if (!showExtraSelect) return '';
    const defaultOpt = extraSelectOptions.find(o => o.value === extraSelectValue) || extraSelectOptions[0] || { value: '', label: '' };
    const defaultOptMeta = LIST_COLORS[defaultOpt.value] || { color: '#64748b', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' };
    const defaultOptIcon = icon(defaultOpt.value, 14, { strokeWidth: 2.2 });

    return `
        <div class="filter-group">
            <select class="filter-select readlist-select" id="${escapeHtmlAttribute(extraSelectId)}">
                <button>
                    <span class="readlist-select-chosen">
                        <span class="readlist-icon" style="color: ${defaultOptMeta.color}">${defaultOptIcon}</span>
                        <span class="select-label">${escapeHtmlAttribute(defaultOpt.label)}</span>
                    </span>
                    <span class="select-chevron-v">
                        ${icon('chevronUpDown', 14)}
                    </span>
                </button>
                ${extraSelectOptions.map(opt => {
                    const meta = LIST_COLORS[opt.value] || { color: '#64748b' };
                    const optIconHtml = icon(opt.value, 14, { strokeWidth: 2.2 });
                    return `
                        <option value="${opt.value}"${opt.value === extraSelectValue ? ' selected' : ''}>
                            <span class="readlist-icon" style="color: ${meta.color}">${optIconHtml}</span>
                            <span>${escapeHtmlAttribute(opt.label)}</span>
                        </option>
                    `;
                }).join('')}
            </select>
        </div>
    `;
}

// ── Рендеринг сортування та порядку ─────────────────────────
function renderSort(showSort, sortId, sortValue, sortOptions, showSortOrder, sortOrderId, sortOrderValue) {
    if (!showSort) return '';
    return `
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
    `;
}

// ── Рендеринг кнопки відкриття панелі фільтрів ───────────────
function renderFiltersBtn(showFiltersBtn, filtersBtnId, filtersBtnActive) {
    if (!showFiltersBtn) return '';
    const svgIcon = icon(filtersBtnActive ? 'sidebarOpen' : 'sidebarClose', 18);
    return `
        <button class="filter-btn-icon btn-filters-panel ${filtersBtnActive ? 'is-active' : ''}" id="${escapeHtmlAttribute(filtersBtnId)}" title="Фільтри" aria-expanded="${filtersBtnActive}">
            ${svgIcon}
        </button>
    `;
}

// ── Головна функція монтування компонента ────────────────────
export function mountFilterBar(container, {
    resultsCount = 0,
    resultsLabel = t('found_count'),
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
    extraMiddleHtml = '',
}) {
    if (!container) return null;

    container.innerHTML = `
        <div class="filter-bar">
            ${renderResults(showResults, resultsLabel, resultsCount)}
            ${renderSearch(showSearch, searchPlaceholder, searchValue)}

            <div class="filter-section filters-section">
                ${renderExtraSelect(showExtraSelect, extraSelectId, extraSelectValue, extraSelectOptions)}
                
                ${extraMiddleHtml ? `
                    <div class="filter-group" style="overflow: visible; background: transparent; border: 0;">
                        ${extraMiddleHtml}
                    </div>
                ` : ''}

                ${renderSort(showSort, sortId, sortValue, sortOptions, showSortOrder, sortOrderId, sortOrderValue)}
                ${renderFiltersBtn(showFiltersBtn, filtersBtnId, filtersBtnActive)}
            </div>
        </div>
    `;

    // ── Element references ─────────────────────────────
    const countEl = container.querySelector('[data-filter-bar-count]');
    const searchInput = container.querySelector('[data-filter-bar-search]');
    const extraSelect = container.querySelector(`#${extraSelectId}`);
    const sortSelect = container.querySelector(`#${sortId}`);
    const sortOrderBtn = container.querySelector(`#${sortOrderId}`);
    const filtersBtn = container.querySelector(`#${filtersBtnId}`);

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

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            clearTimeout(searchTimer);

            searchTimer = setTimeout(() => {
                onSearch(val);
            }, 500); // Debounce for main search
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                onSearch(searchInput.value);
            }
        });
    }

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
                filtersBtn.innerHTML = icon(active ? 'sidebarOpen' : 'sidebarClose', 18);
            }
        }
    };
}
