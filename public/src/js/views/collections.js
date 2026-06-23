import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';

const icon = (d, size = 16, strokeWidth = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON = {
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    listPlus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 10v6"/><path d="M15 13h6"/>'
};

let allVolumes = [];
let searchQuery = '';
let activeTab = 'get'; // 'get', 'wanted', 'barter'
let currentType = 'collection'; // 'collection', 'issue'
let hideMissing = false;

export async function renderCollections(main, params) {
    const username = params.username;
    const isMyCollection = !username || (currentUser && currentUser.username === username);
    document.title = username ? `Колекція ${username} — Drawn Stories` : `Моя колекція — Drawn Stories`;

    main.innerHTML = `
        <div class="container">
            <div class="page-header">
                ${createBreadcrumbs([
                    { label: 'Користувач' },
                    { label: escapeHtmlAttribute(username || 'Я') },
                    { label: 'Колекція' }
                ])}
                <h1 class="page-title">${username ? `Колекція ${escapeHtmlAttribute(username)}` : 'Моя колекція'}</h1>
            </div>

            <div class="collection-controls-row" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px;">
                <div class="collection-segmented-wrap" style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    <div class="catalog-segmented" role="group" aria-label="Тип контенту" id="collection-type-segmented">
                        <button class="catalog-segment ${currentType === 'collection' ? 'is-active' : ''}" data-type="collection">Збірники</button>
                        <button class="catalog-segment ${currentType === 'issue' ? 'is-active' : ''}" data-type="issue">Випуски</button>
                    </div>
                    <div class="collection-segmented" id="collection-tab-segmented">
                        <button class="collection-segment ${activeTab === 'get' ? 'is-active' : ''}" data-tab="get">Колекція</button>
                        <button class="collection-segment ${activeTab === 'wanted' ? 'is-active' : ''}" data-tab="wanted">Бажане</button>
                        <button class="collection-segment ${activeTab === 'barter' ? 'is-active' : ''}" data-tab="barter">Бартер</button>
                    </div>
                </div>
                
                <div class="collection-controls">
                    <div style="display: flex; gap: 16px; align-items: center; flex: 1; flex-wrap: wrap;">
                        <div class="collection-search-wrap" style="flex: 1; max-width: 320px;">
                            <span class="search-icon">${icon(ICON.search, 18, 2.5)}</span>
                            <input type="text" id="collection-search" placeholder="Пошук у колекції..." value="${escapeHtmlAttribute(searchQuery)}">
                        </div>
                        <label class="collection-hide-missing-label" style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: var(--text-2, #4b5563); user-select: none;">
                            <input type="checkbox" id="collection-hide-missing-chk" ${hideMissing ? 'checked' : ''} style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border-color, #d1d5db); cursor: pointer; accent-color: var(--accent-color, #2563eb);">
                            <span>Приховати відсутні</span>
                        </label>
                    </div>
                    <div class="collection-stats">
                        <div class="collection-stat-item">
                            <span class="collection-stat-icon">${icon(ICON.book, 18, 2)}</span>
                            <div class="collection-stat-details">
                                <span class="collection-stat-label">Серій:</span>
                                <span class="collection-stat-value" id="stat-series">0</span>
                            </div>
                        </div>
                        <div class="collection-stat-item">
                            <span class="collection-stat-icon">${icon(ICON.layers, 18, 2)}</span>
                            <div class="collection-stat-details">
                                <span class="collection-stat-label" id="stat-label-collections">Збірників:</span>
                                <span class="collection-stat-value" id="stat-collections">0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="collections-results" class="collections-list">
                <div class="loader-container"><div class="loader"></div></div>
            </div>
        </div>
    `;

    const loadDataAndRender = async () => {
        const resultsEl = main.querySelector('#collections-results');
        if (resultsEl) {
            resultsEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        }
        const apiParams = username ? { username } : {};
        apiParams.content_type = currentType;
        allVolumes = await API.get(`/collections`, apiParams);
        updateStats();
        renderResults(main, isMyCollection);
    };

    try {
        await loadDataAndRender();

        // Content type events
        main.querySelectorAll('#collection-type-segmented .catalog-segment').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentType = btn.getAttribute('data-type');
                main.querySelectorAll('#collection-type-segmented .catalog-segment').forEach(b => b.classList.toggle('is-active', b === btn));
                
                // Update stats label
                const labelEl = main.querySelector('#stat-label-collections');
                if (labelEl) {
                    labelEl.textContent = currentType === 'issue' ? 'Випусків:' : 'Збірників:';
                }
                
                await loadDataAndRender();
            });
        });

        // Tab events
        main.querySelectorAll('#collection-tab-segmented .collection-segment').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.getAttribute('data-tab');
                main.querySelectorAll('#collection-tab-segmented .collection-segment').forEach(b => b.classList.toggle('is-active', b === btn));
                renderResults(main, isMyCollection);
                updateStats();
            });
        });

        const searchInput = main.querySelector('#collection-search');
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderResults(main, isMyCollection);
            updateStats();
        });

        const hideMissingChk = main.querySelector('#collection-hide-missing-chk');
        if (hideMissingChk) {
            hideMissingChk.addEventListener('change', (e) => {
                hideMissing = e.target.checked;
                renderResults(main, isMyCollection);
            });
        }
    } catch (err) {
        main.querySelector('#collections-results').innerHTML = `<div class="error-state">Помилка: ${err.message}</div>`;
    }
}

function updateStats() {
    // Stats should only count items that actually exist in the current tab/status
    const filteredItems = allVolumes.map(vol => ({
        ...vol,
        items: vol.items.filter(item => {
            if (activeTab === 'barter') return item.barter === true;
            return item.status === activeTab;
        })
    })).filter(vol => vol.items.length > 0);

    const seriesCount = filteredItems.length;
    const collectionsCount = filteredItems.reduce((acc, vol) => acc + vol.items.length, 0);

    const sEl = document.getElementById('stat-series');
    const cEl = document.getElementById('stat-collections');
    if (sEl) sEl.textContent = seriesCount;
    if (cEl) cEl.textContent = collectionsCount;
}

function renderResults(main, isMyCollection = true) {
    const container = main.querySelector('#collections-results');

    // Filter logic:
    // A volume is shown if it contains at least one item matching the current tab criteria.
    let filtered = allVolumes.map(vol => {
        const matchingItems = vol.items.filter(item => {
            if (activeTab === 'barter') return item.barter === true;
            return item.status === activeTab;
        });
        return { ...vol, hasMatch: matchingItems.length > 0 };
    }).filter(vol => vol.hasMatch);

    if (searchQuery) {
        filtered = filtered.filter(vol =>
            (vol.name_uk && vol.name_uk.toLowerCase().includes(searchQuery)) ||
            (vol.name && vol.name.toLowerCase().includes(searchQuery)) ||
            (vol.publisher_name && vol.publisher_name.toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                ${icon(ICON.layers, 48, 1.5)}
                <h3>Список порожній</h3>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(volume => {
        const totalCount = volume.items.length;
        const ownedCount = volume.items.filter(item => item.status === 'get').length;
        const percentage = totalCount > 0 ? (ownedCount / totalCount) * 100 : 0;

        return `
            <div class="collection-volume-card">
                <div class="volume-info">
                    <div class="volume-info-left">
                        <h2 class="volume-title">
                            <a href="#/volumes/${volume.id}">${escapeHtmlAttribute(volume.name_uk || volume.name)}</a>
                        </h2>
                        <div class="volume-publisher">${escapeHtmlAttribute(volume.publisher_name || 'Невідоме')}</div>
                    </div>
                    ${isMyCollection ? `
                        <div class="volume-info-right">
                            <div class="volume-progress-row">
                                ${ownedCount < totalCount ? `
                                    <button class="volume-add-all-btn" data-volume-id="${volume.id}" title="Додати всі">
                                        ${icon(ICON.listPlus, 16)}
                                    </button>
                                ` : ''}
                                <span class="volume-progress-text">${ownedCount}/${totalCount}</span>
                                <div class="volume-progress-bar-track">
                                    <div class="volume-progress-bar-fill" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="collection-items">
                    ${volume.items.filter(item => {
                        if (!hideMissing) return true;
                        if (activeTab === 'get') return item.status === 'get';
                        if (activeTab === 'wanted') return item.status === 'wanted';
                        if (activeTab === 'barter') return item.barter === true;
                        return true;
                    }).map(item => {
                        const isOwned = item.status === 'get';
                        
                        // Logic for visual state in the current tab
                        let isActiveInTab = false;
                        if (activeTab === 'get') isActiveInTab = (item.status === 'get');
                        else if (activeTab === 'wanted') isActiveInTab = (item.status === 'wanted');
                        else if (activeTab === 'barter') isActiveInTab = (item.barter === true);

                        const itemUrl = currentType === 'issue' ? `#/issues/${item.id}` : `#/collections/${item.id}`;

                        return `
                            <div class="collection-item-wrapper ${isActiveInTab ? 'is-owned' : ''}">
                                <div class="collection-item-thumb">
                                    <a href="${itemUrl}">
                                        ${item.cv_img 
                                            ? `<img src="${comicVineImageUrl(item.cv_img)}" alt="${escapeHtmlAttribute(item.name)}">`
                                            : `<div class="empty-thumb">${icon(ICON.book, 24)}</div>`}
                                    </a>
                                    <div class="item-number">#${escapeHtmlAttribute(item.issue_number || '—')}</div>
                                    ${isMyCollection ? `
                                        <div class="item-overlay">
                                            <button class="toggle-collection-btn ${isOwned ? 'btn-remove' : 'btn-add'}" 
                                                    data-id="${item.id}" 
                                                    title="${isOwned ? 'Видалити з колекції' : 'Додати в колекцію'}">
                                                ${isOwned ? icon(ICON.trash, 14) : icon(ICON.plus, 14)}
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="item-name" title="${escapeHtmlAttribute(item.name)}">${escapeHtmlAttribute(item.name)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    // --- Add Toggle Listeners ---
    if (isMyCollection) {
        container.querySelectorAll('.toggle-collection-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const collectionId = btn.getAttribute('data-id');
                btn.disabled = true;

                try {
                    // Clicking toggle always targets the 'get' status for the main collection
                    if (currentType === 'issue') {
                        await API.post('/collections/issue/toggle', { issue_id: Number(collectionId), status: 'get' });
                    } else {
                        await API.post('/collections/toggle', { collection_id: Number(collectionId), status: 'get' });
                    }
                    
                    // Full refresh to ensure volume grouping is correct
                    const apiParams = currentUser ? { username: currentUser.username } : {};
                    apiParams.content_type = currentType;
                    allVolumes = await API.get(`/collections`, apiParams);
                    updateStats();
                    renderResults(main, isMyCollection);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                    btn.disabled = false;
                }
            });
        });

        // Add-all buttons listeners
        container.querySelectorAll('.volume-add-all-btn, .volume-add-all-text-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const volumeId = btn.getAttribute('data-volume-id');
                btn.disabled = true;

                try {
                    if (currentType === 'issue') {
                        await API.post('/collections/issue/add-all-from-volume', { volume_id: Number(volumeId) });
                    } else {
                        await API.post('/collections/add-all-from-volume', { volume_id: Number(volumeId) });
                    }
                    
                    // Refresh data
                    const apiParams = currentUser ? { username: currentUser.username } : {};
                    apiParams.content_type = currentType;
                    allVolumes = await API.get(`/collections`, apiParams);
                    updateStats();
                    renderResults(main, isMyCollection);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                    btn.disabled = false;
                }
            });
        });
    }
}
