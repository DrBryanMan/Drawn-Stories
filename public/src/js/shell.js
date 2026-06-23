import { router } from './helpers/router.js';
import { API } from './helpers/api.js';
import { Bookmarks } from './helpers/bookmarks.js';
import { openGlobalAddModal } from './components/GlobalAddModal.js';

// ── Nav config ───────────────────────────────────────
const NAV = [
  {
    label: 'Каталог',
    icon: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`,
    sections: [
      {
        title: 'Серії',
        links: [
          { 
            label: 'Комікси', 
            desc: 'Західні графічні історії',
            icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
            href: '#/catalog?content_type=comics', route: '/catalog', contentType: 'comics' 
          },
          { 
            label: 'Манґа', 
            desc: 'Східна класика жанру',
            icon: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
            href: '#/catalog?content_type=manga', route: '/catalog', contentType: 'manga' 
          }
        ]
      },
      {
        title: 'Інший контент',
        links: [
          {
            label: 'Видавництва',
            desc: 'Каталог видавців та команд',
            icon: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
            href: '#/publishers',
            route: '/publishers'
          },
          {
            label: 'Події',
            desc: 'Комікс-івенти та кросовери',
            icon: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
            href: '#/events',
            route: '/events'
          },
          {
            label: 'Персонажі',
            desc: 'Герої та лиходії всесвітів',
            icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
            href: '#/characters',
            route: '/characters'
          },
          {
            label: 'Персонал',
            desc: 'Сценаристи, художники та автори',
            icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
            href: '#/personnel',
            route: '/personnel'
          }
        ]
      }
    ]
  }
];

const icon = (d, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_BOOKMARK = '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>';

export let currentUser = null;

const DEFAULT_AVATAR_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

function getAvatarHtml(avatarUrl, className, size = 20) {
    const iconSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    return `
        <img src="${avatarUrl}" alt="Avatar" class="${className}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="${className} avatar-fallback" style="display:none; width:${size}px; height:${size}px;">${iconSvg}</div>
    `;
}

// ── Shell mount ──────────────────────────────────────
export async function initShell() {
  const app = document.getElementById('app');
  document.documentElement.dataset.theme = 'light';
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  app.innerHTML = `
    <header class="site-header">
      <div class="container">
        <a class="header-logo" href="#/">
          <div>
            <div class="logo-text">Drawn <span>Stories</span></div>
          </div>
        </a>

        <nav class="header-nav" id="main-nav">
          ${NAV.map(item => `
            <div class="nav-dropdown">
              <a class="nav-link ${item.sections ? 'nav-dropdown-trigger' : ''}" href="${item.sections ? 'javascript:void(0)' : (item.href || '#/catalog')}" ${!item.sections ? `data-route="${item.route}"` : ''}>
                ${icon(item.icon)}<span>${item.label}</span>
                ${item.sections ? icon('<path d="m6 9 6 6 6-6"/>') : ''}
              </a>
              ${item.sections ? `
              <div class="nav-dropdown-content mega-menu">
                ${item.sections.map(section => `
                  <div class="mega-menu-section">
                    <div class="nav-dropdown-header">${section.title}</div>
                    <div class="mega-menu-grid">
                      ${section.links.map(link => `
                        <a class="nav-dropdown-link" href="${link.href}" data-route="${link.route}" ${link.contentType ? `data-content-type="${link.contentType}"` : ''}>
                          ${link.icon ? icon(link.icon, 20) : ''}
                          <div class="nav-dropdown-text">
                            <div class="nav-dropdown-label">${link.label}</div>
                            ${link.desc ? `<div class="nav-dropdown-desc">${link.desc}</div>` : ''}
                          </div>
                        </a>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
              ` : ''}
            </div>
          `).join('')}
        </nav>

        <div class="header-actions" id="header-actions">
          <a href="#/bookmarks" class="bookmarks-trigger" id="bookmarks-btn" title="Закладки">
            ${icon(ICON_BOOKMARK)}
            <span class="bookmarks-count" id="bookmarks-count">0</span>
          </a>
          <a href="#/auth" class="auth-trigger" id="auth-btn">
            ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
            <span>Увійти</span>
          </a>
        </div>
      </div>
    </header>

    <main data-shell-main></main>

    <footer class="site-footer">
      <div class="container">
        Drawn Stories · Енциклопедія коміксів
      </div>
    </footer>
  `;

  // ── Active nav ───────────────────────────────────────
  document.querySelectorAll('.nav-dropdown').forEach(bindDropdown);

  router.onChange((path, query) => {
    syncActiveNav(path, query);
    window.scrollTo(0, 0);
    if (!currentUser) updateAuthUI();
  });

  // ── Auth ───────────────────────────────────────────
  window.addEventListener('auth-changed', (e) => {
    currentUser = e.detail;
    updateAuthUI();
  });

  // ── Bookmarks ──────────────────────────────────────
  window.addEventListener('bookmarks-changed', (e) => {
    updateBookmarksCount(e.detail.length);
  });

  await checkAuth();
  updateBookmarksCount(Bookmarks.count());

  return document.querySelector('[data-shell-main]');
}

async function checkAuth() {
  try {
    const data = await API.get('/auth/me');
    if (data.logged_in) {
      currentUser = data;
    } else {
      currentUser = null;
    }
  } catch (err) {
    currentUser = null;
  }
  updateAuthUI();
}

function updateBookmarksCount(count) {
  const el = document.getElementById('bookmarks-count');
  if (el) {
    el.textContent = count;
    el.classList.toggle('is-visible', count > 0);
  }
}

function updateAuthUI() {
  const container = document.getElementById('header-actions');
  if (!container) return;

  const currentHash = window.location.hash || '#/';
  const authHref = currentHash !== '#/auth' 
    ? `#/auth?returnUrl=${encodeURIComponent(currentHash)}` 
    : '#/auth';

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
  const addBtnHTML = isAdmin ? `
    <button class="bookmarks-trigger" id="global-add-btn" title="Додати контент">
      ${icon('<path d="M12 5v14M5 12h14"/>', 20)}
    </button>
  ` : '';

  const bookmarksHTML = `
    ${addBtnHTML}
    <a href="#/bookmarks" class="bookmarks-trigger" id="bookmarks-btn" title="Закладки">
      ${icon(ICON_BOOKMARK)}
      <span class="bookmarks-count ${Bookmarks.count() > 0 ? 'is-visible' : ''}" id="bookmarks-count">${Bookmarks.count()}</span>
    </a>
  `;

  if (currentUser) {
    const avatarUrl = `/api/auth/avatar/${currentUser.username}?t=${new Date().getTime()}`;
    container.innerHTML = `
      ${bookmarksHTML}
      <div class="nav-dropdown">
        <button class="nav-link nav-dropdown-trigger auth-user-btn">
          ${getAvatarHtml(avatarUrl, 'header-avatar', 38)}
        </button>
        <div class="nav-dropdown-content dropdown-right">
          <div class="dropdown-info">
            ${getAvatarHtml(avatarUrl, 'header-avatar', 40)}
            <div class="user-details">
                <div class="user-name">${currentUser.username}</div>
                <div class="user-role">${currentUser.role === 'admin' ? 'Адміністратор' : currentUser.role === 'moderator' ? 'Модератор' : 'Користувач'}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          
          <!-- Основні списки -->
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}/lists" data-route="/user/${currentUser.username}/lists">
            ${icon('<path d="M8 6h10"/><path d="M8 12h10"/><path d="M8 18h7"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>')}
            <span>Мої списки</span>
          </a>
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}/collection" data-route="/user/${currentUser.username}/collection">
            ${icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>')}
            <span>Моя колекція</span>
          </a>
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}/favorites" data-route="/user/${currentUser.username}/favorites">
            ${icon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>')}
            <span>Обране</span>
          </a>
          
          <div class="dropdown-divider"></div>
          
          <!-- Інше -->
          <a class="nav-dropdown-link" href="#/settings">
            ${icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>')}
            <span>Налаштування</span>
          </a>
          
          <div class="dropdown-divider"></div>
          
          <!-- Логаут -->
          <button class="nav-dropdown-link logout-btn" id="logout-btn">
            ${icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}
            <span>Вийти</span>
          </button>
        </div>
      </div>
    `;


    const addBtn = container.querySelector('#global-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => openGlobalAddModal());
    }

    container.querySelector('#logout-btn').addEventListener('click', async () => {
      await API.post('/auth/logout');
      currentUser = null;
      updateAuthUI();
      router.resolve();
    });

    bindDropdown(container.querySelector('.nav-dropdown'));
  } else {
    container.innerHTML = `
      ${bookmarksHTML}
      <a href="${authHref}" class="auth-trigger" id="auth-btn">
        ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
        <span>Увійти</span>
      </a>
    `;
  }
}

function bindDropdown(dropdown) {
  let timeout = null;
  dropdown.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
    dropdown.classList.add('is-open');
  });

  dropdown.addEventListener('mouseleave', () => {
    timeout = setTimeout(() => {
      dropdown.classList.remove('is-open');
    }, 200);
  });
}

// ── Active nav ───────────────────────────────────────
function syncActiveNav(path, query) {
  const currentContentType = query.content_type || '';
  
  // Highlight both dropdown links AND top-level links (like Publishers)
  document.querySelectorAll('.nav-link, .nav-dropdown-link').forEach(el => {
    // Skip the user dropdown trigger
    if (el.classList.contains('auth-user-btn')) return;

    const route = el.dataset.route || el.getAttribute('href')?.replace('#', '');
    if (!route) return;

    const contentType = el.dataset.contentType;
    let isActive = false;
    
    if (contentType) {
      isActive = path === route && currentContentType === contentType;
    } else {
      isActive = path === route;
    }
    
    el.classList.toggle('active', isActive);
  });

  // Highlight parent trigger if a child is active
  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;
    const hasActiveChild = dropdown.querySelector('.nav-dropdown-link.active');
    trigger.classList.toggle('active', !!hasActiveChild);
  });
}