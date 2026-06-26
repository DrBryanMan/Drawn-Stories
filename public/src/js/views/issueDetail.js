import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { Bookmarks } from '../helpers/bookmarks.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { openScrapeProgressModal } from '../components/ScrapeProgressModal.js';
import { IssueEditor } from '/admin/js/IssueEditor.js';
import { formatDate } from '../helpers/lang.js';
import { translateStaffRole, getRoleSortIndex } from '../helpers/staff.js';


// ── Lucide SVG icons ──────────────────────────────
const ICON = {
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevronLeft:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    building:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    calendar:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hash:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    book:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    layers:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 17 22 12"></polyline></svg>',
    externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    image:        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    smallImage:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    route:        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7H6.5a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
    heart:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    bookmark:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    plus:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    refreshCw:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 3h5v5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/></svg>',
    edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    users:        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mapPin:       '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    box:          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    helpCircle:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

const EVENT_IMPORTANCE_LABELS = {
    prologue: 'Пролог',
    main: 'Основний',
    'tie-in': 'Тай-ін',
    epilogue: 'Епілог',
};

// ── Readlist options config ──────────────────────────
const READLIST_OPTIONS = [
    { value: '',          label: 'Додати в список', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>', color: '#94a3b8', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
    { value: 'Planned',   label: 'Заплановано',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: '#2563eb', bg: 'color-mix(in srgb, #2563eb 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #2563eb 20%, var(--border-s))' },
    { value: 'Completed', label: 'Прочитано',        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', color: '#059669', bg: 'color-mix(in srgb, #059669 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #059669 20%, var(--border-s))' },
];

function translateCharacterRole(role) {
    const roles = {
        'main': 'Основний персонаж',
        'supporting': 'Другорядний персонаж',
        'minor': 'Інші',
        'cameo': 'Камео'
    };
    return roles[role] || role || '';
}

function translateAppearanceStatus(status) {
    const statuses = {
        'flashback': 'Спогад',
        'first appear': 'Перша поява',
        'death': 'Смерть',
        'cameo': 'Камео'
    };
    return statuses[status] || status || '';
}

function renderStaffGroups(personsList) {
    if (!personsList || personsList.length === 0) return '';

    const coverPersons = [];
    const productionPersons = [];
    const featuredPersons = [];

    personsList.forEach(p => {
        const role = (p.role || '').trim().toLowerCase();
        if (role === 'cover') {
            coverPersons.push(p);
        } else if (role === 'editor-in-chief' || role === 'editor') {
            productionPersons.push(p);
        } else {
            featuredPersons.push(p);
        }
    });

    const coverGroup      = groupStaffRoles(coverPersons);
    const productionGroup = groupStaffRoles(productionPersons);
    const featuredGroup   = groupStaffRoles(featuredPersons);

    const renderCard = (person) => {
        const personImg = person.image ? comicVineImageUrl(person.image) : '';
        const imgHTML = personImg
            ? `<img class="issue-staff-avatar" src="${escapeHtmlAttribute(personImg)}" alt="${escapeHtmlAttribute(person.name)}">`
            : `<div class="issue-staff-avatar--empty">${ICON.smallImage}</div>`;
        const rolesJoined = person.roles.map(r => translateStaffRole(r)).join(', ');
        return `
            <a class="issue-staff-card" href="#/persons/${person.id || person.person_id}">
                ${imgHTML}
                <div class="issue-staff-info">
                    <span class="issue-staff-role-label">${escapeHtmlAttribute(rolesJoined)}</span>
                    <span class="issue-staff-name">${escapeHtmlAttribute(person.name)}</span>
                </div>
            </a>
        `;
    };

    const renderGroup = (title, groupItems, extraClass = '') => {
        if (groupItems.length === 0) return '';
        return `
            <div class="issue-staff-group-section ${extraClass}">
                <h4 class="issue-staff-group-title">${title}</h4>
                <div class="issue-staff-grid">
                    ${groupItems.map(renderCard).join('')}
                </div>
            </div>
        `;
    };

    const sideRow = (coverGroup.length > 0 || productionGroup.length > 0)
        ? `<div class="issue-staff-side-row">
               ${renderGroup('Автори обкладинки', coverGroup)}
               ${renderGroup('Редакція та виробництво', productionGroup)}
           </div>`
        : '';

    return `
        ${renderGroup('Інші автори', featuredGroup)}
        ${sideRow}
    `;
}

function readlistOptionLabel(value) {
    return READLIST_OPTIONS.find(o => o.value === value) || READLIST_OPTIONS[0];
}

function readlistUIHTML() {
    const defaultOpt = READLIST_OPTIONS[0];
    const activeOpts = READLIST_OPTIONS.filter(opt => opt.value !== '');
    return `
        <div class="volume-readlist-controls" style="margin-top: 16px; margin-bottom: 8px; width: 100%;">
            <div class="readlist-select-wrap" style="flex: 1;">
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
                        <span class="readlist-icon" style="color: #dc2626"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></span>
                        <span>Видалити</span>
                    </option>
                </select>
            </div>
            <button class="readlist-btn ${!currentUser ? 'readlist-btn--anon' : ''}" id="readlist-favorite-btn" title="${currentUser ? 'В обране' : 'У закладки'}" style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${currentUser ? ICON.heart : ICON.bookmark}
            </button>
        </div>
    `;
}

function collectionUIHTML(status, barter) {
    const isOwned = status === 'get';
    const isWanted = status === 'wanted';
    const isBarter = !!barter;
    
    return `
        <div class="volume-readlist-controls" id="collection-controls-wrap" style="margin-top: 8px; margin-bottom: 8px; width: 100%; display: flex; gap: 8px;">
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
    `;
}

// ── Staff grouping helper ─────────────────────────
function groupStaffRoles(staffArray) {
    const map = new Map();
    for (const p of staffArray) {
        const key = p.person_id || p.name;
        if (!map.has(key)) {
            map.set(key, { ...p, roles: [p.role] });
        } else {
            const existing = map.get(key);
            if (!existing.roles.includes(p.role)) {
                existing.roles.push(p.role);
            }
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        const minA = Math.min(...a.roles.map(r => getRoleSortIndex(r)));
        const minB = Math.min(...b.roles.map(r => getRoleSortIndex(r)));
        return minA - minB;
    });
}

// ── Skeleton ──────────────────────────────────────
function renderSkeleton(container) {
    container.innerHTML = `
        <div class="issue-detail issue-detail-skeleton">
            <div class="container" style="padding-top: 20px;">
                <div class="skeleton" style="width: 240px; height: 16px; margin-bottom: 24px;"></div>
            </div>
            <div class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="skeleton" style="aspect-ratio: 2/3; border-radius: 8px;"></div>
                    <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 8px;">
                        <div class="skeleton" style="width: 80px; height: 20px; border-radius: 999px;"></div>
                        <div class="skeleton" style="width: 70%; height: 32px;"></div>
                        <div class="skeleton" style="width: 50%; height: 16px;"></div>
                        <div class="skeleton" style="width: 100%; height: 100px; margin-top: 8px; border-radius: 8px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ── Nav card HTML ─────────────────────────────────
function navCardHTML(issue, direction) {
    const isNext = direction === 'next';
    const num = issue?.issue_number ? `#${escapeHtmlAttribute(issue.issue_number)}` : '';
    const title = escapeHtmlAttribute(issue?.name || 'Без назви');
    const dirLabel = isNext ? 'НАСТУПНИЙ' : 'ПОПЕРЕДНІЙ';
    const link = issue ? `#/issues/${issue.id}` : null;

    if (!issue) {
        return `
            <div class="issue-nav-card issue-nav-card--placeholder" style="visibility: hidden;"></div>
        `;
    }

    return `
        <a class="issue-nav-card issue-nav-card--${direction}" href="${link}">
            <div class="issue-nav-top">
                <span class="issue-nav-dir">${dirLabel}</span>
                ${num ? `<span class="issue-nav-num">${num}</span>` : ''}
            </div>
            <div class="issue-nav-title">${title}</div>
        </a>
    `;
}

function contextIssueNavCard(issue, direction) {
    const isNext = direction === 'next';
    const label = isNext ? 'Наступний' : 'Попередній';
    const arrow = isNext ? ICON.chevronRight : ICON.chevronLeft;

    if (!issue) {
        return `
            <div class="issue-context-issue-card issue-context-issue-card--${direction} is-disabled">
                <div class="issue-context-issue-cover--empty">${ICON.smallImage}</div>
                <div class="issue-context-issue-body">
                    <span>${label}</span>
                    <strong>Немає</strong>
                </div>
                <div class="issue-context-issue-arrow">${arrow}</div>
            </div>
        `;
    }

    const cover = comicVineImageUrl(issue.cv_img);
    const num = issue.issue_number ? `#${escapeHtmlAttribute(issue.issue_number)}` : '';
    const title = escapeHtmlAttribute(issue.name || 'Без назви');

    return `
        <a class="issue-context-issue-card issue-context-issue-card--${direction}" href="#/issues/${issue.id}" title="${escapeHtmlAttribute(label)}">
            ${cover
                ? `<img class="issue-context-issue-cover" src="${escapeHtmlAttribute(cover)}" alt="" loading="lazy">`
                : `<div class="issue-context-issue-cover--empty">${ICON.smallImage}</div>`}
            <div class="issue-context-issue-body">
                <span>${label}</span>
                ${num ? `<em>${num}</em>` : ''}
                <strong>${title}</strong>
            </div>
            <div class="issue-context-issue-arrow">${arrow}</div>
        </a>
    `;
}

function contextCardHTML(item, type) {
    const isEvent = type === 'event';
    const image = comicVineImageUrl(item.cv_img);
    const name = escapeHtmlAttribute(item.name || (isEvent ? 'Подія' : 'Сюжетна арка'));
    const typeLabel = isEvent ? 'Подія' : 'Арка';
    const detailHref = isEvent ? `#/events/${item.id}` : null;
    const issueType = isEvent
        ? (EVENT_IMPORTANCE_LABELS[item.importance] || item.importance || null)
        : (item.order_num ? `Позиція ${item.order_num}` : null);
    const issueCount = Number(item.issue_count) || 0;
    const countLabel = issueCount === 1 ? '1 випуск' : `${issueCount} випусків`;
    const bgStyle = image ? ` style="--issue-context-bg: url('${escapeHtmlAttribute(image)}')"` : '';

    return `
        <article class="issue-context-card issue-context-card--${type}"${bgStyle}>
            <div class="issue-context-content">
                <div class="issue-context-kicker">${escapeHtmlAttribute(typeLabel)}</div>
                <h3>${detailHref ? `<a href="${detailHref}">${name}</a>` : name}</h3>
                <div class="issue-context-meta">
                    ${issueType ? `<span>${escapeHtmlAttribute(issueType)}</span>` : ''}
                    <span>${escapeHtmlAttribute(countLabel)}</span>
                </div>
            </div>
            <div class="issue-context-actions">
                ${contextIssueNavCard(item.prev_issue, 'prev')}
                ${contextIssueNavCard(item.next_issue, 'next')}
            </div>
        </article>
    `;
}

// ── Collection card HTML ──────────────────────────
function collectionCardHTML(col) {
    const cover = comicVineImageUrl(col.cv_img);
    const name = escapeHtmlAttribute(col.name || 'Збірник');
    const volumeLabel = col.volume_name_uk || col.volume_name || '';
    const date = formatDate(col.release_date || col.cover_date);

    return `
        <a class="issue-collection-card" href="#/collections/${col.id}">
            ${cover
                ? `<img class="issue-collection-cover" src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                : `<div class="issue-collection-cover--empty">${ICON.smallImage}</div>`}
            <div class="issue-collection-body">
                <div class="issue-collection-name">${name}</div>
                ${volumeLabel ? `<div class="issue-collection-volume">${escapeHtmlAttribute(volumeLabel)}</div>` : ''}
                ${date ? `<div class="issue-collection-date">${ICON.calendar} ${escapeHtmlAttribute(date)}</div>` : ''}
            </div>
        </a>
    `;
}

// ── Fact row HTML ─────────────────────────────────
function factHTML(label, value) {
    if (!value) return '';
    return `
        <div class="issue-fact">
            <dt>${label}</dt>
            <dd>${value}</dd>
        </div>
    `;
}

// ── Main render ───────────────────────────────────
export async function renderIssueDetail(container, params = {}) {
    const isModerator = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
    const issueId = Number(params.id);
    if (!Number.isFinite(issueId)) {
        container.innerHTML = `
            <div class="issue-detail">
                <div class="container issue-detail-error">
                    <h2>Некоректний ID</h2>
                    <p>Не вдалося знайти випуск за вказаним ідентифікатором.</p>
                </div>
            </div>
        `;
        return;
    }

    renderSkeleton(container);

    let data, readlistStatus;
    try {
        [data, readlistStatus] = await Promise.all([
            API.get(`/issues/${issueId}`),
            API.get(`/user/readlist/issue/${issueId}`)
        ]);
    } catch (err) {
        container.innerHTML = `
            <div class="issue-detail">
                <div class="container issue-detail-error">
                    <h2>Помилка завантаження</h2>
                    <p>${escapeHtmlAttribute(err.message || 'Щось пішло не так.')}</p>
                </div>
            </div>
        `;
        return;
    }

    const {
        issue,
        collections = [],
        prev_issue,
        next_issue,
        event_contexts = [],
        arc_contexts = [],
        stories = [],
        persons = [],
        reprints = [],
        appearances = { characters: [], teams: [], locations: [], concepts: [], objects: [] }
    } = data;

    // Metadata
    const issueTitle = issue.name || '';
    const issueNum = issue.issue_number ? `#${issue.issue_number}` : '';
    const displayTitle = issueTitle || (issueNum ? `Випуск ${issueNum}` : 'Без назви');

    const volumeName = issue.volume_name_uk || issue.volume_name || '';
    const coverUrl = comicVineImageUrl(issue.cv_img);
    const coverDate = formatDate(issue.cover_date);
    const releaseDate = formatDate(issue.release_date);
    const cvUrl = issue.cv_slug
        ? `https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}/`
        : (issue.site_link || null);

    const pageTitle = issueTitle
        ? `${issueTitle} ${issueNum} — ${volumeName}`
        : `${issueNum ? issueNum + ' — ' : ''}${volumeName}`;
    document.title = `${pageTitle} | Drawn Stories`;

    // ── Breadcrumb ────────────────────────────────
    const breadcrumb = createBreadcrumbs([
        { label: 'Каталог', href: '#/catalog' },
        ...(issue.volume_id ? [{ label: volumeName, href: `#/volumes/${issue.volume_id}` }] : []),
        { label: issueNum || issueTitle || 'Випуск' }
    ]);

    // ── Cover ─────────────────────────────────────
    const coverHTML = coverUrl
        ? `<img class="issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${escapeHtmlAttribute(displayTitle)}">`
        : `<div class="issue-cover--empty">${ICON.image}</div>`;

    // ── Badges ────────────────────────────────────
    const volumeBadge = issue.volume_id
        ? `<a href="#/volumes/${issue.volume_id}" class="volume-badge volume-series-badge" title="Серія">
               ${ICON.book}
               ${escapeHtmlAttribute(volumeName)}
           </a>`
        : '';

    const coverDateBadge = coverDate
        ? `<span class="volume-badge volume-cover-date-badge" title="Дата обкладинки">
               ${ICON.calendar}
               Обкладинка: ${escapeHtmlAttribute(coverDate)}
           </span>`
        : '';

    const releaseDateBadge = releaseDate
        ? `<span class="volume-badge volume-release-date-badge" title="Дата виходу">
               ${ICON.calendar}
               Реліз: ${escapeHtmlAttribute(releaseDate)}
           </span>`
        : '';

    const pagesBadge = issue.pages
        ? `<span class="volume-badge volume-pages-badge" title="Кількість сторінок">
               ${ICON.book}
               Сторінок: ${escapeHtmlAttribute(issue.pages)}
           </span>`
        : '';

    // ── Description ───────────────────────────────
    const descriptionHTML = issue.description
        ? `<div class="issue-description">
               <h3 class="issue-description-title">Опис</h3>
               <div class="issue-description-text">${issue.description}</div>
           </div>`
        : '';

    // ── External links ────────────────────────────
    const externalLinksHTML = cvUrl
        ? `<div class="issue-external-links">
               <a class="issue-ext-link issue-ext-link--cv"
                  href="${escapeHtmlAttribute(cvUrl)}"
                  target="_blank" rel="noopener noreferrer">
                   ComicVine ${ICON.externalLink}
               </a>
           </div>`
        : '';

    // ── Stories HTML ──────────────────────────────
    const hasMultipleStories = stories.length > 1;

    let storiesHTML = '';
    if (stories.length) {
        if (hasMultipleStories) {
            const hasImported = stories.some(s => s.is_imported);
            const hasMain = !hasImported && stories[0] && stories[0].order_num === 0;
            const tabsHTML = `
                <div class="issue-stories-tabs">
                    ${stories.map((story, index) => {
                        const tabLabel = (index === 0 && hasMain)
                            ? 'Основна'
                            : `Історія ${hasMain ? index : index + 1}`;
                        return `
                            <button class="issue-story-tab-btn ${index === 0 ? 'is-active' : ''}" data-story-index="${index}">
                                ${tabLabel}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;

            // Тіло історій
            const storiesListHTML = `
                <div class="issue-stories-tab-contents">
                    ${stories.map((story, index) => {
                        const mainTitle = story.name_ua || story.name_original || 'Без назви';
                        const subTitle = (story.name_ua && story.name_original && story.name_ua.trim() !== story.name_original.trim()) 
                            ? story.name_original 
                            : '';
                        
                        const rawStoryPersons = persons.filter(p => p.story_id === story.id || p.story_id === story.client_story_id);
                        
                        let storyImportBadgeHTML = '';
                        if (story.is_imported) {
                            storyImportBadgeHTML = `
                                <div class="issue-story-imported-banner">
                                    Творці історії з <a href="#/issues/${story.original_issue_id}">
                                        ${escapeHtmlAttribute(story.original_volume_name)} #${escapeHtmlAttribute(story.original_issue_number)}
                                    </a>
                                </div>
                            `;
                        }

                        const storyStaffHTML = rawStoryPersons.length
                            ? `<div class="issue-story-staff">
                                   ${storyImportBadgeHTML}
                                   ${renderStaffGroups(rawStoryPersons)}
                               </div>`
                            : '';

                        return `
                            <div class="issue-story-tab-content ${index === 0 ? 'is-active' : ''}" data-story-index="${index}">
                                <div class="issue-story-content">
                                    <div class="issue-story-main-title">${escapeHtmlAttribute(mainTitle)}</div>
                                    ${subTitle ? `<div class="issue-story-sub-title">${escapeHtmlAttribute(subTitle)}</div>` : ''}
                                    ${storyStaffHTML}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            storiesHTML = `
                <div class="issue-stories-list-wrapper">
                    ${tabsHTML}
                    ${storiesListHTML}
                </div>
            `;
        } else {
            // Всього 1 історія (простий вивід без вкладок)
            const story = stories[0];
            const mainTitle = story.name_ua || story.name_original || 'Без назви';
            const subTitle = (story.name_ua && story.name_original && story.name_ua.trim() !== story.name_original.trim()) 
                ? story.name_original 
                : '';
            
            const rawStoryPersons = persons.filter(p => p.story_id === story.id || p.story_id === story.client_story_id);
            let storyImportBadgeHTML = '';
            if (story.is_imported) {
                storyImportBadgeHTML = `
                    <div class="issue-story-imported-banner">
                        Творці історії з <a href="#/issues/${story.original_issue_id}">
                            ${escapeHtmlAttribute(story.original_volume_name)} #${escapeHtmlAttribute(story.original_issue_number)}
                        </a>
                    </div>
                `;
            }

            const storyStaffHTML = rawStoryPersons.length
                ? `<div class="issue-story-staff">
                       ${storyImportBadgeHTML}
                       ${renderStaffGroups(rawStoryPersons)}
                   </div>`
                : '';

            storiesHTML = `
                <div class="issue-stories-list-wrapper">
                    <div class="issue-story-content">
                        <div class="issue-story-main-title">${escapeHtmlAttribute(mainTitle)}</div>
                        ${subTitle ? `<div class="issue-story-sub-title">${escapeHtmlAttribute(subTitle)}</div>` : ''}
                        ${storyStaffHTML}
                    </div>
                </div>
            `;
        }
    }

    // ── Stories Plots & Appearances HTML ──────────
    let storiesDetailsHTML = '';
    if (stories.length) {
        const blocks = stories.map((story) => {
            const storyStaff = persons.filter(p => p.story_id === story.id || p.story_id === story.client_story_id);
            const hasAppearances = story.appearances && (
                (story.appearances.characters && story.appearances.characters.length > 0) ||
                (story.appearances.teams && story.appearances.teams.length > 0) ||
                (story.appearances.locations && story.appearances.locations.length > 0) ||
                (story.appearances.concepts && story.appearances.concepts.length > 0) ||
                (story.appearances.objects && story.appearances.objects.length > 0)
            );
            const hasPlot = !!(story.plot && story.plot.trim());
            const hasStaff = storyStaff.length > 0;
            const hasContent = hasAppearances || hasPlot || hasStaff;

            // Блок основної історії не відображаємо, якщо немає появ/сюжету/стафу
            const isLocalMain = !story.is_imported && story.order_num === 0;
            if (isLocalMain && !hasContent) {
                return '';
            }

            // Назва та бейдж джерела (якщо імпортовано)
            let badgeHTML = '';
            if (story.is_imported) {
                const storyLabel = (story.order_num === 0 || !story.order_num) 
                    ? 'основної історії' 
                    : `${story.order_num}-ї історії`;
                badgeHTML = `
                    <a class="issue-story-detail-badge" href="#/issues/${story.original_issue_id}">
                        <span class="reprint-icon">${ICON.book}</span>
                        <span>Репринт ${storyLabel} з ${escapeHtmlAttribute(story.original_volume_name)} #${escapeHtmlAttribute(story.original_issue_number)}</span>
                    </a>
                `;
            }

            const mainTitle = story.name_ua || story.name_original || (isLocalMain ? displayTitle : 'Без назви');

            // Появи
            let appearancesHTML = '<div class="issue-story-empty">— поки порожньо —</div>';
            if (hasAppearances) {
                const groups = [];
                const apps = story.appearances;
                
                // Helper to render character card
                const renderCharacterCard = (c) => {
                    const costumeImg = c.portret_costume_img || c.costume_img || null;
                    const regularImg = c.portret_img || c.image || null;
                    
                    let imgHTML = '';
                    if (costumeImg && regularImg) {
                        const defUrl = comicVineImageUrl(costumeImg);
                        const hovUrl = comicVineImageUrl(regularImg);
                        imgHTML = `
                            <div class="story-appearance-avatar-wrap has-hover">
                                <img class="story-appearance-avatar default-avatar" src="${escapeHtmlAttribute(defUrl)}" alt="${escapeHtmlAttribute(c.name)}">
                                <img class="story-appearance-avatar hover-avatar" src="${escapeHtmlAttribute(hovUrl)}" alt="${escapeHtmlAttribute(c.name)}">
                            </div>
                        `;
                    } else {
                        const singleImg = costumeImg || regularImg;
                        imgHTML = singleImg
                            ? `<div class="story-appearance-avatar-wrap">
                                   <img class="story-appearance-avatar default-avatar" src="${escapeHtmlAttribute(comicVineImageUrl(singleImg))}" alt="${escapeHtmlAttribute(c.name)}">
                               </div>`
                            : `<div class="story-appearance-avatar--empty">${ICON.smallImage}</div>`;
                    }
                    
                    const details = [];
                    if (c.status) details.push(translateAppearanceStatus(c.status));
                    if (c.comment) details.push(c.comment);
                    const detailsText = details.join(' • ');
                    
                    const primaryName = c.name_uk || c.name || c.real_name_uk || c.real_name || 'Невідомий персонаж';
                    const hasMainName = !!(c.name_uk || c.name);
                    const subRealName = c.real_name_uk || c.real_name;
                    const showRealName = hasMainName && subRealName;
                    const realNameHTML = showRealName 
                        ? `<span class="story-appearance-real-name">${escapeHtmlAttribute(subRealName)}</span>` 
                        : '';
                    
                    const roleTranslations = {
                        'main': 'ГОЛОВНИЙ',
                        'supporting': 'ДРУГОРЯДНИЙ',
                        'minor': 'ІНШІ',
                        'cameo': 'КАМЕО'
                    };
                    const roleKey = (c.role || 'minor').toLowerCase();
                    const roleLabel = roleTranslations[roleKey] || roleKey.toUpperCase();
                    
                    return `
                        <div class="story-appearance-card character">
                            <span class="character-card-role ${roleKey}">${roleLabel}</span>
                            ${imgHTML}
                            <div class="story-appearance-info">
                                <span class="story-appearance-name">${escapeHtmlAttribute(primaryName)}</span>
                                ${realNameHTML}
                                ${detailsText ? `<span class="story-appearance-details" title="${escapeHtmlAttribute(detailsText)}">${escapeHtmlAttribute(detailsText)}</span>` : ''}
                            </div>
                        </div>
                    `;
                };

                // Characters group
                if (apps.characters && apps.characters.length > 0) {
                    const teamMap = {};
                    if (apps.teams && apps.teams.length > 0) {
                        apps.teams.forEach(t => {
                            teamMap[t.id] = t;
                        });
                    }

                    const groupedByTeam = {};
                    const independentCharacters = [];

                    apps.characters.forEach(c => {
                        if (c.team_id && teamMap[c.team_id]) {
                            if (!groupedByTeam[c.team_id]) {
                                groupedByTeam[c.team_id] = [];
                            }
                            groupedByTeam[c.team_id].push(c);
                        } else {
                            independentCharacters.push(c);
                        }
                    });

                    const teamGroupsHTML = [];
                    for (const teamId in groupedByTeam) {
                        const team = teamMap[teamId];
                        const teamChars = groupedByTeam[teamId];
                        const charCards = teamChars.map(c => renderCharacterCard(c)).join('');
                        
                        teamGroupsHTML.push(`
                            <div class="story-appearance-team-group" style="border-left: 3px solid var(--accent-glow); padding-left: 12px;">
                                <div class="story-appearance-team-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="color: var(--primary); display: flex; align-items: center;">${ICON.users}</span>
                                    <a href="#/teams/${team.id}" class="story-appearance-team-title" style="font-weight: bold; font-size: 14px; text-decoration: none; color: var(--text); transition: color 0.2s;">
                                        ${escapeHtmlAttribute(team.name_uk || team.name)}
                                    </a>
                                </div>
                                <div class="story-appearances-grid characters-grid">
                                    ${charCards}
                                </div>
                            </div>
                        `);
                    }

                    let independentHTML = '';
                    if (independentCharacters.length > 0) {
                        const cards = independentCharacters.map(c => renderCharacterCard(c)).join('');
                        independentHTML = `
                            <div class="story-appearances-grid characters-grid" style="margin-top: 8px;">
                                ${cards}
                            </div>
                        `;
                    }

                    groups.push(`
                        <div class="issue-story-appearance-group">
                            <strong>Персонажі:</strong>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${teamGroupsHTML.join('')}
                                ${independentHTML}
                            </div>
                        </div>
                    `);
                }
                
                // Helper to render other appearance types with icons
                const renderSimpleAppearances = (title, items, icon, className) => {
                    if (!items || items.length === 0) return '';
                    const cards = items.map(item => {
                        const imgHTML = `<div class="story-appearance-avatar--empty">${icon}</div>`;
                        const details = [];
                        if (item.status) details.push(item.status);
                        if (item.comment) details.push(item.comment);
                        const detailsText = details.join(' • ');
                        
                        return `
                            <div class="story-appearance-card ${className}">
                                ${imgHTML}
                                <div class="story-appearance-info">
                                    <span class="story-appearance-name">${escapeHtmlAttribute(item.name_uk || item.name)}</span>
                                    ${detailsText ? `<span class="story-appearance-details" title="${escapeHtmlAttribute(detailsText)}">${escapeHtmlAttribute(detailsText)}</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('');
                    return `
                        <div class="issue-story-appearance-group">
                            <strong>${title}:</strong>
                            <div class="story-appearances-grid">
                                ${cards}
                            </div>
                        </div>
                    `;
                };

                const teamsHTML = renderSimpleAppearances('Команди та Організації', apps.teams, ICON.users, 'team');
                if (teamsHTML) groups.push(teamsHTML);
                
                const objectsHTML = renderSimpleAppearances('Предмети', apps.objects, ICON.box, 'object');
                if (objectsHTML) groups.push(objectsHTML);
                
                const locationsHTML = renderSimpleAppearances('Локації', apps.locations, ICON.mapPin, 'location');
                if (locationsHTML) groups.push(locationsHTML);
                
                const conceptsHTML = renderSimpleAppearances('Концепти', apps.concepts, ICON.helpCircle, 'concept');
                if (conceptsHTML) groups.push(conceptsHTML);

                appearancesHTML = `<div class="issue-story-appearances-groups">${groups.join('')}</div>`;
            }

            // Сюжет
            const plotHTML = hasPlot
                ? `<div class="issue-story-plot-text">${story.plot}</div>`
                : '<div class="issue-story-empty">— поки порожньо —</div>';

            return `
                <div class="issue-story-detail-card">
                    ${badgeHTML}
                    <h2 class="issue-story-detail-title">${escapeHtmlAttribute(mainTitle)}</h2>
                    <div class="issue-story-detail-section">
                        <div class="issue-story-detail-section-title">Сюжет</div>
                        ${plotHTML}
                    </div>
                    <div class="issue-story-detail-section">
                        <div class="issue-story-detail-section-title">Появи</div>
                        ${appearancesHTML}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');

        if (blocks) {
            storiesDetailsHTML = `
                <div class="issue-stories-details-section">
                    <div class="issue-section-heading">
                        <h2>Сюжет та появи</h2>
                    </div>
                    ${blocks}
                </div>
            `;
        }
    }

    // ── Event / arc context ───────────────────────
    const contextCards = [
        ...event_contexts.map(item => contextCardHTML(item, 'event')),
        ...arc_contexts.map(item => contextCardHTML(item, 'arc')),
    ];

    const contextHTML = contextCards.length
        ? `<section class="issue-context-section">
               <div class="issue-context-grid">
                   ${contextCards.join('')}
               </div>
           </section>`
        : '';

    // ── Collections ───────────────────────────────
    const collectionsBodyHTML = collections.length
        ? `<div class="issue-collections-grid">
               ${collections.map(collectionCardHTML).join('')}
           </div>`
        : `<div class="issue-empty-collections">
               ${ICON.layers}
               <p style="margin-top: 10px;">Цей випуск не входить до жодного збірника</p>
           </div>`;

    const collectionsHTML = `
        <section class="issue-collections-section">
            <div class="issue-section-heading">
                <h2>Збірники</h2>
                ${collections.length ? `<span class="issue-section-count">${collections.length}</span>` : ''}
            </div>
            ${collectionsBodyHTML}
        </section>
    `;

    // ── Reprints ──────────────────────────────────
    const reprintsHTML = reprints.length
        ? `<section class="issue-reprints-section">
               <div class="issue-section-heading">
                   <h2>Репринти</h2>
                   <span class="issue-section-count">${reprints.length}</span>
               </div>
               <div class="issue-reprints-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                   ${reprints.map(r => {
                       const isOriginal = r.original_id === issueId;
                       const targetIssueId = isOriginal ? r.reprint_id : r.original_id;
                       const volName = isOriginal
                           ? (r.reprint_volume_name_uk || r.reprint_volume_name || '')
                           : (r.original_volume_name_uk || r.original_volume_name || '');
                       const issueNum = isOriginal ? r.reprint_number : r.original_number;
                       
                       let displayTitle = 'Основна історія';
                       if (r.story_id) {
                           displayTitle = r.story_name_ua || r.story_name_original || 'Історія';
                       } else {
                           const issueName = isOriginal ? r.reprint_name : r.original_name;
                           if (issueName) displayTitle = issueName;
                       }
                       
                       const reprintLang = r.reprint_volume_lang || '';
                       const langPrefix = reprintLang ? `${reprintLang.toLowerCase()}: ` : '';
                       const foreignNameHtml = r.story_foreign_name
                           ? `<div class="issue-reprint-foreign">${langPrefix}${escapeHtmlAttribute(r.story_foreign_name)}</div>`
                           : '';
                           
                       const roleLabel = isOriginal ? 'Перевидання' : 'Оригінал';
                       
                       return `
                           <a class="issue-reprint-card" href="#/issues/${targetIssueId}">
                               <span class="issue-reprint-role ${isOriginal ? 'reprint' : 'original'}">${roleLabel}</span>
                               <div class="issue-reprint-volume">${escapeHtmlAttribute(volName)} #${escapeHtmlAttribute(issueNum || '—')}</div>
                               <div class="issue-reprint-title">${escapeHtmlAttribute(displayTitle)}</div>
                               ${foreignNameHtml}
                           </a>
                       `;
                   }).join('')}
               </div>
           </section>`
        : '';

    // ── Issue Staff & Stories HTML ────────────────
    const rawIssuePersons = persons.filter(p => !p.story_id);
    const issueStaff = groupStaffRoles(rawIssuePersons);
    let staffImportBadgeHTML = '';
    if (rawIssuePersons.length > 0 && rawIssuePersons[0].is_imported) {
        const firstP = rawIssuePersons[0];
        staffImportBadgeHTML = `
            <div class="issue-staff-imported-banner">
                Творці випуску з <a href="#/issues/${firstP.original_issue_id}">
                    ${escapeHtmlAttribute(firstP.original_volume_name)} #${escapeHtmlAttribute(firstP.original_issue_number)}
                </a>
            </div>
        `;
    }

    const mainStaffHTML = rawIssuePersons.length
        ? renderStaffGroups(rawIssuePersons)
        : '';

    const hasAnyStaff = persons.length > 0;
    const combinedStaffStoriesHTML = hasAnyStaff || stories.length > 0
        ? `<section class="issue-staff-section">
               ${staffImportBadgeHTML}
               ${hasAnyStaff ? `
               <div class="issue-section-heading">
                   <h3>Творці випуску</h3>
               </div>
               ` : ''}
               ${mainStaffHTML}
               ${storiesHTML}
           </section>`
        : '';

    // ── Assemble ──────────────────────────────────
    // Визначення підпису для основної історії / історій з оригіналів
    const importedStories = stories.filter(s => s.is_imported);
    const isReprintIssue = reprints.some(r => r.reprint_id === issueId);
    let mainStoryLabelText = 'Основна історія';

    if (importedStories.length > 0) {
        const count = importedStories.length;
        let storyWord = 'історій';
        if (count % 10 === 1 && count % 100 !== 11) {
            storyWord = 'історія';
        } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
            storyWord = 'історії';
        }
        mainStoryLabelText = `${count} ${storyWord} з оригіналів`;
    } else if (isReprintIssue && stories.length > 0) {
        const count = stories.length;
        let storyWord = 'історій';
        if (count % 10 === 1 && count % 100 !== 11) {
            storyWord = 'історія';
        } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
            storyWord = 'історії';
        }
        mainStoryLabelText = `${count} ${storyWord}-репринтів`;
    } else if (stories.length > 1) {
        const count = stories.length;
        let storyWord = 'історій';
        if (count % 10 === 1 && count % 100 !== 11) {
            storyWord = 'історія';
        } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
            storyWord = 'історії';
        }
        mainStoryLabelText = `${count} ${storyWord}`;
    }

    container.innerHTML = `
        <div class="issue-detail">
            <div class="container">
                ${breadcrumb}
            </div>

            <section class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="issue-cover-column">
                        ${coverHTML}
                        ${issueNum ? `<div class="issue-cover-number">${escapeHtmlAttribute(issueNum)}</div>` : ''}
                        ${readlistUIHTML()}
                        ${collectionUIHTML(readlistStatus.collection_status, readlistStatus.collection_barter)}
                    </div>

                    <div class="issue-hero-info">
                        <div class="issue-header-block">
                            ${navCardHTML(prev_issue, 'prev')}
                            <div class="issue-header-center">
                                <h1>${escapeHtmlAttribute(issueTitle || displayTitle)}</h1>
                                <div class="issue-main-story-label">
                                    <span>${escapeHtmlAttribute(mainStoryLabelText)}</span>
                                </div>
                            </div>
                            ${navCardHTML(next_issue, 'next')}
                        </div>

                        <div class="issue-hero-badges">
                            ${volumeBadge}
                            ${coverDateBadge}
                            ${releaseDateBadge}
                            ${pagesBadge}
                        </div>

                        ${combinedStaffStoriesHTML}

                        ${descriptionHTML}
                        ${externalLinksHTML}
                    </div>
                </div>
            </section>

            <div class="container issue-body">
                ${storiesDetailsHTML}
                ${contextHTML}
                ${collectionsHTML}
                ${reprintsHTML}
            </div>

            ${isModerator ? `
                <div class="volume-hero-admin-actions">
                    <button class="btn-admin btn-admin--secondary" id="issue-edit-btn" title="Редагувати">
                        ${ICON.edit}
                    </button>
                    <button class="btn-admin btn-admin--danger" id="issue-delete-btn" title="Видалити випуск">
                        ${ICON.trash}
                    </button>
                    <button class="btn-admin btn-admin--secondary" id="issue-scrape-appearances-btn" title="Скрапити стаф та появи з Comic Vine">
                        ${ICON.refreshCw}
                        <span>Скрапити стаф та появи</span>
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    // ── Stories Tabs Switching ──────────────────────
    if (hasMultipleStories) {
        const tabBtns = container.querySelectorAll('.issue-story-tab-btn');
        const tabContents = container.querySelectorAll('.issue-story-tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetIndex = btn.dataset.storyIndex;
                
                tabBtns.forEach(b => b.classList.remove('is-active'));
                tabContents.forEach(c => c.classList.remove('is-active'));
                
                btn.classList.add('is-active');
                const matchingContent = container.querySelector(`.issue-story-tab-content[data-story-index="${targetIndex}"]`);
                if (matchingContent) matchingContent.classList.add('is-active');
            });
        });
    }

    // ── Readlist & Favorites Handlers ──────────────────
    const readlistSelect = container.querySelector('#readlist-select');
    const favoriteBtn = container.querySelector('#readlist-favorite-btn');
    
    const syncReadlistButton = () => {
        if (!readlistSelect) return;
        const opt = readlistOptionLabel(readlistSelect.value);
        const iconEl = readlistSelect.querySelector('.readlist-select-chosen .readlist-icon');
        const labelEl = readlistSelect.querySelector('.readlist-select-chosen .select-label');
        if (iconEl) iconEl.innerHTML = opt.icon;
        if (labelEl) labelEl.textContent = opt.label;
        
        if (opt.value) {
            readlistSelect.style.setProperty('background-color', opt.bg, 'important');
            readlistSelect.style.setProperty('color', opt.color, 'important');
            readlistSelect.style.setProperty('border-color', opt.borderColor, 'important');
        } else {
            readlistSelect.style.removeProperty('background-color');
            readlistSelect.style.removeProperty('color');
            readlistSelect.style.removeProperty('border-color');
        }
        
        const removeOption = readlistSelect.querySelector('option.readlist-remove-option');
        if (removeOption) {
            if (readlistSelect.value === '') {
                removeOption.style.display = 'none';
            } else {
                removeOption.style.display = 'flex';
            }
        }
    };

    if (readlistSelect) {
        readlistSelect.value = readlistStatus.list_name || '';
        syncReadlistButton();
        
        readlistSelect.addEventListener('change', async (e) => {
            const listName = e.target.value;
            syncReadlistButton();
            try {
                await API.post('/user/readlist/issue/update', {
                    issue_id: issueId,
                    list_name: listName || null
                });
            } catch (err) {
                console.error('Readlist update error:', err);
                e.target.value = readlistStatus.list_name || '';
                syncReadlistButton();
            }
        });
    }

    if (favoriteBtn) {
        const isFavorite = currentUser ? readlistStatus.is_favorite : Bookmarks.has(issueId, 'issue');
        favoriteBtn.classList.toggle('is-active', isFavorite);
        
        favoriteBtn.addEventListener('click', async () => {
            if (!currentUser) {
                const active = Bookmarks.toggle(issueId, 'issue');
                favoriteBtn.classList.toggle('is-active', active);
                return;
            }
            try {
                const res = await API.post('/user/readlist/issue/toggle-favorite', { issue_id: issueId });
                favoriteBtn.classList.toggle('is-active', res.is_favorite);
            } catch (err) {
                console.error('Favorite toggle error:', err);
            }
        });
    }

    // ── Collection Handlers ──────────────────────────
    const initCollectionHandlers = () => {
        const collectionWrap = container.querySelector('#collection-controls-wrap');
        if (!collectionWrap) return;
        
        const toggleBtn = collectionWrap.querySelector('#btn-toggle-collection');
        const barterBtn = collectionWrap.querySelector('#btn-toggle-barter');
        const wishlistBtn = collectionWrap.querySelector('#btn-toggle-wishlist');
        
        const updateState = async (body) => {
            if (!currentUser) return;
            try {
                const res = await API.post('/collections/issue/toggle', body);
                if (res.status === 'removed') {
                    readlistStatus.collection_status = null;
                    readlistStatus.collection_barter = false;
                } else if (res.status === 'added' || res.status === 'updated') {
                    if (body.status !== undefined) readlistStatus.collection_status = body.status;
                    if (body.barter !== undefined) readlistStatus.collection_barter = body.barter;
                }
                
                const newHtml = collectionUIHTML(readlistStatus.collection_status, readlistStatus.collection_barter);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newHtml;
                const newWrap = tempDiv.firstElementChild;
                collectionWrap.replaceWith(newWrap);
                
                initCollectionHandlers();
            } catch (err) {
                console.error('Toggle collection error:', err);
            }
        };
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (!currentUser) return;
                updateState({ issue_id: issueId, status: 'get' });
            });
        }
        
        if (barterBtn) {
            barterBtn.addEventListener('click', () => {
                if (!currentUser) return;
                const newBarter = !readlistStatus.collection_barter;
                updateState({ issue_id: issueId, barter: newBarter });
            });
        }
        
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', () => {
                if (!currentUser) return;
                updateState({ issue_id: issueId, status: 'wanted' });
            });
        }
    };
    
    initCollectionHandlers();

    if (isModerator) {
        const scrapeBtn = container.querySelector('#issue-scrape-appearances-btn');
        if (scrapeBtn) {
            scrapeBtn.addEventListener('click', () => {
                openScrapeProgressModal('issue', issueId);
            });
        }

        const editBtn = container.querySelector('#issue-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const editor = new IssueEditor(issue, stories, persons, reprints, appearances, () => {
                    renderIssueDetail(container, params);
                });
                editor.render();
            });
        }

        const deleteBtn = container.querySelector('#issue-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Ви впевнені, що хочете видалити цей випуск?')) return;
                try {
                    await API.delete(`/issues/${issueId}`);
                    if (issue.volume_id) {
                        window.location.hash = `#/volumes/${issue.volume_id}`;
                    } else {
                        window.location.hash = '#/catalog';
                    }
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                }
            });
        }
    }
}
