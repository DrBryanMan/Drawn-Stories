import { API } from '../helpers/api.js';
import { getAvatarHtml } from '../shell.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { icon } from '../helpers/icons.js';
import { escapeHtml } from '../helpers/editDiff.js';
import { t, getCurrentLanguage } from '../helpers/i18n.js';

export async function renderUsers(main) {
    document.title = `${t('users_leaderboard_title')} — Drawn Stories`;

    main.innerHTML = `
        <div class="container container--main">
            <div class="catalog-heading" style="margin-bottom: 1.5rem;">
                <h1 class="catalog-title">${t('users_leaderboard_title')}</h1>
                <p class="catalog-subtitle">${t('users_leaderboard_subtitle')}</p>
            </div>

            <div id="users-filter-bar-container"></div>

            <!-- Секція онлайн-користувачів та анонімів -->
            <div id="users-online-container" class="users-online-bar" style="margin: 1em 0;"></div>

            <div class="loader-container" id="users-loader"><div class="loader"></div></div>
            <div id="users-content" style="display: none;">
                <div id="users-table-wrap" class="edits-list"></div>
            </div>
        </div>
    `;

    const loader = main.querySelector('#users-loader');
    const content = main.querySelector('#users-content');
    const tableWrap = main.querySelector('#users-table-wrap');
    const filterBarContainer = main.querySelector('#users-filter-bar-container');
    const onlineContainer = main.querySelector('#users-online-container');

    let state = {
        search: '',
        sort: 'score'
    };

    let usersData = { items: [], total: 0 };
    let filterBar = null;

    async function loadOnlineUsers() {
        try {
            const res = await API.get('/users/online');
            renderOnlineBar(res.online_users || [], res.guests_count || 0);
        } catch (err) {
            console.error('Error loading online users:', err);
        }
    }

    function formatGuestCount(count) {
        const isEn = getCurrentLanguage() === 'en';
        if (isEn) {
            return count === 1 ? '1 anonymous visitor' : `${count} anonymous visitors`;
        }
        if (count === 0) return '0 анонімних відвідувачів';
        if (count === 1) return '1 анонімний відвідувач';
        const lastTwo = count % 100;
        const lastOne = count % 10;
        if (lastTwo >= 11 && lastTwo <= 19) return `${count} анонімних відвідувачів`;
        if (lastOne === 1) return `${count} анонімний відвідувач`;
        if (lastOne >= 2 && lastOne <= 4) return `${count} анонімні відвідувачі`;
        return `${count} анонімних відвідувачів`;
    }

    function getRoleIconName(role) {
        if (role === 'admin') return 'crown';
        if (role === 'moderator') return 'shield';
        if (role === 'editor') return 'edit';
        if (role === 'viewer') return 'eye';
        return 'user';
    }

    function getRoleBadgeHtml(role, roleTitle) {
        const iconName = getRoleIconName(role);
        return `<span class="user-role-badge user-role-badge--${role}" title="${escapeHtml(roleTitle)}">${icon(iconName, 13)}</span>`;
    }

    function renderOnlineBar(onlineUsers, guestsCount) {
        if (!onlineContainer) return;

        const onlineUserChips = onlineUsers.map(u => {
            const userDisp = u.nickname || u.username;
            const avatarUrl = `/api/auth/avatar/${encodeURIComponent(userDisp)}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'online-user-avatar', 24);
            const iconName = getRoleIconName(u.role);
            return `
                <a href="#/user/${escapeHtml(userDisp)}" class="online-user-chip" title="${escapeHtml(u.nickname)} (${escapeHtml(u.role_title)})">
                    ${avatarHtml}
                    <span class="online-user-name">${escapeHtml(u.nickname)}</span>
                    <span class="online-role-tag online-role-tag--${u.role}" title="${escapeHtml(u.role_title)}">${icon(iconName, 12)}</span>
                </a>
            `;
        }).join('');

        const guestChip = `
            <div class="online-guest-chip" title="${t('online_now')}">
                <span class="online-guest-icon">${icon('userCheck', 14)}</span>
                <span>${formatGuestCount(guestsCount)}</span>
            </div>
        `;

        onlineContainer.innerHTML = `
            <div class="online-bar-header">
                <span class="online-bar-title">${icon('users', 15)} ${t('online_now')}:</span>
            </div>
            <div class="online-bar-list">
                ${onlineUserChips}
                ${guestChip}
            </div>
        `;
    }

    async function loadUsers() {
        try {
            loader.style.display = 'flex';
            content.style.display = 'none';

            await loadOnlineUsers();

            const queryParams = new URLSearchParams();
            if (state.search) queryParams.set('search', state.search);
            if (state.sort) queryParams.set('sort', state.sort);

            usersData = await API.get(`/users?${queryParams.toString()}`);

            renderFilterBar();
            renderUsersTable();

            loader.style.display = 'none';
            content.style.display = 'block';
        } catch (err) {
            loader.style.display = 'none';
            tableWrap.innerHTML = `<div class="error-msg">${t('error_loading_users')}: ${escapeHtml(err.message)}</div>`;
            content.style.display = 'block';
        }
    }

    function renderFilterBar() {
        filterBar = mountFilterBar(filterBarContainer, {
            resultsCount: usersData.total || 0,
            resultsLabel: t('participants'),
            showResults: true,
            showSearch: true,
            searchPlaceholder: t('search_user_placeholder'),
            searchValue: state.search,
            showSort: true,
            sortValue: state.sort,
            sortOptions: [
                { value: 'score', label: t('sort_by_score') },
                { value: 'last_activity', label: t('sort_by_online') },
                { value: 'username', label: t('sort_by_name') }
            ],
            showSortOrder: false,
            onSearch: (val) => {
                state.search = val;
                loadUsers();
            },
            onSortChange: (val) => {
                state.sort = val;
                loadUsers();
            }
        });
    }

    const starSvg = (className) => `
        <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="rank-star-svg ${className}">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
    `;

    function renderUsersTable() {
        if (!usersData.items || usersData.items.length === 0) {
            tableWrap.innerHTML = `
                <div class="ds-empty-state">
                    <h3>${t('no_users_found')}</h3>
                    <p>${t('no_users_found_desc')}</p>
                </div>
            `;
            return;
        }

        const rowsHtml = usersData.items.map((u, idx) => {
            const rank = idx + 1;
            let rankClass = '';
            let rankBadgeHtml = `<span class="rank-badge">#${rank}</span>`;

            if (state.sort === 'score') {
                if (rank === 1) {
                    rankClass = 'user-row--rank-1';
                    rankBadgeHtml = `<span class="rank-badge rank-badge--gold">${starSvg('rank-star--gold')}</span>`;
                } else if (rank === 2) {
                    rankClass = 'user-row--rank-2';
                    rankBadgeHtml = `<span class="rank-badge rank-badge--silver">${starSvg('rank-star--silver')}</span>`;
                } else if (rank === 3) {
                    rankClass = 'user-row--rank-3';
                    rankBadgeHtml = `<span class="rank-badge rank-badge--bronze">${starSvg('rank-star--bronze')}</span>`;
                }
            }

            const userDisp = u.nickname || u.username;
            const avatarUrl = `/api/auth/avatar/${encodeURIComponent(userDisp)}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'user-avatar-small', 36);
            const edits = u.edits || { approved: 0, rejected: 0, closed: 0 };

            return `
                <tr class="edit-row user-row ${rankClass}">
                    <td class="col-rank">
                        <div class="user-rank-col">
                            ${rankBadgeHtml}
                        </div>
                    </td>

                    <td class="col-author">
                        <div class="edit-row-author-info">
                            ${avatarHtml}
                            <div class="edit-row-author-text">
                                <div class="user-name-line">
                                    <a href="#/user/${escapeHtml(userDisp)}" class="user-username">${escapeHtml(userDisp)}</a>
                                    ${getRoleBadgeHtml(u.role, u.role_title)}
                                    <span class="user-level-badge" title="${escapeHtml(t('level_title_' + u.level))}">${t('level')} ${u.level}</span>
                                </div>
                            </div>
                        </div>
                    </td>

                    <td class="col-activity">
                        <span class="user-activity-status" title="${t('last_visit')}">
                            <span class="activity-icon">${icon('clock', 14)}</span>
                            <span>${escapeHtml(u.last_activity_text)}</span>
                        </span>
                    </td>

                    <td class="col-edits">
                        <div class="user-edits-breakdown">
                            <div class="stat-item" title="${t('approved_plural')}">
                                <span class="stat-dot stat-dot--green"></span>
                                <span>${edits.approved}</span>
                            </div>
                            <div class="stat-item" title="${t('rejected_plural')}">
                                <span class="stat-dot stat-dot--red"></span>
                                <span>${edits.rejected}</span>
                            </div>
                            <div class="stat-item" title="${t('closed_plural')}">
                                <span class="stat-dot stat-dot--grey"></span>
                                <span>${edits.closed}</span>
                            </div>
                        </div>
                    </td>

                    <td class="col-score">
                        <div class="user-score-box">
                            <span class="user-score-val">${u.score} б.</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tableWrap.innerHTML = `
            <div class="edits-table-container">
                <table class="edits-table users-table">
                    <thead>
                        <tr>
                            <th class="col-rank">${t('rank')}</th>
                            <th class="col-author">${t('participant')}</th>
                            <th class="col-activity">${t('last_visit')}</th>
                            <th class="col-edits">${t('edit_list')}</th>
                            <th class="col-score" style="text-align: right;">${t('points')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    loadUsers();

    const onlineTimer = setInterval(() => {
        if (!document.body.contains(main)) {
            clearInterval(onlineTimer);
            return;
        }
        loadOnlineUsers();
    }, 10000);
}
