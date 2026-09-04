import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { openAddIssueModal } from '../components/addIssueModal.js';
import { renderIssueGridCard } from '../components/cards/IssueGridCard.js';
import { CollectionEditor } from '../components/modals/EditCollectionModal.js';
import { formatDate, formatIssueRanges, formatCurrency } from '../helpers/lang.js';
import { icon } from '../helpers/icons.js';
import { t } from '../helpers/i18n.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';

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

/**
 * Formats a release_date string (YYYY-MM-DD or YYYY-MM) as "Анонсовано на {Місяць РРРР}"
 * for future dates shown in the hero badge.
 */
function formatAnnouncedDate(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = String(dateStr).trim().split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        if (isNaN(year) || isNaN(month)) return dateStr;
        const d = new Date(year, month, 1);
        const monthName = d.toLocaleDateString('uk-UA', { month: 'long' });
        const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `Анонсовано на ${capitalized} ${year}`;
    } catch {
        return dateStr;
    }
}

function isFutureDate(dateStr) {
    if (!dateStr) return false;
    const clean = String(dateStr).trim();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (clean.length === 7) {
        return clean >= today.slice(0, 7);
    }
    if (clean.endsWith('-00')) {
        return clean.slice(0, 7) >= today.slice(0, 7);
    }
    return clean > today;
}

function getVerificationBadgeHTML(collection) {
    const status = collection.verification_status || 'unverified';

    if (status === 'physical') {
        return `
            <span class="volume-badge volume-status-physical" title="Інформація підтверджена з фізичного примірника">
                ${icon('book', 13, { strokeWidth: 2.2 })}
                З примірника
            </span>
        `;
    } else if (status === 'open_sources') {
        return `
            <span class="volume-badge volume-status-open-sources" title="Інформація взята з відкритих джерел">
                ${icon('globe', 13, { strokeWidth: 2.2 })}
                З інтернету
            </span>
        `;
    } else {
        return `
            <span class="volume-badge volume-status-unverified" title="Інформація ще не перевірена">
                ${icon('shieldAlert', 13, { strokeWidth: 2.2 })}
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
        const [data, edits] = await Promise.all([
            API.get(`/collections/${collectionId}`),
            fetchEntityEdits('collection', collectionId)
        ]);
        const { collection, issues, themes = [], related_collections } = data;

        const usesNumberedFallbackTitle = !collection.name && !!collection.issue_number;
        const fallbackTitle = collection.issue_number ? `Книга ${collection.issue_number}` : 'Збірник';
        const title = escapeHtmlAttribute(collection.name || fallbackTitle);
        const coverUrl = normalizeImageUrl(collection.image);
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

        let tech = {};
        if (collection.tech_info) {
            try {
                tech = typeof collection.tech_info === 'string' ? JSON.parse(collection.tech_info) : (collection.tech_info || {});
            } catch (e) {
                tech = {};
            }
        }
        const pagesCount = tech.pages || collection.pages || null;
        const coverType = tech.cover_type;
        const dustJacket = tech.dust_jacket;
        const releasePrice = tech.release_price;
        const releaseCurrency = tech.release_currency || 'UAH';
        const dimensions = tech.dimensions;
        const printRun = tech.print_run;
        const ageRating = tech.age_rating;
        const weight = tech.weight;
        const finish = tech.finish;

        // Date badge logic: future date → "Анонсовано на {Місяць РРРР}", past → regular date
        const releaseDateBadgeHTML = (() => {
            const dateStr = collection.release_date;
            if (!dateStr) return '';
            if (isFutureDate(dateStr)) {
                return `
                    <span class="volume-badge volume-status-announced" title="Збірник анонсовано, дата релізу в майбутньому">
                        ${icon('clock', 13, { strokeWidth: 2.2 })}
                        ${formatAnnouncedDate(dateStr)}
                    </span>
                `;
            } else {
                return `
                    <span class="volume-badge volume-year-badge volume-year-badge--green" title="Дата виходу">
                        ${icon('calendar', 13, { strokeWidth: 2.2 })}
                        ${formatDate(dateStr, '—')}
                    </span>
                `;
            }
        })();

        main.innerHTML = `
            <div class="collection-detail">
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
                                    ${isOwned ? icon('trash', 13, { strokeWidth: 2.2 }) : icon('plus', 13, { strokeWidth: 2.2 })}
                                    <span style="font-weight: 600;">${isOwned ? 'Видалити з колекції' : 'Додати в колекцію'}</span>
                                </button>

                                ${isOwned ? `
                                    <button class="readlist-btn ${isBarter ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-barter" title="Бартер" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                                        ${icon('refreshCw', 14, { strokeWidth: 2.5 })}
                                    </button>
                                ` : `
                                    <button class="readlist-btn ${isWanted ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-wishlist" title="У бажане" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                                        ${icon('bookmark', 14, { strokeWidth: 2.5 })}
                                    </button>
                                `}
                            </div>

                            ${isOwned ? `
                                <div class="user-collection-price-box" id="user-collection-price-box">
                                    <div class="user-collection-price-info">
                                        <span class="user-collection-price-label">${t('purchase_price') || 'Ціна покупки'}</span>
                                        <span class="user-collection-price-val" id="user-price-display">
                                            ${collection.user_purchase_price !== null && collection.user_purchase_price !== undefined
                                                ? formatCurrency(collection.user_purchase_price, collection.user_purchase_currency || 'UAH')
                                                : (releasePrice ? `${formatCurrency(releasePrice, releaseCurrency)} <small style="color:var(--text-muted); font-size:11px; font-weight:normal;">(${t('release_price') || 'релізна'})</small>` : '—')}
                                        </span>
                                    </div>
                                    <button class="btn-purchase-price-edit" id="btn-edit-purchase-price" title="${t('edit_purchase_price') || 'Редагувати ціну покупки'}">
                                        ${icon('edit', 12)}
                                    </button>
                                </div>
                            ` : ''}

                            ${(() => {
                                const hasLinks = collection.cv_id || collection.site_link;
                                if (!hasLinks) return '';
                                return `
                                    <div class="volume-cover-ext-sources" style="margin-top: 16px; border-top: 1px solid var(--border-s); padding-top: 16px; width: 100%;">
                                        <div style="font-family: var(--font-oswald); font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; text-align: center;">Зовнішні джерела</div>
                                        <div class="source-links">
                                            ${collection.cv_id ? `
                                                <a href="https://comicvine.gamespot.com/${collection.cv_slug}/4000-${collection.cv_id}/" class="source-link-cv" target="_blank" rel="noreferrer">
                                                    CV ${icon('externalLink', 14, { strokeWidth: 2.2 })}
                                                </a>
                                            ` : ''}
                                            ${collection.site_link ? `
                                                <a href="${escapeHtmlAttribute(collection.site_link)}" class="source-link-site" target="_blank" rel="noreferrer">
                                                    SITE ${icon('externalLink', 14, { strokeWidth: 2.2 })}
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
                                        <h1>${title}${collection.issue_number && !usesNumberedFallbackTitle ? ` #${escapeHtmlAttribute(collection.issue_number)}` : ''}</h1>
                                    </span>
                                </div>
                            </div>

                            <div class="volume-hero-badges">
                            ${collection.volume_id ? `
                                <a href="#/volumes/${collection.volume_id}" class="volume-badge volume-volume-badge" title="Серія: ${escapeHtmlAttribute(collection.volume_name_uk || collection.volume_name || '')}">
                                ${icon('book', 13, { strokeWidth: 2.2 })}
                                <span>${escapeHtmlAttribute(collection.volume_name_uk || collection.volume_name || '')}</span>
                                </a>
                                ` : ''}
                                ${releaseDateBadgeHTML}
                                ${getVerificationBadgeHTML(collection)}
                            </div>


                            <div class="volume-synopsis">
                                <div class="synopsis-header">
                                    <h2 class="synopsis-title">${t('synopsis')}</h2>
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

                            <div class="collection-meta-section">
                                <div class="collection-meta-header">
                                    <h2 class="collection-meta-title">${t('tech_characteristics') || 'Технічні характеристики'}</h2>
                                </div>
                                <div class="collection-meta-details collection-meta-details--${(() => {
                                    if (isFutureDate(collection.release_date)) return 'announced';
                                    return collection.verification_status || 'unverified';
                                })()}">
                                    ${(() => {
                                        const metaItems = [];
                                        if (collection.isbn) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">ISBN</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(collection.isbn)}</span>
                                                </div>
                                            `);
                                        }
                                        if (pagesCount) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('pages_count') || 'Сторінок'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(String(pagesCount))}</span>
                                                </div>
                                            `);
                                        }
                                        if (coverType) {
                                            const coverLabel = coverType === 'hardcover' ? (t('cover_type_hardcover') || 'Тверда (Hardcover)')
                                                : (coverType === 'softcover' ? (t('cover_type_softcover') || 'М\'яка (Softcover)')
                                                : (coverType === 'digital' ? (t('cover_type_digital') || 'Цифрова') : coverType));
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('cover_type') || 'Тип видання'}</span>
                                                    <span class="collection-meta-value">${coverLabel}</span>
                                                </div>
                                            `);
                                        }
                                        if (dustJacket !== null && dustJacket !== undefined) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('dust_jacket') || 'Суперобкладинка'}</span>
                                                    <span class="collection-meta-value">${dustJacket === true || dustJacket === 'true' ? (t('yes') || 'Так') : (t('no') || 'Ні')}</span>
                                                </div>
                                            `);
                                        }
                                        if (releasePrice !== null && releasePrice !== undefined && releasePrice !== '') {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('release_price') || 'Ціна релізу'}</span>
                                                    <span class="collection-meta-value">${formatCurrency(releasePrice, releaseCurrency)}</span>
                                                </div>
                                            `);
                                        }
                                        if (dimensions) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('dimensions') || 'Розміри'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(dimensions)}</span>
                                                </div>
                                            `);
                                        }
                                        if (printRun) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('print_run') || 'Тираж'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(printRun)}</span>
                                                </div>
                                            `);
                                        }
                                        if (ageRating) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('age_rating') || 'Віковий рейтинг'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(ageRating)}</span>
                                                </div>
                                            `);
                                        }
                                        if (weight) {
                                            metaItems.push(`
                                                <div class="collection-meta-item">
                                                    <span class="collection-meta-label">${t('weight') || 'Вага'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(weight)}</span>
                                                </div>
                                            `);
                                        }
                                        if (finish) {
                                            metaItems.push(`
                                                <div class="collection-meta-item" style="grid-column: 1 / -1;">
                                                    <span class="collection-meta-label">${t('finish') || 'Особливості поліграфії'}</span>
                                                    <span class="collection-meta-value">${escapeHtmlAttribute(finish)}</span>
                                                </div>
                                            `);
                                        }

                                        if (metaItems.length === 0) {
                                            return `<div class="collection-meta-empty">${icon('helpCircle', 14)} <span>${t('no_tech_info') || 'Технічна інформація ще не додана'}</span></div>`;
                                        }
                                        return metaItems.join('');
                                    })()}
                                </div>
                            </div>
                        </div>
                        ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'col-edit-btn', editTitle: 'Редагувати' })}
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
                                            <span style="color: var(--text-muted); line-height: 0;">${icon(type, 12, { strokeWidth: 2.2 })}</span>
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
                                        ${issuesSortDir === 'asc' ? icon('sortAsc', 14, { strokeWidth: 2.5 }) : icon('sortDesc', 14, { strokeWidth: 2.5 })}
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
                                    ${icon('layers', 14, { strokeWidth: 2.2 })} Зміст
                                </button>
                                ${(isModerator && collection.collection_issues_count > 0) ? `
                                    <button class="readlist-btn" id="btn-clear-issues" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: color-mix(in srgb, var(--red) 8%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--red) 35%, transparent); color: var(--red);" title="Очистити вміст збірника">
                                        ${icon('trash', 14, { strokeWidth: 2.5 })} ${collection.collection_issues_count}
                                    </button>
                                ` : ''}
                                ${(isModerator) ? `
                                    <button class="readlist-btn" id="btn-add-issue" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: var(--bg-card); border: 1px solid var(--border);">
                                        ${icon('plus', 14, { strokeWidth: 2.5 })} Додати випуск
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

        initEditorsHistoryBlock(main, edits);

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
                            <img src="${normalizeImageUrl(rc.image)}" style="width: 100%; height: 100%; object-fit: cover; opacity: ${isCurrent ? '1' : '0.85'};" alt="${escapeHtmlAttribute(rc.name)}">
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
                        <button class="readlist-btn" id="rel-prev" ${relatedPage === 1 ? 'disabled' : ''} style="width: 32px; height: 32px; padding: 0;">${icon('chevronLeft', 16, { strokeWidth: 2.2 })}</button>
                        <span style="font-size: 13px; font-weight: 750; color: var(--text-2); min-width: 40px; text-align: center;">${relatedPage} / ${totalPages}</span>
                        <button class="readlist-btn" id="rel-next" ${relatedPage === totalPages ? 'disabled' : ''} style="width: 32px; height: 32px; padding: 0;">${icon('chevronRight', 16, { strokeWidth: 2.2 })}</button>
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
            btn.innerHTML = issuesSortDir === 'asc' ? icon('sortAsc', 14) : icon('sortDesc', 14);
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

        // Edit Purchase Price
        const priceBox = main.querySelector('#user-collection-price-box');
        if (priceBox) {
            const editPriceBtn = priceBox.querySelector('#btn-edit-purchase-price');
            if (editPriceBtn) {
                editPriceBtn.addEventListener('click', () => {
                    const hasUahReleasePrice = tech.release_currency === 'UAH' && releasePrice !== null && releasePrice !== undefined;
                    const currentVal = collection.user_purchase_price ?? (hasUahReleasePrice ? releasePrice : '');
                    const currentCurr = collection.user_purchase_currency || 'UAH';

                    priceBox.innerHTML = `
                        <form class="purchase-price-edit-form" id="purchase-price-form">
                            <span class="user-collection-price-label" style="width: 100%;">${t('purchase_price') || 'Ціна покупки'}:</span>
                            <input type="number" step="any" min="0" class="purchase-price-input" id="input-purchase-price" value="${currentVal}" placeholder="0.00">
                            <select class="purchase-price-select" id="select-purchase-currency">
                                <option value="UAH" ${currentCurr === 'UAH' ? 'selected' : ''}>UAH (₴)</option>
                                <option value="USD" ${currentCurr === 'USD' ? 'selected' : ''}>USD ($)</option>
                                <option value="EUR" ${currentCurr === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                                <option value="GBP" ${currentCurr === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                                <option value="JPY" ${currentCurr === 'JPY' ? 'selected' : ''}>JPY (¥)</option>
                                <option value="PLN" ${currentCurr === 'PLN' ? 'selected' : ''}>PLN (zł)</option>
                            </select>
                            <button type="submit" class="purchase-price-btn-save">${t('save') || 'Зберегти'}</button>
                            <button type="button" class="purchase-price-btn-cancel" id="btn-cancel-price-edit">${t('cancel') || 'Скасувати'}</button>
                        </form>
                    `;

                    const form = priceBox.querySelector('#purchase-price-form');
                    const cancelBtn = priceBox.querySelector('#btn-cancel-price-edit');

                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const rawPrice = form.querySelector('#input-purchase-price').value.trim();
                        const price = rawPrice !== '' ? parseFloat(rawPrice) : null;
                        const curr = form.querySelector('#select-purchase-currency').value;

                        try {
                            await API.put(`/collections/${collectionId}/purchase-price`, {
                                purchase_price: price,
                                purchase_currency: curr
                            });
                            collection.user_purchase_price = price;
                            collection.user_purchase_currency = curr;
                            renderCollectionDetail(main, params);
                        } catch (err) {
                            alert('Помилка оновлення ціни: ' + (err.message || 'Невідома помилка'));
                        }
                    });

                    cancelBtn.addEventListener('click', () => {
                        renderCollectionDetail(main, params);
                    });
                });
            }
        }

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
                    <div class="ds-modal-overlay" id="contents-modal-overlay" style="display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                        <div class="ds-modal" style="max-width: 480px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;">
                            <div class="ds-modal-header">
                                <div class="ds-modal-title">${icon('layers', 16)} Зміст збірника</div>
                                <button class="ds-modal-close" id="contents-modal-close">&times;</button>
                            </div>
                            <div class="ds-modal-body" style="overflow-y: auto; flex: 1; padding: 20px;">
                                ${contentsList.length > 0 ? `
                                    <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                        ${contentsList.map((item, i) => `
                                            <li style="display: flex; align-items: baseline; gap: 10px; padding: 8px 12px; background: var(--bg-2); border-radius: var(--r); border: 1px solid var(--border-s);">
                                                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 20px; text-align: right;">${i + 1}.</span>
                                                <span style="color: var(--text);">${escapeHtmlAttribute(item)}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                ` : `
                                    <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
                                        <div style="opacity: 0.5;">${icon('layers', 14, { strokeWidth: 2.2 })}</div>
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
