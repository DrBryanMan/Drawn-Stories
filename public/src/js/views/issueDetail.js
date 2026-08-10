import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { Bookmarks } from '../helpers/bookmarks.js';
import { openScrapeProgressModal } from '../components/ScrapeProgressModal.js';
import { IssueEditor } from '../components/modals/EditIssueModal.js';
import { formatDate } from '../helpers/lang.js';
import { translateStaffRole, getRoleSortIndex } from '../helpers/staff.js';
import { t } from '../helpers/i18n.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { icon } from '../helpers/icons.js';


function parsePersonas(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'object') return [parsed];
    } catch (e) {}
    return [];
}


const EVENT_IMPORTANCE_LABELS = {
    prologue: t('event_prologue'),
    main: t('event_main'),
    'tie-in': t('event_tiein'),
    epilogue: t('event_epilogue'),
};

// ── Readlist options config ──────────────────────────
const getReadlistOptions = () => [
    { value: '',          label: t('add_to_list'), icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>', color: 'var(--status-default)', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
    { value: 'Planned',   label: t('list_planned'),     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: 'var(--status-planned)', bg: 'color-mix(in srgb, var(--status-planned) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-planned) 20%, var(--border-s))' },
    { value: 'Reading',   label: t('list_reading'),     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', color: 'var(--status-reading)', bg: 'color-mix(in srgb, var(--status-reading) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-reading) 20%, var(--border-s))' },
    { value: 'Completed', label: t('list_completed'),        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', color: 'var(--status-completed)', bg: 'color-mix(in srgb, var(--status-completed) 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--status-completed) 20%, var(--border-s))' },
];

function translateCharacterRole(role) {
    const roles = {
        'main': t('role_main_char'),
        'supporting': t('role_supporting_char'),
        'minor': t('role_minor_char'),
        'cameo': t('role_cameo')
    };
    return roles[role] || role || '';
}

function translateAppearanceStatus(status) {
    const statuses = {
        'flashback': t('status_flashback'),
        'first appear': t('status_first_appear'),
        'death': t('status_death'),
        'cameo': t('role_cameo')
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
        const personImg = person.image ? normalizeImageUrl(person.image) : '';
        const imgHTML = personImg
            ? `<img class="issue-staff-avatar" src="${escapeHtmlAttribute(personImg)}" alt="${escapeHtmlAttribute(person.name)}">`
            : `<div class="issue-staff-avatar--empty">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`;
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
               ${renderGroup(t('staff_cover'), coverGroup)}
               ${renderGroup(t('staff_production'), productionGroup)}
           </div>`
        : '';

    return `
        ${sideRow}
        ${renderGroup(t('staff_featured'), featuredGroup)}
    `;
}

function readlistOptionLabel(value) {
    const options = getReadlistOptions();
    return options.find(o => o.value === value) || options[0];
}

function readlistUIHTML() {
    const options = getReadlistOptions();
    const defaultOpt = options[0];
    const activeOpts = options.filter(opt => opt.value !== '');
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
                        <span>${t('remove')}</span>
                    </option>
                </select>
            </div>
            <button class="readlist-btn ${!currentUser ? 'readlist-btn--anon' : ''}" id="readlist-favorite-btn" title="${currentUser ? t('add_to_fav') : t('add_to_bookmarks')}" style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${currentUser ? icon('heart', 16, { strokeWidth: 2.2 }) : icon('bookmark', 16, { strokeWidth: 2.2 })}
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
                ${isOwned ? icon('trash', 14, { strokeWidth: 2.5 }) : icon('plus', 14, { strokeWidth: 2.5 })}
                <span style="font-weight: 600;">${isOwned ? t('collection_remove') : t('collection_add')}</span>
            </button>
            ${isOwned ? `
                <button class="readlist-btn ${isBarter ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-barter" title="${t('barter')}" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                    ${icon('refreshCw', 14, { strokeWidth: 2.5 })}
                </button>
            ` : `
                <button class="readlist-btn ${isWanted ? 'is-active' : ''} ${!currentUser ? 'readlist-btn--anon' : ''}" id="btn-toggle-wishlist" title="${t('wishlist')}" style="width: 42px; height: 42px; padding: 0; justify-content: center; flex-shrink: 0;">
                    ${icon('bookmark', 16, { strokeWidth: 2.2 })}
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
    const title = escapeHtmlAttribute(issue?.name || t('no_title'));
    const dirLabel = isNext ? t('nav_next') : t('nav_prev');
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
    const label = isNext ? t('nav_next') : t('nav_prev');
    const arrow = isNext ? icon('chevronRight', 16, { strokeWidth: 2.2 }) : icon('chevronLeft', 16, { strokeWidth: 2.2 });

    if (!issue) {
        return `
            <div class="issue-context-issue-card issue-context-issue-card--${direction} is-disabled">
                <div class="issue-context-issue-cover--empty">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>
                <div class="issue-context-issue-body">
                    <span>${label}</span>
                    <strong>${t('none')}</strong>
                </div>
                <div class="issue-context-issue-arrow">${arrow}</div>
            </div>
        `;
    }

    const cover = normalizeImageUrl(issue.image);
    const num = issue.issue_number ? `#${escapeHtmlAttribute(issue.issue_number)}` : '';
    const title = escapeHtmlAttribute(issue.name || t('no_title'));

    return `
        <a class="issue-context-issue-card issue-context-issue-card--${direction}" href="#/issues/${issue.id}" title="${escapeHtmlAttribute(label)}">
            ${cover
                ? `<img class="issue-context-issue-cover" src="${escapeHtmlAttribute(cover)}" alt="" loading="lazy">`
                : `<div class="issue-context-issue-cover--empty">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`}
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
    const image = normalizeImageUrl(item.image);
    const name = escapeHtmlAttribute(item.name || (isEvent ? t('event') : t('story_arc')));
    const typeLabel = isEvent ? t('event') : t('story_arc');
    const detailHref = isEvent ? `#/events/${item.id}` : null;
    const issueType = isEvent
        ? (EVENT_IMPORTANCE_LABELS[item.importance] || item.importance || null)
        : (item.order_num ? `${t('position')} ${item.order_num}` : null);
    const issueCount = Number(item.issue_count) || 0;
    const countLabel = issueCount === 1 ? t('issue_singular', { count: 1 }) : t('issue_plural', { count: issueCount });
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
    const cover = normalizeImageUrl(col.image);
    const name = escapeHtmlAttribute(col.name || t('collection'));
    const volumeLabel = col.volume_name_uk || col.volume_name || '';
    const date = formatDate(col.release_date || col.cover_date);

    return `
        <a class="issue-collection-card" href="#/collections/${col.id}">
            ${cover
                ? `<img class="issue-collection-cover" src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                : `<div class="issue-collection-cover--empty">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`}
            <div class="issue-collection-body">
                <div class="issue-collection-name">${name}</div>
                ${volumeLabel ? `<div class="issue-collection-volume">${escapeHtmlAttribute(volumeLabel)}</div>` : ''}
                ${date ? `<div class="issue-collection-date">${icon('calendar', 13, { strokeWidth: 2.2 })} ${escapeHtmlAttribute(date)}</div>` : ''}
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
                    <h2>${t('invalid_id')}</h2>
                    <p>${t('not_found_id')}</p>
                </div>
            </div>
        `;
        return;
    }

    renderSkeleton(container);

    let data, readlistStatus, ratingData, edits;
    try {
        [data, readlistStatus, ratingData, edits] = await Promise.all([
            API.get(`/issues/${issueId}`),
            API.get(`/user/readlist/issue/${issueId}`),
            API.get(`/ratings/issue/${issueId}`),
            fetchEntityEdits('issue', issueId)
        ]);
    } catch (err) {
        container.innerHTML = `
            <div class="issue-detail">
                <div class="container issue-detail-error">
                    <h2>${t('loading_error')}</h2>
                    <p>${escapeHtmlAttribute(err.message || t('something_went_wrong'))}</p>
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
    const issueTitle = issue.name_uk || issue.name || '';
    const issueNum = issue.issue_number ? `#${issue.issue_number}` : '';
    const displayTitle = issueTitle || (issueNum ? `${t('issue')} ${issueNum}` : t('no_title'));

    const volumeName = issue.volume_name_uk || issue.volume_name || '';
    const coverUrl = normalizeImageUrl(issue.image);
    const coverDate = formatDate(issue.cover_date);
    const releaseDate = formatDate(issue.release_date);
    const cvUrl = issue.cv_slug
        ? `https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}/`
        : (issue.site_link || null);

    const pageTitle = issueTitle
        ? `${issueTitle} ${issueNum} — ${volumeName}`
        : `${issueNum ? issueNum + ' — ' : ''}${volumeName}`;
    document.title = `${pageTitle} | Drawn Stories`;

    // ── Cover ─────────────────────────────────────
    const coverHTML = coverUrl
        ? `<img class="issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${escapeHtmlAttribute(displayTitle)}">`
        : `<div class="issue-cover--empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`;

    // ── Badges ────────────────────────────────────
    const volumeBadge = issue.volume_id
        ? `<a href="#/volumes/${issue.volume_id}" class="volume-badge volume-series-badge" title="${t('series')}">
               ${icon('book', 13, { strokeWidth: 2.2 })}
               ${escapeHtmlAttribute(volumeName)}
           </a>`
        : '';

    const coverDateBadge = coverDate
        ? `<span class="volume-badge volume-cover-date-badge" title="${t('cover_date')}">
               ${icon('calendar', 13, { strokeWidth: 2.2 })}
               ${t('cover')}: ${escapeHtmlAttribute(coverDate)}
           </span>`
        : '';

    const releaseDateBadge = releaseDate
        ? `<span class="volume-badge volume-release-date-badge" title="${t('release_date')}">
               ${icon('calendar', 13, { strokeWidth: 2.2 })}
               ${t('release')}: ${escapeHtmlAttribute(releaseDate)}
           </span>`
        : '';

    const pagesBadge = issue.pages
        ? `<span class="volume-badge volume-pages-badge" title="${t('pages_count')}">
               ${icon('book', 13, { strokeWidth: 2.2 })}
               ${t('pages')}: ${escapeHtmlAttribute(issue.pages)}
           </span>`
        : '';

    // ── Description ───────────────────────────────
    const descriptionHTML = issue.description
        ? `<div class="issue-description">
               <h3 class="issue-description-title">${t('description')}</h3>
               <div class="issue-description-text">${issue.description}</div>
           </div>`
        : '';

    // ── External links ────────────────────────────
    const externalLinksHTML = cvUrl
        ? `<div class="issue-cover-ext-sources" style="margin-top: 16px; border-top: 1px solid var(--border-s); padding-top: 16px; width: 100%;">
               <div style="font-family: var(--font-oswald); font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; text-align: center;">${t('external_sources')}</div>
               <div class="issue-external-links">
                   <a class="issue-ext-link issue-ext-link--cv"
                      href="${escapeHtmlAttribute(cvUrl)}"
                      target="_blank" rel="noopener noreferrer">
                       ComicVine ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                   </a>
               </div>
           </div>`
        : '';

    // ── Stories HTML ──────────────────────────────
    const hasMultipleStories = stories.length > 1;

    let storiesHTML = '';
    if (stories.length) {
        if (hasMultipleStories) {
            const tabsHTML = `
                <div class="issue-stories-tabs">
                    ${stories.map((story, index) => {
                        return `
                            <button class="issue-story-tab-btn ${index === 0 ? 'is-active' : ''}" data-story-index="${index}">
                                ${t('story')} ${index + 1}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;

            // Тіло історій
            const storiesListHTML = `
                <div class="issue-stories-tab-contents">
                    ${stories.map((story, index) => {
                        const mainTitle = story.name_ua || story.name_original || t('no_title');
                        const subTitle = (story.name_ua && story.name_original && story.name_ua.trim() !== story.name_original.trim()) 
                            ? story.name_original 
                            : '';
                        
                        const rawStoryPersons = persons.filter(p => 
                            p.story_id === story.id || 
                            p.story_id === story.client_story_id ||
                            (index === 0 && !p.story_id)
                        );
                        
                        let storyImportBadgeHTML = '';
                        if (story.is_imported) {
                            storyImportBadgeHTML = `
                                <div class="issue-story-imported-banner">
                                    ${t('reprint_from')} <a href="#/issues/${story.original_issue_id}">
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
            const mainTitle = story.name_ua || story.name_original || t('no_title');
            const subTitle = (story.name_ua && story.name_original && story.name_ua.trim() !== story.name_original.trim()) 
                ? story.name_original 
                : '';
            
            const rawStoryPersons = persons.filter(p => 
                p.story_id === story.id || 
                p.story_id === story.client_story_id ||
                (!p.story_id)
            );
            let storyImportBadgeHTML = '';
            if (story.is_imported) {
                storyImportBadgeHTML = `
                    <div class="issue-story-imported-banner">
                        ${t('reprint_from')} <a href="#/issues/${story.original_issue_id}">
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
                    ? t('label_main_story') 
                    : `${story.order_num}-${t('label_story_ord')}`;
                badgeHTML = `
                    <a class="issue-story-detail-badge" href="#/issues/${story.original_issue_id}">
                        <span class="reprint-icon">${icon('book', 13, { strokeWidth: 2.2 })}</span>
                        <span>${t('reprint_of')} ${storyLabel} ${t('from')} ${escapeHtmlAttribute(story.original_volume_name)} #${escapeHtmlAttribute(story.original_issue_number)}</span>
                    </a>
                `;
            }

            const mainTitle = story.name_ua || story.name_original || (isLocalMain ? displayTitle : t('no_title'));

            // Появи
            let appearancesHTML = `<div class="issue-story-empty">— ${t('nothing_yet')} —</div>`;
            if (hasAppearances) {
                const groups = [];
                const apps = story.appearances;
                
                // Helper to render character card
                const renderCharacterCard = (c) => {
                    const costumeImg = c.portret_costume_img || c.costume_img || null;
                    const regularImg = c.portret_img || c.image || null;
                    
                    let imgHTML = '';
                    if (costumeImg && regularImg) {
                        const defUrl = normalizeImageUrl(costumeImg);
                        const hovUrl = normalizeImageUrl(regularImg);
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
                                   <img class="story-appearance-avatar default-avatar" src="${escapeHtmlAttribute(normalizeImageUrl(singleImg))}" alt="${escapeHtmlAttribute(c.name)}">
                               </div>`
                            : `<div class="story-appearance-avatar--empty">${icon('imagePlaceholder', 20, { strokeWidth: 1.5 })}</div>`;
                    }
                    
                    const details = [];
                    if (c.status) details.push(translateAppearanceStatus(c.status));
                    if (c.comment) details.push(c.comment);
                    const detailsText = details.join(' • ');
                    
                    const primaryName = c.name_uk || c.name || c.real_name_uk || c.real_name || t('unknown_character');
                    const hasMainName = !!(c.name_uk || c.name);
                    const subRealName = c.real_name_uk || c.real_name;
                    const showRealName = hasMainName && subRealName;
                    const realNameHTML = showRealName 
                        ? `<span class="story-appearance-real-name">${escapeHtmlAttribute(subRealName)}</span>` 
                        : '';
                    
                    const roleTranslations = {
                        'main': t('role_main_caps'),
                        'supporting': t('role_supporting_caps'),
                        'minor': t('role_minor_caps'),
                        'cameo': t('role_cameo_caps')
                    };
                    const roleKey = (c.role || 'minor').toLowerCase();
                    const roleLabel = roleTranslations[roleKey] || roleKey.toUpperCase();
                    
                    let personaBadgeHTML = '';
                    if (c.persona_idx !== null && c.persona_idx !== undefined && c.personas) {
                        const charPersonas = parsePersonas(c.personas);
                        const p = charPersonas[c.persona_idx];
                        if (p) {
                            const pName = p.name_uk || p.name;
                            personaBadgeHTML = `
                                <a href="#/characters/${c.id}/persona/${c.persona_idx}" class="story-appearance-persona-link" style="font-size: 11px; color: var(--accent); font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 3px; margin-top: 2px;" title="Особистість: ${escapeHtmlAttribute(pName)}">
                                    ${icon('user', 12)} ${escapeHtmlAttribute(pName)}
                                </a>
                            `;
                        }
                    }

                    return `
                        <div class="story-appearance-card character">
                            <span class="character-card-role ${roleKey}">${roleLabel}</span>
                            ${imgHTML}
                            <div class="story-appearance-info">
                                <span class="story-appearance-name">${escapeHtmlAttribute(primaryName)}</span>
                                ${realNameHTML}
                                ${personaBadgeHTML}
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
                                    <span style="color: var(--primary); display: flex; align-items: center;">${icon('users', 20, { strokeWidth: 1.5 })}</span>
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
                            <strong>${t('characters')}:</strong>
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

                const teamsHTML = renderSimpleAppearances(t('teams_orgs'), apps.teams, icon('users', 18), 'team');
                if (teamsHTML) groups.push(teamsHTML);
                
                const objectsHTML = renderSimpleAppearances(t('objects'), apps.objects, icon('box', 18), 'object');
                if (objectsHTML) groups.push(objectsHTML);
                
                const locationsHTML = renderSimpleAppearances(t('locations'), apps.locations, icon('mapPin', 18), 'location');
                if (locationsHTML) groups.push(locationsHTML);
                
                const conceptsHTML = renderSimpleAppearances(t('concepts'), apps.concepts, icon('helpCircle', 18), 'concept');
                if (conceptsHTML) groups.push(conceptsHTML);

                appearancesHTML = `<div class="issue-story-appearances-groups">${groups.join('')}</div>`;
            }

            // Сюжет
            const plotHTML = hasPlot
                ? `<div class="issue-story-plot-text">${story.plot}</div>`
                : `<div class="issue-story-empty">— ${t('nothing_yet')} —</div>`;

            return `
                <div class="issue-story-detail-card">
                    ${badgeHTML}
                    <h2 class="issue-story-detail-title">${escapeHtmlAttribute(mainTitle)}</h2>
                    <div class="issue-story-detail-section">
                        <div class="issue-story-detail-section-title">${t('plot')}</div>
                        ${plotHTML}
                    </div>
                    <div class="issue-story-detail-section">
                        <div class="issue-story-detail-section-title">${t('appearances')}</div>
                        ${appearancesHTML}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');

        if (blocks) {
            storiesDetailsHTML = `
                <div class="issue-stories-details-section">
                    <div class="issue-section-heading">
                        <h2>${t('plot_and_appearances')}</h2>
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
               ${icon('layers', 14, { strokeWidth: 2.2 })}
               <p style="margin-top: 10px;">${t('no_collections')}</p>
           </div>`;

    const collectionsHTML = `
        <section class="issue-collections-section">
            <div class="issue-section-heading">
                <h2>${t('collections')}</h2>
                ${collections.length ? `<span class="issue-section-count">${collections.length}</span>` : ''}
            </div>
            ${collectionsBodyHTML}
        </section>
    `;

    // ── Reprints ──────────────────────────────────
    const reprintsHTML = reprints.length
        ? `<section class="issue-reprints-section">
               <div class="issue-section-heading">
                   <h2>${t('reprints')}</h2>
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
                       
                       let displayTitle = '';
                       const issueName = isOriginal ? r.reprint_name : r.original_name;
                       if (r.story_num === 0 || r.story_num === null || r.story_num === undefined) {
                           const storyName = r.story_name_ua || r.story_name_original || issueName || t('no_title');
                           displayTitle = `${t('story_1')}: ${storyName}`;
                       } else {
                           const storyName = r.story_name_ua || r.story_name_original || t('no_title');
                           displayTitle = `${t('story_n', { n: r.story_num })}: ${storyName}`;
                       }
                       
                       const reprintLang = r.reprint_volume_lang || '';
                       const langPrefix = reprintLang ? `${reprintLang.toLowerCase()}: ` : '';
                       const foreignNameHtml = r.story_foreign_name
                           ? `<div class="issue-reprint-foreign">${langPrefix}${escapeHtmlAttribute(r.story_foreign_name)}</div>`
                           : '';
                           
                       const roleLabel = isOriginal ? t('reprint') : t('original');
                       
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
    const combinedStaffStoriesHTML = stories.length > 0
        ? `<section class="issue-staff-section">
               ${storiesHTML}
           </section>`
        : '';

    // ── Assemble ──────────────────────────────────
    // Визначення підпису для основної історії / історій з оригіналів
    const importedStories = stories.filter(s => s.is_imported);
    const isReprintIssue = reprints.some(r => r.reprint_id === issueId);
    let mainStoryLabelText = t('zero_stories');

    if (importedStories.length > 0) {
        const count = importedStories.length;
        mainStoryLabelText = t('imported_stories_count', { count });
    } else if (isReprintIssue && stories.length > 0) {
        const count = stories.length;
        mainStoryLabelText = t('reprint_stories_count', { count });
    } else if (stories.length > 0) {
        const count = stories.length;
        mainStoryLabelText = t('stories_count', { count });
    }

    container.innerHTML = `
        <div class="issue-detail">
            <section class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="issue-cover-column">
                        ${coverHTML}
                        ${issueNum ? `<div class="issue-cover-number">${escapeHtmlAttribute(issueNum)}</div>` : ''}
                        
                        <div class="volume-ratings" style="margin-top: 12px; display: grid; grid-template-columns: 1fr; border: 1px solid var(--border-s); background: var(--bg-card); padding: .2em; border-radius: var(--r);">
                            <div class="rating-item rating-main" title="Середня оцінка користувачів: ${ratingData.average || 0} (${ratingData.count} оцінок)">
                                ${icon('bookmark', 16, { strokeWidth: 2.2 })}
                                <span class="rating-value" style="font-family: var(--font-mono); font-size: 16px; font-weight: 600; color: var(--accent);">${ratingData.average ? ratingData.average.toFixed(1) : '—'}</span>
                            </div>
                        </div>

                        <div class="user-interaction-block" style="margin-top: 10px; width: 100%; border: 1px solid var(--border-s); border-radius: var(--r); background: var(--bg-card); padding: 12px;">
                            <svg style="width:0; height:0; position:absolute;" aria-hidden="true" focusable="false">
                                <linearGradient id="half-fill-gradient-issue" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="50%" stop-color="#ffc107" />
                                    <stop offset="50%" stop-color="var(--border)" />
                                </linearGradient>
                            </svg>
                            <div class="interactive-rating-section">
                                <div class="interactive-rating-title" style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <span>Ваша оцінка</span>
                                    <span class="user-score-badge" style="font-family: var(--font-mono); font-weight: bold; color: #ffc107;"></span>
                                </div>
                                <div class="star-rating-widget" data-entity-type="issue" data-entity-id="${issueId}" style="display: flex; align-items: center; gap: 4px;">
                                    ${[1, 2, 3, 4, 5].map(starIndex => {
                                        return `
                                            <div class="star-container" data-star-index="${starIndex}" style="position: relative; width: 24px; height: 24px; cursor: pointer;">
                                                <div class="star-half star-left" style="position: absolute; left: 0; top: 0; width: 50%; height: 100%; z-index: 2;"></div>
                                                <div class="star-half star-right" style="position: absolute; right: 0; top: 0; width: 50%; height: 100%; z-index: 2;"></div>
                                                <svg class="star-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 100%; height: 100%; color: var(--border); transition: all 0.2s;">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                                </svg>
                                            </div>
                                        `;
                                    }).join('')}
                                    <button class="btn-clear-rating" title="Видалити оцінку" style="display: none; border: none; background: none; color: #ef4444; font-size: 14px; cursor: pointer; margin-left: 6px;">✕</button>
                                </div>
                            </div>
                        </div>

                        ${readlistUIHTML()}
                        ${collectionUIHTML(readlistStatus.collection_status, readlistStatus.collection_barter)}
                        ${externalLinksHTML}
                    </div>

                    <div class="issue-hero-info">
                        
                        ${contextHTML}
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
                    </div>
                    ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'issue-edit-btn', editTitle: isModerator ? t('edit') : t('suggest_edit') })}
                </div>

                <div class="issue-hero-tabs-band">
                    <div class="container" style="display: flex; justify-content: center;">
                        <div class="issue-page-tabs">
                            <button class="issue-page-tab-btn" data-page-tab="main">${t('tab_main')}</button>
                            <button class="issue-page-tab-btn" data-page-tab="staff-appearances">${t('tab_creators_appearances')}</button>
                            <button class="issue-page-tab-btn" data-page-tab="collections" ${collections.length === 0 ? 'disabled' : ''}>
                                <span>${t('collections')}</span>
                                ${collections.length > 0 ? `<span class="tab-count">${collections.length}</span>` : ''}
                            </button>
                            <button class="issue-page-tab-btn" data-page-tab="reprints" ${reprints.length === 0 ? 'disabled' : ''}>
                                <span>${t('reprints')}</span>
                                ${reprints.length > 0 ? `<span class="tab-count">${reprints.length}</span>` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div class="container issue-body">
                <!-- Вкладка: Основне -->
                <div class="issue-tab-pane" id="page-tab-pane-main">
                    ${descriptionHTML ? `<div class="issue-main-description-section" style="margin-bottom: 24px;">${descriptionHTML}</div>` : ''}
                    ${(!descriptionHTML && !contextHTML) ? `<div class="issue-story-empty">— ${t('no_description_or_context')} —</div>` : ''}
                </div>

                <!-- Вкладка: Творці та появи -->
                <div class="issue-tab-pane" id="page-tab-pane-staff-appearances">
                    ${combinedStaffStoriesHTML}
                    ${storiesDetailsHTML}
                    ${(!combinedStaffStoriesHTML && !storiesDetailsHTML) ? `<div class="issue-story-empty">— ${t('no_creators_or_appearances')} —</div>` : ''}
                </div>

                <!-- Вкладка: Збірники -->
                <div class="issue-tab-pane" id="page-tab-pane-collections">
                    ${collectionsHTML}
                </div>

                <!-- Вкладка: Репринти -->
                <div class="issue-tab-pane" id="page-tab-pane-reprints">
                    ${reprintsHTML}
                </div>
            </div>
        </div>
    `;

    // ── Page Tabs Logic ──────────────────────────────
    const pageTabs = container.querySelectorAll('.issue-page-tab-btn');
    const pagePanes = container.querySelectorAll('.issue-tab-pane');
    let currentPageTab = 'main';

    const switchPageTab = (tabName, scroll = true) => {
        currentPageTab = tabName;
        
        // Update URL query parameter
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

        setTimeout(() => {
            pagePanes.forEach(pane => {
                pane.classList.remove('is-active');
            });

            const newPane = container.querySelector(`#page-tab-pane-${tabName}`);
            if (newPane) {
                newPane.classList.add('is-active');
                newPane.offsetHeight; // Reflow
                newPane.classList.add('is-fade-in');
            }

            if (scroll) {
                const tabsNav = container.querySelector('.issue-hero-tabs-band');
                if (tabsNav) {
                    window.scrollTo({ top: tabsNav.offsetTop - 20, behavior: 'smooth' });
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

    // Check URL query parameters for preselected tab
    const urlParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const preselectedTab = urlParams.get('tab');
    if (preselectedTab && ['main', 'staff-appearances', 'collections', 'reprints'].includes(preselectedTab)) {
        const tabBtn = container.querySelector(`.issue-page-tab-btn[data-page-tab="${preselectedTab}"]`);
        if (tabBtn && !tabBtn.disabled) {
            switchPageTab(preselectedTab, false);
        } else {
            switchPageTab('main', false);
        }
    } else {
        switchPageTab('main', false);
    }

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

    // Initialize Star Rating Widget for Issue
    const ratingWidget = container.querySelector('.star-rating-widget');
    if (ratingWidget) {
        let selectedRating = ratingData.user_rating || 0;
        const clearBtn = ratingWidget.querySelector('.btn-clear-rating');

        const highlightStars = (val) => {
            const containers = ratingWidget.querySelectorAll('.star-container');
            containers.forEach((container, idx) => {
                const starIndex = idx + 1;
                const svg = container.querySelector('.star-svg');
                svg.classList.remove('filled', 'half-filled');
                svg.style.color = 'var(--border)';
                svg.style.fill = 'none';
                
                if (val >= starIndex * 2) {
                    svg.classList.add('filled');
                    svg.style.color = '#ffc107';
                    svg.style.fill = '#ffc107';
                } else if (val === (starIndex * 2) - 1) {
                    svg.classList.add('half-filled');
                    svg.style.color = '#ffc107';
                    svg.style.fill = 'url(#half-fill-gradient-issue)';
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
            ratingWidget.style.opacity = '0.7';
            ratingWidget.style.pointerEvents = 'none';
        } else {
            const containers = ratingWidget.querySelectorAll('.star-container');
            containers.forEach(container => {
                const starIndex = parseInt(container.dataset.starIndex, 10);
                
                container.querySelector('.star-left').addEventListener('mousemove', () => {
                    highlightStars((starIndex * 2) - 1);
                });
                
                container.querySelector('.star-right').addEventListener('mousemove', () => {
                    highlightStars(starIndex * 2);
                });

                container.querySelector('.star-left').addEventListener('click', async () => {
                    const val = (starIndex * 2) - 1;
                    selectedRating = val;
                    highlightStars(val);
                    try {
                        const res = await API.post('/ratings/update', {
                            entity_type: 'issue',
                            entity_id: issueId,
                            rating: val
                        });
                        const avgVal = container.closest('.issue-cover-column').querySelector('.rating-main .rating-value');
                        if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                    } catch (err) {
                        console.error(err);
                    }
                });

                container.querySelector('.star-right').addEventListener('click', async () => {
                    const val = starIndex * 2;
                    selectedRating = val;
                    highlightStars(val);
                    try {
                        const res = await API.post('/ratings/update', {
                            entity_type: 'issue',
                            entity_id: issueId,
                            rating: val
                        });
                        const avgVal = container.closest('.issue-cover-column').querySelector('.rating-main .rating-value');
                        if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                    } catch (err) {
                        console.error(err);
                    }
                });
            });

            ratingWidget.addEventListener('mouseleave', () => {
                highlightStars(selectedRating);
            });

            if (clearBtn) {
                clearBtn.addEventListener('click', async () => {
                    selectedRating = 0;
                    highlightStars(0);
                    try {
                        const res = await API.delete(`/ratings/issue/${issueId}`);
                        const avgVal = ratingWidget.closest('.issue-cover-column').querySelector('.rating-main .rating-value');
                        if (avgVal) avgVal.textContent = res.average ? res.average.toFixed(1) : '—';
                    } catch (err) {
                        console.error(err);
                    }
                });
            }
        }
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

    initEditorsHistoryBlock(container, edits);

    const editBtn = container.querySelector('#issue-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const editor = new IssueEditor(issue, stories, persons, reprints, appearances, () => {
                renderIssueDetail(container, params);
            });
            editor.render();
        });
    }

    if (isModerator) {
        const scrapeBtn = container.querySelector('#issue-scrape-appearances-btn');
        if (scrapeBtn) {
            scrapeBtn.addEventListener('click', () => {
                openScrapeProgressModal('issue', issueId);
            });
        }

        const deleteBtn = container.querySelector('#issue-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm(t('confirm_delete_issue'))) return;
                try {
                    await API.delete(`/issues/${issueId}`);
                    if (issue.volume_id) {
                        window.location.hash = `#/volumes/${issue.volume_id}`;
                    } else {
                        window.location.hash = '#/catalog';
                    }
                } catch (err) {
                    alert(`${t('error_deleting')}: ${err.message}`);
                }
            });
        }
    }
}
