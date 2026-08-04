import { router } from './helpers/router.js';
import { API } from './helpers/api.js';
import { Bookmarks } from './helpers/bookmarks.js';
import { openGlobalAddModal } from './components/GlobalAddModal.js';
import { t, setLanguage, getCurrentLanguage } from './helpers/i18n.js';

// ── Nav config ───────────────────────────────────────
// ── Nav config ───────────────────────────────────────
const getNav = () => [
  {
    label: t('catalog'),
    icon: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`,
    sections: [
      {
        title: t('series'),
        links: [
          { 
            label: t('comics'), 
            desc: t('comics_desc'),
            icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
            href: '#/catalog?content_type=comics', route: '/catalog', contentType: 'comics' 
          },
          { 
            label: t('manga'), 
            desc: t('manga_desc'),
            icon: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
            href: '#/catalog?content_type=manga', route: '/catalog', contentType: 'manga' 
          }
        ]
      },
      {
        title: t('other_content'),
        links: [
          {
            label: t('publishers'),
            desc: t('publishers_desc'),
            icon: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
            href: '#/publishers',
            route: '/publishers'
          },
          {
            label: t('events'),
            desc: t('events_desc'),
            icon: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
            href: '#/events',
            route: '/events'
          },
          {
            label: t('characters'),
            desc: t('characters_desc'),
            icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
            href: '#/characters',
            route: '/characters'
          },
          {
            label: 'Сутності',
            desc: 'Базові особистості та альтернативні версії',
            icon: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/>',
            href: '#/essences',
            route: '/essences'
          },
          {
            label: t('personnel'),
            desc: t('personnel_desc'),
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

export function getAvatarHtml(avatarUrl, className, size = 20) {
    const iconSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    return `
        <img src="${avatarUrl}" alt="Avatar" class="${className}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width:${size}px; height:${size}px;">
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
          <img src="/logo.png" alt="Drawn Stories" class="logo-img">
          <div class="logo-text">Drawn<br><span>Stories</span></div>
        </a>

        <nav class="header-nav" id="main-nav">
          ${getNav().map(item => `
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
                      ${section.links.map(link => {
                        const isManga = link.contentType === 'manga';
                        const linkHtml = `
                          <a class="nav-dropdown-link" href="${link.href}" data-route="${link.route}" ${link.contentType ? `data-content-type="${link.contentType}"` : ''}>
                            ${link.icon ? icon(link.icon, 20) : ''}
                            <div class="nav-dropdown-text">
                              <div class="nav-dropdown-label">${link.label}</div>
                              ${link.desc ? `<div class="nav-dropdown-desc">${link.desc}</div>` : ''}
                            </div>
                          </a>
                        `;
                        if (isManga) {
                          return `
                            <div class="nav-dropdown-link-container">
                              ${linkHtml}
                              <div class="manga-menu-buttons">
                                <a href="#/catalog?content_type=manga" class="manga-menu-btn" data-route="/catalog" data-content-type="manga">${t('series')}</a>
                                <a href="#/manga-magazines" class="manga-menu-btn" data-route="/manga-magazines">${t('manga_magazines')}</a>
                                <a href="#/manga-chapters" class="manga-menu-btn" data-route="/manga-chapters">${t('manga_chapters')}</a>
                              </div>
                            </div>
                          `;
                        }
                        return linkHtml;
                      }).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
              ` : ''}
            </div>
          `).join('')}
        </nav>

        <div class="header-actions" id="header-actions">
          <a href="#/bookmarks" class="bookmarks-trigger" id="bookmarks-btn" title="${t('bookmarks')}">
            ${icon(ICON_BOOKMARK)}
            <span class="bookmarks-count" id="bookmarks-count">0</span>
          </a>
          <a href="#/auth" class="auth-trigger" id="auth-btn">
            ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
            <span>${t('login')}</span>
          </a>
        </div>
      </div>
    </header>

    <main data-shell-main></main>

    <footer class="site-footer">
      <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
        <div>Drawn Stories · ${t('encyclopedia')}</div>
        <div class="footer-lang-switcher">
          <select id="footer-lang-select" class="footer-lang-select" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-s); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
            <option value="uk" ${getCurrentLanguage() === 'uk' ? 'selected' : ''}>UA</option>
            <option value="en" ${getCurrentLanguage() === 'en' ? 'selected' : ''}>EN</option>
          </select>
        </div>
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

  const langSelect = document.getElementById('footer-lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      if (currentUser) {
        try {
          await API.post('/auth/preferences', { site_lang: newLang });
        } catch (err) {
          console.error('Failed to save language preferences in DB:', err);
        }
      }
      setLanguage(newLang);
    });
  }

  await checkAuth();
  updateBookmarksCount(Bookmarks.count());

  return document.querySelector('[data-shell-main]');
}

async function checkAuth() {
  try {
    const data = await API.get('/auth/me');
    if (data.logged_in) {
      currentUser = data;
      if (data.site_lang && data.site_lang !== getCurrentLanguage()) {
        localStorage.setItem('site_lang', data.site_lang);
        window.location.reload();
      }
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

export async function updateEditsPendingCount() {
  const badge = document.getElementById('edits-pending-count');
  if (!badge) return;

  try {
    const edits = await API.get('/edits?status=pending');
    const count = edits.length;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.add('is-visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('is-visible');
    }
  } catch (err) {
    console.error('Помилка оновлення лічильника правок:', err);
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
    <a href="/wanted" class="bookmarks-trigger" id="wanted-btn" title="Wanted Content" style="display: inline-flex; align-items: center; justify-content: center; margin-right: 2px;">
      ${icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', 20)}
    </a>
    <button class="bookmarks-trigger" id="global-add-btn" title="${t('add_content')}">
      ${icon('<path d="M12 5v14M5 12h14"/>', 20)}
    </button>
  ` : '';

  const bookmarksGuestHTML = `
    <a href="#/bookmarks" class="bookmarks-trigger" id="bookmarks-btn" title="${t('bookmarks')}">
      ${icon(ICON_BOOKMARK)}
      <span class="bookmarks-count ${Bookmarks.count() > 0 ? 'is-visible' : ''}" id="bookmarks-count">${Bookmarks.count()}</span>
    </a>
  `;

  const headerControlsHTML = `
    ${addBtnHTML}
    <a href="#/edits" class="bookmarks-trigger" id="edits-list-btn" title="${t('edit_list')}" style="display: inline-flex; align-items: center; justify-content: center; margin-right: 2px; position: relative;">
      ${icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 20)}
      <span class="bookmarks-count edits-pending-badge" id="edits-pending-count"></span>
    </a>
  `;

  if (currentUser) {
    const avatarUrl = `/api/auth/avatar/${currentUser.username}?t=${new Date().getTime()}`;
    const score = currentUser.score || 0;
    const prog = getLevelProgress(score);

    container.innerHTML = `
      ${headerControlsHTML}
      <div class="nav-dropdown">
        <button class="nav-link nav-dropdown-trigger auth-user-btn">
          ${getAvatarHtml(avatarUrl, 'header-avatar', 38)}
        </button>
        <div class="nav-dropdown-content dropdown-right">
          <a class="dropdown-info dropdown-user-card" href="#/user/${currentUser.username}" data-route="/user/${currentUser.username}" data-tab="overview">
            ${getAvatarHtml(avatarUrl, 'header-avatar', 40)}
            <div class="user-details" style="flex: 1; min-width: 0;">
                <div class="user-name">${currentUser.nickname || currentUser.username}</div>
                <div class="user-level-info">Рівень ${prog.levelNum}: ${prog.title}</div>
                <div class="user-score-info">Бали: ${score}${prog.nextThreshold ? ` / ${prog.nextThreshold}` : ''}</div>
                ${prog.nextThreshold ? `
                    <div class="user-level-progress-bar-wrap" title="До наступного рівня: ${prog.remaining} б.">
                        <div class="user-level-progress-bar" style="width: ${prog.percent}%;"></div>
                    </div>
                ` : '<div class="user-level-max">Максимальний рівень!</div>'}
            </div>
            <div class="dropdown-user-chevron">
              ${icon('<polyline points="9 18 15 12 9 6"/>', 16)}
            </div>
          </a>
          <div class="dropdown-divider"></div>
          
          <!-- Основні списки -->
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}?tab=readlists" data-route="/user/${currentUser.username}" data-tab="readlists">
            ${icon('<path d="M8 6h10"/><path d="M8 12h10"/><path d="M8 18h7"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>')}
            <span>${t('my_lists')}</span>
          </a>
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}?tab=collections" data-route="/user/${currentUser.username}" data-tab="collections">
            ${icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>')}
            <span>${t('my_collection')}</span>
          </a>
          <a class="nav-dropdown-link" href="#/user/${currentUser.username}?tab=favorites" data-route="/user/${currentUser.username}" data-tab="favorites">
            ${icon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>')}
            <span>${t('favorites')}</span>
          </a>
          <a class="nav-dropdown-link" href="#/bookmarks" id="bookmarks-dropdown-link" data-route="/bookmarks">
            ${icon(ICON_BOOKMARK)}
            <span>${t('bookmarks')}</span>
          </a>
          
          <div class="dropdown-divider"></div>
          
          <!-- Інше -->
          <a class="nav-dropdown-link" href="#/settings">
            ${icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>')}
            <span>${t('settings')}</span>
          </a>
          
          <div class="dropdown-divider"></div>
          
          <!-- Логаут -->
          <button class="nav-dropdown-link logout-btn" id="logout-btn">
            ${icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}
            <span>${t('logout')}</span>
          </button>
        </div>
      </div>
    `;


    const addBtn = container.querySelector('#global-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => openGlobalAddModal());
    }

    const logoutBtn = container.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await API.post('/auth/logout');
          currentUser = null;
          updateAuthUI();
          router.navigate('/');
        } catch (err) {
          console.error('Помилка виходу:', err);
        }
      });
    }

    bindDropdown(container.querySelector('.nav-dropdown'));
    if (isAdmin) {
      updateEditsPendingCount();
    }
  } else {
    container.innerHTML = `
      ${bookmarksGuestHTML}
      <a href="${authHref}" class="auth-trigger" id="auth-btn">
        ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
        <span>${t('login')}</span>
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
  const currentTab = query.tab || (path.startsWith('/user/') ? 'overview' : '');
  
  // Highlight both dropdown links AND top-level links
  document.querySelectorAll('.nav-link, .nav-dropdown-link, .manga-menu-btn, .dropdown-user-card').forEach(el => {
    // Skip the user dropdown trigger
    if (el.classList.contains('auth-user-btn')) return;

    const rawHref = el.getAttribute('href') || '';
    const route = el.dataset.route || rawHref.replace('#', '').split('?')[0];
    if (!route) return;

    const contentType = el.dataset.contentType;
    const elTab = el.dataset.tab;
    let isActive = false;
    
    if (elTab) {
      isActive = path === route && currentTab === elTab;
    } else if (contentType) {
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

function getLevelProgress(score) {
  const LEVELS = [
    { threshold: 0, title: "Новачок" },
    { threshold: 50, title: "Учень" },
    { threshold: 150, title: "Редактор" },
    { threshold: 350, title: "Досвідчений" },
    { threshold: 700, title: "Провідний" },
    { threshold: 1200, title: "Експерт" },
    { threshold: 2000, title: "Майстер" },
    { threshold: 3500, title: "Гросмейстер" }
  ];

  let currentIdx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (score >= LEVELS[i].threshold) {
      currentIdx = i;
    } else {
      break;
    }
  }

  const currentLevel = LEVELS[currentIdx];
  const nextLevel = LEVELS[currentIdx + 1];

  if (!nextLevel) {
    return {
      levelNum: currentIdx + 1,
      title: currentLevel.title,
      score: score,
      nextThreshold: null,
      remaining: 0,
      percent: 100
    };
  }

  const currentMin = currentLevel.threshold;
  const nextMin = nextLevel.threshold;
  const totalForLevel = nextMin - currentMin;
  const earnedInLevel = score - currentMin;
  const percent = Math.min(100, Math.max(0, Math.round((earnedInLevel / totalForLevel) * 100)));
  const remaining = nextMin - score;

  return {
    levelNum: currentIdx + 1,
    title: currentLevel.title,
    score: score,
    nextThreshold: nextMin,
    remaining: remaining,
    percent: percent
  };
}