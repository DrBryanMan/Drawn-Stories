import { t } from '../helpers/i18n.js';

const ICONS = {
  level_up: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7"/><path d="M14 14.66V17c0 .55.45 1 1 1h2"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.counter = 0;
  }

  ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      let existing = document.getElementById('toast-container');
      if (existing) {
        this.container = existing;
      } else {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Сповіщення');
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(options = {}) {
    const {
      type = 'default',
      title = '',
      message = '',
      icon = null,
      badge = null,
      duration = type === 'level_up' ? 8000 : 5000,
      link = null,
      onClick = null,
      onClose = null,
      closeable = true
    } = typeof options === 'string' ? { message: options } : options;

    const id = `toast-${++this.counter}`;
    const container = this.ensureContainer();

    const toastEl = document.createElement('div');
    toastEl.id = id;
    toastEl.className = `toast-item ${type} ${link || onClick ? 'is-clickable' : ''}`;
    toastEl.setAttribute('role', 'alert');

    const iconHtml = icon || ICONS[type] || ICONS.info;

    let badgeHtml = '';
    if (badge) {
      badgeHtml = `<span class="toast-level-badge">${this.escapeHtml(badge)}</span>`;
    }

    toastEl.innerHTML = `
      <div class="toast-icon-wrap">${iconHtml}</div>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${title}${badgeHtml}</div>` : ''}
        <div class="toast-msg">${message}</div>
      </div>
      ${closeable ? `<button type="button" class="toast-close-btn" aria-label="Закрити">${ICONS.close}</button>` : ''}
      ${duration > 0 ? `<div class="toast-progress-bar"></div>` : ''}
    `;

    container.appendChild(toastEl);

    // Timer & Progress management
    let remainingTime = duration;
    let startTime = Date.now();
    let timerId = null;
    let progressEl = toastEl.querySelector('.toast-progress-bar');

    const startProgressAnimation = (time) => {
      if (!progressEl) return;
      progressEl.style.transition = 'none';
      progressEl.style.transform = 'scaleX(1)';
      // Trigger reflow
      void progressEl.offsetHeight;
      progressEl.style.transition = `transform ${time}ms linear`;
      progressEl.style.transform = 'scaleX(0)';
    };

    const pauseTimer = () => {
      if (duration <= 0) return;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      remainingTime -= Date.now() - startTime;
      if (progressEl) {
        const computedWidth = window.getComputedStyle(progressEl).transform;
        progressEl.style.transition = 'none';
        progressEl.style.transform = computedWidth;
      }
    };

    const resumeTimer = () => {
      if (duration <= 0 || remainingTime <= 0) return;
      startTime = Date.now();
      startProgressAnimation(remainingTime);
      timerId = setTimeout(() => {
        this.dismiss(id);
      }, remainingTime);
    };

    if (duration > 0) {
      resumeTimer();
      toastEl.addEventListener('mouseenter', pauseTimer);
      toastEl.addEventListener('mouseleave', resumeTimer);
    }

    // Close button
    if (closeable) {
      const closeBtn = toastEl.querySelector('.toast-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dismiss(id);
        });
      }
    }

    // Click handler / Link navigation
    toastEl.addEventListener('click', (e) => {
      if (e.target.closest('.toast-close-btn')) return;

      if (typeof onClick === 'function') {
        onClick({ id, type, title, message, link });
      }

      if (link) {
        const targetHash = link.startsWith('/') ? link : '/' + link;
        if (window.location.hash !== `#${targetHash}`) {
          window.location.hash = targetHash;
        }
      }

      if (link || onClick) {
        this.dismiss(id);
      }
    });

    const toastRecord = {
      id,
      element: toastEl,
      onClose,
      timerId,
      clearTimer: () => {
        if (timerId) clearTimeout(timerId);
      }
    };

    this.toasts.set(id, toastRecord);

    return {
      id,
      element: toastEl,
      dismiss: () => this.dismiss(id)
    };
  }

  dismiss(id) {
    const record = this.toasts.get(id);
    if (!record || !record.element) return;

    record.clearTimer();
    const el = record.element;
    el.classList.add('is-hiding');

    el.addEventListener('animationend', () => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      if (typeof record.onClose === 'function') {
        record.onClose(id);
      }
      this.toasts.delete(id);
    }, { once: true });

    // Fallback cleanup if animationend fails
    setTimeout(() => {
      if (this.toasts.has(id)) {
        if (el.parentNode) el.parentNode.removeChild(el);
        this.toasts.delete(id);
      }
    }, 400);
  }

  dismissAll() {
    for (const id of Array.from(this.toasts.keys())) {
      this.dismiss(id);
    }
  }

  levelUp(data = {}) {
    const level = data.level || 1;
    const levelTitle = data.levelTitle || data.title || t(`level_title_${level}`) || 'Герой';
    const score = data.score;
    const userDisplay = data.nickname || data.username;

    const titleText = data.heading || t('level_up_title');
    const badgeText = t('level_up_toast_badge', { level });
    const msgText = data.message || t('level_up_msg', { 
      level, 
      title: `<strong>${this.escapeHtml(levelTitle)}</strong>` 
    });

    const link = data.link || (userDisplay ? `/user/${encodeURIComponent(userDisplay)}` : null);

    return this.show({
      type: 'level_up',
      title: titleText,
      badge: badgeText,
      message: msgText,
      duration: data.duration || 9000,
      link: link,
      onClick: data.onClick,
      onClose: data.onClose
    });
  }

  success(message, title = '', options = {}) {
    return this.show({
      ...options,
      type: 'success',
      title: title || t('success') || 'Успіх',
      message
    });
  }

  error(message, title = '', options = {}) {
    return this.show({
      ...options,
      type: 'error',
      title: title || t('error') || 'Помилка',
      message,
      duration: options.duration || 7000
    });
  }

  info(message, title = '', options = {}) {
    return this.show({
      ...options,
      type: 'info',
      title: title,
      message
    });
  }

  warning(message, title = '', options = {}) {
    return this.show({
      ...options,
      type: 'warning',
      title: title || t('warning') || 'Увага',
      message,
      duration: options.duration || 6000
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const Toast = new ToastManager();

if (typeof window !== 'undefined') {
  window.Toast = Toast;
}
