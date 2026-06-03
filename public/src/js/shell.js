import { router } from './helpers/router.js';

// ── Nav config ───────────────────────────────────────
const NAV = [
  {
    label: 'Каталог',
    icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
           <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>`,
    children: [
      { label: 'Комікси', href: '#/catalog?content_type=comics', route: '/catalog', contentType: 'comics' },
      { label: 'Манга', href: '#/catalog?content_type=manga', route: '/catalog', contentType: 'manga' },
    ]
  },
];

const icon = (d) =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

// ── Shell mount ──────────────────────────────────────
export function initShell() {
  const app = document.getElementById('app');
  document.documentElement.dataset.theme = 'light';
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  app.innerHTML = `
    <header class="site-header">
      <div class="container">
        <a class="header-logo" href="#/">
          <div class="logo-mark">DS</div>
          <div>
            <div class="logo-text">Drawn <span>Stories</span></div>
          </div>
        </a>

        <nav class="header-nav" id="main-nav">
          ${NAV.map(item => `
            <div class="nav-dropdown">
              <a class="nav-link nav-dropdown-trigger" href="#/catalog">
                ${icon(item.icon)}<span>${item.label}</span>
                ${icon('<path d="m6 9 6 6 6-6"/>')}
              </a>
              <div class="nav-dropdown-content">
                ${item.children.map(child => `
                  <a class="nav-dropdown-link" href="${child.href}" data-route="${child.route}" data-content-type="${child.contentType}">
                    ${child.label}
                  </a>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </nav>

        <div class="header-actions">
          <!-- Theme toggle removed as per request -->
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
  const navDropdowns = document.querySelectorAll('.nav-dropdown');
  navDropdowns.forEach(dropdown => {
    let timeout = null;
    const trigger = dropdown.querySelector('.nav-dropdown-trigger');
    const content = dropdown.querySelector('.nav-dropdown-content');

    dropdown.addEventListener('mouseenter', () => {
      clearTimeout(timeout);
      dropdown.classList.add('is-open');
    });

    dropdown.addEventListener('mouseleave', () => {
      timeout = setTimeout(() => {
        dropdown.classList.remove('is-open');
      }, 200);
    });
  });

router.onChange((path, query) => {
  syncActiveNav(path, query);
  window.scrollTo(0, 0);
});
  return document.querySelector('[data-shell-main]');
}

// ── Active nav ───────────────────────────────────────
function syncActiveNav(path, query) {
  const currentContentType = query.content_type || 'comics';
  
  document.querySelectorAll('.nav-dropdown-link').forEach(el => {
    const route = el.dataset.route;
    const contentType = el.dataset.contentType;
    const isActive = path === route && currentContentType === contentType;
    el.classList.toggle('active', isActive);
  });

  // Highlight parent if any child is active
  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    const hasActive = dropdown.querySelector('.nav-dropdown-link.active');
    dropdown.querySelector('.nav-dropdown-trigger').classList.toggle('active', !!hasActive);
  });
}
