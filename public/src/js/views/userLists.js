import { API } from '../helpers/api.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';

function getVolumeListLabels() {
    return {
        'Planned': t('list_planned'),
        'Reading': t('list_reading'),
        'Completed': t('list_completed'),
        'On Hold': t('list_on_hold'),
        'Dropped': t('list_dropped')
    };
}

function getIssueListLabels() {
    return {
        'Planned': t('list_planned'),
        'Completed': t('list_completed')
    };
}

function getSortOptions() {
    return [
        { value: 'name', label: t('sort_name') },
        { value: 'recent', label: t('sort_recent') },
    ];
}

let allListItems = {};
let filteredItems = [];
let currentListType = 'all';
let currentTab = 'volume';
let searchQuery = '';
let sortField = 'recent';
let sortOrder = 'desc';
let filterBar = null;

export async function renderUserLists(main, params, query = {}) {
    const username = params.username;
    currentTab = query.tab || 'volume';
    document.title = `${t('user_lists_label')} ${username} — Drawn Stories`;

    currentListType = query.list || 'all';
    searchQuery = ''; // Reset search on new navigation

    renderLayout(main, username);

    try {
        const data = await API.get(`/user/readlist/user/${username}?content_type=${currentTab}`);
        allListItems = data.lists || {};
        applyFilters();
        renderResults();
    } catch (err) {
        main.querySelector('#user-lists-results').innerHTML = `<div class="error-state">${t('error_label')}: ${escapeHtmlAttribute(err.message)}</div>`;
    }
}

function renderLayout(main, username) {
    const currentLabels = currentTab === 'issue' ? getIssueListLabels() : getVolumeListLabels();
    const listOptions = [
        { value: 'all', label: t('list_all') },
        ...Object.entries(currentLabels).map(([value, label]) => ({ value, label }))
    ];

    if (currentTab === 'issue' && !['all', 'Planned', 'Completed'].includes(currentListType)) {
        currentListType = 'all';
    }

    main.innerHTML = `
        <div class="container">
            <div class="page-header">
                ${createBreadcrumbs([
                    { label: t('user_lists_label') },
                    { label: escapeHtmlAttribute(username) }
                ])}
                <h1 class="page-title">${t('user_lists_label')} ${escapeHtmlAttribute(username)}</h1>
            </div>
            <div class="catalog-top-row" style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <div id="catalog-filter-bar-container" style="flex: 1; min-width: 280px;">
                    <div id="user-lists-filter-bar-container"></div>
                </div>
                <div class="catalog-primary-actions" aria-label="Тип контенту" style="margin-left: auto;">
                    <div class="catalog-segmented" role="group" aria-label="Тип контенту">
                        <button class="catalog-segment ${currentTab === 'volume' ? 'is-active' : ''}" type="button" data-tab-type="volume">${t('series')}</button>
                        <button class="catalog-segment ${currentTab === 'issue' ? 'is-active' : ''}" type="button" data-tab-type="issue">${t('section_issues')}</button>
                    </div>
                </div>
            </div>

            <div id="user-lists-results" class="catalog-results">
                <div class="loader-container"><div class="loader"></div></div>
            </div>
        </div>
    `;

    filterBar = mountFilterBar(main.querySelector('#user-lists-filter-bar-container'), {
        resultsCount: 0,
        resultsLabel: t('found_count'),
        showResults: true,
        showSearch: true,
        searchPlaceholder: t('search_in_lists'),
        searchValue: searchQuery,
        
        showExtraSelect: true,
        extraSelectId: 'user-list-type-select',
        extraSelectValue: currentListType,
        extraSelectOptions: listOptions,
        onExtraSelectChange: (val) => {
            currentListType = val;
            applyFilters();
            renderResults();
        },

        showSort: true,
        sortId: 'user-lists-sort',
        sortValue: sortField,
        sortOptions: getSortOptions(),
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

    const tabButtons = main.querySelectorAll('[data-tab-type]');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tabType;
            if (tab === currentTab) return;
            location.hash = `#/user/${username}/lists?tab=${tab}`;
        });
    });
}

function applyFilters() {
    let items = [];
    if (currentListType === 'all') {
        Object.entries(allListItems).forEach(([listType, list]) => {
            list.forEach(item => {
                if (!item.list_name) item.list_name = listType;
            });
            items = items.concat(list);
        });
        const seen = new Set();
        items = items.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    } else {
        items = allListItems[currentListType] || [];
        items.forEach(item => {
            if (!item.list_name) item.list_name = currentListType;
        });
    }

    if (searchQuery) {
        items = items.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchQuery)) || 
            (item.name_uk && item.name_uk.toLowerCase().includes(searchQuery)) ||
            (item.publisher_name && item.publisher_name.toLowerCase().includes(searchQuery)) ||
            (item.volume_name && item.volume_name.toLowerCase().includes(searchQuery)) ||
            (item.volume_name_uk && item.volume_name_uk.toLowerCase().includes(searchQuery))
        );
    }

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
                <h3>${t('nothing_found')}</h3>
            </div>`;
        return;
    }

    grid.innerHTML = '<div class="comic-grid"></div>';
    const gridInner = grid.querySelector('.comic-grid');
    filteredItems.forEach(item => {
        gridInner.appendChild(createComicCard(item));
    });
}
