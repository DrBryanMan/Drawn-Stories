import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

// ── Lucide SVG icons ──────────────────────────────
const ICON = {
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',   
    building: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    calendar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    bookmark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    refreshCw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>'
};

function renderSkeleton(container) {
    container.innerHTML = `
        <div class="collection-detail skeleton-state">
            <div class="container" style="padding-top: 20px;">
                <div class="skeleton" style="width: 200px; height: 18px; margin-bottom: 24px;"></div>
            </div>
            <div class="volume-hero-band" style="height: 320px;">
                <div class="container volume-hero">
                    <div class="skeleton" style="width: 250px; height: 375px; border-radius: 8px;"></div>
                    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                        <div class="skeleton" style="width: 60%; height: 36px;"></div>
                        <div class="skeleton" style="width: 40%; height: 20px;"></div>
                        <div class="skeleton" style="width: 20%; height: 24px; margin-top: 12px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2] === '00') {
            const months = [
                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
            ];
            const mIdx = parseInt(parts[1]) - 1;
            return `${months[mIdx] || parts[1]} ${parts[0]}`;
        }
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return dateStr;
        }
    }
    return dateStr;
}

export async function renderCollectionDetail(main, params = {}) {
    const collectionId = Number(params.id);
    if (!Number.isFinite(collectionId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ID збірника</div></div>';
        return;
    }

    renderSkeleton(main);

    try {
        const data = await API.get(`/collections/${collectionId}`);
        const { collection, issues, themes } = data;

        const title = escapeHtmlAttribute(collection.name || 'Збірник');
        const coverUrl = comicVineImageUrl(collection.cv_img);
        const publisherName = escapeHtmlAttribute(collection.publisher_name || 'Невідоме видавництво');
        const isOwned = collection.is_owned;
        const isWanted = collection.user_status === 'wanted';
        const isBarter = !!collection.user_barter;

        const hasUaSynopsis = !!(collection.synopsis_ua || collection.description);
        const activeTab = hasUaSynopsis ? 'ua' : 'en';

        main.innerHTML = `
            <div class="collection-detail">
                <div class="container" style="padding-top: 20px;">
                    <nav class="breadcrumbs" aria-label="Навігація">
                        <a href="#/">Drawn Stories</a>
                        <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                        <a href="#/catalog">Каталог</a>
                        <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                        ${collection.volume_id ? `
                            <a href="#/volumes/${collection.volume_id}">${escapeHtmlAttribute(collection.volume_name_uk || collection.volume_name)}</a>
                            <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                        ` : ''}
                        <span>${title}</span>
                    </nav>
                </div>

                <section class="volume-hero-band collection-hero-band">
                    <div class="container volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty">
                                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>
                                    </svg>
                                   </div>`}

                            <div class="volume-readlist-controls" style="display: flex; gap: 8px; margin-top: 16px;">
                                <button class="readlist-btn ${isOwned ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-collection" style="flex: 1; height: 42px; padding: 0 16px; gap: 8px; justify-content: center;">
                                    ${isOwned ? ICON.trash : ICON.plus}
                                    <span style="font-size: 14px; font-weight: 600;">${isOwned ? 'Видалити' : 'Додати'}</span>
                                </button>
                                
                                ${isOwned ? `
                                    <button class="readlist-btn ${isBarter ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-barter" title="Бартер" style="width: 42px; height: 42px; padding: 0; justify-content: center;">
                                        ${ICON.refreshCw}
                                    </button>
                                ` : `
                                    <button class="readlist-btn ${isWanted ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-wishlist" title="У бажане" style="width: 42px; height: 42px; padding: 0; justify-content: center;">
                                        ${ICON.bookmark}
                                    </button>
                                `}
                            </div>
                        </div>

                        <div class="volume-hero-info">
                            <div class="volume-header">
                                <div class="volume-title">
                                    <span class="volume-main-title">
                                        <h1>${title} ${collection.issue_number ? `#${escapeHtmlAttribute(collection.issue_number)}` : ''}</h1>
                                    </span>
                                    ${collection.volume_id ? `
                                        <span class="volume-original-title">
                                            Том: <a href="#/volumes/${collection.volume_id}" style="color: var(--accent); text-decoration: none; font-weight: 600;">${escapeHtmlAttribute(collection.volume_name_uk || collection.volume_name)}</a>
                                        </span>
                                    ` : ''}
                                </div>
                            </div>

                            <div class="volume-hero-badges">
                                <a href="#/catalog?publisher_ids=${collection.publisher}" class="volume-badge volume-publisher-badge" title="Видавництво">
                                    ${ICON.building}
                                    ${publisherName}
                                </a>
                                ${collection.cover_date || collection.release_date ? `
                                    <span class="volume-badge volume-year-badge" title="Дата виходу">
                                        ${ICON.calendar}
                                        ${formatDate(collection.release_date || collection.cover_date)}
                                    </span>
                                ` : ''}
                            </div>

                            <div class="volume-synopsis" style="margin-top: 24px;">
                                <div class="synopsis-header">
                                    <h2 class="synopsis-title">Синопсис</h2>
                                    <div class="synopsis-tabs">
                                        <button class="synopsis-tab ${activeTab === 'ua' ? 'is-active' : ''}" data-tab="ua">UA</button>
                                        <button class="synopsis-tab ${activeTab === 'en' ? 'is-active' : ''}" data-tab="en">EN</button>
                                    </div>
                                </div>
                                <div class="synopsis-content">
                                    <div class="synopsis-pane ${activeTab === 'ua' ? 'is-active' : ''}" id="synopsis-ua">
                                        ${collection.synopsis_ua || collection.description || 'Немає синопсису українською.'}
                                    </div>
                                    <div class="synopsis-pane ${activeTab === 'en' ? 'is-active' : ''}" id="synopsis-en">
                                        ${collection.synopsis || 'No description available in English.'}
                                    </div>
                                </div>
                            </div>

                            <div class="collection-meta-details" style="margin-top: 24px;">
                                <div class="collection-meta-item">
                                    <span class="collection-meta-label">ISBN</span>
                                    <span class="collection-meta-value">${escapeHtmlAttribute(collection.isbn || '—')}</span>
                                </div>
                                <div class="collection-meta-item">
                                    <span class="collection-meta-label">Сторінок</span>
                                    <span class="collection-meta-value">${escapeHtmlAttribute(collection.pages || '—')}</span>
                                </div>
                                <div class="collection-meta-item">
                                    <span class="collection-meta-label">Джерело</span>
                                    <span class="collection-meta-value">
                                        ${collection.site_link ? `
                                            <a href="${escapeHtmlAttribute(collection.site_link)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px;"> 
                                                ComicVine ${ICON.link}
                                            </a>
                                        ` : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container" style="margin-top: 32px;">
                    <div class="collection-issues-section">
                        <div class="collection-issues-header">
                            <h2 class="collection-issues-title">Вміст збірника</h2>
                            <span class="collection-issues-count">${issues.length} випусків</span>
                        </div>

                        ${issues.length === 0 ? `
                            <div class="ds-empty-state" style="padding: 48px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r);">
                                ${ICON.info}
                                <h3 style="margin-top: 12px; font-size: 16px; font-weight: 600;">Пусто</h3>
                                <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Інформація про випуски, що входять до цього збірника, наразі відсутня.</p>
                            </div>
                        ` : `
                            <div class="collection-issues-list">
                                ${issues.map((issue) => {
                                    const issueCover = comicVineImageUrl(issue.cv_img);
                                    const isChapterTitleDiff = issue.chapter_title && issue.chapter_title !== issue.name;
                                    const mainTitle = issue.chapter_title || issue.name || `Випуск #${issue.issue_number}`;

                                    return `
                                        <div class="collection-issue-row">
                                            <div class="collection-issue-order">Розділ ${issue.order_num || '—'}</div>
                                            <div class="collection-issue-cover-wrap">
                                                ${issueCover
                                                    ? `<img class="collection-issue-cover" src="${escapeHtmlAttribute(issueCover)}" loading="lazy" alt="${escapeHtmlAttribute(mainTitle)}">`
                                                    : `<div class="collection-issue-cover-empty"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
                                            </div>
                                            <div class="collection-issue-info">
                                                <div class="collection-chapter-name" title="${escapeHtmlAttribute(mainTitle)}">
                                                    ${escapeHtmlAttribute(mainTitle)}
                                                </div>
                                                ${isChapterTitleDiff && issue.name ? `
                                                    <div class="collection-original-issue" title="Оригінальний випуск: ${escapeHtmlAttribute(issue.name)}">
                                                        Оригінально: ${escapeHtmlAttribute(issue.name)}
                                                    </div>
                                                ` : ''}
                                                <div class="collection-original-issue">
                                                    Випуск #${escapeHtmlAttribute(issue.issue_number || '—')}
                                                </div>
                                            </div>
                                            <div class="collection-issue-meta-cell">
                                                ${issue.cover_date || issue.release_date ? `
                                                    <span class="collection-issue-date">${formatDate(issue.release_date || issue.cover_date)}</span>
                                                ` : ''}
                                                ${issue.volume_id ? `
                                                    <a href="#/volumes/${issue.volume_id}" class="collection-issue-vol-badge">
                                                        Перейти до тому
                                                    </a>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        // --- Event Listeners ---

        // Synopsis tabs
        const synopsisTabs = main.querySelectorAll('.synopsis-tab');
        synopsisTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const lang = tab.getAttribute('data-tab');
                synopsisTabs.forEach(t => t.classList.toggle('is-active', t === tab));
                main.querySelectorAll('.synopsis-content .synopsis-pane').forEach(p => {
                    p.classList.toggle('is-active', p.id === `synopsis-${lang}`);
                });
            });
        });

        // Toggle Collection
        const toggleBtn = main.querySelector('#btn-toggle-collection');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    alert('Будь ласка, увійдіть, щоб керувати колекцією');
                    return;
                }

                toggleBtn.disabled = true;
                try {
                    await API.post('/collections/toggle', { collection_id: collectionId, status: 'get' });
                    renderCollectionDetail(main, params);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                    toggleBtn.disabled = false;
                }
            });
        }

        // Toggle Wishlist
        const wishlistBtn = main.querySelector('#btn-toggle-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    alert('Будь ласка, увійдіть, щоб керувати бажаним');
                    return;
                }

                wishlistBtn.disabled = true;
                try {
                    await API.post('/collections/toggle', { collection_id: collectionId, status: 'wanted' });
                    renderCollectionDetail(main, params);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                    wishlistBtn.disabled = false;
                }
            });
        }

        // Toggle Barter
        const barterBtn = main.querySelector('#btn-toggle-barter');
        if (barterBtn) {
            barterBtn.addEventListener('click', async () => {
                if (!currentUser) return;

                barterBtn.disabled = true;
                try {
                    const newBarter = !isBarter;
                    await API.post('/collections/toggle', { collection_id: collectionId, barter: newBarter });
                    renderCollectionDetail(main, params);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                    barterBtn.disabled = false;
                }
            });
        }

    } catch (err) {
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження: ${err.message}</div></div>`;
    }
}
