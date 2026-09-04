import { API } from '../helpers/api.js';
import { NotificationDropdown } from './NotificationDropdown.js';
import { Toast } from './Toast.js';
import { t } from '../helpers/i18n.js';

function getToastedIds() {
  try {
    const raw = sessionStorage.getItem('ds_toasted_notifications');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markToastedId(id) {
  try {
    const ids = getToastedIds();
    ids.add(Number(id));
    const arr = Array.from(ids).slice(-100);
    sessionStorage.setItem('ds_toasted_notifications', JSON.stringify(arr));
  } catch {}
}

export class NotificationBell {
  constructor() {
    this.container = null;
    this.badgeEl = null;
    this.unreadCount = 0;
    this.dropdown = null;
    this.pollingTimer = null;
    this.isInitialCheck = true;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-bell-wrapper';
    wrapper.id = 'notificationBellWrapper';

    wrapper.innerHTML = `
      <button type="button" class="notification-bell-btn" id="notificationBellBtn" title="Сповіщення" aria-label="Сповіщення">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
      </button>
    `;

    this.container = wrapper;
    this.badgeEl = wrapper.querySelector('#notificationBadge');
    
    // Створюємо випадаючий список
    this.dropdown = new NotificationDropdown(this);
    wrapper.appendChild(this.dropdown.render());

    this.bindEvents();
    this.checkUnreadCount();
    this.startPolling();

    return wrapper;
  }

  bindEvents() {
    const btn = this.container.querySelector('#notificationBellBtn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dropdown.toggle();
      });
    }

    // Закриття випадаючого вікна при кліку поза ним
    document.addEventListener('click', (e) => {
      if (this.dropdown && this.dropdown.isOpen) {
        if (!this.container.contains(e.target)) {
          this.dropdown.close();
        }
      }
    });
  }

  async checkUnreadCount() {
    try {
      const res = await API.get('/notifications/unread-count');
      const count = res.unread_count || 0;
      const previousCount = this.unreadCount;
      this.setUnreadCount(count);

      if (count > 0 && (count > previousCount || this.isInitialCheck)) {
        await this.checkAndShowToasts();
      }
      this.isInitialCheck = false;
    } catch (err) {
      // Авторизація відсутня або помилка мережі
      this.setUnreadCount(0);
    }
  }

  async checkAndShowToasts() {
    try {
      const res = await API.get('/notifications', { unread_only: true, limit: 5 });
      const items = res.notifications || [];
      const toastedIds = getToastedIds();

      for (const item of items.slice().reverse()) {
        const numId = Number(item.id);
        if (toastedIds.has(numId)) continue;
        markToastedId(numId);

        const payload = item.payload || {};
        if (item.type === 'level_up') {
          Toast.levelUp({
            level: payload.level,
            levelTitle: payload.level_title,
            score: payload.score,
            username: payload.actor_username,
            link: item.link
          });
        } else if (item.type === 'edit_approved') {
          Toast.success(item.message || t('edit_approved_title'), t('edit_approved_title'), {
            link: item.link
          });
        } else if (item.type === 'edit_rejected') {
          Toast.error(item.message || t('edit_rejected_title'), t('edit_rejected_title'), {
            link: item.link
          });
        } else if (item.type === 'new_follower') {
          Toast.info(item.message || t('new_follower_title'), t('new_follower_title'), {
            link: item.link
          });
        } else if (item.type === 'new_issue') {
          Toast.info(item.message || t('new_issue_title'), t('new_issue_title'), {
            link: item.link
          });
        } else {
          Toast.show({
            title: item.title,
            message: item.message,
            link: item.link
          });
        }
      }
    } catch (err) {
      console.warn('Помилка завантаження сповіщень для тостів:', err);
    }
  }

  setUnreadCount(count) {
    this.unreadCount = Math.max(0, count);
    if (!this.badgeEl) return;

    if (this.unreadCount > 0) {
      this.badgeEl.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.badgeEl.style.display = 'flex';
    } else {
      this.badgeEl.style.display = 'none';
    }
  }

  decrementUnread() {
    this.setUnreadCount(this.unreadCount - 1);
  }

  startPolling() {
    this.stopPolling();
    // Опитування сервера кожні 45 секунд
    this.pollingTimer = setInterval(() => {
      this.checkUnreadCount();
    }, 45000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  destroy() {
    this.stopPolling();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

