import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { createPaginator } from '../components/Pagination.js';
import { updateEditsPendingCount, getAvatarHtml, currentUser } from '../shell.js';
import { langName, getEntityTypeLabel, formatDate } from '../helpers/lang.js';
import { normalizeImageUrl } from '../helpers/image.js';
import { createSearchableUserSelect } from '../components/SearchableUserSelect.js';
import { icon } from '../helpers/icons.js';
import { getChangedFieldBadges, generateDiffHTML } from '../helpers/editDiff.js';
import { renderEditStatusBadge } from '../components/EditStatusBadge.js';
import { t } from '../helpers/i18n.js';

export async function renderEdits(main) {
    document.title = `${t('edits_moderation')} — Drawn Stories`;

    main.innerHTML = `
        <div class="container container--main">
            <div class="catalog-heading" style="margin-bottom: 1.5rem;">
                <h1 class="catalog-title">${t('edits_moderation')}</h1>
                <p class="catalog-subtitle">${t('edits_moderation_desc')}</p>
            </div>
            
            <div id="contributors-container" class="contributors-carousel" style="display: none; margin-bottom: 24px;"></div>
            
            <div class="edits-filter-bar">
                <div class="filter-section results-section">
                    <div class="results-label">${t('edits_count_label')}</div>
                    <div class="results-value" id="edits-count-value">—</div>
                </div>
                
                <div class="filter-section search-section">
                    <div class="search-inner">
                        <span class="search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input type="text" id="edits-search-input" class="search-input-pill" placeholder="${t('search_by_title')}" autocomplete="off">
                    </div>
                </div>

                <div class="filter-section select-section" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <div id="filter-entity-type-container"></div>
                    <div id="filter-status-container"></div>
                    <div id="filter-proposer-container"></div>
                    <div id="filter-moderator-container"></div>
                </div>
            </div>

            <div class="loader-container" id="edits-loader"><div class="loader"></div></div>
            <div id="edits-content" style="display: none;">
                <div class="edits-list" id="edits-list"></div>
                <div id="edits-pagination" class="pagination-wrap"></div>
            </div>
        </div>
    `;

    const loader = main.querySelector('#edits-loader');
    const content = main.querySelector('#edits-content');
    const listContainer = main.querySelector('#edits-list');
    const paginator = createPaginator({ pageSize: 20 });
    
    let allEdits = [];
    let themesCache = [];
    let state = {
        status: 'all',
        search: '',
        entityType: '',
        proposer: '',
        moderator: ''
    };

    async function loadThemes() {
        try {
            const res = await API.get('/themes');
            themesCache = res.items || [];
        } catch (err) {
            console.error('Помилка завантаження тем:', err);
        }
    }

    async function loadEdits() {
        try {
            loader.style.display = 'flex';
            content.style.display = 'none';
            
            await loadThemes();
            allEdits = await API.get('/edits');
            
            populateFilters();
            renderContributors();
            
            loader.style.display = 'none';
            content.style.display = 'block';
            
            renderFilteredList();
        } catch (err) {
            loader.style.display = 'none';
            listContainer.innerHTML = `<div class="error-msg">Помилка завантаження правок: ${err.message}</div>`;
        }
    }

    let entityTypeSelectComp = null;
    let statusSelectComp = null;
    let proposerSelectComp = null;
    let moderatorSelectComp = null;

    function renderContributors() {
        const container = main.querySelector('#contributors-container');
        if (!container) return;

        // Group edits by proposer_username
        const userStats = {};
        allEdits.forEach(e => {
            const username = e.proposer_username;
            if (!username) return;

            if (!userStats[username]) {
                userStats[username] = {
                    username: username,
                    totalScore: 0,
                    approved: 0,
                    rejected: 0,
                    pending: 0,
                    closed: 0
                };
            }
            
            const pts = Number(e.score_awarded) || 0;
            userStats[username].totalScore += pts;

            if (e.status === 'approved') userStats[username].approved++;
            else if (e.status === 'rejected') userStats[username].rejected++;
            else if (e.status === 'pending') userStats[username].pending++;
            else if (e.status === 'closed') userStats[username].closed++;
        });

        // Convert to array and sort by totalScore desc, then approved desc, then rejected asc
        const sorted = Object.values(userStats).sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            if (b.approved !== a.approved) return b.approved - a.approved;
            return a.rejected - b.rejected;
        });

        // Take top 3
        const topContributors = sorted.slice(0, 3);

        if (topContributors.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        const starSvg = (className) => `
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="rank-star-svg ${className}">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
        `;

        let totalCount = sorted.length;

        const cardsHtml = topContributors.map((c, index) => {
            let starHtml = '';
            if (index === 0) starHtml = starSvg('rank-star--gold');
            else if (index === 1) starHtml = starSvg('rank-star--silver');
            else if (index === 2) starHtml = starSvg('rank-star--bronze');

            const contributorDisp = c.nickname || c.username;
            const avatarUrl = `/api/auth/avatar/${encodeURIComponent(contributorDisp)}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'contributor-avatar', 44);

            return `
                <a href="#/user/${escapeHtml(contributorDisp)}" class="contributor-card" title="Переглянути профіль ${escapeHtml(contributorDisp)}">
                    <div class="contributor-avatar-wrap">
                        ${avatarHtml}
                    </div>
                    <div class="contributor-info">
                        <span class="contributor-name">${escapeHtml(contributorDisp)}</span>
                        <div class="contributor-stats">
                            <div class="stat-item" title="Схвалено">
                                <span class="stat-dot stat-dot--green"></span>
                                <span>${c.approved}</span>
                            </div>
                            <div class="stat-item" title="Відхилено">
                                <span class="stat-dot stat-dot--red"></span>
                                <span>${c.rejected}</span>
                            </div>
                            <div class="stat-item" title="Закрито">
                                <span class="stat-dot stat-dot--grey"></span>
                                <span>${c.closed}</span>
                            </div>
                        </div>
                    </div>
                    <div class="contributor-rank-star">
                        ${starHtml}
                    </div>
                    <div class="contributor-score-badge" title="Загальна кількість балів з правок">${c.totalScore} б.</div>
                </a>
            `;
        }).join('');

        const renderContainerContent = (count) => {
            const moreCardHtml = `
                <a href="#/users" class="contributor-card contributor-card--more" title="Переглянути лідерборд усіх користувачів">
                    <div class="contributor-more-content">
                        <span class="contributor-more-icon">${icon('users', 20)}</span>
                        <span class="contributor-more-text">${t('show_all')} (${count})</span>
                    </div>
                    <span class="contributor-more-arrow">${icon('chevronRight', 18)}</span>
                </a>
            `;
            container.style.display = 'flex';
            container.innerHTML = cardsHtml + moreCardHtml;
        };

        renderContainerContent(totalCount);

        API.get('/users').then(res => {
            if (res && typeof res.total === 'number') {
                renderContainerContent(res.total);
            }
        }).catch(() => {});
    }

    function populateFilters() {
        const proposers = new Set();
        const moderators = new Set();
        const entityTypes = new Set();
        
        allEdits.forEach(e => {
            if (e.proposer_username) proposers.add(e.proposer_username);
            if (e.moderator_username) moderators.add(e.moderator_username);
            if (e.entity_type) entityTypes.add(e.entity_type);
        });

        const entityTypeContainer = main.querySelector('#filter-entity-type-container');
        if (entityTypeContainer) {
            if (entityTypeSelectComp) entityTypeSelectComp.destroy();
            const entityOpts = Array.from(entityTypes).sort().map(t => ({
                value: t,
                label: getEntityTypeLabel(t)
            }));
            entityTypeSelectComp = createSearchableUserSelect({
                container: entityTypeContainer,
                placeholder: t('all_types'),
                searchable: false,
                options: entityOpts,
                value: state.entityType,
                onChange: (val) => {
                    state.entityType = val;
                    paginator.reset();
                    renderFilteredList();
                }
            });
        }

        const statusContainer = main.querySelector('#filter-status-container');
        if (statusContainer) {
            if (statusSelectComp) statusSelectComp.destroy();
            statusSelectComp = createSearchableUserSelect({
                container: statusContainer,
                placeholder: t('all_statuses'),
                searchable: false,
                options: [
                    { value: 'pending',  label: t('pending_plural') },
                    { value: 'approved', label: t('approved_plural') },
                    { value: 'rejected', label: t('rejected_plural') },
                    { value: 'closed',   label: t('closed_plural') }
                ],
                value: state.status === 'all' ? '' : state.status,
                onChange: (val) => {
                    state.status = val || 'all';
                    paginator.reset();
                    renderFilteredList();
                }
            });
        }

        const proposerContainer = main.querySelector('#filter-proposer-container');
        if (proposerContainer) {
            if (proposerSelectComp) proposerSelectComp.destroy();
            proposerSelectComp = createSearchableUserSelect({
                container: proposerContainer,
                placeholder: t('all_authors'),
                searchPlaceholder: t('search_user_placeholder'),
                options: Array.from(proposers).sort(),
                value: state.proposer,
                onChange: (val) => {
                    state.proposer = val;
                    paginator.reset();
                    renderFilteredList();
                }
            });
        }

        const moderatorContainer = main.querySelector('#filter-moderator-container');
        if (moderatorContainer) {
            if (moderatorSelectComp) moderatorSelectComp.destroy();
            moderatorSelectComp = createSearchableUserSelect({
                container: moderatorContainer,
                placeholder: t('all_moderators'),
                searchPlaceholder: t('search_user_placeholder'),
                options: Array.from(moderators).sort(),
                value: state.moderator,
                onChange: (val) => {
                    state.moderator = val;
                    paginator.reset();
                    renderFilteredList();
                }
            });
        }
    }

    function renderFilteredList() {
        const filtered = allEdits.filter(e => {
            if (state.status !== 'all' && e.status !== state.status) return false;
            if (state.entityType && e.entity_type !== state.entityType) return false;
            if (state.proposer && e.proposer_username !== state.proposer) return false;
            if (state.moderator && e.moderator_username !== state.moderator) return false;
            
            if (state.search) {
                const title = (e.volume_name_uk || e.volume_name || '').toLowerCase();
                if (!title.includes(state.search.toLowerCase())) return false;
            }
            return true;
        });

        // Оновимо кількість знайдених правок
        const countVal = main.querySelector('#edits-count-value');
        if (countVal) {
            countVal.textContent = filtered.length;
        }

        const total = filtered.length;
        const page = paginator.getPage();
        const pageSize = paginator.getPageSize();
        const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

        if (pageItems.length === 0) {
            listContainer.innerHTML = `<div class="empty-msg">${t('no_edits_found_desc')}</div>`;
            const paginationWrap = main.querySelector('#edits-pagination');
            if (paginationWrap) paginationWrap.innerHTML = '';
            return;
        }

        listContainer.innerHTML = `
            <div class="edits-table-container">
                <table class="edits-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>${t('author_date')}</th>
                            <th>${t('content_type')}</th>
                            <th>${t('changes')}</th>
                            <th>${t('points')}</th>
                            <th style="text-align: right;">${t('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map(e => renderEditRow(e)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Рендер пагінатора
        const paginationWrap = main.querySelector('#edits-pagination');
        if (paginationWrap) {
            paginationWrap.replaceChildren(
                paginator.render(total, () => {
                    renderFilteredList();
                    listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                })
            );
        }

        attachCardEvents();
    }

    function attachCardEvents() {
        listContainer.querySelectorAll('.edit-row').forEach(row => {
            row.addEventListener('click', (event) => {
                if (event.target.closest('a') || event.target.closest('button')) return;
                const editId = row.dataset.id;
                router.navigate(`/edits/${editId}`);
            });
        });

        listContainer.querySelectorAll('.btn-delete-edit').forEach(btn => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const editId = btn.dataset.id;
                if (!confirm(`Ви дійсно бажаєте видалити правку #${editId}? Нараховані бали буде віднято у автора.`)) {
                    return;
                }
                try {
                    btn.disabled = true;
                    const res = await API.delete(`/edits/${editId}`);
                    alert(res.message || 'Правку видалено');
                    await updateEditsPendingCount();
                    await loadEdits();
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                    btn.disabled = false;
                }
            });
        });
    }

    function renderEditRow(e) {
        const statusBadgeHtml = renderEditStatusBadge(e.status, { iconOnly: true });

        const entityLabel = getEntityTypeLabel(e.entity_type);
        const entityName = e.volume_name_uk || e.volume_name || `ID ${e.entity_id}`;
        
        const patchObj = e.patch_data || {};
        const beforeData = patchObj.before || {};
        const afterData = patchObj.after || patchObj;

        const isAdmin = currentUser && currentUser.role === 'admin';
        const deleteBtnHtml = isAdmin ? `
            <button class="btn-delete-edit" data-id="${e.id}" title="Видалити правку" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; margin-left: 8px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; transition: color 0.2s;" onmouseover="this.style.color='var(--color-danger, #ef4444)'" onmouseout="this.style.color='var(--text-muted)'">
                ${icon('trash', 14)}
            </button>
        ` : '';

        const proposerDisp = e.proposer_nickname || e.proposer_username;
        const proposerAvatarUrl = `/api/auth/avatar/${encodeURIComponent(proposerDisp)}`;
        const proposerAvatarHtml = getAvatarHtml(proposerAvatarUrl, 'edit-row-avatar', 36);

        return `
            <tr class="edit-row" data-id="${e.id}">
                <td class="col-id">
                    <a href="#/edits/${e.id}" class="edit-row-link">#${e.id}</a>
                </td>
                <td class="col-author">
                    <a href="#/user/${escapeHtml(proposerDisp)}" class="edit-row-author-info" title="Переглянути профіль ${escapeHtml(proposerDisp)}">
                        ${proposerAvatarHtml}
                        <div class="edit-row-author-text">
                            <span class="edit-row-author-name">${escapeHtml(proposerDisp)}</span>
                            <span class="edit-row-date">${formatDate(e.created_at)}</span>
                        </div>
                    </a>
                </td>
                <td class="col-content">
                    <div class="edit-row-content-info">
                        <a href="#/edits/${e.id}" class="edit-row-content-title">${escapeHtml(entityName)}</a>
                        <span class="edit-row-entity-badge">${entityLabel}</span>
                    </div>
                </td>
                <td class="col-changes">
                    ${getChangedFieldBadges(beforeData, afterData)}
                </td>
                <td class="col-score">
                    ${renderScoreChip(e)}
                </td>
                <td class="col-status" style="white-space: nowrap;">
                    ${statusBadgeHtml}
                    ${deleteBtnHtml}
                </td>
            </tr>
        `;
    }

    function renderScoreChip(e) {
        const pts = e.score_awarded ?? 0;
        if (e.status === 'pending') {
            return '<span class="score-chip score-chip--pending">—</span>';
        }
        if (e.status === 'rejected') {
            return '<span class="score-chip score-chip--negative">−10</span>';
        }
        if (pts === 0) {
            return '<span class="score-chip score-chip--zero">0 б.</span>';
        }
        return `<span class="score-chip score-chip--positive">+${pts} б.</span>`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }



    // Текстовий пошук
    const searchInput = main.querySelector('#edits-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.search = e.target.value.trim();
            paginator.reset();
            renderFilteredList();
        });
    }

    await loadEdits();
}
