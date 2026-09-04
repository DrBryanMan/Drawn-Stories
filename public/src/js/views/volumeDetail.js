import { API } from '../helpers/api.js';
import { currentUser, getAvatarHtml } from '../shell.js';
import { Bookmarks } from '../helpers/bookmarks.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { langDisplay, langName, formatDate, formatIssueRanges } from '../helpers/lang.js';
import { createPaginator } from '../components/Pagination.js';
import { renderIssueGridCard } from '../components/cards/IssueGridCard.js';
import { VolumeEditor } from '../components/modals/EditVolumeModal.js';
import { VolumePicker } from '/admin/js/VolumePicker.js';
import { openScrapeProgressModal } from '../components/ScrapeProgressModal.js';
import { translateStaffRole } from '../helpers/staff.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t, getCurrentLanguage } from '../helpers/i18n.js';
import { icon } from '../helpers/icons.js';
import { renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';

let currentItems = [];
let currentView = localStorage.getItem('ds-volume-view') || 'grid';

// ── Helpers ─────────────────────────────────────────


function themeName(theme) {
    if (getCurrentLanguage() === 'en') {
        return theme.name || theme.ua_name || 'Theme';
    }
    return theme.ua_name || theme.name || 'Тема';
}

function themeType(theme) {
    return theme.type || 'theme';
}

function isMangaVolume(volume, themes = [], translationParents = []) {
    if (volume.hikka_slug) return true;
    if (translationParents.some(parent => parent.hikka_slug || parent.rel_type === 'translation')) return true;

    return themes.some(theme => {
        if ([36, 140, 141].includes(Number(theme.id))) return true;
        const name = `${theme.name || ''} ${theme.ua_name || ''}`.toLowerCase();
        return name.includes('manga') || name.includes('манга') || name.includes('манґа');
    });
}

function isCollectionVolume(themes = []) {
    return themes.some(theme => {
        const name = `${theme.name || ''} ${theme.ua_name || ''}`.toLowerCase();
        return name.includes('collection') || name.includes('збірник') || name.includes('збірка');
    });
}

function isTranslatedVolume(themes = []) {
    return themes.some(theme => {
        const name = (theme.name || '').toLowerCase();
        return name === 'translated';
    });
}

function formatYearPeriod(volume) {
    const start = volume.start_year;
    const end = volume.end_year;
    if (!start) return 'Рік невідомий';
    
    if (end === 'Ongoing') return `${start} — Триває`;
    if (end && end !== start) return `${start} — ${end}`;
    return String(start);
}

function formatIssuesRange(issues) {
    if (!issues || !issues.length) return '';
    const nums = issues
        .map(i => parseInt(i.issue_number, 10))
        .filter(n => !isNaN(n));
    if (!nums.length) return '';
    
    const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
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

function getReadlistOptions() {
    return [
        { value: '',          label: t('add_to_list'),     icon: icon('plus', 14, { strokeWidth: 2.2 }), color: 'var(--status-default)', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
        { value: 'Planned',   label: t('list_planned'),     icon: icon('planned', 14, { strokeWidth: 2.2 }), color: 'var(--status-planned)', bg: 'color-mix(in srgb, var(--status-planned) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-planned) 20%, var(--border-s))' },
        { value: 'Reading',   label: t('list_reading'),     icon: icon('reading', 14, { strokeWidth: 2.2 }), color: 'var(--status-reading)', bg: 'color-mix(in srgb, var(--status-reading) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-reading) 20%, var(--border-s))' },
        { value: 'Completed', label: t('list_completed'),   icon: icon('completed', 14, { strokeWidth: 2.2 }), color: 'var(--status-completed)', bg: 'color-mix(in srgb, var(--status-completed) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-completed) 20%, var(--border-s))' },
        { value: 'On Hold',   label: t('list_on_hold'),     icon: icon('onHold', 14, { strokeWidth: 2.2 }), color: 'var(--status-on-hold)', bg: 'color-mix(in srgb, var(--status-on-hold) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-on-hold) 20%, var(--border-s))' },
        { value: 'Dropped',   label: t('list_dropped'),     icon: icon('dropped', 14, { strokeWidth: 2.2 }), color: 'var(--status-dropped)', bg: 'color-mix(in srgb, var(--status-dropped) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-dropped) 20%, var(--border-s))' },
    ];
}

function readlistOptionLabel(value) {
    const options = getReadlistOptions();
    return options.find(o => o.value === value) || options[0];
}

const THEME_ICON = {
    type: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
    genre: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    theme: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
};

// ── HTML builders ───────────────────────────────────
function volumeFact(label, value) {
    if (!value) return '';
    return `
        <div class="volume-fact">
            <dt>${label}</dt>
            <dd>${escapeHtmlAttribute(String(value))}</dd>
        </div>
    `;
}

function themeChipHTML(theme) {
    const name = escapeHtmlAttribute(themeName(theme));
    const url = `#/catalog?theme_ids=${theme.id}`;
    return `<a href="${url}" class="volume-theme-chip volume-theme-chip--${themeType(theme)}">${name}</a>`;
}

function relationCardHTML(item, { title, icon, isModerator, onRemove }) {
    if (!item?.id) return '';

    const cover = normalizeImageUrl(item.image || item.image || item.cover_img);
    const name = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
    const originalName = item.name_uk && item.name_uk !== item.name ? item.name : '';
    const lang = langDisplay(item.lang);

    const href = item.type === 'magazine' ? `#/magazines/${item.id}` : `#/volumes/${item.id}`;

    return `
        <a class="volume-relation-card" href="${href}">
            ${isModerator && onRemove ? `<button class="btn-remove-rel" onclick="event.preventDefault(); event.stopPropagation(); ${onRemove}" title="Видалити зв'язок">✕</button>` : ''}
            <span class="volume-relation-cover">
                ${cover
                    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                    : icon}
            </span>
            <span class="volume-relation-content">
                <span class="volume-relation-label">${icon}${title}</span>
                <span class="volume-relation-title">
                    ${lang.code ? `<span class="volume-relation-lang">${escapeHtmlAttribute(lang.code)}</span>` : ''}
                    ${name}
                </span>
                ${originalName ? `<span class="volume-relation-meta">${escapeHtmlAttribute(originalName)}</span>` : ''}
                ${item.publisher_name ? `<span class="volume-relation-meta">${escapeHtmlAttribute(item.publisher_name)}</span>` : ''}
                ${item.collections_count ? `<span class="volume-relation-meta">${Number(item.collections_count).toLocaleString('uk-UA')} збір.</span>` : ''}
            </span>
        </a>
    `;
}

function heroRelationsHTML({ translationParents, magazineParents, magazine, isModerator, currentVolumeId }) {
    const source = translationParents.find(parent => parent.rel_type === 'source');
    const magazines = magazineParents.length ? magazineParents : (magazine ? [magazine] : []);
    const original = magazines.length > 0 ? null : translationParents.find(parent => parent.rel_type === 'translation');
    
    const cards = [
        original ? relationCardHTML(original, {
            title: 'Оригінал',
            icon: icon('bookOpen', 14),
            isModerator,
            onRemove: `window.removeTranslation(${original.id}, ${currentVolumeId})`
        }) : '',
        source ? relationCardHTML(source, {
            title: 'Джерело',
            icon: icon('link', 14),
            isModerator,
            onRemove: `window.removeTranslation(${source.id}, ${currentVolumeId})`
        }) : '',
        ...magazines.map(item => relationCardHTML(item, {
            title: 'Журнал',
            icon: icon('newspaper', 14),
            isModerator,
            onRemove: `window.removeMagazineChild(${item.id}, ${currentVolumeId})`
        })),
    ].filter(Boolean);

    if (!cards.length) return '';
    return `
        <div class="volume-hero-relations-block">
            <div class="synopsis-header">
                <h3 class="synopsis-title">Зв'язки</h3>
            </div>
            <div class="volume-hero-relations">${cards.join('')}</div>
        </div>
    `;
}

function translationCardHTML(item, { isModerator, currentVolumeId }) {
    const isCurrent = item.id === currentVolumeId;
    const cover = normalizeImageUrl(item.image || item.image);
    const title = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
    const originalTitle = item.name_uk && item.name_uk !== item.name ? item.name : '';
    const collectionsCount = Number(item.collections_count || 0);
    const lang = langDisplay(item.lang);

    const tag = isCurrent ? 'div' : 'a';
    const hrefAttr = isCurrent ? '' : ` href="#/volumes/${item.id}"`;
    const currentClass = isCurrent ? ' is-current' : '';

    return `
        <${tag} class="volume-translation-card${currentClass}"${hrefAttr}>
            ${isModerator && !isCurrent ? `<button class="btn-remove-rel" onclick="event.preventDefault(); event.stopPropagation(); window.removeTranslation(${currentVolumeId}, ${item.id})" title="Видалити переклад">✕</button>` : ''}
            <span class="volume-translation-poster">
                ${cover
                    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">`
                    : icon('bookOpen', 14)}
            </span>
            <span class="volume-translation-body">
                <span class="volume-translation-title">${lang.code ? `<span class="volume-translation-lang">${escapeHtmlAttribute(lang.code)}</span>` : ''} ${title}</span>
                ${originalTitle ? `<span class="volume-translation-original">${escapeHtmlAttribute(originalTitle)}</span>` : ''}
                <span class="volume-translation-count">${item.publisher_name + ' / ' || ''}${collectionsCount.toLocaleString('uk-UA')} збір.</span>
            </span>
        </${tag}>
    `;
}

function translationsSectionHTML(translations, { isModerator, currentVolumeId }) {
    if (!isModerator && !translations.length) return '';

    return `
        <section class="volume-translations-section block">
            <div class="section-header">
                <div class="section-title">
                    <h2>Збірні видання ${translations.length ? `(${translations.length})` : ''}</h2>
                    ${isModerator ? `<button class="btn-admin btn-admin--secondary" id="volume-add-translation-btn" title="Додати переклад" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;">${icon('plus', 14, { strokeWidth: 2.5 })}</button>` : ''}
                </div>
            </div>
            <div class="volume-translations-grid">
                ${translations.map(t => translationCardHTML(t, { isModerator, currentVolumeId })).join('')}
            </div>
        </section>
    `;
}

function readlistUIHTML(isCollection = false, stats = {}) {
    if (isCollection) {
        const total = stats.collections || 0;
        const owned = stats.owned_collections || 0;
        const allOwned = total > 0 && owned === total;
        const someOwned = owned > 0 && owned < total;

        let btnClass = 'btn-add-all-collection';
        let btnText = 'Додати все до колекції';
        let btnIcon = icon('plus', 14);

        if (allOwned) {
            btnClass += ' btn-all-owned';
            btnText = `В колекції (${owned}/${total})`;
            btnIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (someOwned) {
            btnClass += ' btn-some-owned';
            btnText = `Додати решту (${total - owned})`;
        }

        return `
            <div class="volume-readlist-controls">
                <button class="${btnClass} ${!currentUser ? 'btn-disabled' : ''}" id="btn-add-all-collection" ${!currentUser || allOwned ? 'disabled' : ''}>
                    ${btnIcon}
                    <span>${btnText}</span>
                </button>
            </div>
        `;
    }

    const readlistOptions = getReadlistOptions();
    const defaultOpt = readlistOptions[0];
    const activeOpts = readlistOptions.filter(opt => opt.value !== '');
    return `
        <div class="volume-readlist-controls">
            <div class="readlist-select-wrap">
                <select class="filter-select readlist-select" id="readlist-select" ${!currentUser ? 'disabled' : ''}>
                    <button>
                        <span class="readlist-select-chosen">
                            <span class="readlist-icon" style="color: ${defaultOpt.color}">${defaultOpt.icon}</span>
                            <span class="select-label">${defaultOpt.label}</span>
                        </span>
                        <span class="select-chevron-v">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                        </span>
                    </button>
                    ${activeOpts.map(opt => `
                        <option value="${opt.value}">
                            <span class="readlist-icon" style="color: ${opt.color}">${opt.icon}</span>
                            <span>${opt.label}</span>
                        </option>
                    `).join('')}
                    <option value="" class="readlist-remove-option">
                        <span class="readlist-icon" style="color: #dc2626">${icon('trash', 14, { strokeWidth: 2.2 })}</span>
                        <span>${t('remove_from_list')}</span>
                    </option>
                </select>
            </div>
            <button class="readlist-btn ${!currentUser ? 'readlist-btn--anon' : ''}" id="readlist-favorite-btn" title="${currentUser ? t('add_to_fav') : t('add_to_bookmarks')}">
                ${currentUser ? icon('heart', 14, { strokeWidth: 2.5 }) : icon('bookmark', 20)}
            </button>
        </div>
    `;
}

// ── Skeleton ────────────────────────────────────────
function renderSkeleton(main) {
    main.innerHTML = `
        <div class="volume-detail">
            <section class="volume-hero-band">
                <div class="container volume-skeleton-hero">
                    <div class="volume-cover-column">
                        <div class="skeleton skeleton-rect" style="width: 100%; aspect-ratio: 2/3;"></div>
                    </div>
                    <div class="volume-hero-info" style="gap: 14px;">
                        <div class="skeleton skeleton-text" style="width: 120px; height: 22px; border-radius: 999px;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; height: 36px;"></div>
                        <div class="skeleton skeleton-text" style="width: 45%; height: 16px;"></div>
                    </div>
                </div>
            </section>
        </div>
    `;
}

// ── Render items (grid / table) ─────────────────────
function renderItems(container, items) {
    if (!items.length) {
        container.innerHTML = `
            <div class="volume-empty-issues">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>
                </svg>
                <h3>Нічого не знайдено</h3>
                <p>Для цього тому ще не додані випуски.</p>
            </div>
        `;
        return;
    }

    if (currentView === 'grid') {
        container.innerHTML = `
            <div class="issues-view-grid">
                ${items.map(item => renderIssueGridCard(item, { showVolumeName: !!item.volume_name })).join('')}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="issues-view-table">
                <table class="issues-table">
                    <thead>
                        <tr>
                            <th style="width: 60px">#</th>
                            <th>Назва</th>
                            <th style="width: 120px">Дата</th>
                            <th style="width: 120px">У збірниках</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
                            const cover = normalizeImageUrl(item.image || item.image || item.cover_img);
                            const isCollection = item.type === 'collection' || item.is_collection;
                            const isVolume = item.type === 'volume';
                            const isMangaChapter = item.type === 'manga_chapter';
                            const link = isVolume ? `#/volumes/${item.id}` : (isCollection ? `#/collections/${item.id}` : (isMangaChapter ? `#/manga-chapters/${item.id}` : `#/issues/${item.id}`));
                            const title = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
                            const issueNumLabel = item.chapter_number || item.issue_number || '—';

                            return `
                                <tr ${link ? `data-link="${link}" style="cursor: pointer;"` : ''}>
                                    <td class="table-issue-num">${escapeHtmlAttribute(issueNumLabel)}</td>
                                    <td>
                                        <div class="table-issue-info">
                                            ${cover ? `<img class="table-issue-thumb" src="${escapeHtmlAttribute(cover)}" loading="lazy">` : ''}
                                            <div style="display:flex; flex-direction:column; gap:1px; min-width:0;">
                                                <span class="table-issue-name">${title}</span>
                                                ${(() => {
                                                    const volLabel = item.volume_name_uk || item.volume_name || '';
                                                    const isDup = !volLabel || volLabel === (item.name_uk || item.name || '');
                                                    return (!isCollection && !isVolume && !isMangaChapter && !isDup)
                                                        ? `<span class="table-issue-volume-label">${escapeHtmlAttribute(volLabel)}</span>`
                                                        : '';
                                                })()}
                                            </div>
                                            ${isVolume ? '<span class="issue-grid-type-badge" style="position:static; margin-left:8px; padding:2px 6px;">Манґа</span>' : (isCollection ? '<span class="issue-grid-type-badge" style="position:static; margin-left:8px; padding:2px 6px;">Збірник</span>' : '')}
                                        </div>
                                    </td>
                                    <td class="table-issue-date">${isVolume ? (item.start_year || '') : formatDate(item.release_date, '—')}</td>
                                    <td>
                                         ${isCollection ? `
                                             <button class="issue-grid-toggle-btn ${item.is_owned ? 'is-owned' : ''}" data-id="${item.id}" title="${item.is_owned ? 'Видалити з колекції' : 'Додати в колекцію'}" style="position: static; width: 28px; height: 28px;">
                                                 ${item.is_owned ? icon('trash', 14) : icon('plus', 14)}
                                             </button>
                                         ` : ''}
                                         ${(!isCollection && !isVolume) ? `
                                             <button class="table-membership-btn ${item.collection_count === 0 ? 'is-disabled' : ''}" 
                                                     data-issue-id="${item.id}" 
                                                     data-item-type="${item.type || 'issue'}"
                                                     title="${item.collection_count > 0 ? 'У збірниках' : 'Не у збірниках'}"
                                                     ${item.collection_count === 0 ? 'style="opacity: 0.4; cursor: default;"' : ''}>
                                                 ${icon('layers', 14, { strokeWidth: 2.2 })}
                                                 <span class="membership-count">${item.collection_count || 0}</span>
                                             </button>` : ''}
                                     </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

// ── Sort ─────────────────────────────────────────────
function sortItems(items, order = 'number_asc') {
    const isDesc = order.endsWith('_desc');
    const field = order.replace(/_(asc|desc)$/, '');

    return [...items].sort((a, b) => {
        if (field === 'series') {
            const volA = (a.volume_name_uk || a.volume_name || '').toLowerCase();
            const volB = (b.volume_name_uk || b.volume_name || '').toLowerCase();
            const volCmp = volA.localeCompare(volB, 'uk');
            if (volCmp !== 0) return isDesc ? -volCmp : volCmp;
            const nA = Number.parseFloat(a.issue_number);
            const nB = Number.parseFloat(b.issue_number);
            if (Number.isFinite(nA) && Number.isFinite(nB) && nA !== nB) {
                return isDesc ? nB - nA : nA - nB;
            }
            const strCmp = String(a.issue_number || '').localeCompare(String(b.issue_number || ''), 'uk', { numeric: true });
            return isDesc ? -strCmp : strCmp;
        }

        if (field === 'date') {
            const dateA = a.release_date || '';
            const dateB = b.release_date || '';
            if (dateA && dateB && dateA !== dateB) {
                return isDesc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
            }
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            const numA = Number.parseFloat(a.issue_number);
            const numB = Number.parseFloat(b.issue_number);
            if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
                return isDesc ? numB - numA : numA - numB;
            }
            return 0;
        }

        // Default: sort by number
        const numA = Number.parseFloat(a.issue_number);
        const numB = Number.parseFloat(b.issue_number);
        if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
            return isDesc ? numB - numA : numA - numB;
        }
        const strCmp = String(a.issue_number || '').localeCompare(String(b.issue_number || ''), 'uk', { numeric: true });
        return isDesc ? -strCmp : strCmp;
    });
}

function sortCollections(collections, order = 'number_asc') {
    const isDesc = order.endsWith('_desc');
    const field = order.replace(/_(asc|desc)$/, '');

    return [...collections].sort((a, b) => {
        // Спочатку групуємо за батьківською серією
        const volA = (a.parent_vol_name || '').toLowerCase();
        const volB = (b.parent_vol_name || '').toLowerCase();
        const volCmp = volA.localeCompare(volB, 'uk');
        if (volCmp !== 0) return volCmp;

        const parentIdA = a.parent_vol_id || 0;
        const parentIdB = b.parent_vol_id || 0;
        if (parentIdA !== parentIdB) return parentIdA - parentIdB;

        // Всередині групи
        if (field === 'date') {
            const dateA = a.release_date || '';
            const dateB = b.release_date || '';
            if (dateA && dateB && dateA !== dateB) {
                return isDesc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
            }
            if (dateA && !dateB) return isDesc ? 1 : -1;
            if (!dateA && dateB) return isDesc ? -1 : 1;
        }

        if (field === 'name') {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            const nameCmp = nameA.localeCompare(nameB, 'uk');
            if (nameCmp !== 0) return isDesc ? -nameCmp : nameCmp;
        }

        // За замовчуванням: за числовим номером
        const numA = Number.parseFloat(a.issue_number);
        const numB = Number.parseFloat(b.issue_number);
        if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
            return isDesc ? numB - numA : numA - numB;
        }
        const strCmp = String(a.issue_number || '').localeCompare(String(b.issue_number || ''), 'uk', { numeric: true });
        if (strCmp !== 0) return isDesc ? -strCmp : strCmp;

        return (a.name || '').localeCompare(b.name || '', 'uk');
    });
}

// ── Main render ─────────────────────────────────────
export async function renderVolumeDetail(main, params = {}, query = {}) {
    const volumeId = Number(params.id);
    if (!Number.isFinite(volumeId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор тому.</div></div>';
        return;
    }

    renderSkeleton(main);

    try {
        const [data, readlistStatus, ratingData, editsRes] = await Promise.all([
            API.get(`/volumes/${volumeId}`),
            API.get(`/user/readlist/${volumeId}`),
            API.get(`/ratings/volume/${volumeId}`),
            API.get(`/volumes/${volumeId}/edit-history`)
        ]);

        const edits = editsRes.data || [];

        const {
            volume,
            themes = [],
            stats = {},
            magazine,
            translation_parents: translationParents = [],
            translations = [],
            magazine_parents: magazineParents = [],
            magazine_children: magazineChildren = [],
            characters = [],
            staff = [],
        } = data;

        const coverUrl = normalizeImageUrl(volume.image || volume.cover_img);
        const bannerUrl = normalizeImageUrl(volume.cover_img || volume.image);
        const heroBannerStyle = bannerUrl ? ` style="--volume-banner-url: url('${escapeHtmlAttribute(bannerUrl)}')"` : '';
        const heroBannerClass = bannerUrl ? ' volume-hero-band--banner' : '';
        const title = escapeHtmlAttribute(volume.name_uk || volume.name_en || volume.name);
        const subTitleValue = volume.name && volume.name !== (volume.name_uk || volume.name_en || volume.name) ? volume.name : '';
        const subTitle = escapeHtmlAttribute(subTitleValue);
        const publisherName = escapeHtmlAttribute(volume.publisher_name || 'Невідоме видавництво');
        const hasThemes = themes.length > 0;
        const isModerator = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
        const heroRelations = heroRelationsHTML({ 
            translationParents, 
            magazineParents, 
            magazine, 
            isModerator, 
            currentVolumeId: volumeId 
        });

        const isManga = isMangaVolume(volume, themes, translationParents);
        const isCollection = isCollectionVolume(themes);
        const isMagazine = themes.some(t => t.id === 35);
        const isMangaWithMagazine = isManga && Boolean(magazine);

        const issuesTabLabel = isMagazine ? t('magazine_issues_label') : (isManga ? t('manga_chapters_label') : t('releases'));
        const collectionsTabLabel = isMagazine ? t('manga_series') : (isManga ? t('volumes') : t('collections'));
        
        const shouldSeparate = isManga || isCollection;
        currentItems = shouldSeparate ? (data.issues || []) : (data.items || data.issues || []);

        let currentCollections = isMagazine ? magazineChildren : [];
        if (!isMagazine) {
            try {
                const collRes = await API.get(`/volumes/${volumeId}/collections-from-issues`);
                currentCollections = collRes.data || [];
            } catch (e) {
                console.error(e);
            }
        }

        const issuesTabSuffix = currentItems.length > 0 ? ` (${currentItems.length})` : '';
        const collectionsTabSuffix = currentCollections.length > 0 ? ` (${currentCollections.length})` : '';

        const groupedStaff = new Map();
        staff.forEach(person => {
            if (!groupedStaff.has(person.id)) {
                groupedStaff.set(person.id, {
                    id: person.id,
                    name: person.name_uk || person.name,
                    nameEn: person.name,
                    nameNative: person.name_native,
                    image: person.image,
                    roles: [person.role]
                });
            } else {
                const existing = groupedStaff.get(person.id);
                if (person.role && !existing.roles.includes(person.role)) {
                    existing.roles.push(person.role);
                }
            }
        });

        const authorCards = Array.from(groupedStaff.values()).map(person => {
            const cover = person.image ? normalizeImageUrl(person.image) : '';
            const name = escapeHtmlAttribute(person.name);
            const rolesLabel = person.roles.filter(Boolean).map(r => translateStaffRole(r)).join(', ');
            return `
                <a class="volume-staff-card" href="#/persons/${person.id}">
                    <span class="volume-staff-avatar">
                        ${cover
                            ? `<img src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                            : `<div class="volume-staff-avatar-empty">${icon('user', 14, { strokeWidth: 2.2 })}</div>`}
                    </span>
                    <span class="volume-staff-content">
                        <span class="volume-staff-name">${name}</span>
                        <span class="volume-staff-roles">${escapeHtmlAttribute(rolesLabel)}</span>
                    </span>
                </a>
            `;
        }).join('');
        
        const authorsHTML = authorCards ? `
            <div class="volume-hero-staff-block">
                <div class="synopsis-header">
                    <h3 class="synopsis-title">Автори</h3>
                </div>
                <div class="volume-hero-staff">${authorCards}</div>
            </div>
        ` : '';

        const charactersHTML = characters.length > 0 ? `
            <section class="volume-characters-section block">
                <div class="section-header">
                    <h2 class="section-title">Персонажі тома</h2>
                    ${characters.length > 8 ? `
                        <a href="javascript:void(0)" id="btn-show-all-characters" class="section-link">
                            Всі персонажі (${characters.length})
                            ${icon('chevronRight', 16, { strokeWidth: 2.2 })}
                        </a>
                    ` : ''}
                </div>
                <div class="characters-grid">
                    ${characters.slice(0, 8).map(char => {
                        const cover = char.image ? normalizeImageUrl(char.image) : '';
                        const name = escapeHtmlAttribute(char.name_uk || char.name || 'Без назви');
                        const roleLabel = char.role === 'main' ? 'Основний' : 'Другорядний';
                        const roleClass = char.role === 'main' ? 'role-main' : 'role-supporting';
                        const charLink = char.cv_slug ? `#/characters/${char.id}-${char.cv_slug}` : `#/characters/${char.id}`;
                        return `
                            <a href="${charLink}" class="character-card" style="text-decoration: none; color: inherit;">
                                <div class="char-cover-wrap">
                                    ${cover
                                        ? `<img class="char-cover" src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                                        : `<div class="char-cover-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>`
                                    }
                                    <span class="char-role-badge ${roleClass}">${roleLabel}</span>
                                </div>
                                <div class="char-info">
                                    <span class="char-name" title="${name}">${name}</span>
                                </div>
                            </a>
                        `;
                    }).join('')}
                </div>
            </section>
        ` : '';

        const hasUaSynopsis = !!(volume.synopsis_ua || volume.description);
        const activeTab = hasUaSynopsis ? 'ua' : 'en';

        const synopsisHTML = `<div class="volume-synopsis">
                   <div class="synopsis-header">
                       <h2 class="synopsis-title">${t('synopsis')}</h2>
                       <div class="synopsis-tabs">
                           <button class="synopsis-tab ${activeTab === 'ua' ? 'is-active' : ''}" data-tab="ua">UA</button>
                           <button class="synopsis-tab ${activeTab === 'en' ? 'is-active' : ''}" data-tab="en">EN</button>
                       </div>
                   </div>
                   <div class="synopsis-content">
                       <div class="synopsis-pane ${activeTab === 'ua' ? 'is-active' : ''}" id="synopsis-ua">
                           ${volume.synopsis_ua || t('no_synopsis_ua')}
                       </div>
                       <div class="synopsis-pane ${activeTab === 'en' ? 'is-active' : ''}" id="synopsis-en">
                           ${volume.synopsis || t('no_synopsis_en')}
                       </div>
                   </div>
                   ${volume.description ? `
                       <div class="volume-description-extra">
                           <h2 class="synopsis-title" style="margin-top: 1.5rem;">${t('description')}</h2>
                           <div class="synopsis-pane is-active" style="padding: 0;">
                               ${volume.description}
                           </div>
                       </div>
                   ` : ''}
               </div>`;

        const hasExternalLinks = volume.cv_id || volume.hikka_slug || volume.mal_id || volume.site_link;
        const externalLinksBlockHTML = hasExternalLinks
            ? `<div class="volume-cover-ext-sources" style="margin-top: 16px; border-top: 1px solid var(--border-s); padding-top: 16px; width: 100%;">
                   <div style="font-family: var(--font-oswald); font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; text-align: center;">${t('external_sources')}</div>
                   <div class="source-links">
                       ${volume.cv_id ? `
                           <a href="https://comicvine.gamespot.com/${volume.cv_slug}/4050-${volume.cv_id}/" class="source-link-cv" target="_blank" rel="noreferrer">
                               CV
                               ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                           </a>
                       ` : ''}
                       ${volume.hikka_slug ? `
                           <a href="https://hikka.io/manga/${volume.hikka_slug}" class="source-link-hikka" target="_blank" rel="noreferrer">
                               Hikka
                               ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                           </a>
                       ` : ''}
                       ${volume.mal_id ? `
                           <a href="https://myanimelist.net/manga/${volume.mal_id}" class="source-link-mal" target="_blank" rel="noreferrer">
                               MAL
                               ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                           </a>
                       ` : ''}
                       ${volume.site_link ? `
                           <a href="${escapeHtmlAttribute(volume.site_link)}" class="source-link-site" target="_blank" rel="noreferrer">
                               SITE
                               ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                           </a>
                       ` : ''}
                   </div>
               </div>`
            : '';



        const editorsHistoryBlockHTML = renderEditorsHistoryBlock(edits, currentUser, {
            editButtonId: 'volume-edit-btn',
            editTitle: isModerator ? 'Редагувати' : t('suggest_edit')
        });

        main.innerHTML = `
            <div class="volume-detail">
                <section class="volume-hero-band${heroBannerClass}"${heroBannerStyle}>
                    <div class="container volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty">
                                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>
                                    </svg>
                                  </div>`}
                            ${readlistUIHTML(isCollection, stats)}
                            
                            ${translationParents.length === 0 ? `
                                <svg style="width:0; height:0; position:absolute;" aria-hidden="true" focusable="false">
                                    <linearGradient id="half-fill-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="50%" stop-color="#ffc107" />
                                        <stop offset="50%" stop-color="var(--border)" />
                                    </linearGradient>
                                </svg>

                                <div class="user-interaction-block">
                                    <div class="interactive-rating-section">
                                        <div class="interactive-rating-title" style="display: flex; justify-content: space-between; align-items: center;">
                                            <span>${t('your_rating')}</span>
                                            <span class="user-score-badge" style="font-family: var(--font-mono); font-weight: bold; color: #ffc107;"></span>
                                        </div>
                                        <div class="star-rating-widget" data-entity-type="volume" data-entity-id="${volumeId}">
                                            ${[1, 2, 3, 4, 5].map(starIndex => {
                                                return `
                                                    <div class="star-container" data-star-index="${starIndex}">
                                                        <div class="star-half star-left"></div>
                                                        <div class="star-half star-right"></div>
                                                        <svg class="star-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                                        </svg>
                                                    </div>
                                                `;
                                            }).join('')}
                                            <button class="btn-clear-rating" title="${t('clear_rating')}" style="display: none;">✕</button>
                                        </div>
                                    </div>

                                    ${currentUser ? `
                                        <div class="read-progress-section">
                                            <div class="progress-title">
                                                <span>${t('issues_read')}</span>
                                                <span class="progress-type-badge" id="read-progress-hint" title="${t('progress_hint_tooltip')}">
                                                    ${readlistStatus.issues_count !== null ? `${icon('edit', 11)} ${t('progress_manual_short')}` : `${icon('sparkles', 11)} ${t('progress_auto_short')}`}
                                                </span>
                                            </div>
                                            <div class="progress-controls">
                                                <div class="progress-stepper">
                                                    <button type="button" class="stepper-btn" id="btn-progress-minus" title="Зменшити на 1">${icon('minus', 13)}</button>
                                                    <button type="button" class="stepper-btn" id="btn-progress-plus" title="Збільшити на 1">${icon('plus', 13)}</button>
                                                </div>
                                                <div class="progress-value-wrap">
                                                    <input type="number" min="0" max="${stats.issues || 0}" class="progress-input" id="read-issues-input" value="${readlistStatus.issues_count !== null ? readlistStatus.issues_count : ''}" placeholder="${readlistStatus.read_issues_count}">
                                                    <span class="progress-slash">/</span>
                                                    <span class="progress-total">${stats.issues || 0}</span>
                                                </div>
                                                <button type="button" class="progress-save-btn" id="save-progress-btn" title="${t('save')}">${icon('save', 14)}</button>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                            ${externalLinksBlockHTML}
                        </div>

                        <div class="volume-hero-info">
                            <div class="volume-header">
                                <div class="volume-title">
                                    <span class="volume-main-title">
                                        <h1>
                                            ${title}
                                            <button class="btn-synonyms" id="btn-show-synonyms" title="${t('all_names_synonyms')}">
                                                ${icon('language', 13, { strokeWidth: 2.2 })}
                                            </button>
                                        </h1>
                                    </span>
                                    <span class="volume-original-title">${subTitle}</span>
                                </div>
                            </div>
                            <div class="volume-hero-badges">
                                ${magazine ? `
                                    <a href="#/catalog?magazine_ids=${magazine.id}" class="volume-badge volume-magazine-badge" title="Журнал">
                                        ${icon('book', 13, { strokeWidth: 2.2 })}
                                        ${escapeHtmlAttribute(magazine.name)}
                                    </a>
                                ` : `
                                    <a href="${volume.publisher ? `#/publishers/${volume.publisher}` : '#/publishers'}" class="volume-badge volume-publisher-badge" title="Видавництво">
                                        ${icon('building', 13, { strokeWidth: 2.2 })}
                                        ${publisherName}
                                    </a>
                                `}
                                ${volume.lang ? `
                                    <span class="volume-badge volume-lang-badge" title="Мова видання">
                                        ${icon('language', 13, { strokeWidth: 2.2 })}
                                        ${langName(volume.lang)}
                                    </span>
                                ` : ''}
                                <span class="volume-badge volume-year-badge" title="Період видання">
                                    ${icon('calendar', 13, { strokeWidth: 2.2 })}
                                    ${formatYearPeriod(volume)}
                                </span>
                            </div>

                            ${synopsisHTML}
                        </div>

                        <div class="volume-hero-aside">
                            <div class="volume-ratings">
                                <div class="rating-item rating-main" title="Середня оцінка користувачів: ${ratingData.average || 0} (${ratingData.count} оцінок)">
                                    ${icon('star', 14, { strokeWidth: 2.5 })}
                                    <span class="rating-value">${ratingData.average ? ratingData.average.toFixed(1) : '—'}</span>
                                </div>
                                ${volume.hikka_score ? `
                                    <div class="rating-item rating--hikka" title="Голосів на Hikka: ${volume.hikka_scored_by || 0}">
                                        <span class="rating-value">${Number(volume.hikka_score).toFixed(2)}</span>
                                        <span class="rating-label rating--hikka">Hikka</span>
                                    </div>
                                ` : ''}
                                ${volume.mal_score ? `
                                    <div class="rating-item rating--mal" title="Голосів на MAL: ${volume.mal_scored_by || 0}">
                                         <span class="rating-value">${Number(volume.mal_score).toFixed(2)}</span>
                                        <span class="rating-label">MAL</span>
                                    </div>
                                ` : ''}
                            </div>
                            ${authorsHTML}
                            ${heroRelations}
                            ${(() => {
                                // Find translations in uk language
                                const ukTranslations = translations.filter(t => t.lang === 'uk');
                                if (!ukTranslations.length) return '';
                                
                                return `
                                    <div class="volume-hero-relations-block volume-published-uk-block">
                                        <div class="synopsis-header">
                                            <h3 class="synopsis-title">Видається українською</h3>
                                        </div>
                                        <div class="volume-hero-relations">
                                            ${ukTranslations.map(item => {
                                                const cover = normalizeImageUrl(item.image || item.cover_img);
                                                const name = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
                                                const href = `#/volumes/${item.id}`;
                                                const collectionsCount = Number(item.collections_count || 0);
                                                const publisherStr = item.publisher_name ? `<span class="volume-relation-meta">${escapeHtmlAttribute(item.publisher_name)}</span>` : '';
                                                
                                                return `
                                                    <a class="volume-relation-card" href="${href}">
                                                        <span class="volume-relation-cover">
                                                            ${cover
                                                                ? `<img src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                                                                : icon('bookOpen', 14)}
                                                        </span>
                                                        <span class="volume-relation-content">
                                                            <span class="volume-relation-title">${name}</span>
                                                            ${publisherStr}
                                                            <span class="volume-relation-meta">${collectionsCount.toLocaleString('uk-UA')} збір.</span>
                                                        </span>
                                                    </a>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            })()}
                        </div>
                        ${editorsHistoryBlockHTML}
                    </div>
                    <div class="volume-hero-tabs-band">
                        <div style="display: flex; justify-content: center;">
                            <div class="volume-page-tabs">
                                <button class="volume-page-tab-btn" data-page-tab="main">${t('tab_main')}</button>
                                <button class="volume-page-tab-btn" data-page-tab="issues" ${currentItems.length === 0 ? 'disabled' : ''}>
                                    <span>${issuesTabLabel}</span>
                                    ${currentItems.length > 0 ? `<span class="tab-count">${currentItems.length}</span>` : ''}
                                </button>
                                <button class="volume-page-tab-btn" data-page-tab="collections">
                                    <span>${collectionsTabLabel}</span>
                                    ${currentCollections.length > 0 ? `<span class="tab-count">${currentCollections.length}</span>` : ''}
                                </button>
                                <button class="volume-page-tab-btn" data-page-tab="characters" ${characters.length === 0 ? 'disabled' : ''}>
                                    <span>${t('characters')}</span>
                                    ${characters.length > 0 ? `<span class="tab-count">${characters.length}</span>` : ''}
                                </button>
                                <button class="volume-page-tab-btn" data-page-tab="editions" ${(!isModerator && translations.length === 0) ? 'disabled' : ''}>
                                    <span>${t('other_editions')}</span>
                                    ${translations.length > 0 ? `<span class="tab-count">${translations.length}</span>` : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body">
                    <!-- Вкладка: Основне -->
                    <div class="volume-tab-pane" id="page-tab-pane-main">
                        ${(() => {
                            if (!hasThemes) return '';
                            const groups = {
                                type: themes.filter(t => t.type === 'type'),
                                genre: themes.filter(t => t.type === 'genre'),
                                theme: themes.filter(t => (t.type === 'theme' || !t.type))
                            };

                            const groupLabels = {
                                type: t('category_type'),
                                genre: t('genres'),
                                theme: t('themes')
                            };

                            const icons = {
                                type: icon('type', 12, { strokeWidth: 2.2 }),
                                genre: icon('tag', 12, { strokeWidth: 2.2 }),
                                theme: icon('theme', 12, { strokeWidth: 2.2 })
                            };

                            return `
                                <div class="volume-themes-row block">
                                    ${Object.entries(groups).map(([type, items]) => {
                                        if (!items.length) return '';
                                        return `
                                            <div class="volume-theme-group">
                                                <span style="color: var(--text-muted); line-height: 0;">${icons[type] || ''}</span>
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
                        


                        ${charactersHTML}
                    </div>

                    <!-- Вкладка: Розділи -->
                    <div class="volume-tab-pane" id="page-tab-pane-issues">
                        <section class="volume-issues-section">
                            <div class="volume-issues-toolbar block">
                                <div class="volume-toolbar-right" id="issues-toolbar-right" style="margin-left: auto;">
                                    <div id="volume-pagination-container"></div>
                                    <div class="filter-group volume-sort-group">
                                        <select class="filter-select" id="volume-issue-sort">
                                            <button>
                                                <span class="select-label">За номером</span>
                                                <span class="select-chevron-v">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                                                </span>
                                            </button>
                                            <option value="number" selected>За номером</option>
                                            <option value="date">За датою</option>
                                            ${isCollection ? '<option value="series">За серією</option>' : ''}
                                        </select>
                                        <button class="filter-btn-icon sort-order-btn" id="volume-issue-sort-order-btn" type="button" title="Змінити напрямок сортування">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" data-sort-order-icon>
                                                <path d="m3 8 4-4 4 4M7 4v16M15 4h6M15 10h4M15 16h2"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="view-toggle-mini" id="issues-view-switcher">
                                        <button class="view-toggle-btn ${currentView === 'grid' ? 'is-active' : ''}" data-view="grid" title="Плитка">${icon('all', 18)}</button>
                                        <button class="view-toggle-btn ${currentView === 'table' ? 'is-active' : ''}" data-view="table" title="Список">${icon('list', 18)}</button>
                                    </div>
                                </div>
                            </div>

                            <div id="volume-parent-volumes-summary" style="display: none;"></div>

                            <div id="volume-items-view-container" class="volume-items-content-fade"></div>
                        </section>

                        ${isModerator && isCollection && data.direct_issues && data.direct_issues.length > 0 ? `
                            <section class="volume-direct-issues-section block" style="margin-top: 2rem; border-top: 1px solid var(--border-s); padding-top: 2rem;">
                                <div class="section-header">
                                    <h2 class="section-title">Прямі випуски тома (модерація)</h2>
                                    <p class="text-muted" style="font-size: 0.9rem; margin-top: 4px;">Ці випуски належать безпосередньо цьому тому. Використовуйте кнопку конвертації, щоб перетворити їх у збірники.</p>
                                </div>
                                <div id="volume-direct-issues-container"></div>
                            </section>
                        ` : ''}
                    </div>

                    <!-- Вкладка: Збірники -->
                    <div class="volume-tab-pane" id="page-tab-pane-collections">
                        <section class="volume-issues-section">
                            <div class="volume-issues-toolbar block">
                                <div class="volume-toolbar-right" id="collections-toolbar-right" style="margin-left: auto;">
                                    <div id="volume-collections-pagination-container"></div>
                                    <div class="filter-group volume-sort-group">
                                        <select class="filter-select" id="volume-collection-sort">
                                            <button>
                                                <span class="select-label">За номером</span>
                                                <span class="select-chevron-v">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                                                </span>
                                            </button>
                                            <option value="number" selected>За номером</option>
                                            <option value="date">За датою</option>
                                            <option value="name">За назвою</option>
                                        </select>
                                        <button class="filter-btn-icon sort-order-btn" id="volume-collection-sort-order-btn" type="button" title="Змінити напрямок сортування">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" data-sort-order-icon>
                                                <path d="m3 8 4-4 4 4M7 4v16M15 4h6M15 10h4M15 16h2"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div id="volume-collections-view-container" class="volume-items-content-fade"></div>
                        </section>
                    </div>

                    <!-- Вкладка: Інші видання -->
                    <div class="volume-tab-pane" id="page-tab-pane-editions">
                        ${!isMagazine && (translations.length > 0 || translationParents.length === 0)
                            ? translationsSectionHTML(translations, { isModerator, currentVolumeId: volumeId })
                            : ''
                        }
                    </div>

                    <!-- Вкладка: Персонажі -->
                    <div class="volume-tab-pane" id="page-tab-pane-characters">
                        <section class="volume-characters-section block">
                            <div class="section-header">
                                <h2 class="section-title">Всі персонажі тома</h2>
                            </div>
                            <div class="catalog-top-row" style="margin-bottom: 1.5rem;">
                                <div id="volume-characters-filter-bar-container"></div>
                            </div>
                            <div class="characters-grid" id="volume-characters-grid">
                                <div class="loader-container"><div class="loader"></div></div>
                            </div>
                            <div class="pagination-wrap" id="volume-characters-pagination"></div>
                        </section>
                    </div>
                </div>
            </div>

            ${isModerator ? `
                <div class="volume-hero-admin-actions">
                    <button class="btn-admin btn-admin--danger" id="volume-delete-btn" title="Видалити том">
                        ${icon('trash', 15, { strokeWidth: 2.2 })}
                    </button>
                    ${!isMagazine && !isCollection ? `
                        <button class="btn-admin btn-admin--secondary" id="volume-add-magazine-btn" title="Додати до журналу">
                            ${icon('bookOpen', 15, { strokeWidth: 2.2 })}
                        </button>
                    ` : ''}
                    ${!isMagazine ? `
                        <button class="btn-admin btn-admin--secondary" id="volume-add-original-btn" title="Додати до оригіналу">
                            ${icon('bookmark', 15, { strokeWidth: 2.2 })}
                        </button>
                    ` : ''}
                    ${!isMagazine && !volume.mal_id && data.convertable_count > 0 ? `
                        <button class="btn-admin btn-admin--warning" id="volume-convert-btn" title="Конвертувати всі випуски у збірники">
                            ${icon('layers', 14, { strokeWidth: 2.2 })}
                            <span>У збірники (${data.convertable_count})</span>
                        </button>
                    ` : ''}
                    ${isMagazine && isManga ? `
                        <button class="btn-admin btn-admin--warning" id="volume-convert-to-magazine-btn" title="Конвертувати том у повноцінний журнал манґи">
                            ${icon('magazine', 14, { strokeWidth: 2.2 })}
                            <span>У журнал манґи</span>
                        </button>
                    ` : ''}
                    ${isCollection && data.collections.length > 0 ? `
                        <button class="btn-admin btn-admin--danger" id="volume-revert-btn" title="Конвертувати всі збірники у випуски">
                            ${icon('hash', 13, { strokeWidth: 2.2 })}
                            <span>У випуски (${data.collections.length})</span>
                        </button>
                    ` : ''}
                    ${!isManga ? `
                        <button class="btn-admin btn-admin--warning" id="volume-scrape-appearances-btn" title="Скрапити стаф та появи для всіх випусків тому">
                            ${icon('refreshCw', 14, { strokeWidth: 2.2 })}
                            <span>Скрапити стаф та появи</span>
                        </button>
                    ` : ''}
                    ${(volume.hikka_slug || volume.mal_id) ? `
                        <button class="btn-admin btn-admin--warning" id="volume-scrape-manga-characters-btn" title="Парсити персонажів манґи з Hikka API">
                            ${icon('refreshCw', 14, { strokeWidth: 2.2 })}
                            <span>Парсити персонажів Hikka</span>
                        </button>
                    ` : ''}
                </div>
            ` : ''}
        `;

        // ── Bind events ──────────────────────────────
        const readlistSelect = main.querySelector('#readlist-select');
        const favoriteBtn = main.querySelector('#readlist-favorite-btn');

        const syncReadlistButton = () => {
            if (!readlistSelect) return;
            const opt = readlistOptionLabel(readlistSelect.value);
            const iconEl = readlistSelect.querySelector('.readlist-select-chosen .readlist-icon');
            const labelEl = readlistSelect.querySelector('.readlist-select-chosen .select-label');
            if (iconEl) { iconEl.innerHTML = opt.icon; iconEl.style.color = opt.color; }
            if (labelEl) labelEl.textContent = opt.label;

            if (opt.bg) {
                readlistSelect.style.setProperty('background-color', opt.bg, 'important');
            } else {
                readlistSelect.style.removeProperty('background-color');
            }
            if (opt.borderColor) {
                readlistSelect.style.setProperty('border-color', opt.borderColor, 'important');
            } else {
                readlistSelect.style.removeProperty('border-color');
            }

            // Show "Delete" option only if the volume is currently added to some list
            const removeOption = readlistSelect.querySelector('option.readlist-remove-option');
            if (removeOption) {
                if (readlistSelect.value === '') {
                    removeOption.style.setProperty('display', 'none', 'important');
                } else {
                    removeOption.style.setProperty('display', 'flex', 'important');
                }
            }
        };

        if (readlistSelect) {
            readlistSelect.value = readlistStatus.list_name || '';
            syncReadlistButton();
        }

        // Initialize Star Rating Widget
        const ratingWidget = main.querySelector('.star-rating-widget');
        if (ratingWidget) {
            let selectedRating = ratingData.user_rating || 0;
            const clearBtn = ratingWidget.querySelector('.btn-clear-rating');

            const highlightStars = (val) => {
                const containers = ratingWidget.querySelectorAll('.star-container');
                containers.forEach((container, idx) => {
                    const starIndex = idx + 1;
                    const svg = container.querySelector('.star-svg');
                    svg.classList.remove('filled', 'half-filled');
                    
                    if (val >= starIndex * 2) {
                        svg.classList.add('filled');
                    } else if (val === (starIndex * 2) - 1) {
                        svg.classList.add('half-filled');
                    }
                });
                
                const scoreBadge = ratingWidget.closest('.interactive-rating-section')?.querySelector('.user-score-badge');
                if (scoreBadge) {
                    scoreBadge.textContent = val > 0 ? `${val}/10` : '';
                }
                
                if (clearBtn) {
                    clearBtn.style.display = val > 0 ? 'inline-block' : 'none';
                }
            };

            highlightStars(selectedRating);

            if (!currentUser) {
                // Readonly for guest users
                ratingWidget.style.opacity = '0.7';
                ratingWidget.style.pointerEvents = 'none';
            } else {
                const containers = ratingWidget.querySelectorAll('.star-container');
                containers.forEach(container => {
                    const starIndex = parseInt(container.dataset.starIndex, 10);
                    
                    // Left half (odd value, e.g. 1, 3, 5, 7, 9)
                    container.querySelector('.star-left').addEventListener('mousemove', () => {
                        highlightStars((starIndex * 2) - 1);
                    });
                    
                    // Right half (even value, e.g. 2, 4, 6, 8, 10)
                    container.querySelector('.star-right').addEventListener('mousemove', () => {
                        highlightStars(starIndex * 2);
                    });

                    // Click left
                    container.querySelector('.star-left').addEventListener('click', async () => {
                        const val = (starIndex * 2) - 1;
                        selectedRating = val;
                        highlightStars(val);
                        try {
                            const res = await API.post('/ratings/update', {
                                entity_type: 'volume',
                                entity_id: volumeId,
                                rating: val
                            });
                            // Update main average
                            const avgVal = main.querySelector('.rating-main .rating-value');
                            if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    // Click right
                    container.querySelector('.star-right').addEventListener('click', async () => {
                        const val = starIndex * 2;
                        selectedRating = val;
                        highlightStars(val);
                        try {
                            const res = await API.post('/ratings/update', {
                                entity_type: 'volume',
                                entity_id: volumeId,
                                rating: val
                            });
                            const avgVal = main.querySelector('.rating-main .rating-value');
                            if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                        } catch (err) {
                            console.error(err);
                        }
                    });
                });

                // Mouseleave widget reverts to selectedRating
                ratingWidget.addEventListener('mouseleave', () => {
                    highlightStars(selectedRating);
                });

                if (clearBtn) {
                    clearBtn.addEventListener('click', async () => {
                        selectedRating = 0;
                        highlightStars(0);
                        try {
                            const res = await API.delete(`/ratings/volume/${volumeId}`);
                            const avgVal = main.querySelector('.rating-main .rating-value');
                            if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }
            }
        }

        // Save progress logic
        const saveProgressBtn = main.querySelector('#save-progress-btn');
        const readIssuesInput = main.querySelector('#read-issues-input');
        const btnMinus = main.querySelector('#btn-progress-minus');
        const btnPlus = main.querySelector('#btn-progress-plus');

        if (readIssuesInput) {
            readIssuesInput.addEventListener('input', () => {
                const hintEl = main.querySelector('#read-progress-hint');
                if (hintEl) {
                    const hasVal = readIssuesInput.value.trim() !== '';
                    hintEl.innerHTML = hasVal 
                        ? `${icon('edit', 11)} ${t('progress_manual_short')}` 
                        : `${icon('sparkles', 11)} ${t('progress_auto_short')}`;
                }
            });
        }

        const getInputValue = () => {
            if (!readIssuesInput) return 0;
            const valStr = readIssuesInput.value.trim();
            if (valStr !== '') {
                return parseInt(valStr, 10) || 0;
            }
            return parseInt(readIssuesInput.placeholder, 10) || 0;
        };

        if (btnMinus && readIssuesInput) {
            btnMinus.addEventListener('click', () => {
                const current = getInputValue();
                const nextVal = Math.max(0, current - 1);
                readIssuesInput.value = nextVal;
                readIssuesInput.dispatchEvent(new Event('input'));
            });
        }

        if (btnPlus && readIssuesInput) {
            btnPlus.addEventListener('click', () => {
                const current = getInputValue();
                const maxVal = parseInt(readIssuesInput.getAttribute('max'), 10) || 9999;
                const nextVal = Math.min(maxVal, current + 1);
                readIssuesInput.value = nextVal;
                readIssuesInput.dispatchEvent(new Event('input'));
            });
        }

        if (saveProgressBtn) {
            saveProgressBtn.addEventListener('click', async () => {
                const input = main.querySelector('#read-issues-input');
                const val = input.value === '' ? null : parseInt(input.value, 10);
                
                try {
                    await API.post('/user/readlist/update', {
                        volume_id: volumeId,
                        list_name: readlistSelect ? (readlistSelect.value || 'Planned') : 'Planned', // Keep current or plan
                        issues_count: val
                    });
                    alert('Прогрес збережено!');
                    renderVolumeDetail(main, params);
                } catch (err) {
                    console.error(err);
                    alert('Помилка при збереженні.');
                }
            });
        }
        
        if (favoriteBtn) {
            const isFavorite = currentUser ? readlistStatus.is_favorite : Bookmarks.has(volumeId, 'volume');
            favoriteBtn.classList.toggle('is-active', isFavorite);
        }

        if (readlistSelect) {
            readlistSelect.addEventListener('change', async (e) => {
                const listName = e.target.value;
                syncReadlistButton();
                try {
                    await API.post('/user/readlist/update', {
                        volume_id: volumeId,
                        list_name: listName || null
                    });
                } catch (err) {
                    console.error('Readlist update error:', err);
                    // Revert UI on error
                    e.target.value = readlistStatus.list_name || '';
                    syncReadlistButton();
                }
            });
        }

        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    const active = Bookmarks.toggle(volumeId, 'volume');
                    favoriteBtn.classList.toggle('is-active', active);
                    return;
                }
                try {
                    const res = await API.post('/user/readlist/toggle-favorite', { volume_id: volumeId });
                    favoriteBtn.classList.toggle('is-active', res.is_favorite);
                } catch (err) {
                    console.error('Favorite toggle error:', err);
                }
            });
        }

        const addAllBtn = main.querySelector('#btn-add-all-collection');
        if (addAllBtn) {
            addAllBtn.addEventListener('click', async () => {
                if (!currentUser) return;
                try {
                    const res = await API.post('/collections/add-all-from-volume', { volume_id: volumeId });
                    // Refresh the view to show updated button state and owned items
                    renderVolumeDetail(main, params);
                } catch (err) {
                    console.error('Add all to collection error:', err);
                    alert('Помилка при додаванні до колекції.');
                }
            });
        }

        const deleteBtn = main.querySelector('#volume-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Ви впевнені, що хочете видалити цей том? Всі пов\'язані дані (теми, зв\'язки) будуть видалені.')) return;
                
                try {
                    const res = await API.delete(`/volumes/${volumeId}`);
                    alert(res.message);
                    window.location.hash = '#/catalog';
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                }
            });
        }

        initEditorsHistoryBlock(main, edits);

        const editBtn = main.querySelector('#volume-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                const editor = new VolumeEditor(volume, () => {
                    // Reload the view on save
                    renderVolumeDetail(main, params);
                });
                await editor.render();
            });
        }

        const scrapeBtn = main.querySelector('#volume-scrape-appearances-btn');
        if (scrapeBtn) {
            scrapeBtn.addEventListener('click', () => {
                openScrapeProgressModal('volume', volumeId);
            });
        }

        const scrapeMangaCharactersBtn = main.querySelector('#volume-scrape-manga-characters-btn');
        if (scrapeMangaCharactersBtn) {
            scrapeMangaCharactersBtn.addEventListener('click', () => {
                openScrapeProgressModal('manga-characters', volumeId);
            });
        }

        const setOriginalBtn = main.querySelector('#volume-add-original-btn');
        if (setOriginalBtn) {
            setOriginalBtn.addEventListener('click', () => {
                const disabledIds = [
                    ...translations.map(t => t.id),
                    ...translationParents.map(p => p.id)
                ];
                const picker = new VolumePicker({
                    title: 'Вибрати оригінал',
                    excludeId: volumeId,
                    disabledIds: disabledIds,
                    onSelect: async (selectedVol) => {
                        try {
                            await API.post(`/volumes/${selectedVol.id}/translations`, {
                                child_id: volume.id,
                                rel_type: 'translation'
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const addTranslationBtn = main.querySelector('#volume-add-translation-btn');
        if (addTranslationBtn) {
            addTranslationBtn.addEventListener('click', () => {
                const disabledIds = [
                    ...translations.map(t => t.id),
                    ...translationParents.map(p => p.id)
                ];
                const picker = new VolumePicker({
                    title: 'Додати переклад',
                    excludeId: volumeId,
                    disabledIds: disabledIds,
                    onSelect: async (selectedVol) => {
                        try {
                            await API.post(`/volumes/${volumeId}/translations`, {
                                child_id: selectedVol.id,
                                rel_type: 'translation'
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const addMagazineBtn = main.querySelector('#volume-add-magazine-btn');
        if (addMagazineBtn) {
            addMagazineBtn.addEventListener('click', () => {
                const picker = new VolumePicker({
                    title: 'Вибрати журнал',
                    mode: 'magazine',
                    disabledIds: magazineParents.map(m => m.id),
                    onSelect: async (selectedMag) => {
                        try {
                            await API.post(`/magazines/${selectedMag.id}/volumes`, {
                                volume_id: volume.id
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const convertBtn = main.querySelector('#volume-convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', async () => {
                if (!confirm(`Конвертувати всі випуски (${data.convertable_count}) у збірники? Це видалить випуски та створить замість них збірники.`)) return;
                
                try {
                    const res = await API.post(`/volumes/${volumeId}/convert-all-to-collections`);
                    alert(res.message);
                    renderVolumeDetail(main, params);
                } catch (err) {
                    alert('Помилка конвертації: ' + err.message);
                }
            });
        }

        const revertBtn = main.querySelector('#volume-revert-btn');
        if (revertBtn) {
            revertBtn.addEventListener('click', async () => {
                if (!confirm(`Конвертувати всі збірники (${data.collections.length}) у випуски? Це видалить збірники та створить замість них випуски.`)) return;
                
                try {
                    const res = await API.post(`/volumes/${volumeId}/convert-all-collections-to-issues`);
                    alert(res.message);
                    renderVolumeDetail(main, params);
                } catch (err) {
                    alert('Помилка конвертації: ' + err.message);
                }
            });
        }

        const convertToMagBtn = main.querySelector('#volume-convert-to-magazine-btn');
        if (convertToMagBtn) {
            convertToMagBtn.addEventListener('click', async () => {
                if (!confirm('Ви впевнені, що хочете конвертувати цей том та його випуски в окрему структуру журналів манґи? Цей том буде видалено як звичайний том.')) return;
                
                try {
                    const res = await API.post(`/magazines/convert-from-volume/${volumeId}`);
                    alert(res.message);
                    window.location.hash = '#/catalog';
                } catch (err) {
                    alert('Помилка конвертації: ' + err.message);
                }
            });
        }


        const synonymsBtn = main.querySelector('#btn-show-synonyms');
        if (synonymsBtn) {
            synonymsBtn.addEventListener('click', () => {
                openSynonymsModal(volume);
            });
        }

        const synopsisTabs = main.querySelectorAll('.synopsis-tab');
        synopsisTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const lang = tab.dataset.tab;
                synopsisTabs.forEach(t => t.classList.toggle('is-active', t === tab));
                main.querySelectorAll('.synopsis-content .synopsis-pane').forEach(p => {
                    p.classList.toggle('is-active', p.id === `synopsis-${lang}`);
                });
            });
        });

        const itemsView = document.getElementById('volume-items-view-container');
        const viewSwitcher = document.getElementById('issues-view-switcher');
        const sortSelect = document.getElementById('volume-issue-sort');
        const sortOrderBtn = document.getElementById('volume-issue-sort-order-btn');
        let currentSortField = sortSelect ? sortSelect.value : 'number';
        let currentSortDir = 'asc';
        const getCurrentOrder = () => `${currentSortField}_${currentSortDir}`;
        const paginationContainer = document.getElementById('volume-pagination-container');

        const collsView = document.getElementById('volume-collections-view-container');
        const collsPaginationContainer = document.getElementById('volume-collections-pagination-container');
        const collSortSelect = document.getElementById('volume-collection-sort');
        const collSortOrderBtn = document.getElementById('volume-collection-sort-order-btn');
        let currentCollsSortField = collSortSelect ? collSortSelect.value : 'number';
        let currentCollsSortDir = 'asc';
        const getCurrentCollsOrder = () => `${currentCollsSortField}_${currentCollsSortDir}`;

        if (isMagazine) {
            currentCollections = magazineChildren;
        }
        const paginator = createPaginator({ pageSize: 12 });
        const collsPaginator = createPaginator({ pageSize: 12 });

        const refreshCollections = () => {
            if (!collsView) return;
            const source = currentCollections;
            const total = source.length;

            collsPaginationContainer.innerHTML = '';
            if (total > collsPaginator.getPageSize()) {
                collsPaginationContainer.appendChild(collsPaginator.render(total, () => {
                    refreshCollections();
                    const tabsNav = main.querySelector('.volume-hero-tabs-band');
                    if (tabsNav) {
                        window.scrollTo({ top: tabsNav.offsetTop - 70, behavior: 'smooth' });
                    }
                }));
            }

            const page = collsPaginator.getPage();
            const pageSize = collsPaginator.getPageSize();
            const start = (page - 1) * pageSize;
            const end = start + pageSize;

            collsView.innerHTML = '';
            const sorted = sortCollections([...source], getCurrentCollsOrder());
            const sliced = sorted.slice(start, end);
            if (isMagazine) {
                renderItems(collsView, sliced);
            } else {
                renderCollectionsFromIssues(collsView, sliced, {
                    emptyMessage: isManga ? 'Для цього тому немає збірників' : 'Цей том не входить у жоден відомий збірник',
                    typeLabel: isManga ? 'Том' : 'Збірник',
                });
            }
        };

        const refreshItems = () => {
            if (!itemsView) return;
            const source = currentItems;
            const total = source.length;

            // Оновлення блоку батьківських томів (vol-summary)
            const parentVolumesContainer = document.getElementById('volume-parent-volumes-summary');
            if (parentVolumesContainer) {
                if (isCollection && currentItems.length > 0) {
                    const volumesMap = new Map();
                    const sortedItems = sortItems([...currentItems], getCurrentOrder());
                    for (const item of sortedItems) {
                        const volId = item.volume_db_id || item.volume_id;
                        if (!volId) continue;
                        
                        if (!volumesMap.has(volId)) {
                            volumesMap.set(volId, {
                                id: volId,
                                name: item.volume_name_uk || item.volume_name || 'Без назви',
                                cover: normalizeImageUrl(item.volume_cover_img || item.volume_cv_img),
                                numbers: []
                            });
                        }
                        
                        if (item.issue_number != null) {
                            volumesMap.get(volId).numbers.push(String(item.issue_number));
                        }
                    }

                    if (volumesMap.size > 0) {
                        const sortedVolumes = Array.from(volumesMap.values());
                        sortedVolumes.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
                        
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

                        parentVolumesContainer.innerHTML = `
                            <div class="vol-summary">
                                <div class="vol-summary__label">Серії випусків у збірниках</div>
                                <div class="vol-summary__list">
                                    ${listHtml}
                                </div>
                            </div>
                        `;
                        parentVolumesContainer.style.display = 'block';
                    } else {
                        parentVolumesContainer.innerHTML = '';
                        parentVolumesContainer.style.display = 'none';
                    }
                } else {
                    parentVolumesContainer.innerHTML = '';
                    parentVolumesContainer.style.display = 'none';
                }
            }

            // Update pagination UI
            paginationContainer.innerHTML = '';
            if (total > paginator.getPageSize()) {
                paginationContainer.appendChild(paginator.render(total, () => {
                    refreshItems();
                    const tabsNav = main.querySelector('.volume-hero-tabs-band');
                    if (tabsNav) {
                        window.scrollTo({ top: tabsNav.offsetTop - 70, behavior: 'smooth' });
                    }
                }));
            }

            const page = paginator.getPage();
            const pageSize = paginator.getPageSize();
            const start = (page - 1) * pageSize;
            const end = start + pageSize;

            itemsView.innerHTML = '';
            const sorted = sortItems([...currentItems], getCurrentOrder());
            const sliced = sorted.slice(start, end);
            renderItems(itemsView, sliced);
        };

        // ── Characters Tab Logic ────────────────────────
        let charSearchQuery = '';
        let filteredChars = [...characters];
        const charPaginator = createPaginator({ pageSize: 24 });
        let charFilterBar = null;

        const refreshCharacters = () => {
            const grid = main.querySelector('#volume-characters-grid');
            const paginationWrap = main.querySelector('#volume-characters-pagination');
            if (!grid) return;

            if (filteredChars.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                        Персонажів не знайдено
                    </div>
                `;
                paginationWrap.innerHTML = '';
                return;
            }

            const page = charPaginator.getPage();
            const pageSize = charPaginator.getPageSize();
            const pageItems = filteredChars.slice((page - 1) * pageSize, page * pageSize);

            const buildCharCardHTML = (char) => {
                const cover = char.image ? normalizeImageUrl(char.image) : '';
                const name = escapeHtmlAttribute(char.name_uk || char.name || 'Без назви');
                const charLink = char.cv_slug ? `#/characters/${char.id}-${char.cv_slug}` : `#/characters/${char.id}`;
                return `
                    <a href="${charLink}" class="character-card" style="text-decoration: none; color: inherit;">
                        <div class="char-cover-wrap">
                            ${cover
                                ? `<img class="char-cover" src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                                : `<div class="char-cover-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>`
                            }
                        </div>
                        <div class="char-info">
                            <span class="char-name" title="${name}">${name}</span>
                        </div>
                    </a>
                `;
            };

            const mains = pageItems.filter(c => c.role === 'main');
            const supportings = pageItems.filter(c => c.role !== 'main');

            let gridHtml = '';
            if (mains.length > 0) {
                gridHtml += `
                    <div class="volume-char-category" style="grid-column: 1 / -1; margin-bottom: 1.5rem; width: 100%;">
                        <div class="volume-char-category-title" style="font-size: 14px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Головні</div>
                        <div class="characters-grid">
                            ${mains.map(buildCharCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            if (supportings.length > 0) {
                gridHtml += `
                    <div class="volume-char-category" style="grid-column: 1 / -1; width: 100%;">
                        <div class="volume-char-category-title" style="font-size: 14px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Другорядні</div>
                        <div class="characters-grid">
                            ${supportings.map(buildCharCardHTML).join('')}
                        </div>
                    </div>
                `;
            }

            grid.innerHTML = gridHtml;

            paginationWrap.innerHTML = '';
            if (filteredChars.length > pageSize) {
                paginationWrap.appendChild(charPaginator.render(filteredChars.length, (newPage) => {
                    charPaginator.setPage(newPage);
                    refreshCharacters();
                    const tabsNav = main.querySelector('.volume-hero-tabs-band');
                    if (tabsNav) {
                        window.scrollTo({ top: tabsNav.offsetTop - 70, behavior: 'smooth' });
                    }
                }));
            }
        };

        const applyCharFilter = () => {
            filteredChars = characters.filter(char => {
                const name = (char.name_uk || char.name || '').toLowerCase();
                const realName = (char.real_name_uk || char.real_name || '').toLowerCase();
                const matchesSearch = !charSearchQuery || name.includes(charSearchQuery) || realName.includes(charSearchQuery);
                return matchesSearch;
            });

            if (charFilterBar) {
                charFilterBar.setResultsCount(filteredChars.length);
            }
            charPaginator.reset();
            refreshCharacters();
        };

        // ── Page Tabs Logic (v4) ────────────────────────
        const pageTabs = main.querySelectorAll('.volume-page-tab-btn');
        const pagePanes = main.querySelectorAll('.volume-tab-pane');
        let currentPageTab = 'main';

        const switchPageTab = async (tabName, scroll = true) => {
            currentPageTab = tabName;
            
            // Update URL without triggering router reload
            const hashPath = window.location.hash.split('?')[0];
            const newHash = tabName === 'main' ? hashPath : `${hashPath}?tab=${tabName}`;
            window.history.replaceState(null, '', newHash);
            
            pageTabs.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.pageTab === tabName);
            });

            const currentPane = Array.from(pagePanes).find(pane => pane.classList.contains('is-active'));
            if (currentPane) {
                currentPane.classList.remove('is-fade-in');
            }

            setTimeout(async () => {
                pagePanes.forEach(pane => {
                    pane.classList.remove('is-active');
                });

                const newPane = main.querySelector(`#page-tab-pane-${tabName}`);
                if (newPane) {
                    newPane.classList.add('is-active');
                    newPane.offsetHeight; // Reflow
                    newPane.classList.add('is-fade-in');
                }

                if (tabName === 'characters') {
                    const filterContainer = main.querySelector('#volume-characters-filter-bar-container');
                    if (filterContainer && !charFilterBar) {
                        charFilterBar = mountFilterBar(filterContainer, {
                            resultsCount: filteredChars.length,
                            resultsLabel: 'Знайдено',
                            showResults: true,
                            showSearch: true,
                            searchPlaceholder: 'Пошук персонажів...',
                            searchValue: charSearchQuery,
                            onSearch: (val) => {
                                charSearchQuery = val.trim().toLowerCase();
                                applyCharFilter();
                            },
                            showSort: false
                        });
                    }
                    refreshCharacters();
                } else if (tabName === 'issues') {
                    refreshItems();
                } else if (tabName === 'collections') {
                    if (currentCollections.length === 0 && !isMagazine) {
                        const collsView = document.getElementById('volume-collections-view-container');
                        if (collsView) collsView.innerHTML = `<div class="loading-state">Завантаження збірників...</div>`;
                        try {
                            const response = await API.get(`/volumes/${volumeId}/collections-from-issues`);
                            currentCollections = response.data || [];
                        } catch (err) {
                            if (collsView) collsView.innerHTML = `<div class="error-state">Помилка: ${err.message}</div>`;
                        }
                    }
                    refreshCollections();
                }

                if (scroll) {
                    const tabsNav = main.querySelector('.volume-hero-tabs-band');
                    if (tabsNav) {
                        window.scrollTo({ top: tabsNav.offsetTop + 50, behavior: 'smooth' });
                    }
                }
            }, currentPane ? 200 : 0);
        };

        pageTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('is-active') || btn.disabled) return;
                switchPageTab(btn.dataset.pageTab);
            });
        });

        const showAllCharsBtn = main.querySelector('#btn-show-all-characters');
        if (showAllCharsBtn) {
            showAllCharsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                switchPageTab('characters');
            });
        }

        if (viewSwitcher) {
            viewSwitcher.querySelectorAll('.view-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.view === currentView) return;
                    currentView = btn.dataset.view;
                    localStorage.setItem('ds-volume-view', currentView);
                    viewSwitcher.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('is-active', b === btn));
                    refreshItems();
                });
            });
        }

        const directIssuesContainer = document.getElementById('volume-direct-issues-container');
        if (directIssuesContainer && data.direct_issues) {
            const uncollected = data.direct_issues.filter(i => (i.collection_count || 0) === 0);
            if (uncollected.length > 0) {
                renderItems(directIssuesContainer, uncollected);
            } else {
                const section = directIssuesContainer.closest('.volume-direct-issues-section');
                if (section) section.style.display = 'none';
            }
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSortField = e.target.value;
                const selectedOption = e.target.options[e.target.selectedIndex];
                const label = main.querySelector('.volume-sort-group .select-label');
                if (label) label.textContent = selectedOption.text;
                paginator.reset();
                refreshItems();
            });
        }

        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                const iconSvg = sortOrderBtn.querySelector('[data-sort-order-icon]');
                if (iconSvg) {
                    iconSvg.innerHTML = currentSortDir === 'asc'
                        ? '<path d="m3 8 4-4 4 4M7 4v16M15 4h6M15 10h4M15 16h2"/>'
                        : '<path d="m3 16 4 4 4-4M7 20V4M15 4h6M15 10h4M15 16h2"/>';
                }
                paginator.reset();
                refreshItems();
            });
        }

        if (collSortSelect) {
            collSortSelect.addEventListener('change', (e) => {
                currentCollsSortField = e.target.value;
                const selectedOption = e.target.options[e.target.selectedIndex];
                const label = main.querySelector('#collections-toolbar-right .volume-sort-group .select-label');
                if (label) label.textContent = selectedOption.text;
                collsPaginator.reset();
                refreshCollections();
            });
        }

        if (collSortOrderBtn) {
            collSortOrderBtn.addEventListener('click', () => {
                currentCollsSortDir = currentCollsSortDir === 'asc' ? 'desc' : 'asc';
                const iconSvg = collSortOrderBtn.querySelector('[data-sort-order-icon]');
                if (iconSvg) {
                    iconSvg.innerHTML = currentCollsSortDir === 'asc'
                        ? '<path d="m3 8 4-4 4 4M7 4v16M15 4h6M15 10h4M15 16h2"/>'
                        : '<path d="m3 16 4 4 4-4M7 20V4M15 4h6M15 10h4M15 16h2"/>';
                }
                collsPaginator.reset();
                refreshCollections();
            });
        }

        main.addEventListener('click', async (e) => {
            const membershipBtn = e.target.closest('.issue-grid-membership-btn, .table-membership-btn');
            if (membershipBtn) {
                e.stopPropagation();
                e.preventDefault();
                if (!membershipBtn.classList.contains('is-disabled')) {
                    openIssueMembershipModal(membershipBtn.dataset.issueId, membershipBtn.dataset.itemType);
                }
                return;
            }

            const toggleBtn = e.target.closest('.issue-grid-toggle-btn');
            if (toggleBtn) {
                e.stopPropagation();
                e.preventDefault();
                if (!currentUser) {
                    alert('Будь ласка, увійдіть, щоб керувати колекцією');
                    return;
                }
                const id = parseInt(toggleBtn.dataset.id);
                try {
                    const res = await API.post('/collections/toggle', { collection_id: id });
                    const isOwned = res.status === 'added';
                    
                    toggleBtn.classList.toggle('is-owned', isOwned);
                    toggleBtn.innerHTML = isOwned ? icon('trash', 14) : icon('plus', 14);
                    toggleBtn.title = isOwned ? 'Видалити з колекції' : 'Додати в колекцію';

                    // Update local items if they are in the current view
                    currentItems.forEach(item => {
                        if ((item.type === 'collection' || item.is_collection) && item.id === id) {
                            item.is_owned = isOwned;
                        }
                    });
                } catch (err) {
                    console.error(err);
                    alert('Помилка: ' + err.message);
                }
                return;
            }

            const tr = e.target.closest('.issues-table tbody tr');
            if (tr && !e.target.closest('button') && !e.target.closest('a')) {
                const link = tr.dataset.link;
                if (link) {
                    window.location.hash = link;
                }
            }
        });

        // Read tab from query parameters or default to 'main'
        const initialTab = query.tab && ['main', 'issues', 'collections', 'characters', 'editions'].includes(query.tab) ? query.tab : 'main';
        
        let finalInitialTab = initialTab;
        if (finalInitialTab === 'issues' && currentItems.length === 0) finalInitialTab = 'main';
        if (finalInitialTab === 'collections' && currentCollections.length === 0) finalInitialTab = 'main';
        if (finalInitialTab === 'characters' && characters.length === 0) finalInitialTab = 'main';
        if (finalInitialTab === 'editions' && (!isModerator && translations.length === 0)) finalInitialTab = 'main';

        switchPageTab(finalInitialTab, false);

    } catch (error) {
        main.innerHTML = `
            <div class="container">
                <div class="error-state">Помилка завантаження тому: ${escapeHtmlAttribute(error.message)}</div>
            </div>
        `;
    }
}

// ── Relations Management ───────────────────────────
window.removeTranslation = async (parentId, childId) => {
    if (!confirm('Від\'єднати цей переклад від оригіналу?')) return;
    try {
        await API.delete(`/volumes/${parentId}/translations/${childId}`);
        const volumeId = Number(new URL(window.location).hash.split('/').pop());
        if (volumeId) {
            const main = document.querySelector('main');
            renderVolumeDetail(main, { id: volumeId });
        }
    } catch (err) {
        alert('Помилка: ' + err.message);
    }
};

window.removeMagazineChild = async (magazineId, childId) => {
    if (!confirm('Від\'єднати цей том від журналу?')) return;
    try {
        await API.delete(`/magazines/${magazineId}/volumes/${childId}`);
        const volumeId = Number(new URL(window.location).hash.split('/').pop());
        if (volumeId) {
            const main = document.querySelector('main');
            renderVolumeDetail(main, { id: volumeId });
        }
    } catch (err) {
        alert('Помилка: ' + err.message);
    }
};



function openSynonymsModal(volume) {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    modal.id = 'synonyms-modal-overlay';
    
    const synonyms = (Array.isArray(volume.synonyms) ? volume.synonyms : []).filter(s => s);
    const mainNames = [
        { label: 'Українська', value: volume.name_uk },
        { label: 'Англійська', value: volume.name_en },
        { label: 'Оригінальна', value: volume.name },
        { label: 'Рідна', value: volume.name_native },
    ].filter(n => n.value);

    modal.innerHTML = `
        <div class="ds-modal ds-modal--small" id="synonyms-modal">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    ${icon('language', 13, { strokeWidth: 2.2 })}
                    Всі назви та синоніми
                </div>
                <button class="ds-modal-close" id="modal-close">&times;</button>
            </div>
            <div class="ds-modal-body">
                <div class="synonyms-list">
                    ${mainNames.map(n => `
                        <div class="synonym-item">
                            <span class="synonym-label">${n.label}</span>
                            <span class="synonym-value">${escapeHtmlAttribute(n.value)}</span>
                        </div>
                    `).join('')}

                    ${synonyms.length > 0 ? `
                        <div class="synonym-item">
                            <span class="synonym-label">Синоніми</span>
                            ${synonyms.map(s => `
                                <span class="synonym-value">${escapeHtmlAttribute(s)}</span>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${mainNames.length === 0 && synonyms.length === 0 ? '<p class="text-muted">Назв не знайдено</p>' : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        document.removeEventListener('keydown', handleEsc);
        modal.remove();
        document.body.style.overflow = '';
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    modal.querySelector('#modal-close').addEventListener('click', close);
}

async function openIssueMembershipModal(issueId, itemType = 'issue') {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    modal.id = 'issue-membership-modal-overlay';
    modal.innerHTML = `
        <div class="ds-modal" id="issue-membership-modal">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    ${icon('layers', 14, { strokeWidth: 2.2 })}
                    Входить у збірники
                </div>
                <button class="ds-modal-close" id="modal-close">&times;</button>
            </div>
            <div class="ds-modal-body">
                <div id="membership-loading" class="skeleton skeleton-text" style="width: 100%; height: 60px;"></div>
                <div id="membership-list" class="collection-membership-list" style="display: none;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        document.removeEventListener('keydown', handleEsc);
        modal.remove();
        document.body.style.overflow = '';
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    modal.querySelector('#modal-close').addEventListener('click', close);

    try {
        const response = await API.get(`/volumes/issue/${issueId}/collections-membership`, { type: itemType });
        const collections = response.data || [];
        const listContainer = modal.querySelector('#membership-list');
        const loader = modal.querySelector('#membership-loading');

        loader.style.display = 'none';
        listContainer.style.display = 'flex';

        if (collections.length === 0) {
            listContainer.innerHTML = `
                <div class="ds-empty-state">
                    <h3>Нічого не знайдено</h3>
                    <p>Випуск не входить у жоден відомий збірник</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = collections.map(col => {
                const cover = normalizeImageUrl(col.image);
                return `
                    <div class="membership-item">
                        ${cover ? `<img src="${cover}" class="membership-item-cover">` : `<div class="membership-item-cover-empty"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>`}
                        <div class="membership-item-info">
                            <div class="membership-item-title">${escapeHtmlAttribute(col.volume_name)}</div>
                            <div class="membership-item-num">Випуск #${escapeHtmlAttribute(col.issue_number)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        modal.querySelector('.ds-modal-body').innerHTML = `<div class="error-state">Помилка завантаження: ${err.message}</div>`;
    }
}

function renderCollectionsFromIssues(container, collections, options = {}) {
    const emptyMessage = options.emptyMessage || 'Цей том не входить у жоден відомий збірник';
    const typeLabel = options.typeLabel || 'Збірник';

    if (!collections.length) {
        container.innerHTML = `
            <div class="ds-empty-state">
                <h3>Нічого не знайдено</h3>
                <p>${escapeHtmlAttribute(emptyMessage)}</p>
            </div>
        `;
        return;
    }

    // Group by parent volume
    const groups = {};
    collections.forEach(col => {
        const key = col.parent_vol_id || 'unknown';
        if (!groups[key]) {
            groups[key] = {
                id: col.parent_vol_id,
                name: col.parent_vol_name || 'Інші збірники',
                lang: col.parent_vol_lang,
                items: []
            };
        }
        groups[key].items.push(col);
    });

    container.innerHTML = Object.values(groups).map(group => `
        <div class="collections-group">
            <div class="collections-group-header">
                <div class="collections-group-title">
                    ${group.id ? `<a href="#/volumes/${group.id}">${group.name}</a>` : group.name}
                    ${group.lang ? `<span class="collections-group-lang">${group.lang}</span>` : ''}
                </div>
            </div>
            <div class="issues-view-grid">
                ${group.items.map(col => {
                    const cover = normalizeImageUrl(col.image);
                    const range = formatIssueRanges(col.volume_issue_numbers);
                    return `
                        <a class="issue-grid-card" href="#/collections/${col.id}">
                            <div class="issue-grid-cover-wrap">
                                ${cover 
                                    ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy">` 
                                    : `<div class="issue-grid-cover-empty"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
                                ${col.issue_number ? `<div class="issue-grid-number">#${escapeHtmlAttribute(col.issue_number)}</div>` : ''}
                                <div class="issue-grid-actions">
                                    <button class="issue-grid-toggle-btn ${col.is_owned ? 'is-owned' : ''}" data-id="${col.id}" title="${col.is_owned ? 'Видалити з колекції' : 'Додати в колекцію'}">
                                        ${col.is_owned ? icon('trash', 14) : icon('plus', 14)}
                                    </button>
                                </div>
                            </div>
                            <div class="issue-grid-body">
                                <div class="issue-grid-title">${escapeHtmlAttribute(col.name || 'Без назви')}</div>
                                <div class="issue-grid-meta">
                                    ${range ? `<span class="issue-grid-range">${icon('hash', 13, { strokeWidth: 2.2 })} ${range}</span>` : ''}
                                    <span class="issue-grid-date">${formatDate(col.release_date, '—')}</span>
                                </div>
                            </div>
                        </a>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}
