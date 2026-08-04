import { API } from '../helpers/api.js';
import { currentUser, getAvatarHtml } from '../shell.js';
import { icon } from '../helpers/icons.js';
import { escapeHtml } from '../helpers/editDiff.js';
import { renderUserLists } from './userLists.js';
import { renderCollections } from './collections.js';
import { renderFavorites } from './favorites.js';
import { openUserFollowsModal } from '../components/modals/UserFollowsModal.js';

export async function renderUserProfile(main, params, query = {}) {
    const username = params.username;
    const currentTab = query.tab || 'overview';
    document.title = `Профіль користувача ${username} — Drawn Stories`;

    main.innerHTML = `
        <div class="user-profile-view">
            <div class="loader-container" id="profile-loader" style="padding: 100px 0;"><div class="loader"></div></div>
            <div id="profile-content" style="display: none;"></div>
        </div>
    `;

    const loader = main.querySelector('#profile-loader');
    const content = main.querySelector('#profile-content');

    try {
        const profile = await API.get(`/users/profile/${username}`);
        renderProfileLayout(content, profile, currentTab);
        loader.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        loader.style.display = 'none';
        content.innerHTML = `
            <div class="container" style="padding: 60px 0;">
                <div class="error-state">
                    <h3>Користувача не знайдено</h3>
                    <p>Користувача "${escapeHtml(username)}" не знайдено або виникла помилка: ${escapeHtml(err.message)}</p>
                </div>
            </div>
        `;
        content.style.display = 'block';
    }
}

function getRoleIconName(role) {
    if (role === 'admin') return 'crown';
    if (role === 'moderator') return 'shield';
    if (role === 'editor') return 'edit';
    if (role === 'viewer') return 'eye';
    return 'user';
}

function renderProfileLayout(container, p, activeTab) {
    const avatarUrl = `/api/auth/avatar/${p.username}`;
    const avatarHtml = getAvatarHtml(avatarUrl, 'user-profile-avatar-img', 200);
    const isSelf = currentUser && currentUser.username.toLowerCase() === p.username.toLowerCase();
    const roleIcon = getRoleIconName(p.role);

    const edits = p.edits_stats || { approved: 0, rejected: 0, closed: 0, total: 0 };

    container.innerHTML = `
        <!-- Hero Band -->
        <section class="user-profile-hero-band">
            <div class="container user-profile-hero">
                <!-- Avatar Column (200px Avatar + Action Icons below) -->
                <div class="user-profile-avatar-col">
                    <div class="user-profile-avatar-frame">
                        ${avatarHtml}
                        <span class="profile-avatar-online-dot ${p.is_online ? 'is-online' : ''}" title="${p.is_online ? 'Зараз онлайн' : p.last_activity_text}"></span>
                    </div>

                    <!-- Кнопки дій під аватаром (лише іконки) -->
                    <div class="user-profile-avatar-actions">
                        ${isSelf ? `
                            <a href="#/settings" class="btn btn-secondary btn-icon-only" title="Налаштування">
                                ${icon('edit', 16)}
                            </a>
                        ` : ''}
                        <button class="btn btn-secondary btn-icon-only" id="btn-share-profile" title="Поділитися">
                            ${icon('share', 16)}
                        </button>
                    </div>
                </div>

                <!-- Info Column -->
                <div class="user-profile-info">
                    <div class="user-profile-name-row">
                        <h1>${escapeHtml(p.nickname || p.username)}</h1>
                        <span class="user-role-badge user-role-badge--${p.role}" title="${escapeHtml(p.role_title)}">
                            ${icon(roleIcon, 14)}
                        </span>
                    </div>

                    <!-- Level Progress Bar з бейджем рівня та балами -->
                    <div class="user-profile-level-box">
                        <div class="level-box-header">
                            <span class="user-level-badge" title="${escapeHtml(p.level_title)}">
                                Рівень ${p.level} — ${escapeHtml(p.level_title)}
                            </span>
                            <span class="level-score-text">${p.score} / ${p.next_min_score} б.</span>
                        </div>
                        <div class="level-progress-bar" title="Прогрес до наступного рівня: ${p.progress_percent}% (${p.score} / ${p.next_min_score} б.)">
                            <div class="level-progress-fill" style="width: ${p.progress_percent}%;"></div>
                        </div>
                    </div>

                    <!-- Meta Row (тільки дата реєстрації) -->
                    <div class="user-profile-meta-row">
                        <div class="user-profile-meta-item" title="Дата реєстрації">
                            ${icon('calendar', 14)}
                            <span>${escapeHtml(p.created_at_text)}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Subscriptions & Follow Button Column -->
                <div class="user-profile-right-col">
                    <div class="user-profile-follows-card">
                        <div class="follows-stat-item" id="btn-open-followers" title="Натисніть, щоб переглянути підписників">
                            <span class="follows-stat-num" id="followers-count-val">${p.followers_count}</span>
                            <span class="follows-stat-lbl">підписників</span>
                        </div>
                        <div class="follows-stat-divider"></div>
                        <div class="follows-stat-item" id="btn-open-following" title="Натисніть, щоб переглянути підписки">
                            <span class="follows-stat-num">${p.following_count}</span>
                            <span class="follows-stat-lbl">підписок</span>
                        </div>
                    </div>

                    ${!isSelf ? `
                        <button class="btn ${p.is_following ? 'btn-following' : 'btn-follow-primary'}" id="btn-follow-user">
                            ${p.is_following ? `${icon('userCheck', 15)} Ви підписані` : `${icon('userPlus', 15)} Підписатися`}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Tabs Band in Hero -->
            <div class="user-profile-tabs-band">
                <div class="container" style="padding: 0 2em;">
                    <div class="user-profile-tabs" role="tablist">
                        <a href="#/user/${escapeHtml(p.username)}?tab=overview" class="user-profile-tab ${activeTab === 'overview' ? 'is-active' : ''}">
                            ${icon('sparkles', 14)} Огляд та правки
                        </a>
                        <a href="#/user/${escapeHtml(p.username)}?tab=readlists" class="user-profile-tab ${activeTab === 'readlists' ? 'is-active' : ''}">
                            ${icon('bookOpen', 14)} Списки читання <span class="tab-count">${p.readlists_count}</span>
                        </a>
                        <a href="#/user/${escapeHtml(p.username)}?tab=collections" class="user-profile-tab ${activeTab === 'collections' ? 'is-active' : ''}">
                            ${icon('collections', 14)} Колекції <span class="tab-count">${p.collections_count}</span>
                        </a>
                        <a href="#/user/${escapeHtml(p.username)}?tab=favorites" class="user-profile-tab ${activeTab === 'favorites' ? 'is-active' : ''}">
                            ${icon('heart', 14)} Улюблене <span class="tab-count">${p.favorites_count}</span>
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <!-- Main Content -->
        <div class="user-profile-content-wrap">
            <div id="profile-tab-content"></div>
        </div>
    `;

    // Модальне вікно підписників
    const followersBtn = container.querySelector('#btn-open-followers');
    if (followersBtn) {
        followersBtn.addEventListener('click', () => openUserFollowsModal(p.username, 'followers'));
    }

    // Модальне вікно підписок
    const followingBtn = container.querySelector('#btn-open-following');
    if (followingBtn) {
        followingBtn.addEventListener('click', () => openUserFollowsModal(p.username, 'following'));
    }

    // Кнопка підписки
    const followBtn = container.querySelector('#btn-follow-user');
    if (followBtn) {
        followBtn.addEventListener('click', async () => {
            try {
                const res = await API.post(`/users/follow/${p.id}`);
                p.is_following = res.following;
                p.followers_count = res.followers_count;
                const cntEl = container.querySelector('#followers-count-val');
                if (cntEl) cntEl.textContent = res.followers_count;
                
                followBtn.className = `btn ${res.following ? 'btn-following' : 'btn-follow-primary'}`;
                followBtn.innerHTML = res.following ? `${icon('userCheck', 15)} Ви підписані` : `${icon('userPlus', 15)} Підписатися`;
            } catch (e) {
                alert(e.message || 'Помилка виконання дії');
            }
        });
    }

    // Кнопка поділитися
    const shareBtn = container.querySelector('#btn-share-profile');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href);
            const origHTML = shareBtn.innerHTML;
            shareBtn.innerHTML = icon('check', 16);
            setTimeout(() => {
                shareBtn.innerHTML = origHTML;
            }, 2000);
        });
    }

    const tabContent = container.querySelector('#profile-tab-content');

    if (activeTab === 'overview') {
        renderOverviewTab(tabContent, p, edits);
    } else if (activeTab === 'readlists') {
        renderUserLists(tabContent, { username: p.username });
    } else if (activeTab === 'collections') {
        renderCollections(tabContent, { username: p.username });
    } else if (activeTab === 'favorites') {
        renderFavorites(tabContent, { username: p.username });
    }
}

function renderOverviewTab(container, p, edits) {
    const recentEdits = p.recent_edits || [];

    const editsRowsHtml = recentEdits.length > 0 ? recentEdits.map(e => {
        let statusBadge = `<span class="status-badge status-badge--pending">На розгляді</span>`;
        if (e.status === 'approved') statusBadge = `<span class="status-badge status-badge--approved">Схвалено</span>`;
        else if (e.status === 'rejected') statusBadge = `<span class="status-badge status-badge--rejected">Відхилено</span>`;
        else if (e.status === 'closed') statusBadge = `<span class="status-badge status-badge--closed">Закрито</span>`;

        return `
            <tr class="edit-row" onclick="window.location.hash='#/edits/${e.id}'">
                <td style="font-family: var(--font-monos);">#${e.id}</td>
                <td><strong>${escapeHtml(e.volume_title)}</strong></td>
                <td><span class="user-level-badge">${escapeHtml(e.entity_type)}</span></td>
                <td>${statusBadge}</td>
                <td style="color: var(--purple, #a855f7); font-weight:700;">+${e.score_awarded} б.</td>
                <td style="color: var(--text-muted); font-size: 13px;">${e.created_at}</td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">Користувач ще не подавав правок.</td></tr>`;

    container.innerHTML = `
        <div class="container">
            <div class="overview-stats-grid">
                <div class="stat-card-box">
                    <div class="stat-card-title">${icon('sparkles', 14)} Нараховано балів</div>
                    <div class="stat-card-val" style="color: var(--purple, #a855f7);">${p.score}</div>
                </div>
                <div class="stat-card-box">
                    <div class="stat-card-title">${icon('check', 14)} Схвалено правок</div>
                    <div class="stat-card-val" style="color: #10b981;">${edits.approved}</div>
                </div>
                <div class="stat-card-box">
                    <div class="stat-card-title">${icon('x', 14)} Відхилено / Закрито</div>
                    <div class="stat-card-val" style="color: #ef4444;">${edits.rejected + edits.closed}</div>
                </div>
                <div class="stat-card-box">
                    <div class="stat-card-title">${icon('history', 14)} Всього внесено</div>
                    <div class="stat-card-val">${edits.total}</div>
                </div>
            </div>

            <div class="catalog-heading" style="margin-bottom: 1rem;">
                <h3>${icon('history', 16)} Останні правки користувача</h3>
            </div>

            <div class="edits-table-container">
                <table class="edits-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">ID</th>
                            <th>Об'єкт / Том</th>
                            <th>Тип</th>
                            <th>Статус</th>
                            <th>Бали</th>
                            <th>Дата</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${editsRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
