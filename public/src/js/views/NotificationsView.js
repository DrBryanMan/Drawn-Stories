import { API } from '../helpers/api.js';
import { normalizeImageUrl } from '../helpers/image.js';
import { t, getCurrentLanguage } from '../helpers/i18n.js';

export class NotificationsView {
  constructor() {
    this.container = null;
    this.page = 1;
    this.unreadOnly = false;
    this.notifications = [];
    this.total = 0;
  }

  async render() {
    const view = document.createElement('div');
    view.className = 'notifications-page-container';

    view.innerHTML = `
      <div class="notifications-page-header">
        <h1 class="notifications-page-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          ${t('notifications_title')}
        </h1>

        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="notifications-filter-tabs">
            <button type="button" class="tab-btn ${!this.unreadOnly ? 'active' : ''}" id="tabAll">${t('filter_all')}</button>
            <button type="button" class="tab-btn ${this.unreadOnly ? 'active' : ''}" id="tabUnread">${t('filter_unread')}</button>
          </div>

          <button type="button" class="btn-mark-all-read" id="btnPageMarkAll" style="padding: 6px 12px; font-weight: 500;">
            ${t('mark_all_read')}
          </button>
        </div>
      </div>

      <div class="notifications-list-card" id="notificationsPageList">
        <div class="notification-empty">${t('loading_notifications')}</div>
      </div>

      <div id="notificationsPagination" style="margin-top: 16px; display: flex; justify-content: center; gap: 8px;"></div>
    `;

    this.container = view;
    this.bindEvents();
    await this.loadData();

    return view;
  }

  bindEvents() {
    const tabAll = this.container.querySelector('#tabAll');
    const tabUnread = this.container.querySelector('#tabUnread');
    const btnMarkAll = this.container.querySelector('#btnPageMarkAll');

    if (tabAll) {
      tabAll.addEventListener('click', () => {
        if (this.unreadOnly) {
          this.unreadOnly = false;
          this.page = 1;
          tabAll.classList.add('active');
          tabUnread.classList.remove('active');
          this.loadData();
        }
      });
    }

    if (tabUnread) {
      tabUnread.addEventListener('click', () => {
        if (!this.unreadOnly) {
          this.unreadOnly = true;
          this.page = 1;
          tabUnread.classList.add('active');
          tabAll.classList.remove('active');
          this.loadData();
        }
      });
    }

    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async () => {
        try {
          await API.post('/notifications/read-all');
          this.loadData();
        } catch (err) {
          console.error('Помилка позначення прочитаними:', err);
        }
      });
    }
  }

  async loadData() {
    const listEl = this.container.querySelector('#notificationsPageList');
    if (!listEl) return;

    try {
      const res = await API.get('/notifications', {
        page: this.page,
        limit: 20,
        unread_only: this.unreadOnly
      });

      this.notifications = res.notifications || [];
      this.total = res.total || 0;

      this.renderList();
      this.renderPagination();
    } catch (err) {
      console.error('Помилка завантаження сторінки сповіщень:', err);
      listEl.innerHTML = `<div class="notification-empty">${t('notifications_auth_required')}</div>`;
    }
  }

  renderList() {
    const listEl = this.container.querySelector('#notificationsPageList');
    if (!listEl) return;

    if (this.notifications.length === 0) {
      listEl.innerHTML = `<div class="notification-empty">${t('no_notifications_found')}</div>`;
      return;
    }

    listEl.innerHTML = this.notifications.map((item) => this.renderItemHtml(item)).join('');

    // Події кліків та видалення
    listEl.querySelectorAll('.notification-item').forEach((el) => {
      el.addEventListener('click', async (e) => {
        // Якщо натиснули на кнопку видалення
        if (e.target.closest('.btn-delete-notification')) {
          e.stopPropagation();
          const id = el.dataset.id;
          await this.deleteItem(id);
          return;
        }

        const id = el.dataset.id;
        const link = el.dataset.link;
        const isRead = el.dataset.isRead === 'true';

        if (!isRead) {
          await API.post(`/notifications/${id}/read`);
        }

        if (link) {
          window.location.hash = link.startsWith('/') ? link : '/' + link;
        }
      });
    });
  }

  renderItemHtml(item) {
    const isUnread = !item.is_read;
    const timeStr = this.formatTime(item.created_at);
    const avatarAndBadgeHtml = this.getAvatarAndBadgeHtml(item);
    const titleHtml = this.getTitleHtml(item);
    const messageHtml = this.formatMessageHtml(item);

    return `
      <div class="notification-item ${isUnread ? 'unread' : ''}" 
           data-id="${item.id}" 
           data-link="${item.link || ''}" 
           data-is-read="${item.is_read}">
        ${avatarAndBadgeHtml}
        <div class="notification-content">
          <div class="notification-title">${titleHtml}</div>
          <div class="notification-msg">${messageHtml}</div>
          <div class="notification-time">${timeStr}</div>
        </div>
        <button type="button" class="btn-delete-notification" title="${t('delete_notification')}" style="background: transparent; border: none; color: #8e8e93; padding: 4px; cursor: pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }

  getAvatarAndBadgeHtml(item) {
    const payload = item.payload || {};
    let imgUrl = null;

    const actorIdentifier = payload.actor_name || payload.actor_login || payload.actor_username;
    if (actorIdentifier) {
      imgUrl = `/api/auth/avatar/${encodeURIComponent(actorIdentifier)}`;
    } else if (payload.cover_image) {
      imgUrl = normalizeImageUrl(payload.cover_image);
    }

    const badgeHtml = this.getTypeBadgeHtml(item.type);

    if (imgUrl) {
      return `
        <div class="notification-avatar-container">
          <img src="${this.escapeHtml(imgUrl)}" class="notification-avatar-img" alt="" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
          <div class="notification-avatar-placeholder" style="display: none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          ${badgeHtml}
        </div>
      `;
    }

    return `
      <div class="notification-avatar-container">
        <div class="notification-avatar-placeholder">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        ${badgeHtml}
      </div>
    `;
  }

  getTypeBadgeHtml(type) {
    let iconSvg = '';
    if (type === 'new_follower') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="16" x2="22" y1="11" y2="11"/></svg>`;
    } else if (type === 'edit_approved') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
    } else if (type === 'edit_rejected') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    } else if (type === 'new_issue') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`;
    } else if (type === 'level_up') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7"/><path d="M14 14.66V17c0 .55.45 1 1 1h2"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
    }

    return `<div class="notification-type-badge ${type}">${iconSvg}</div>`;
  }

  getTitleHtml(item) {
    if (item.type === 'new_follower') return t('new_follower_title');
    if (item.type === 'edit_approved') return t('edit_approved_title');
    if (item.type === 'edit_rejected') return t('edit_rejected_title');
    if (item.type === 'new_issue') return t('new_issue_title');
    if (item.type === 'level_up') return t('level_up_title');
    return this.escapeHtml(item.title);
  }

  formatMessageHtml(item) {
    const payload = item.payload || {};
    const actorName = payload.actor_name ? this.escapeHtml(payload.actor_name) : '';

    if (item.type === 'level_up') {
      const level = payload.level;
      const title = payload.level_title || (level ? t(`level_title_${level}`) : '');
      if (level && title) {
        return t('level_up_msg', { level, title: `<strong>${this.escapeHtml(title)}</strong>` });
      }
    }
    if (item.type === 'new_follower' && actorName) {
      return t('new_follower_msg', { name: `<strong>${actorName}</strong>` });
    }
    if (item.type === 'edit_approved' && actorName) {
      return t('edit_approved_msg', { name: `<strong>${actorName}</strong>` });
    }
    if (item.type === 'edit_rejected' && actorName) {
      return t('edit_rejected_msg', { name: `<strong>${actorName}</strong>` });
    }

    if (item.type === 'new_issue') {
      const number = payload.issue_number || (item.message ? item.message.match(/#([\w\.\-]+)/)?.[1] : '');
      let title = payload.volume_name;
      if (!title && item.message) {
        const match = item.message.match(/'([^']+)'/);
        if (match) title = match[1];
      }
      if (number) {
        return t('new_issue_msg', { number, title: this.escapeHtml(title || '') });
      }
    }

    let msg = this.escapeHtml(item.message);
    if (actorName && msg.includes(actorName)) {
      msg = msg.replace(actorName, `<strong>${actorName}</strong>`);
    }
    return msg;
  }

  async deleteItem(id) {
    try {
      await API.delete(`/notifications/${id}`);
      this.loadData();
    } catch (err) {
      console.error('Помилка видалення сповіщення:', err);
    }
  }

  renderPagination() {
    const pagEl = this.container.querySelector('#notificationsPagination');
    if (!pagEl) return;

    const totalPages = Math.ceil(this.total / 20);
    if (totalPages <= 1) {
      pagEl.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<button type="button" class="tab-btn ${i === this.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    pagEl.innerHTML = html;
    pagEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.page = parseInt(btn.dataset.page, 10);
        this.loadData();
      });
    });
  }

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('time_just_now');
    if (diffMins < 60) return t('time_mins_ago', { n: diffMins });

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('time_hours_ago', { n: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return t('time_yesterday');

    const currentLang = getCurrentLanguage();
    const localeStr = currentLang === 'en' ? 'en-US' : 'uk-UA';

    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(localeStr, { day: 'numeric', month: 'short' });
    }
    return date.toLocaleDateString(localeStr, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export async function renderNotifications(main) {
  const view = new NotificationsView();
  const el = await view.render();
  main.innerHTML = '';
  main.appendChild(el);
}
