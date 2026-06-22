import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

// ── Lucide SVG icons ──────────────────────────────
const ICON = {
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevronLeft:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    building:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    calendar:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hash:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    book:         '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    layers:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    image:        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    smallImage:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    route:        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7H6.5a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
};

const EVENT_IMPORTANCE_LABELS = {
    prologue: 'Пролог',
    main: 'Основний',
    'tie-in': 'Тай-ін',
    epilogue: 'Епілог',
};

// ── Date formatter ────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2] === '00') {
            const months = [
                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
            ];
            const mIdx = parseInt(parts[1], 10) - 1;
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
    const title = escapeHtmlAttribute(issue?.name || '');
    const arrow = isNext ? ICON.chevronRight : ICON.chevronLeft;
    const dirLabel = isNext ? 'Наступний' : 'Попередній';
    const link = issue ? `#/issues/${issue.id}` : null;

    if (!issue) {
        return `
            <div class="issue-nav-card issue-nav-card--${direction} issue-nav-card--placeholder">
                <div class="issue-nav-body">
                    <div class="issue-nav-dir">${dirLabel}</div>
                    <div class="issue-nav-title" style="color: var(--text-muted);">Немає</div>
                </div>
                <span class="issue-nav-arrow">${arrow}</span>
            </div>
        `;
    }

    return `
        <a class="issue-nav-card issue-nav-card--${direction}" href="${link}">
            <div class="issue-nav-body">
                <div class="issue-nav-dir">${dirLabel}</div>
                ${num ? `<div class="issue-nav-num">${num}</div>` : ''}
                ${title ? `<div class="issue-nav-title">${title}</div>` : ''}
            </div>
            <span class="issue-nav-arrow">${arrow}</span>
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

    let data;
    try {
        data = await API.get(`/issues/${issueId}`);
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
        ? `https://comicvine.gamespot.com/${issue.cv_slug}/${issue.cv_id}-${issue.issue_number || '1'}/`
        : (issue.site_link || null);

    const pageTitle = issueTitle
        ? `${issueTitle} ${issueNum} — ${volumeName}`
        : `${issueNum ? issueNum + ' — ' : ''}${volumeName}`;
    document.title = `${pageTitle} | Drawn Stories`;

    // ── Breadcrumb ────────────────────────────────
    const breadcrumb = `
        <nav class="breadcrumbs" aria-label="Навігація">
            <a href="#/">Drawn Stories</a>
            <span class="breadcrumb-separator">${ICON.chevronRight}</span>
            <a href="#/catalog">Каталог</a>
            ${issue.volume_id ? `
                <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                <a href="#/volumes/${issue.volume_id}">${escapeHtmlAttribute(volumeName)}</a>
            ` : ''}
            <span class="breadcrumb-separator">${ICON.chevronRight}</span>
            <span>${issueNum || escapeHtmlAttribute(issueTitle) || 'Випуск'}</span>
        </nav>
    `;

    // ── Cover ─────────────────────────────────────
    const coverHTML = coverUrl
        ? `<img class="issue-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${escapeHtmlAttribute(displayTitle)}">`
        : `<div class="issue-cover--empty">${ICON.image}</div>`;

    // ── Badges ────────────────────────────────────
    const publisherBadge = issue.publisher_name
        ? `<a href="#/catalog?publisher_ids=${issue.publisher_id}" class="volume-badge volume-publisher-badge" title="Видавництво">
               ${ICON.building}
               ${escapeHtmlAttribute(issue.publisher_name)}
           </a>`
        : '';

    const dateBadge = (coverDate || releaseDate)
        ? `<span class="volume-badge volume-year-badge" title="Дата виходу">
               ${ICON.calendar}
               ${escapeHtmlAttribute(coverDate || releaseDate)}
           </span>`
        : '';

    // ── Facts grid ────────────────────────────────
    const volumeLinkHTML = issue.volume_id
        ? `<a href="#/volumes/${issue.volume_id}">${escapeHtmlAttribute(volumeName)}</a>`
        : (volumeName ? escapeHtmlAttribute(volumeName) : null);

    const factsHTML = `
        <dl class="issue-meta-facts">
            ${factHTML('Том', volumeLinkHTML)}
            ${factHTML('Видавець', issue.publisher_name ? escapeHtmlAttribute(issue.publisher_name) : null)}
            ${factHTML('Номер випуску', issueNum || null)}
            ${factHTML('Дата обкладинки', coverDate)}
            ${factHTML('Дата виходу', releaseDate)}
        </dl>
    `;

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

    // ── Navigation ────────────────────────────────
    const navHTML = `
        <div class="issue-nav-grid" aria-label="Навігація по тому">
            ${navCardHTML(prev_issue, 'prev')}
            ${navCardHTML(next_issue, 'next')}
        </div>
    `;

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

    // ── Assemble ──────────────────────────────────
    container.innerHTML = `
        <div class="issue-detail">
            <div class="container" style="padding-top: 20px;">
                ${breadcrumb}
            </div>

            <section class="issue-hero-band">
                <div class="container issue-hero">
                    <div class="issue-cover-column">
                        ${coverHTML}
                        ${issueNum ? `<div class="issue-cover-number">${escapeHtmlAttribute(issueNum)}</div>` : ''}
                        ${navHTML}
                    </div>

                    <div class="issue-hero-info">
                        <div>
                            <h1>${escapeHtmlAttribute(issueTitle || displayTitle)}</h1>
                            ${issue.volume_id
                                ? `<div class="issue-volume-link">
                                       ${ICON.book} Серія:
                                       <a href="#/volumes/${issue.volume_id}">${escapeHtmlAttribute(volumeName)}</a>
                                   </div>`
                                : ''}
                        </div>

                        <div class="issue-hero-badges">
                            ${publisherBadge}
                            ${dateBadge}
                        </div>

                        ${factsHTML}
                        ${descriptionHTML}
                        ${externalLinksHTML}
                    </div>
                </div>
            </section>

            <div class="container issue-body">
                ${contextHTML}
                ${collectionsHTML}
            </div>
        </div>
    `;
}
