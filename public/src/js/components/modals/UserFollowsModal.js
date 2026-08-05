import { API } from '../../helpers/api.js';
import { getAvatarHtml, currentUser } from '../../shell.js';
import { icon } from '../../helpers/icons.js';
import { escapeHtml } from '../../helpers/editDiff.js';

function getRoleIconName(role) {
    if (role === 'admin') return 'crown';
    if (role === 'moderator') return 'shield';
    if (role === 'editor') return 'edit';
    if (role === 'viewer') return 'eye';
    return 'user';
}

export async function openUserFollowsModal(username, initialType = 'followers') {
    const existingModal = document.getElementById('user-follows-modal');
    if (existingModal) existingModal.remove();

    const titleText = initialType === 'following' ? 'Підписки користувача' : 'Підписники користувача';

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'user-follows-modal';
    modalOverlay.className = 'ds-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="ds-modal ds-modal--medium">
            <div class="ds-modal-header">
                <h3 class="ds-modal-title" style="display: flex; align-items: center; gap: 8px;">
                    ${icon('users', 18)} ${titleText}
                </h3>
                <button class="ds-modal-close" id="modal-close-x">&times;</button>
            </div>
            <div class="ds-modal-body" style="max-height: 440px; overflow-y: auto; padding: 16px;">
                <div class="loader-container" id="follows-modal-loader"><div class="loader"></div></div>
                <div id="follows-modal-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);
    document.body.classList.add('modal-open');

    const loader = modalOverlay.querySelector('#follows-modal-loader');
    const listContainer = modalOverlay.querySelector('#follows-modal-list');
    const closeBtn = modalOverlay.querySelector('#modal-close-x');

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        modalOverlay.remove();
        document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    closeBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', handleKeydown);

    try {
        const res = await API.get(`/users/follows/${username}?type=${initialType}`);
        loader.style.display = 'none';

        if (!res.items || res.items.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                    ${initialType === 'following' ? 'Користувач ні на кого не підписаний.' : 'У користувача поки немає підписників.'}
                </div>
            `;
            return;
        }

        listContainer.innerHTML = res.items.map(u => {
            const userDisp = u.nickname || u.username;
            const avatarUrl = `/api/auth/avatar/${encodeURIComponent(userDisp)}`;
            const avatarHtml = getAvatarHtml(avatarUrl, 'modal-user-avatar', 40);
            const roleIcon = getRoleIconName(u.role);
            const isSelf = currentUser && currentUser.username.toLowerCase() === u.username.toLowerCase();

            return `
                <div class="modal-user-item">
                    <a href="#/user/${escapeHtml(userDisp)}" class="modal-user-info" onclick="document.body.classList.remove('modal-open'); document.getElementById('user-follows-modal')?.remove()">
                        ${avatarHtml}
                        <div class="modal-user-text">
                            <div class="modal-user-name">
                                <strong>${escapeHtml(u.nickname)}</strong>
                                <span class="user-role-badge user-role-badge--${u.role}" title="${escapeHtml(u.role_title)}">
                                    ${icon(roleIcon, 12)}
                                </span>
                            </div>
                            <span class="user-level-badge" style="font-size: 11px;">Рівень ${u.level}</span>
                        </div>
                    </a>

                    ${!isSelf ? `
                        <button class="modal-follow-btn ${u.is_following ? 'is-following' : ''}" data-userid="${u.id}">
                            ${u.is_following ? `${icon('userCheck', 13)} Ви підписані` : `${icon('userPlus', 13)} Підписатися`}
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Обробник кнопок підписки у модалці
        listContainer.querySelectorAll('.modal-follow-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = parseInt(btn.dataset.userid, 10);
                try {
                    const toggleRes = await API.post(`/users/follow/${targetId}`);
                    btn.className = `modal-follow-btn ${toggleRes.following ? 'is-following' : ''}`;
                    btn.innerHTML = toggleRes.following ? `${icon('userCheck', 13)} Ви підписані` : `${icon('userPlus', 13)} Підписатися`;
                } catch (e) {
                    alert(e.message || 'Помилка підписки');
                }
            });
        });

    } catch (err) {
        loader.style.display = 'none';
        listContainer.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
}
