import { API } from '../helpers/api.js';
import { createComicCard } from '../components/ComicCard.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { mountFilterBar } from '../components/FilterBar.js';

const LIST_LABELS = {
    'Planned': 'Заплановано',
    'Reading': 'Читаю',
    'Completed': 'Прочитано',
    'On Hold': 'Відкладено',
    'Dropped': 'Закинуто'
};

const LIST_OPTIONS = [
    { value: 'all', label: 'Усі списки' },
    ...Object.entries(LIST_LABELS).map(([value, label]) => ({ value, label }))
];

const SORT_OPTIONS = [
    { value: 'name', label: 'За назвою' },
    { value: 'recent', label: 'За датою додавання' },
];

let allListItems = {};
let filteredItems = [];
let currentListType = 'all';
let searchQuery = '';
let sortField = 'recent';
let sortOrder = 'desc';
let filterBar = null;

export async function renderUserLists(main, params, query = {}) {
    const username = params.username;
    document.title = `Списки ${username} — Drawn Stories`;

    currentListType = query.list || 'all';
    searchQuery = ''; // Reset search on new navigation

    renderLayout(main, username);

    try {
        const data = await API.get(`/user/readlist/user/${username}`);
        allListItems = data.lists || {};
        applyFilters();
        renderResults();
    } catch (err) {
        main.querySelector('#user-lists-results').innerHTML = `<div class="error-state">Помилка: ${escapeHtmlAttribute(err.message)}</div>`;
    }
}

function renderLayout(main, username) {
    main.innerHTML = `
        <div class="container">
            <div class="page-header">
                <nav class="breadcrumbs" aria-label="Навігація">
                    <a href="#/">Drawn Stories</a>
                    <span class="breadcrumb-separator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </span>
                    <span>Користувач</span>
                    <span class="breadcrumb-separator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </span>
                    <span>${escapeHtmlAttribute(username)}</span>
                </nav>
            </div>

            <div class="catalog-top-row">
                <div id="catalog-filter-bar-container">
                    <div id="user-lists-filter-bar-container"></div>
                </div>
            </div>

            <div id="user-lists-results" class="catalog-results">
                <div class="loader-container"><div class="loader"></div></div>
            </div>
        </div>
    `;

    filterBar = mountFilterBar(main.querySelector('#user-lists-filter-bar-container'), {
        resultsCount: 0,
        resultsLabel: 'Знайдено',
        showResults: true,
        showSearch: true,
        searchPlaceholder: 'Пошук у списках...',
        searchValue: searchQuery,
        
        showExtraSelect: true,
        extraSelectId: 'user-list-type-select',
        extraSelectValue: currentListType,
        extraSelectOptions: LIST_OPTIONS,
        onExtraSelectChange: (val) => {
            currentListType = val;
            applyFilters();
            renderResults();
        },

        showSort: true,
        sortId: 'user-lists-sort',
        sortValue: sortField,
        sortOptions: SORT_OPTIONS,
        showSortOrder: true,
        sortOrderId: 'user-lists-sort-order',
        sortOrderValue: sortOrder,
        onSortChange: (val) => {
            sortField = val;
            applyFilters();
            renderResults();
        },
        onSortOrderChange: (dir) => {
            sortOrder = dir;
            applyFilters();
            renderResults();
        },
        onSearch: (val) => {
            searchQuery = val.toLowerCase();
            applyFilters();
            renderResults();
        }
    });
}

function applyFilters() {
    let items = [];
    if (currentListType === 'all') {
        Object.values(allListItems).forEach(list => {
            items = items.concat(list);
        });
        // Remove duplicates if a volume is in multiple lists (e.g. Planned and Favorites)
        const seen = new Set();
        items = items.filter(item => {
            const duplicate = seen.has(item.id);
            seen.add(item.id);
            return !duplicate;
        });
    } else {
        items = allListItems[currentListType] || [];
    }

    if (searchQuery) {
        items = items.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchQuery)) || 
            (item.name_uk && item.name_uk.toLowerCase().includes(searchQuery)) ||
            (item.publisher_name && item.publisher_name.toLowerCase().includes(searchQuery))
        );
    }

    // Sort items client-side
    items.sort((a, b) => {
        let valA = sortField === 'recent' ? (a.added_at || a.id || 0) : (a.name_uk || a.name || '');
        let valB = sortField === 'recent' ? (b.added_at || b.id || 0) : (b.name_uk || b.name || '');

        if (typeof valA === 'string') {
            return sortOrder === 'asc'
                ? valA.localeCompare(valB, 'uk', { numeric: true })
                : valB.localeCompare(valA, 'uk', { numeric: true });
        } else {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
    });

    filteredItems = items;
}

function renderResults() {
    const grid = document.getElementById('user-lists-results');
    if (!grid) return;

    if (filterBar) {
        filterBar.updateCount(filteredItems.length);
    }

    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                <h3>Нічого не знайдено</h3>
            </div>`;
        return;
    }

    grid.innerHTML = '<div class="comic-grid"></div>';
    const gridInner = grid.querySelector('.comic-grid');
    filteredItems.forEach(item => {
        gridInner.appendChild(createComicCard(item));
    });
}
