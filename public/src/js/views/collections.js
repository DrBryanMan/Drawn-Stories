import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { t } from '../helpers/i18n.js';
import { icon } from '../helpers/icons.js';
import { formatCurrency } from '../helpers/lang.js';

let allVolumes = [];
let searchQuery = '';
let activeTab = 'get'; // 'get', 'wanted', 'barter'
let currentType = 'collection'; // 'collection', 'issue'
let hideMissing = false;

export async function renderCollections(main, params) {
    const username = params.username;
    const isMyCollection = !username || (currentUser && (
        (currentUser.nickname && currentUser.nickname.toLowerCase() === username.toLowerCase()) ||
        (currentUser.login && currentUser.login.toLowerCase() === username.toLowerCase()) ||
        (currentUser.username && currentUser.username.toLowerCase() === username.toLowerCase())
    ));
    
    const pageTitle = username 
        ? t('collection_title_other').replace('{username}', username)
        : t('collection_title_my');
        
    document.title = `${pageTitle} — Drawn Stories`;

    main.innerHTML = `
        <div class="container">
            <div class="page-header">
            <div class="collection-controls-row">
                <div class="collection-segmented-wrap">
                    <div class="catalog-segmented" role="group" aria-label="Тип контенту" id="collection-type-segmented">
                        <button class="catalog-segment ${currentType === 'collection' ? 'is-active' : ''}" data-type="collection">${t('collections')}</button>
                        <button class="catalog-segment ${currentType === 'issue' ? 'is-active' : ''}" data-type="issue">${t('releases')}</button>
                    </div>
                    <div class="collection-segmented" id="collection-tab-segmented">
                        <button class="collection-segment ${activeTab === 'get' ? 'is-active' : ''}" data-tab="get">${t('have')}</button>
                        <button class="collection-segment ${activeTab === 'wanted' ? 'is-active' : ''}" data-tab="wanted">${t('wanted')}</button>
                        <button class="collection-segment ${activeTab === 'barter' ? 'is-active' : ''}" data-tab="barter">${t('barter')}</button>
                    </div>
                </div>
                
                <div class="collection-controls">
                    <div class="collection-filters-left">
                        <div class="collection-search-wrap">
                            <span class="search-icon">${icon('search', 18, 2.5)}</span>
                            <input type="text" id="collection-search" placeholder="${t('search_in_collection')}" value="${escapeHtmlAttribute(searchQuery)}">
                        </div>
                        <label class="collection-hide-missing-label">
                            <input type="checkbox" id="collection-hide-missing-chk" class="collection-hide-missing-chk" ${hideMissing ? 'checked' : ''}>
                            <span>${t('hide_missing')}</span>
                        </label>
                    </div>
                    <div class="collection-stats">
                        <div class="collection-stat-item">
                            <span class="collection-stat-icon">${icon('book', 18, 2)}</span>
                            <div class="collection-stat-details">
                                <span class="collection-stat-label">${t('home_stats_volumes')}:</span>
                                <span class="collection-stat-value" id="stat-series">0</span>
                            </div>
                        </div>
                        <div class="collection-stat-item">
                            <span class="collection-stat-icon">${icon('layers', 18, 2)}</span>
                            <div class="collection-stat-details">
                                <span class="collection-stat-label" id="stat-label-collections">${currentType === 'issue' ? t('releases') : t('collections')}:</span>
                                <span class="collection-stat-value" id="stat-collections">0</span>
                            </div>
                        </div>
                        <div class="collection-stat-item" id="stat-item-spent" style="${currentType === 'collection' ? '' : 'display: none;'}">
                            <span class="collection-stat-icon">${icon('banknote', 18, 2)}</span>
                            <div class="collection-stat-details">
                                <span class="collection-stat-label">${t('total_spent_value') || 'Витрачено'}:</span>
                                <span class="collection-stat-value" id="stat-purchase-price">—</span>
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
                    labelEl.textContent = currentType === 'issue' ? `${t('releases')}:` : `${t('collections')}:`;
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
        main.querySelector('#collections-results').innerHTML = `<div class="error-state">${t('error_label')}: ${err.message}</div>`;
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

    let totalSpent = 0;
    let hasSpent = false;

    if (currentType === 'collection') {
        filteredItems.forEach(vol => {
            vol.items.forEach(item => {
                const pPrice = parseFloat(item.purchase_price);
                if (item.purchase_currency === 'UAH' && !isNaN(pPrice) && pPrice > 0) {
                    totalSpent += pPrice;
                    hasSpent = true;
                }
            });
        });
    }

    const sEl = document.getElementById('stat-series');
    const cEl = document.getElementById('stat-collections');
    const spentEl = document.getElementById('stat-purchase-price');
    const statItemSpent = document.getElementById('stat-item-spent');

    if (sEl) sEl.textContent = seriesCount;
    if (cEl) cEl.textContent = collectionsCount;
    if (spentEl) spentEl.textContent = hasSpent ? formatCurrency(totalSpent, 'UAH') : '—';

    if (statItemSpent) statItemSpent.style.display = currentType === 'collection' ? 'flex' : 'none';
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
                ${icon('layers', 48, 1.5)}
                <h3>${t('list_empty')}</h3>
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
                        <div class="volume-publisher">${escapeHtmlAttribute(volume.publisher_name || t('unknown_publisher'))}</div>
                    </div>
                    ${isMyCollection ? `
                        <div class="volume-info-right">
                            <div class="volume-progress-row">
                                ${ownedCount < totalCount ? `
                                    <button class="volume-add-all-btn" data-volume-id="${volume.id}" title="${t('add_all')}">
                                        ${icon('listPlus', 16)}
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
                                        ${item.image 
                                            ? `<img src="${normalizeImageUrl(item.image)}" alt="${escapeHtmlAttribute(item.name)}">` 
                                            : `<div class="empty-thumb">${icon('book', 24)}</div>`}
                                    </a>
                                    <div class="item-number">#${escapeHtmlAttribute(item.issue_number || '—')}</div>
                                    ${isMyCollection ? `
                                        <div class="item-overlay">
                                            <button class="toggle-collection-btn ${isOwned ? 'btn-remove' : 'btn-add'}" 
                                                    data-id="${item.id}" 
                                                    title="${isOwned ? t('remove_from_collection') : t('add_to_collection')}">
                                                ${isOwned ? icon('trash', 14) : icon('plus', 14)}
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
                    const currHandle = currentUser ? (currentUser.nickname || currentUser.login || currentUser.username) : null;
                    const apiParams = currHandle ? { username: currHandle } : {};
                    apiParams.content_type = currentType;
                    allVolumes = await API.get(`/collections`, apiParams);
                    updateStats();
                    renderResults(main, isMyCollection);
                } catch (err) {
                    alert(`${t('error_label')}: ` + err.message);
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
                    const currHandle = currentUser ? (currentUser.nickname || currentUser.login || currentUser.username) : null;
                    const apiParams = currHandle ? { username: currHandle } : {};
                    apiParams.content_type = currentType;
                    allVolumes = await API.get(`/collections`, apiParams);
                    updateStats();
                    renderResults(main, isMyCollection);
                } catch (err) {
                    alert(`${t('error_label')}: ` + err.message);
                    btn.disabled = false;
                }
            });
        });
    }
}
