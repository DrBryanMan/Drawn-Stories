import { router } from './helpers/router.js';

// ── Nav config ───────────────────────────────────────
const NAV = [
  {
    route: '/',
    href: '#/',
    label: 'Головна',
    icon: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  },
  {
    route: '/catalog',
    href: '#/catalog',
    label: 'Каталог',
    icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
           <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>`,
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
          ${NAV.map(({ route, href, label, icon: d }) =>
    `<a class="nav-link" data-route="${route}" href="${href}">
              ${icon(d)}<span>${label}</span>
            </a>`
  ).join('')}
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

router.onChange((path) => {
  syncActiveNav(path);
  window.scrollTo(0, 0);
});
  return document.querySelector('[data-shell-main]');
}

// ── Active nav ───────────────────────────────────────
function syncActiveNav(path) {
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    const r = el.dataset.route;
    const active = r === '/' ? path === '/' : path.startsWith(r);
    el.classList.toggle('active', active);
  });
}
