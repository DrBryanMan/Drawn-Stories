import { API } from '../helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';

const ICON = {
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    image: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
};

const IMPORTANCE_LABELS = {
    main: 'Основний',
    'tie-in': 'Тай-ін',
    prologue: 'Пролог',
    epilogue: 'Епілог',
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return dateStr;
    }
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
    return Object.entries(IMPORTANCE_LABELS)
        .map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`)
        .join('');
}

function importanceBadgeHTML(importance) {
    const label = IMPORTANCE_LABELS[importance] || importance || IMPORTANCE_LABELS.main;
    return `<span class="event-importance-badge event-importance-badge--${escapeHtmlAttribute(importance || 'main')}">${escapeHtmlAttribute(label)}</span>`;
}

function isModerator() {
    return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function issueRowHTML(issue, index, total, canModerate) {
    const cover = comicVineImageUrl(issue.cv_img);
    const title = escapeHtmlAttribute(issue.name || 'Без назви');
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
            <td>${volume ? `<a class="event-volume-link" href="#/volumes/${issue.volume_id}">${escapeHtmlAttribute(volume)}</a>` : '<span class="event-muted">-</span>'}</td>
            <td>${date ? escapeHtmlAttribute(date) : '<span class="event-muted">-</span>'}</td>
            ${canModerate ? `
                <td>
                    <button class="event-icon-btn event-remove-btn" type="button" data-link-id="${issue.link_id}" title="Видалити з події">${ICON.trash}</button>
                </td>
            ` : ''}
        </tr>
    `;
}

function modalShell(id, title, body) {
    return `
        <div class="event-modal" id="${id}" hidden>
            <div class="event-modal__backdrop" data-close-modal="${id}"></div>
            <div class="event-modal__panel" role="dialog" aria-modal="true" aria-label="${escapeHtmlAttribute(title)}">
                <div class="event-modal__header">
                    <h2>${escapeHtmlAttribute(title)}</h2>
                    <button class="event-modal__close" type="button" data-close-modal="${id}">x</button>
                </div>
                ${body}
            </div>
        </div>
    `;
}

function editModalHTML(event) {
    return modalShell('event-edit-modal', 'Редагувати подію', `
        <form class="event-form" id="event-edit-form">
            <label>Назва<input name="name" value="${escapeHtmlAttribute(event.name || '')}" required></label>
            <label>Зображення<input name="cv_img" value="${escapeHtmlAttribute(event.cv_img || '')}"></label>
            <div class="event-form-grid">
                <label>Початок<input name="start_year" type="number" value="${event.start_year || ''}"></label>
                <label>Кінець<input name="end_year" type="number" value="${event.end_year || ''}"></label>
            </div>
            <label>Опис<textarea name="description" rows="5">${escapeHtmlAttribute(event.description || '')}</textarea></label>
            <div class="event-form-actions">
                <button class="event-btn event-btn--ghost" type="button" data-close-modal="event-edit-modal">Скасувати</button>
                <button class="event-btn event-btn--primary" type="submit">Зберегти</button>
            </div>
        </form>
    `);
}

function addIssueModalHTML() {
    return modalShell('event-add-issue-modal', 'Додати випуск до події', `
        <div class="event-add-issue">
            <div class="event-search-row">
                <input id="event-issue-search" placeholder="Пошук випуску або тому">
                <select id="event-issue-importance">${importanceOptions('main')}</select>
            </div>
            <div class="event-issue-results" id="event-issue-results">
                <div class="event-empty-inline">Введіть назву випуску або тому.</div>
            </div>
        </div>
    `);
}

function searchResultHTML(issue, existingIds) {
    const cover = comicVineImageUrl(issue.cv_img);
    const title = escapeHtmlAttribute(issue.name || 'Без назви');
    const volume = issue.volume_name_uk || issue.volume_name || '';
    const isExisting = existingIds.has(issue.id);

    return `
        <div class="event-search-result">
            <a class="event-search-cover" href="#/issues/${issue.id}">
                ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="" loading="lazy">` : `<span>${ICON.image}</span>`}
            </a>
            <div class="event-search-info">
                <strong>${issue.issue_number ? `#${escapeHtmlAttribute(issue.issue_number)} ` : ''}${title}</strong>
                ${volume ? `<span>${escapeHtmlAttribute(volume)}</span>` : ''}
            </div>
            <button class="event-btn event-btn--primary event-add-result-btn" type="button" data-issue-id="${issue.id}" ${isExisting ? 'disabled' : ''}>
                ${isExisting ? 'Додано' : 'Додати'}
            </button>
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
        container.innerHTML = `<div class="container event-detail-error"><h2>Некоректний ID події</h2></div>`;
        return;
    }

    renderSkeleton(container);

    let state;
    try {
        state = await loadEvent(eventId);
    } catch (err) {
        container.innerHTML = `
            <div class="container event-detail-error">
                <h2>Помилка завантаження</h2>
                <p>${escapeHtmlAttribute(err.message || 'Не вдалося завантажити подію.')}</p>
            </div>
        `;
        return;
    }

    const { event, issues } = state;
    const canModerate = isModerator();
    const cover = comicVineImageUrl(event.cv_img);
    const years = eventYears(event);
    const existingIds = new Set(issues.map(issue => issue.id));
    document.title = `${event.name} | Drawn Stories`;

    container.innerHTML = `
        <div class="event-detail">
            <div class="container" style="padding-top:20px;">
                <nav class="breadcrumbs" aria-label="Навігація">
                    <a href="#/">Drawn Stories</a>
                    <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                    <span>${escapeHtmlAttribute(event.name || 'Подія')}</span>
                </nav>
            </div>

            <section class="event-hero-band" ${cover ? `style="--event-bg:url('${escapeHtmlAttribute(cover)}')"` : ''}>
                <div class="container event-hero">
                    <div class="event-cover">
                        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(event.name)}">` : `<div class="event-cover-empty">${ICON.image}</div>`}
                    </div>
                    <div class="event-hero-info">
                        <div class="event-kicker">Подія</div>
                        <h1>${escapeHtmlAttribute(event.name || 'Без назви')}</h1>
                        <div class="event-meta">
                            ${years ? `<span>${ICON.calendar} ${escapeHtmlAttribute(String(years))}</span>` : ''}
                            <span>${issues.length} випусків</span>
                        </div>
                        ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                        ${canModerate ? `
                            <div class="event-actions">
                                <button class="event-btn event-btn--primary" id="event-add-issue-btn" type="button">${ICON.plus} Додати випуск</button>
                                <button class="event-btn event-btn--ghost" id="event-edit-btn" type="button">${ICON.edit} Редагувати</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </section>

            <div class="container event-body">
                <section class="event-issues-section">
                    <div class="event-section-heading">
                        <h2>Випуски події</h2>
                        <span>${issues.length}</span>
                    </div>
                    ${issues.length ? `
                        <div class="event-table-wrap">
                            <table class="event-issues-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Обкладинка</th>
                                        <th>Тип</th>
                                        <th>Випуск</th>
                                        <th>Назва</th>
                                        <th>Том</th>
                                        <th>Дата</th>
                                        ${canModerate ? '<th></th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>${issues.map((issue, index) => issueRowHTML(issue, index, issues.length, canModerate)).join('')}</tbody>
                            </table>
                        </div>
                    ` : `<div class="event-empty-state">У події ще немає випусків.</div>`}
                </section>
            </div>

            ${canModerate ? `${editModalHTML(event)}${addIssueModalHTML()}` : ''}
        </div>
    `;

    bindEventDetail(container, eventId, existingIds, canModerate);
}

function openModal(id) {
    document.getElementById(id)?.removeAttribute('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.setAttribute('hidden', '');
}

function bindEventDetail(container, eventId, existingIds, canModerate) {
    if (!canModerate) return;

    container.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    container.querySelector('#event-edit-btn')?.addEventListener('click', () => openModal('event-edit-modal'));
    container.querySelector('#event-add-issue-btn')?.addEventListener('click', () => openModal('event-add-issue-modal'));

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

    const searchInput = container.querySelector('#event-issue-search');
    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => searchIssues(container, eventId, existingIds), 250);
    });
}

async function patchEventItem(eventId, linkId, body) {
    return API.patch(`/events/${eventId}/items/${linkId}`, body);
}

async function searchIssues(container, eventId, existingIds) {
    const query = container.querySelector('#event-issue-search')?.value.trim();
    const results = container.querySelector('#event-issue-results');
    if (!query || query.length < 2) {
        results.innerHTML = `<div class="event-empty-inline">Введіть щонайменше 2 символи.</div>`;
        return;
    }

    const data = await API.get('/issues', { name: query, limit: 12 });
    const items = data.data || data.items || data || [];
    results.innerHTML = items.length
        ? items.map(issue => searchResultHTML(issue, existingIds)).join('')
        : `<div class="event-empty-inline">Нічого не знайдено.</div>`;

    results.querySelectorAll('.event-add-result-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const importance = container.querySelector('#event-issue-importance')?.value || 'main';
            await API.post(`/events/${eventId}/issues`, {
                issue_id: Number(button.dataset.issueId),
                importance,
            });
            await renderEventDetail(container, { id: eventId });
        });
    });
}
