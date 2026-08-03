import { API } from '../helpers/api.js';
import { getAvatarHtml } from '../shell.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { icon } from '../helpers/icons.js';
import { escapeHtml } from '../helpers/editDiff.js';

export async function renderUsers(main) {
    document.title = 'Лідерборд користувачів — Drawn Stories';

    main.innerHTML = `
        <div class="container container--main">
            <div class="catalog-heading" style="margin-bottom: 1.5rem;">
                <h1 class="catalog-title">Лідерборд користувачів</h1>
                <p class="catalog-subtitle">Перегляд списку всіх учасників, їхніх досягнень, балів та активності</p>
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
            console.error('Помилка завантаження онлайн користувачів:', err);
        }
    }

    function formatGuestCount(count) {
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
            const avatarUrl = `/api/auth/avatar/${u.username}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'online-user-avatar', 24);
            const iconName = getRoleIconName(u.role);
            return `
                <a href="#/user/${escapeHtml(u.username)}" class="online-user-chip" title="${escapeHtml(u.nickname)} (${escapeHtml(u.role_title)})">
                    ${avatarHtml}
                    <span class="online-user-name">${escapeHtml(u.nickname)}</span>
                    <span class="online-role-tag online-role-tag--${u.role}" title="${escapeHtml(u.role_title)}">${icon(iconName, 12)}</span>
                </a>
            `;
        }).join('');

        const guestChip = `
            <div class="online-guest-chip" title="Анонімні відвідувачі, які зараз переглядають сайт">
                <span class="online-guest-icon">${icon('userCheck', 14)}</span>
                <span>${formatGuestCount(guestsCount)}</span>
            </div>
        `;

        onlineContainer.innerHTML = `
            <div class="online-bar-header">
                <span class="online-bar-title">${icon('users', 15)} Зараз на сайті:</span>
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
            tableWrap.innerHTML = `<div class="error-msg">Помилка завантаження користувачів: ${escapeHtml(err.message)}</div>`;
            content.style.display = 'block';
        }
    }

    function renderFilterBar() {
        filterBar = mountFilterBar(filterBarContainer, {
            resultsCount: usersData.total || 0,
            resultsLabel: 'Учасників',
            showResults: true,
            showSearch: true,
            searchPlaceholder: 'Пошук користувача...',
            searchValue: state.search,
            showSort: true,
            sortValue: state.sort,
            sortOptions: [
                { value: 'score', label: 'За балами' },
                { value: 'last_activity', label: 'За останнім онлайном' },
                { value: 'username', label: 'За ім\'ям' }
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
                    <h3>Користувачів не знайдено</h3>
                    <p>Спробуйте змінити пошуковий запит або параметри сортування.</p>
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
                    rankBadgeHtml = `<span class="rank-badge rank-badge--gold" title="1 місце">${starSvg('rank-star--gold')}</span>`;
                } else if (rank === 2) {
                    rankClass = 'user-row--rank-2';
                    rankBadgeHtml = `<span class="rank-badge rank-badge--silver" title="2 місце">${starSvg('rank-star--silver')}</span>`;
                } else if (rank === 3) {
                    rankClass = 'user-row--rank-3';
                    rankBadgeHtml = `<span class="rank-badge rank-badge--bronze" title="3 місце">${starSvg('rank-star--bronze')}</span>`;
                }
            }

            const avatarUrl = `/api/auth/avatar/${u.username}`;
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
                                    <a href="#/user/${escapeHtml(u.username)}" class="user-username">${escapeHtml(u.nickname || u.username)}</a>
                                    ${getRoleBadgeHtml(u.role, u.role_title)}
                                    <span class="user-level-badge" title="${escapeHtml(u.level_title)}">Рівень ${u.level}</span>
                                </div>
                            </div>
                        </div>
                    </td>

                    <td class="col-activity">
                        <span class="user-activity-status" title="Останній візит">
                            <span class="activity-icon">${icon('clock', 14)}</span>
                            <span>${escapeHtml(u.last_activity_text)}</span>
                        </span>
                    </td>

                    <td class="col-edits">
                        <div class="user-edits-breakdown" title="Правки: Схвалено / Відхилено / Закрито">
                            <div class="stat-item" title="Схвалено">
                                <span class="stat-dot stat-dot--green"></span>
                                <span>${edits.approved}</span>
                            </div>
                            <div class="stat-item" title="Відхилено">
                                <span class="stat-dot stat-dot--red"></span>
                                <span>${edits.rejected}</span>
                            </div>
                            <div class="stat-item" title="Закрито">
                                <span class="stat-dot stat-dot--grey"></span>
                                <span>${edits.closed}</span>
                            </div>
                        </div>
                    </td>

                    <td class="col-score">
                        <div class="user-score-box" title="Бали користувача">
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
                            <th class="col-rank">Місце</th>
                            <th class="col-author">Учасник</th>
                            <th class="col-activity">Останній візит</th>
                            <th class="col-edits">Правки</th>
                            <th class="col-score" style="text-align: right;">Бали</th>
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
