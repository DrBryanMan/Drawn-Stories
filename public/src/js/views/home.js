import { API } from '../helpers/api.js';

/**
 * Renders the home page into the given container.
 * @param {HTMLElement} main
 */
export async function renderHome(main) {
  let stats = { volumes: 0, collections: 0, issues: 0, publishers: 0, themes: 0, characters: 0, authors: 0 };
  try {
    stats = await API.get('/stats');
  } catch { /* fallback to zeros */ }

  main.innerHTML = `
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="container hero-content">
        <h1 class="hero-title">Drawn <span class="accent">Stories</span></h1>
        <p class="hero-sub">
          Найповніша база даних коміксів — серії, випуски, персонажі та видавництва.
          Досліджуйте світ графічних романів.
        </p>
      </div>
    </section>

    <div class="container">
      <section class="stats-section">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon--volumes">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.volumes || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Серій</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--collections">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.collections || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Збірників</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--issues">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.issues || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Випусків</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--publishers">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.publishers || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Видавництв</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--themes">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.themes || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Жанрів та тем</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--authors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l5 2"/><path d="M2 2l2 5"/><path d="M14 14l3-2"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.authors || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Авторів</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--characters">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.characters || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Персонажів</div>
            </div>
          </div>
        </div>
      </section>

      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Нещодавно додані
          </div>
          <a class="section-link" href="#/catalog">Дивитись все →</a>
        </div>
        <div class="comic-grid" id="recent-grid">
          <div class="loader-container"><div class="loader"></div></div>
        </div>
      </div>
    </div>
  `;

  loadRecentVolumes();
}

async function loadRecentVolumes() {
  const grid = document.getElementById('recent-grid');
  const renderSkeletons = () => {
    grid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const skel = document.createElement('div');
      skel.className = 'comic-card skeleton-card';
      skel.innerHTML = `
        <div class="skeleton" style="width: 100%; aspect-ratio: 2/3;"></div>
        <div class="comic-body">
          <div class="skeleton skeleton-text" style="width: 85%; height: 16px; margin-bottom: 8px;"></div>
          <div class="skeleton skeleton-text" style="width: 45%; height: 12px; margin-bottom: 6px;"></div>
          <div class="skeleton skeleton-text" style="width: 30%; height: 10px;"></div>
        </div>
      `;
      grid.appendChild(skel);
    }
  };

  renderSkeletons();

  try {
    const { createComicCard } = await import('../components/ComicCard.js');
    const data = await API.get('/catalog', { page: 1, limit: 10, sort: 'recent', order_dir: 'desc' });

    grid.innerHTML = '';
    if (data.items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>Поки що нічого</h3><p>Дані завантажуються...</p></div>';
      return;
    }
    data.items.forEach(item => grid.appendChild(createComicCard(item)));
  } catch {
    grid.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити</h3></div>';
  }
}
