import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { openAddIssueModal } from '../components/addIssueModal.js';
import { renderIssueGridCard } from '../components/cards/IssueGridCard.js';
import { CollectionEditor } from '/admin/js/CollectionEditor.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { formatDate } from '../helpers/lang.js';


// ── Lucide SVG icons ──────────────────────────────
const ICON = {
    chevronLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
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
    refreshCw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
    sortAsc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 12-4-4-4 4"/><path d="M7 16V8"/><path d="M14 9h8"/><path d="M14 15h5"/><path d="M14 21h2"/></svg>',
    sortDesc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 12-4 4-4-4"/><path d="M7 8v8"/><path d="M14 9h8"/><path d="M14 15h5"/><path d="M14 21h2"/></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="10" y1="14" x2="22" y2="3"></line></svg>',
    shieldAlert: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    globe: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
};

const THEME_ICON = {
    type: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
    genre: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    theme: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
};

let issuesSortDir = 'asc'; // 'asc' or 'desc'
let relatedPage = 1;
const RELATED_PER_PAGE = 10;

function renderSkeleton(container) {
    container.innerHTML = `
        <div class="collection-detail skeleton-state">
            <div class="container" style="padding-top: 20px;">
                <div class="skeleton" style="width: 200px; height: 18px; margin-bottom: 24px;"></div>
            </div>
            <div class="issue-hero-band" style="height: 320px;">
                <div class="container issue-hero">
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


function formatIssueRanges(nums) {
    if (!nums || !nums.length) return '';
    const sorted = [...nums].map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!sorted.length) return '';
    
    const parts = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i];
        if (curr === prev + 1) {
            prev = curr;
        } else {
            if (start === prev) parts.push(start);
            else parts.push(`${start}-${prev}`);
            start = curr;
            prev = curr;
        }
    }
    return parts.join(', ');
}

function getVerificationBadgeHTML(collection) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const isAnnounced = collection.release_date && collection.release_date > today;
    const status = isAnnounced ? 'announced' : (collection.verification_status || 'unverified');

    if (status === 'announced') {
        return `
            <span class="volume-badge volume-status-announced" title="Збірник анонсовано, дата релізу в майбутньому">
                ${ICON.clock}
                Анонсовано
            </span>
        `;
    } else if (status === 'physical') {
        return `
            <span class="volume-badge volume-status-physical" title="Інформація підтверджена з фізичного примірника">
                ${ICON.book}
                З примірника
            </span>
        `;
    } else if (status === 'open_sources') {
        return `
            <span class="volume-badge volume-status-open-sources" title="Інформація взята з відкритих джерел">
                ${ICON.globe}
                З інтернету
            </span>
        `;
    } else {
        return `
            <span class="volume-badge volume-status-unverified" title="Інформація ще не перевірена">
                ${ICON.shieldAlert}
                Неперевірено
            </span>
        `;
    }
}

function themeName(theme) {
    return theme.ua_name || theme.name || 'Тема';
}

function themeType(theme) {
    return theme.type || 'theme';
}

function themeChipHTML(theme) {
    const name = escapeHtmlAttribute(themeName(theme));
    const url = `#/catalog?theme_ids=${theme.id}`;
    return `<a href="${url}" class="volume-theme-chip volume-theme-chip--${themeType(theme)}">${name}</a>`;
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
        const { collection, issues, themes = [], related_collections } = data;

        const title = escapeHtmlAttribute(collection.name || 'Збірник');
        const coverUrl = normalizeImageUrl(collection.cv_img);
        const publisherName = escapeHtmlAttribute(collection.publisher_name || 'Невідоме видавництво');
        const isOwned = collection.is_owned;
        const isWanted = collection.user_status === 'wanted';
        const isBarter = !!collection.user_barter;

        const hasUaSynopsis = !!(collection.synopsis_ua || collection.description);
        const activeTab = hasUaSynopsis ? 'ua' : 'en';

        // Sorting issues
        const sortedIssues = [...issues].sort((a, b) => {
            const orderA = a.order_num || 0;
            const orderB = b.order_num || 0;
            return issuesSortDir === 'asc' ? orderA - orderB : orderB - orderA;
        });

        const isModerator = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

        const volumesMap = new Map();
        for (const item of sortedIssues) {
            const volId = item.volume_id;
            if (!volId) continue;
            
            if (!volumesMap.has(volId)) {
                volumesMap.set(volId, {
                    id: volId,
                    name: item.volume_name_uk || item.volume_name || 'Без назви',
                    numbers: []
                });
            }
            
            if (item.issue_number != null) {
                volumesMap.get(volId).numbers.push(String(item.issue_number));
            }
        }
        
        const sortedVolumes = Array.from(volumesMap.values());
        let seriesBlockHtml = '';
        if (sortedVolumes.length > 0) {
            const listHtml = sortedVolumes.map(vol => {
                const range = formatIssueRanges(vol.numbers) || '—';
                return `
                    <a href="#/volumes/${vol.id}" class="vol-summary-card">
                        <div class="vol-summary-card__info">
                            <span class="vol-summary-card__name" title="${escapeHtmlAttribute(vol.name)}">${escapeHtmlAttribute(vol.name)}</span>
                            <span class="vol-summary-card__range" title="Номери випусків"># ${escapeHtmlAttribute(range)}</span>
                        </div>
                    </a>
                `;
            }).join('');
            
            seriesBlockHtml = `
                <div class="vol-summary" style="margin-bottom: 24px;">
                    <div class="vol-summary__label">Серії випусків у збірниках</div>
                    <div class="vol-summary__list">
                        ${listHtml}
                    </div>
                </div>
            `;
        }

        main.innerHTML = `
            <div class="collection-detail">
                <div class="container">
                    ${createBreadcrumbs([
                        { label: 'Каталог', href: '#/catalog' },
                        ...(collection.volume_id ? [{ label: collection.volume_name_uk || collection.volume_name, href: `#/volumes/${collection.volume_id}` }] : []),
                        { label: title }
                    ])}
                </div>

                <section class="issue-hero-band">
                    <div class="container issue-hero">
                        <div class="issue-cover-column">
                            ${coverUrl
                                ? `<img class="issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="issue-cover issue-cover--empty">
                                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>
                                    </svg>
                                   </div>`}

                            <div class="issue-readlist-controls" style="display: flex; gap: 8px; margin-top: 16px;">
                                <button class="readlist-btn ${isOwned ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-collection" style="flex: 1; height: 42px; padding: 0 16px; gap: 8px; justify-content: center;">
                                    ${isOwned ? ICON.trash : ICON.plus}
                                    <span style="font-weight: 600;">${isOwned ? 'Видалити з колекції' : 'Додати в колекцію'}</span>
                                </button>

                                ${isOwned ? `
                                    <button class="readlist-btn ${isBarter ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-barter" title="Бартер" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                                        ${ICON.refreshCw}
                                    </button>
                                ` : `
                                    <button class="readlist-btn ${isWanted ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-wishlist" title="У бажане" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                                        ${ICON.bookmark}
                                    </button>
                                `}
                            </div>

                            ${(() => {
                                const hasLinks = collection.cv_id || collection.site_link;
                                if (!hasLinks) return '';
                                return `
                                    <div class="volume-cover-ext-sources" style="margin-top: 16px; border-top: 1px solid var(--border-s); padding-top: 16px; width: 100%;">
                                        <div style="font-family: var(--font-oswald); font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; text-align: center;">Зовнішні джерела</div>
                                        <div class="source-links">
                                            ${collection.cv_id ? `
                                                <a href="https://comicvine.gamespot.com/${collection.cv_slug}/4000-${collection.cv_id}/" class="source-link-cv" target="_blank" rel="noreferrer">
                                                    CV ${ICON.externalLink}
                                                </a>
                                            ` : ''}
                                            ${collection.site_link ? `
                                                <a href="${escapeHtmlAttribute(collection.site_link)}" class="source-link-site" target="_blank" rel="noreferrer">
                                                    SITE ${ICON.externalLink}
                                                </a>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            })()}
                        </div>

                        <div class="volume-hero-info">
                            <div class="volume-header">
                                <div class="volume-title">
                                    <span class="volume-main-title">
                                        <h1>${title} ${collection.issue_number ? `#${escapeHtmlAttribute(collection.issue_number)}` : ''}</h1>
                                    </span>
                                </div>
                            </div>

                            <div class="volume-hero-badges">
                            ${collection.volume_id ? `
                                <a href="#/volumes/${collection.volume_id}" class="volume-badge volume-volume-badge" title="Серія">
                                ${ICON.book}
                                ${escapeHtmlAttribute(collection.volume_name_uk || collection.volume_name || '')}
                                </a>
                                ` : ''}
                                ${collection.cover_date || collection.release_date ? (() => {
                                    const dateStr = collection.release_date || collection.cover_date;
                                    const now = new Date();
                                    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                                    const isFuture = dateStr && dateStr > today;
                                    const badgeClass = isFuture ? 'volume-year-badge--yellow' : 'volume-year-badge--green';
                                    return `
                                        <span class="volume-badge volume-year-badge ${badgeClass}" title="Дата виходу">
                                            ${ICON.calendar}
                                            ${formatDate(dateStr, '—')}
                                        </span>
                                    `;
                                })() : ''}
                                ${getVerificationBadgeHTML(collection)}
                            </div>


                            ${isModerator ? `
                                <div class="volume-hero-admin-actions">
                                    <button class="btn-admin btn-admin--secondary" id="col-edit-btn" title="Редагувати">
                                        <i class="bi bi-pencil-square"></i>
                                    </button>
                                    <button class="btn-admin btn-admin--danger" id="col-delete-btn" title="Видалити збірник">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            ` : ''}

                            <div class="volume-synopsis">
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

                            <div class="collection-meta-details collection-meta-details--${(() => {
                                const now = new Date();
                                const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                                if (collection.release_date && collection.release_date > today) return 'announced';
                                return collection.verification_status || 'unverified';
                            })()}">
                                <div class="collection-meta-item">
                                    <span class="collection-meta-label">ISBN</span>
                                    <span class="collection-meta-value">${escapeHtmlAttribute(collection.isbn || '—')}</span>
                                </div>
                                <div class="collection-meta-item">
                                    <span class="collection-meta-label">Сторінок</span>
                                    <span class="collection-meta-value">${escapeHtmlAttribute(collection.pages || '—')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body" style="margin-top: 32px;">
                    ${(() => {
                        const hasThemes = themes && themes.length > 0;
                        if (!hasThemes) return '';
                        const groups = {
                            type: themes.filter(t => t.type === 'type'),
                            genre: themes.filter(t => t.type === 'genre'),
                            theme: themes.filter(t => (t.type === 'theme' || !t.type))
                        };

                        const groupLabels = {
                            type: 'Тип',
                            genre: 'Жанри',
                            theme: 'Теми'
                        };

                        return `
                            <div class="volume-themes-row block" style="margin-bottom: 32px;">
                                ${Object.entries(groups).map(([type, items]) => {
                                    if (!items.length) return '';
                                    return `
                                        <div class="volume-theme-group">
                                            <span style="color: var(--text-muted); line-height: 0;">${THEME_ICON[type] || ''}</span>
                                            <span class="volume-theme-group-label">${groupLabels[type]}</span>
                                            <div class="volume-theme-chips-wrap">
                                                ${items.map(theme => themeChipHTML(theme)).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    })()}

                    <!-- Related Collections Block (Horizontal) -->
                    ${related_collections.length > 0 ? `
                        <div class="related-collections-section" style="margin-bottom: 40px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h2 style="font-size: 18px; font-weight: 750; margin: 0;">Інші збірники серії</h2>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <button class="readlist-btn" id="btn-sort-related" title="Змінити напрямок" style="width: 34px; height: 34px; padding: 0;">
                                        ${issuesSortDir === 'asc' ? ICON.sortAsc : ICON.sortDesc}
                                    </button>
                                    <div id="related-pagination"></div>
                                </div>
                            </div>
                            <div class="related-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 20px;">
                                <!-- Will be rendered by JS -->
                            </div>
                        </div>
                    ` : ''}

                    <div class="collection-issues-section">
                        ${seriesBlockHtml}
                        <div class="collection-issues-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <div style="display: flex; align-items: baseline; gap: 12px;">
                                <h2 class="collection-issues-title" style="margin: 0;">Вміст збірника</h2>
                                <span class="collection-issues-count" style="color: var(--text-muted); font-size: 14px;">${issues.length} випусків</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button class="readlist-btn" id="btn-show-contents" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: var(--bg-card); border: 1px solid var(--border);">
                                    ${ICON.layers} Зміст
                                </button>
                                ${(isModerator && collection.collection_issues_count > 0) ? `
                                    <button class="readlist-btn" id="btn-clear-issues" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: color-mix(in srgb, var(--red) 8%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--red) 35%, transparent); color: var(--red);" title="Очистити вміст збірника">
                                        ${ICON.trash} ${collection.collection_issues_count}
                                    </button>
                                ` : ''}
                                ${(isModerator) ? `
                                    <button class="readlist-btn" id="btn-add-issue" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: var(--bg-card); border: 1px solid var(--border);">
                                        ${ICON.plus} Додати випуск
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        ${sortedIssues.length === 0 ? `
                            <div class="ds-empty-state" style="padding: 48px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r);">
                                <h3 style="font-size: 16px; font-weight: 600;">Пусто</h3>
                                <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Інформація про випуски відсутня.</p>
                            </div>
                        ` : `
                            <div class="issues-view-grid" id="collection-issues-grid">
                                ${sortedIssues.map((issue) => renderIssueGridCard(issue, { 
                                    orderNum: issue.order_num,
                                    chapterTitle: issue.chapter_title,
                                    showOrder: isModerator,
                                    draggable: isModerator
                                })).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        // --- Event Listeners ---

        // Edit Button
        const editBtn = main.querySelector('#col-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                const editor = new CollectionEditor(collection, () => {
                    renderCollectionDetail(main, params);
                });
                await editor.render();
            });
        }

        // Delete Button
        const deleteBtn = main.querySelector('#col-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Ви впевнені, що хочете видалити цей збірник?')) return;
                try {
                    await API.delete(`/collections/${collectionId}`);
                    window.location.hash = collection.volume_id ? `#/volumes/${collection.volume_id}` : '#/catalog';
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                }
            });
        }


        // --- Helper: Drag & Drop Reordering ---
        const initReordering = () => {
            if (!isModerator) return;
            const grid = main.querySelector('#collection-issues-grid');
            if (!grid) return;

            let draggingCard = null;
            let isSaving = false;

            const getCards = () => Array.from(grid.querySelectorAll('.issue-grid-card'));
            
            const updateUIOrder = () => {
                getCards().forEach((card, index) => {
                    const badge = card.querySelector('.issue-grid-order-badge');
                    if (badge) badge.textContent = String(index + 1);
                });
            };

            const saveOrder = async () => {
                if (isSaving) return;
                const items = getCards().map(c => ({
                    id: Number(c.dataset.id),
                    type: c.dataset.itemType
                })).filter(item => !isNaN(item.id));
                
                isSaving = true;
                try {
                    await API.put(`/collections/${collectionId}/reorder-issues`, { items });
                    console.log('Order updated');
                } catch (err) {
                    alert('Помилка оновлення порядку: ' + err.message);
                    renderCollectionDetail(main, params); // Reset UI
                } finally {
                    isSaving = false;
                }
            };

            grid.addEventListener('dragstart', (e) => {
                const handle = e.target.closest('.issue-grid-drag-handle');
                if (!handle) {
                    e.preventDefault();
                    return;
                }
                draggingCard = handle.closest('.issue-grid-card');
                draggingCard.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            grid.addEventListener('dragend', (e) => {
                if (draggingCard) {
                    draggingCard.classList.remove('is-dragging');
                    draggingCard = null;
                }
                grid.querySelectorAll('.issue-grid-card').forEach(c => c.classList.remove('drag-over'));
            });

            grid.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggingCard) return;

                const targetCard = e.target.closest('.issue-grid-card');
                if (!targetCard || targetCard === draggingCard) return;

                const rect = targetCard.getBoundingClientRect();
                const next = (e.clientX - rect.left) > (rect.width / 2);
                
                grid.insertBefore(draggingCard, next ? targetCard.nextSibling : targetCard);
                updateUIOrder();
            });

            grid.addEventListener('drop', (e) => {
                e.preventDefault();
                saveOrder();
            });
        };

        initReordering();

        // --- Helper: Render Related Collections with Pagination ---
        const renderRelated = () => {
            const container = main.querySelector('.related-list');
            if (!container) return;

            // Sort related collections based on user preference
            const sortedRelated = [...related_collections].sort((a, b) => {
                const numA = parseFloat(a.issue_number) || 0;
                const numB = parseFloat(b.issue_number) || 0;
                return issuesSortDir === 'asc' ? numA - numB : numB - numA;
            });

            const start = (relatedPage - 1) * RELATED_PER_PAGE;
            const end = start + RELATED_PER_PAGE;
            const pageItems = sortedRelated.slice(start, end);

            container.innerHTML = pageItems.map(rc => {
                const isCurrent = rc.id === collectionId;
                return `
                    <a href="#/collections/${rc.id}" class="related-collection-card ${isCurrent ? 'is-active' : ''}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; transition: transform 0.2s; position: relative;">
                        <div style="aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; border: ${isCurrent ? '2px solid var(--accent)' : '1px solid var(--border-s)'}; background: var(--bg-card); box-shadow: ${isCurrent ? '0 0 0 3px var(--accent-glow)' : '0 4px 6px -1px rgba(0,0,0,0.1)'};">
                            <img src="${normalizeImageUrl(rc.cv_img)}" style="width: 100%; height: 100%; object-fit: cover; opacity: ${isCurrent ? '1' : '0.85'};" alt="${escapeHtmlAttribute(rc.name)}">
                        </div>
                        <div style="padding: 0 4px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">#${escapeHtmlAttribute(rc.issue_number || '—')}</div>
                        </div>
                        ${isCurrent ? `
                            <div style="position: absolute; top: -6px; right: -6px; background: var(--accent); color: white; padding: 2px 8px; border-radius: var(--r); font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                Поточний
                            </div>
                        ` : ''}
                    </a>
                `;
            }).join('');

            const pagContainer = main.querySelector('#related-pagination');
            if (related_collections.length > RELATED_PER_PAGE) {
                const totalPages = Math.ceil(related_collections.length / RELATED_PER_PAGE);
                pagContainer.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="readlist-btn" id="rel-prev" ${relatedPage === 1 ? 'disabled' : ''} style="width: 32px; height: 32px; padding: 0;">${ICON.chevronLeft}</button>
                        <span style="font-size: 13px; font-weight: 750; color: var(--text-2); min-width: 40px; text-align: center;">${relatedPage} / ${totalPages}</span>
                        <button class="readlist-btn" id="rel-next" ${relatedPage === totalPages ? 'disabled' : ''} style="width: 32px; height: 32px; padding: 0;">${ICON.chevronRight}</button>
                    </div>
                `;
                pagContainer.querySelector('#rel-prev').onclick = () => { relatedPage--; renderRelated(); };
                pagContainer.querySelector('#rel-next').onclick = () => { relatedPage++; renderRelated(); };
            }
        };

        renderRelated();

        // Sort related collections
        main.querySelector('#btn-sort-related')?.addEventListener('click', () => {
            issuesSortDir = issuesSortDir === 'asc' ? 'desc' : 'asc';
            // Update button icon
            const btn = main.querySelector('#btn-sort-related');
            btn.innerHTML = issuesSortDir === 'asc' ? ICON.sortAsc : ICON.sortDesc;
            // Also resort the issues list since it's logical to keep them in sync
            renderCollectionDetail(main, params);
        });

        // Synopsis tabs
        main.querySelectorAll('.synopsis-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const lang = tab.getAttribute('data-tab');
                const synopsisTabs = main.querySelectorAll('.synopsis-tab');
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

        // --- Add Issue Modal ---
        const btnAddIssue = main.querySelector('#btn-add-issue');
        if (btnAddIssue) {
            btnAddIssue.addEventListener('click', () => {
                openAddIssueModal({
                    title: 'Додати вміст до збірника',
                    collectionId: collectionId,
                    alreadyIds: new Set(issues.map(i => i.id)),
                    onAdd: async (items) => {
                        for (const item of items) {
                            try {
                                const payload = item.is_manga 
                                    ? { manga_chapter_id: item.id } 
                                    : { issue_id: item.id };
                                await API.post(`/collections/${collectionId}/issues`, payload);
                            } catch (err) {
                                console.error(`Error adding item ${item.id}:`, err);
                            }
                        }
                        renderCollectionDetail(main, params);
                    }
                });
            });
        }

        // --- Clear Issues ---
        const btnClearIssues = main.querySelector('#btn-clear-issues');
        if (btnClearIssues) {
            btnClearIssues.addEventListener('click', async () => {
                if (!confirm(`Видалити всі ${collection.collection_issues_count} зв'язків із випусками? Самі випуски/розділи не будуть видалені.`)) return;
                try {
                    await API.delete(`/collections/${collectionId}/issues`);
                    renderCollectionDetail(main, params);
                } catch (err) {
                    alert('Помилка: ' + err.message);
                }
            });
        }

        // --- Contents Modal ---
        const btnContents = main.querySelector('#btn-show-contents');
        if (btnContents) {
            btnContents.addEventListener('click', () => {
                let contentsList = [];
                try {
                    if (collection.contents) {
                        contentsList = typeof collection.contents === 'string' 
                            ? JSON.parse(collection.contents) 
                            : collection.contents;
                    }
                } catch (e) {
                    console.error('Помилка парсингу змісту:', e);
                }

                const modalHtml = `
                    <div class="ds-modal-overlay" id="contents-modal-overlay" style="display: flex;">
                        <div class="ds-modal ds-modal--medium">
                            <div class="ds-modal-header">
                                <div class="ds-modal-title">${ICON.layers} Зміст збірника</div>
                                <button class="ds-modal-close" id="contents-modal-close">&times;</button>
                            </div>
                            <div class="ds-modal-body">
                                ${contentsList && contentsList.length > 0 ? `
                                    <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                        ${contentsList.map((item, idx) => `
                                            <li style="background: var(--bg-input); display: flex; align-items: baseline;">
                                                <span style="color: var(--text-muted); min-width: 20px;">${idx + 1}.</span>
                                                <span style="color: var(--text);">${escapeHtmlAttribute(item)}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                ` : `
                                    <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
                                        <div style="opacity: 0.5;">${ICON.layers}</div>
                                        <p style="font-size: 16px; font-weight: 500; margin: 0;">Зміст наразі відсутній.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                const modal = document.getElementById('contents-modal-overlay');
                const closeBtn = document.getElementById('contents-modal-close');
                
                const closeModal = () => modal.remove();
                
                closeBtn.onclick = closeModal;
                modal.onclick = (e) => { if (e.target === modal) closeModal(); };
                // Escape key
                const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
                document.addEventListener('keydown', escHandler);
            });
        }

    } catch (err) {
        console.error(err);
        main.innerHTML = `<div class="container"><div class="error-state">Помилка завантаження: ${err.message}</div></div>`;
    }
}

