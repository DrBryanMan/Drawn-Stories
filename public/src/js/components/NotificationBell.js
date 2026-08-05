import { API } from '../helpers/api.js';
import { NotificationDropdown } from './NotificationDropdown.js';

export class NotificationBell {
  constructor() {
    this.container = null;
    this.badgeEl = null;
    this.unreadCount = 0;
    this.dropdown = null;
    this.pollingTimer = null;
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
      this.setUnreadCount(res.unread_count || 0);
    } catch (err) {
      // Авторизація відсутня або помилка мережі
      this.setUnreadCount(0);
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
