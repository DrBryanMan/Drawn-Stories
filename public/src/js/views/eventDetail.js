import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { openAddIssueModal } from '../components/addIssueModal.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { formatDate } from '../helpers/lang.js';
import { t } from '../helpers/i18n.js';

const ICON = {
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    image: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    layers: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
};

function getImportanceLabels() {
    return {
        main: t('importance_main'),
        'tie-in': t('importance_tie_in'),
        prologue: t('importance_prologue'),
        epilogue: t('importance_epilogue'),
    };
}

function eventYears(event) {
    if (event.start_year && event.end_year && event.start_year !== event.end_year) {
        return `${event.start_year}-${event.end_year}`;
    }
    return event.start_year || event.end_year || null;
}

function renderSkeleton(container) {
    container.innerHTML = `
        <div class="event-detail">
            <div class="container" style="padding-top:20px;">
                <div class="skeleton" style="width:240px;height:16px;margin-bottom:24px;"></div>
            </div>
            <section class="event-hero-band">
                <div class="container event-hero">
                    <div class="skeleton" style="width:260px;aspect-ratio:2/3;border-radius:8px;"></div>
                    <div class="event-hero-info">
                        <div class="skeleton" style="width:70%;height:38px;"></div>
                        <div class="skeleton" style="width:100%;height:120px;border-radius:8px;"></div>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function importanceOptions(selected = 'main') {
    const labels = getImportanceLabels();
    return Object.entries(labels)
        .map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`)
        .join('');
}

function importanceBadgeHTML(importance) {
    const labels = getImportanceLabels();
    const label = labels[importance] || importance || labels.main;
    return `<span class="event-importance-badge event-importance-badge--${escapeHtmlAttribute(importance || 'main')}">${escapeHtmlAttribute(label)}</span>`;
}

function isModerator() {
    return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function issueRowHTML(issue, index, total, canModerate) {
    const cover = normalizeImageUrl(issue.cv_img);
    const title = escapeHtmlAttribute(issue.name || t('no_title'));
    const number = issue.issue_number ? `#${escapeHtmlAttribute(issue.issue_number)}` : '#?';
    const volume = issue.volume_name_uk || issue.volume_name || '';
    const date = formatDate(issue.release_date || issue.cover_date);

    return `
        <tr class="event-issue-row" data-link-id="${issue.link_id}">
            <td>
                ${canModerate
                    ? `<input class="event-order-input" type="number" min="1" max="${total}" value="${index + 1}" data-link-id="${issue.link_id}">`
                    : `<span class="event-order-value">${index + 1}</span>`}
            </td>
            <td>
                <a class="event-issue-cover-link" href="#/issues/${issue.id}">
                    ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="" loading="lazy">` : `<span>${ICON.image}</span>`}
                </a>
            </td>
            <td>
                ${canModerate
                    ? `<select class="event-importance-select" data-link-id="${issue.link_id}">${importanceOptions(issue.importance)}</select>`
                    : importanceBadgeHTML(issue.importance)}
            </td>
            <td><a class="event-issue-number" href="#/issues/${issue.id}">${number}</a></td>
            <td><a class="event-issue-title" href="#/issues/${issue.id}">${title}</a></td>
            <td>${volume ? `<a class="event-volume-link" href="#/volumes/${issue.volume_id}">${escapeHtmlAttribute(volume)}</a>` : `<span class="event-muted">-</span>`}</td>
            <td>${date ? escapeHtmlAttribute(date) : '<span class="event-muted">-</span>'}</td>
            ${canModerate ? `
                <td>
                    <button class="event-icon-btn event-remove-btn" type="button" data-link-id="${issue.link_id}" title="${t('remove_from_event')}">${ICON.trash}</button>
                </td>
            ` : ''}
        </tr>
    `;
}

function editModalHTML(event) {
    return `
        <div class="ds-modal-overlay" id="event-edit-modal" style="display: none;">
            <div class="ds-modal ds-modal--large">
                <div class="ds-modal-header">
                    <div class="ds-modal-title">${ICON.edit} ${t('edit_event')}</div>
                    <button class="ds-modal-close" type="button" data-close-modal="event-edit-modal">&times;</button>
                </div>
                <form id="event-edit-form">
                    <div class="ds-modal-body" style="display: block;">
                        <div class="admin-form-grid">
                            <div class="admin-form-group admin-form-group--full">
                                <label class="admin-label">${ICON.type} ${t('name')}</label>
                                <input type="text" name="name" class="admin-input" value="${escapeHtmlAttribute(event.name || '')}" required>
                            </div>
                            <div class="admin-form-group admin-form-group--full">
                                <label class="admin-label">${ICON.image} ${t('image_url')}</label>
                                <input type="url" name="cv_img" class="admin-input" value="${escapeHtmlAttribute(event.cv_img || '')}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.calendar} ${t('start_year')}</label>
                                <input type="number" name="start_year" class="admin-input" value="${event.start_year || ''}">
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-label">${ICON.calendar} ${t('end_year')}</label>
                                <input type="number" name="end_year" class="admin-input" value="${event.end_year || ''}">
                            </div>
                            <div class="admin-form-group admin-form-group--full">
                                <label class="admin-label">${ICON.alignLeft} ${t('short_description')}</label>
                                <textarea name="description" class="admin-textarea" rows="5">${escapeHtmlAttribute(event.description || '')}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="ds-modal-footer">
                        <button class="btn-admin btn-admin--secondary" type="button" data-close-modal="event-edit-modal">${t('cancel')}</button>
                        <button class="btn-admin btn-admin--primary" type="submit">${t('save_changes')}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function loadEvent(eventId) {
    const [event, issuesRes] = await Promise.all([
        API.get(`/events/${eventId}`),
        API.get(`/events/${eventId}/issues`),
    ]);
    return { event, issues: issuesRes.data || [] };
}

export async function renderEventDetail(container, params = {}) {
    const eventId = Number(params.id);
    if (!Number.isFinite(eventId)) {
        container.innerHTML = `<div class="container event-detail-error"><h2>${t('invalid_event_id')}</h2></div>`;
        return;
    }

    renderSkeleton(container);

    let state;
    try {
        state = await loadEvent(eventId);
    } catch (err) {
        container.innerHTML = `
            <div class="container event-detail-error">
                <h2>${t('loading_error')}</h2>
                <p>${escapeHtmlAttribute(err.message || t('failed_to_load_event'))}</p>
            </div>
        `;
        return;
    }

    const { event, issues } = state;
    const canModerate = isModerator();
    const cover = normalizeImageUrl(event.cv_img);
    const years = eventYears(event);
    const existingIds = new Set(issues.map(issue => issue.id));
    document.title = `${event.name} | Drawn Stories`;

    container.innerHTML = `
        <div class="event-detail">
            <div class="container">
                ${createBreadcrumbs([{ label: event.name || t('event') }])}
            </div>

            <section class="event-hero-band" ${cover ? `style="--event-bg:url('${escapeHtmlAttribute(cover)}')"` : ''}>
                <div class="container event-hero">
                    <div class="event-cover">
                        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(event.name)}">` : `<div class="event-cover-empty">${ICON.image}</div>`}
                    </div>
                    <div class="event-hero-info">
                        <div class="event-kicker">${t('event')}</div>
                        <h1>${escapeHtmlAttribute(event.name || t('no_title'))}</h1>
                        <div class="event-meta">
                            ${years ? `<span>${ICON.calendar} ${escapeHtmlAttribute(String(years))}</span>` : ''}
                            <span>${t('issues_count_label').replace('{count}', issues.length)}</span>
                        </div>
                        ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                    </div>
                </div>
            </section>

            ${canModerate ? `
                <div class="volume-hero-admin-actions">
                    <button class="btn-admin btn-admin--secondary" id="event-edit-btn" title="Редагувати">${ICON.edit}</button>
                </div>
            ` : ''}

            <div class="container event-body">
                <section class="event-issues-section">
                    <div class="event-section-heading">
                        <div class="event-section-heading__left">
                            <h2>${t('event_issues')}</h2>
                            <span>${issues.length}</span>
                        </div>
                        ${canModerate ? `
                            <button class="readlist-btn" id="btn-add-issue" style="height: 34px; padding: 0 12px; font-size: 13px; gap: 6px; background: var(--bg-card); border: 1px solid var(--border);">${ICON.plus} ${t('add_issue')}</button>
                        ` : ''}
                    </div>
                    ${issues.length ? `
                        <div class="event-table-wrap">
                            <table class="event-issues-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>${t('cover')}</th>
                                        <th>${t('type')}</th>
                                        <th>${t('release')}</th>
                                        <th>${t('name')}</th>
                                        <th>${t('volume')}</th>
                                        <th>${t('date')}</th>
                                        ${canModerate ? '<th></th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>${issues.map((issue, index) => issueRowHTML(issue, index, issues.length, canModerate)).join('')}</tbody>
                            </table>
                        </div>
                    ` : `<div class="event-empty-state">${t('event_no_issues')}</div>`}
                </section>
            </div>

            ${canModerate ? `${editModalHTML(event)}` : ''}
        </div>
    `;

    bindEventDetail(container, eventId, existingIds, canModerate);
}

function openModal(id) {
    const el = document.getElementById(id);
    if (!el || el.style.display === 'flex') return;
    el.style.display = 'flex';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function bindEventDetail(container, eventId, existingIds, canModerate) {
    if (!canModerate) return;

    container.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    container.querySelector('#event-edit-btn')?.addEventListener('click', () => openModal('event-edit-modal'));
    container.querySelector('#btn-add-issue')?.addEventListener('click', () => {
        openAddIssueModal({
            title: t('add_issue_to_event'),
            layout: 'vertical',
            alreadyIds: existingIds,
            extraFiltersHTML: `
                <div class="aim-filter-group" style="flex: 1;">
                    <label class="aim-label">${t('importance')}</label>
                    <select id="event-issue-importance" class="aim-input">${importanceOptions('main')}</select>
                </div>
            `,
            onAdd: async (items) => {
                const importance = document.getElementById('event-issue-importance')?.value || 'main';
                for (const item of items) {
                    await API.post(`/events/${eventId}/issues`, {
                        issue_id: item.id,
                        importance: importance,
                    });
                }
                await renderEventDetail(container, { id: eventId });
            }
        });
    });

    container.querySelectorAll('.ds-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    container.querySelector('#event-edit-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await API.put(`/events/${eventId}`, {
            name: form.get('name')?.trim(),
            cv_img: form.get('cv_img')?.trim() || null,
            start_year: form.get('start_year') ? Number(form.get('start_year')) : null,
            end_year: form.get('end_year') ? Number(form.get('end_year')) : null,
            description: form.get('description')?.trim() || null,
        });
        await renderEventDetail(container, { id: eventId });
    });

    container.querySelectorAll('.event-importance-select').forEach(select => {
        select.addEventListener('change', async () => {
            await patchEventItem(eventId, select.dataset.linkId, { importance: select.value });
        });
    });

    container.querySelectorAll('.event-order-input').forEach(input => {
        input.addEventListener('change', async () => {
            await API.put(`/events/${eventId}/items/${input.dataset.linkId}/reorder`, { position: Number(input.value) });
            await renderEventDetail(container, { id: eventId });
        });
    });

    container.querySelectorAll('.event-remove-btn').forEach(button => {
        button.addEventListener('click', async () => {
            await API.delete(`/events/${eventId}/items/${button.dataset.linkId}`);
            await renderEventDetail(container, { id: eventId });
        });
    });
}

async function patchEventItem(eventId, linkId, body) {
    return API.patch(`/events/${eventId}/items/${linkId}`, body);
}
