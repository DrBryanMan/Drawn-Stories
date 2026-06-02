import { API } from '../helpers/api.js';

/**
 * Renders the home page into the given container.
 * @param {HTMLElement} main
 */
export async function renderHome(main) {
  let stats = { volumes: 0, issues: 0, characters: 0 };
  try {
    stats = await API.get('/stats');
  } catch { /* fallback to zeros */ }

  main.innerHTML = `
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="container hero-content">
        <div class="hero-label"><span class="hero-dot"></span> Онлайн-енциклопедія</div>
        <h1 class="hero-title">Drawn <span class="accent">Stories</span></h1>
        <p class="hero-sub">
          Найповніша база даних коміксів — серії, випуски, персонажі та видавництва.
          Досліджуйте світ графічних романів.
        </p>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-val">${stats.volumes?.toLocaleString('uk-UA') ?? '—'}</div>
            <div class="hero-stat-lbl">Томів</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-val">${stats.issues?.toLocaleString('uk-UA') ?? '—'}</div>
            <div class="hero-stat-lbl">Випусків</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-val">${stats.characters?.toLocaleString('uk-UA') ?? '—'}</div>
            <div class="hero-stat-lbl">Персонажів</div>
          </div>
        </div>
      </div>
    </section>

    <div class="container">
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
