import { API } from '../helpers/api.js';
import { currentUser, getAvatarHtml } from '../shell.js';
import { icon } from '../helpers/icons.js';
import { escapeHtml } from '../helpers/editDiff.js';
import { renderUserLists } from './userLists.js';
import { renderCollections } from './collections.js';
import { renderFavorites } from './favorites.js';
import { openUserFollowsModal } from '../components/modals/UserFollowsModal.js';
import { renderEditStatusBadge } from '../components/EditStatusBadge.js';
import { getEntityTypeLabel, formatDate } from '../helpers/lang.js';
import { t } from '../helpers/i18n.js';

export async function renderUserProfile(main, params, query = {}) {
    const username = params.username;
    const currentTab = query.tab || 'overview';
    document.title = `${t('user_profile')} ${username} — Drawn Stories`;

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
                    <h3>${t('user_not_found')}</h3>
                    <p>${t('user_not_found_desc')}: ${escapeHtml(err.message)}</p>
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
    const avatarUrl = `/api/auth/avatar/${encodeURIComponent(p.nickname || p.username)}`;
    const avatarHtml = getAvatarHtml(avatarUrl, 'user-profile-avatar-img', 200);
    const isSelf = currentUser && currentUser.username.toLowerCase() === p.username.toLowerCase();
    const roleIcon = getRoleIconName(p.role);

    const edits = p.edits_stats || { approved: 0, rejected: 0, closed: 0, pending: 0, total: 0 };

    container.innerHTML = `
        <!-- Hero Band -->
        <section class="user-profile-hero-band">
            <div class="container user-profile-hero">
                <!-- Avatar Column (200px Avatar + Action Icons below) -->
                <div class="user-profile-avatar-col">
                    <div class="user-profile-avatar-frame">
                        ${avatarHtml}
                        <span class="profile-avatar-online-dot ${p.is_online ? 'is-online' : ''}" title="${p.is_online ? t('online_status_online') : p.last_activity_text}"></span>
                    </div>

                    <!-- Кнопки дій під аватаром (лише іконки) -->
                    <div class="user-profile-avatar-actions">
                        ${isSelf ? `
                            <a href="#/settings" class="btn btn-secondary btn-icon-only" title="${t('settings')}">
                                ${icon('edit', 16)}
                            </a>
                        ` : ''}
                        <button class="btn btn-secondary btn-icon-only" id="btn-share-profile" title="${t('share')}">
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
                            <span class="user-level-badge" title="${escapeHtml(t('level_title_' + p.level))}">
                                ${t('level')} ${p.level} — ${escapeHtml(t('level_title_' + p.level))}
                            </span>
                            <span class="level-score-text">${p.score} / ${p.next_min_score} ${t('points_short')}</span>
                        </div>
                        <div class="level-progress-bar" title="${t('progress_to_next_level')}: ${p.progress_percent}% (${p.score} / ${p.next_min_score} ${t('points_short')})">
                            <div class="level-progress-fill" style="width: ${p.progress_percent}%;"></div>
                        </div>
                    </div>

                    <!-- Meta Row (тільки дата реєстрації) -->
                    <div class="user-profile-meta-row">
                        <div class="user-profile-meta-item" title="${t('registration_date')}">
                            ${icon('calendar', 14)}
                            <span>${t('member_since', { date: escapeHtml((p.created_at_text || '').replace(/^На сайті з\s*/i, '')) })}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Subscriptions & Follow Button Column -->
                <div class="user-profile-right-col">
                    <div class="user-profile-follows-card">
                        <div class="follows-stat-item" id="btn-open-followers" title="${t('click_to_view_followers')}">
                            <span class="follows-stat-num" id="followers-count-val">${p.followers_count}</span>
                            <span class="follows-stat-lbl">${t('followers_count_label')}</span>
                        </div>
                        <div class="follows-stat-divider"></div>
                        <div class="follows-stat-item" id="btn-open-following" title="${t('click_to_view_following')}">
                            <span class="follows-stat-num">${p.following_count}</span>
                            <span class="follows-stat-lbl">${t('following_count_label')}</span>
                        </div>
                    </div>

                    ${!isSelf ? `
                        <button class="btn ${p.is_following ? 'btn-following' : 'btn-follow-primary'}" id="btn-follow-user">
                            ${p.is_following ? `${icon('userCheck', 15)} ${t('you_are_following')}` : `${icon('userPlus', 15)} ${t('follow_button')}`}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Tabs Band in Hero -->
            <div class="user-profile-tabs-band">
                <div class="container" style="padding: 0 2em;">
                    <div class="user-profile-tabs" role="tablist">
                        <a href="#/user/${escapeHtml(p.nickname || p.username)}?tab=overview" class="user-profile-tab ${activeTab === 'overview' ? 'is-active' : ''}">
                            ${icon('sparkles', 14)} ${t('tab_overview_and_edits')}
                        </a>
                        <a href="#/user/${escapeHtml(p.nickname || p.username)}?tab=readlists" class="user-profile-tab ${activeTab === 'readlists' ? 'is-active' : ''}">
                            ${icon('bookOpen', 14)} ${t('tab_readlists')} <span class="tab-count">${p.readlists_count}</span>
                        </a>
                        <a href="#/user/${escapeHtml(p.nickname || p.username)}?tab=collections" class="user-profile-tab ${activeTab === 'collections' ? 'is-active' : ''}">
                            ${icon('collections', 14)} ${t('tab_collections')} <span class="tab-count">${p.collections_count}</span>
                        </a>
                        <a href="#/user/${escapeHtml(p.nickname || p.username)}?tab=favorites" class="user-profile-tab ${activeTab === 'favorites' ? 'is-active' : ''}">
                            ${icon('heart', 14)} ${t('tab_favorites')} <span class="tab-count">${p.favorites_count}</span>
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
                followBtn.innerHTML = res.following ? `${icon('userCheck', 15)} ${t('you_are_following')}` : `${icon('userPlus', 15)} ${t('follow_button')}`;
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
        const statusBadge = renderEditStatusBadge(e.status);

        return `
            <tr class="edit-row" onclick="window.location.hash='#/edits/${e.id}'">
                <td style="font-family: var(--font-monos);">#${e.id}</td>
                <td><strong>${escapeHtml(e.volume_title)}</strong></td>
                <td><span class="user-level-badge">${escapeHtml(getEntityTypeLabel(e.entity_type))}</span></td>
                <td>${statusBadge}</td>
                <td style="color: var(--purple, #a855f7); font-weight:700;">+${e.score_awarded} ${t('points_short')}</td>
                <td style="color: var(--text-muted); font-size: 13px;">${formatDate(e.created_at)}</td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">${t('user_no_edits')}</td></tr>`;

    container.innerHTML = `
        <div class="container">
            <!-- Спільний уніфікований блок статистики правок -->
            <div class="user-edits-summary-card">
                <div class="summary-card-header">
                    <span class="summary-card-title">${icon('history', 16)} ${t('edits_and_score_stats')}</span>
                </div>
                <div class="summary-card-body">
                    <!-- 1. Індикатори статусу -->
                    <div class="summary-section summary-section--indicators">
                        <span class="summary-section-label">${icon('layers', 12)} ${t('by_status')}</span>
                        <div class="edit-indicators-group">
                            <div class="edit-indicator-pill edit-indicator-pill--pending" title="${t('status_pending')}: ${edits.pending || 0}">
                                <span class="pill-icon-count">${icon('planned', 14)} <strong class="pill-val">${edits.pending || 0}</strong></span>
                                <span class="pill-lbl">${t('status_pending')}</span>
                            </div>
                            <div class="edit-indicator-pill edit-indicator-pill--approved" title="${t('status_approved')}: ${edits.approved}">
                                <span class="pill-icon-count">${icon('check', 14)} <strong class="pill-val">${edits.approved}</strong></span>
                                <span class="pill-lbl">${t('status_approved')}</span>
                            </div>
                            <div class="edit-indicator-pill edit-indicator-pill--rejected" title="${t('status_rejected')}: ${edits.rejected}">
                                <span class="pill-icon-count">${icon('x', 14)} <strong class="pill-val">${edits.rejected}</strong></span>
                                <span class="pill-lbl">${t('status_rejected')}</span>
                            </div>
                            <div class="edit-indicator-pill edit-indicator-pill--closed" title="${t('status_closed')}: ${edits.closed}">
                                <span class="pill-icon-count">${icon('lock', 14)} <strong class="pill-val">${edits.closed}</strong></span>
                                <span class="pill-lbl">${t('status_closed')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="summary-divider"></div>

                    <!-- 2. Всього внесено -->
                    <div class="summary-section summary-section--total">
                        <span class="summary-section-label">${icon('list', 12)} ${t('total_submitted')}</span>
                        <div class="summary-metric-val">${edits.total}</div>
                    </div>

                    <div class="summary-divider"></div>

                    <!-- 3. Нараховано балів -->
                    <div class="summary-section summary-section--score">
                        <span class="summary-section-label">${icon('sparkles', 12)} ${t('awarded_points')}</span>
                        <div class="summary-metric-val summary-metric-val--purple">${p.score}</div>
                    </div>
                </div>
            </div>

            <div class="catalog-heading" style="margin-bottom: 1rem;">
                <h3>${icon('history', 16)} ${t('user_recent_edits')}</h3>
            </div>

            <div class="edits-table-container">
                <table class="edits-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">ID</th>
                            <th>${t('content')}</th>
                            <th>${t('type')}</th>
                            <th>${t('status')}</th>
                            <th>${t('points')}</th>
                            <th>${t('date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${editsRowsHtml}
                    </tbody>
                </table>
            </div>

            <div class="user-all-edits-btn-wrap" style="margin-top: 16px; text-align: center;">
                <a href="#/edits?proposer=${encodeURIComponent(p.username)}" class="btn btn-secondary">
                    ${icon('list', 16)} ${t('view_all_edits')}
                </a>
            </div>
        </div>
    `;
}
