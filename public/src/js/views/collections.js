import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

const icon = (d, size = 16, strokeWidth = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON = {
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
};

let allVolumes = [];
let searchQuery = '';
let activeTab = 'get'; // 'get', 'wanted', 'barter'

export async function renderCollections(main, params) {
    const username = params.username;
    const isMyCollection = !username || (currentUser && currentUser.username === username);
    document.title = username ? `Колекція ${username} — Drawn Stories` : `Моя колекція — Drawn Stories`;

    main.innerHTML = `
        <div class="container">
            <div class="page-header">
                <nav class="breadcrumbs" aria-label="Н">
                    <a href="#/">Drawn Stories</a>
                    <span class="breadcrumb-separator">${icon('<path d="m9 18 6-6-6-6"/>')}</span>
                    <span>Користувач</span>
                    <span class="breadcrumb-separator">${icon('<path d="m9 18 6-6-6-6"/>')}</span>
                    <span>${escapeHtmlAttribute(username || 'Я')}</span>
                    <span class="breadcrumb-separator">${icon('<path d="m9 18 6-6-6-6"/>')}</span>
                    <span>Колекція</span>
                </nav>
                <h1 class="page-title">${username ? `Колекція ${escapeHtmlAttribute(username)}` : 'Моя колекція'}</h1>
            </div>

            <div class="collection-controls-row" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px;">
                <div class="collection-segmented">
                    <button class="collection-segment ${activeTab === 'get' ? 'is-active' : ''}" data-tab="get">Колекція</button>
                    <button class="collection-segment ${activeTab === 'wanted' ? 'is-active' : ''}" data-tab="wanted">Бажане</button>
                    <button class="collection-segment ${activeTab === 'barter' ? 'is-active' : ''}" data-tab="barter">Бартер</button>
                </div>
                
                <div class="collection-controls">
                    <div class="collection-search-wrap">
                        <span class="search-icon">${icon(ICON.search, 18, 2.5)}</span>
                        <input type="text" id="collection-search" placeholder="Пошук у колекції..." value="${escapeHtmlAttribute(searchQuery)}">
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
                                <span class="collection-stat-label">Збірників:</span>
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

    try {
        const apiParams = username ? { username } : {};
        allVolumes = await API.get(`/collections`, apiParams);
        updateStats();
        renderResults(main, isMyCollection);

        // Tab events
        main.querySelectorAll('.collection-segment').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.getAttribute('data-tab');
                main.querySelectorAll('.collection-segment').forEach(b => b.classList.toggle('is-active', b === btn));
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

    container.innerHTML = filtered.map(volume => `
        <div class="collection-volume-card">
            <div class="volume-info">
                <h2 class="volume-title">
                    <a href="#/volumes/${volume.id}">${escapeHtmlAttribute(volume.name_uk || volume.name)}</a>
                </h2>
                <div class="volume-publisher">${escapeHtmlAttribute(volume.publisher_name || 'Невідоме')}</div>
            </div>
            <div class="collection-items">
                ${volume.items.map(item => {
                    const isOwned = item.status === 'get';
                    
                    // Logic for visual state in the current tab
                    let isActiveInTab = false;
                    if (activeTab === 'get') isActiveInTab = (item.status === 'get');
                    else if (activeTab === 'wanted') isActiveInTab = (item.status === 'wanted');
                    else if (activeTab === 'barter') isActiveInTab = (item.barter === true);

                    return `
                        <div class="collection-item-wrapper ${isActiveInTab ? 'is-owned' : ''}">
                            <div class="collection-item-thumb">
                                <a href="#/collections/${item.id}">
                                    ${item.cv_img 
                                        ? `<img src="${comicVineImageUrl(item.cv_img)}" alt="${escapeHtmlAttribute(item.name)}">`
                                        : `<div class="empty-thumb">${icon(ICON.book, 24)}</div>`}
                                </a>
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
                            <div class="item-number">#${escapeHtmlAttribute(item.issue_number || '—')}</div>
                            <div class="item-name" title="${escapeHtmlAttribute(item.name)}">${escapeHtmlAttribute(item.name)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    // --- Add Toggle Listeners ---
    if (isMyCollection) {
        container.querySelectorAll('.toggle-collection-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const collectionId = btn.getAttribute('data-id');
                btn.disabled = true;

                try {
                    // Clicking toggle always targets the 'get' status for the main collection
                    await API.post('/collections/toggle', { collection_id: Number(collectionId), status: 'get' });
                    
                    // Full refresh to ensure volume grouping is correct
                    const apiParams = currentUser ? { username: currentUser.username } : {};
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
