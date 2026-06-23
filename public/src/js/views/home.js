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

  const { start, end } = getComicWeek();
  const dateRangeStr = `${formatDate(start)} – ${formatDate(end)}`;

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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.volumes || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Серій</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--collections">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.collections || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Збірників</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--issues">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.issues || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Випусків</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--publishers">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.publishers || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Видавництв</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--themes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.themes || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Жанрів та тем</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--authors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l5 2"/><path d="M2 2l2 5"/><path d="M14 14l3-2"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.authors || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Авторів</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--characters">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.characters || 0).toLocaleString('uk-UA')}</div>
              <div class="stat-label">Персонажів</div>
            </div>
          </div>
        </div>
      </section>

      <div class="home-tabs-container" style="display: flex; justify-content: center; margin: 24px 0 32px 0;">
        <div class="catalog-segmented" role="group" aria-label="Тип контенту">
          <button class="catalog-segment is-active" type="button" data-home-tab="comics">Комікси</button>
          <button class="catalog-segment" type="button" data-home-tab="manga">Манґа</button>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            Новинки тижня <span class="section-subtitle" style="font-size: 0.75em; color: var(--text-muted); margin-left: 8px;">(${dateRangeStr})</span>
          </div>
          <a class="section-link" id="weekly-releases-more" href="#/catalog?view_type=issues&sort=date">Дивитись все →</a>
        </div>
        <div class="comic-grid" id="weekly-releases-grid">
          <div class="loader-container"><div class="loader"></div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Нещодавно додані серії
          </div>
          <a class="section-link" id="recent-volumes-more" href="#/catalog">Дивитись все →</a>
        </div>
        <div class="comic-grid" id="recent-volumes-grid">
          <div class="loader-container"><div class="loader"></div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Нещодавно додані випуски
          </div>
          <a class="section-link" id="recent-issues-more" href="#/catalog?view_type=issues&sort=recent">Дивитись все →</a>
        </div>
        <div class="comic-grid" id="recent-issues-grid">
          <div class="loader-container"><div class="loader"></div></div>
        </div>
      </div>
    </div>
  `;

  let activeTab = 'comics';

  const updateTab = (tab) => {
    activeTab = tab;
    
    // Update button active states
    main.querySelectorAll('[data-home-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.homeTab === tab);
    });

    // Update "Дивитись все" links
    const weeklyMore = main.querySelector('#weekly-releases-more');
    if (weeklyMore) weeklyMore.href = `#/catalog?view_type=issues&sort=date&content_type=${tab}`;
    
    const volumesMore = main.querySelector('#recent-volumes-more');
    if (volumesMore) volumesMore.href = `#/catalog?content_type=${tab}`;

    const issuesMore = main.querySelector('#recent-issues-more');
    if (issuesMore) issuesMore.href = `#/catalog?view_type=issues&sort=recent&content_type=${tab}`;

    // Reload content with filters
    loadWeeklyReleases(start, end, tab);
    loadRecentVolumes(tab);
    loadRecentIssues(tab);
  };

  const tabContainer = main.querySelector('.home-tabs-container');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-home-tab]');
      if (btn) {
        const tab = btn.dataset.homeTab;
        if (tab !== activeTab) {
          updateTab(tab);
        }
      }
    });
  }

  // Initial load
  updateTab('comics');
}

async function loadWeeklyReleases(start, end, contentType) {
  const grid = document.getElementById('weekly-releases-grid');
  renderSkeletons(grid, 10);

  const formatDateYMD = (date) => date.toISOString().split('T')[0];

  try {
    const { createComicCard } = await import('../components/ComicCard.js');
    const data = await API.get('/catalog', { 
      page: 1, 
      limit: 10, 
      view_type: 'issues',
      sort: 'date', 
      order_dir: 'desc',
      date_min: formatDateYMD(start),
      date_max: formatDateYMD(end),
      content_type: contentType
    });

    grid.innerHTML = '';
    if (!data.items || data.items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>Поки що нічого</h3></div>';
      return;
    }
    data.items.forEach(item => grid.appendChild(createComicCard(item)));
  } catch (err) {
    console.error('Error loading weekly releases:', err);
    grid.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити</h3></div>';
  }
}

async function loadRecentVolumes(contentType) {
  const grid = document.getElementById('recent-volumes-grid');
  renderSkeletons(grid, 8);

  const today = new Date().toISOString().split('T')[0];

  try {
    const { createComicCard } = await import('../components/ComicCard.js');
    const data = await API.get('/catalog', { 
        page: 1, 
        limit: 8, 
        sort: 'recent', 
        order_dir: 'desc',
        date_max: today,
        content_type: contentType
    });

    grid.innerHTML = '';
    if (!data.items || data.items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>Поки що нічого</h3></div>';
      return;
    }
    data.items.forEach(item => grid.appendChild(createComicCard(item)));
  } catch (err) {
    console.error('Error loading recent volumes:', err);
    grid.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити</h3></div>';
  }
}

async function loadRecentIssues(contentType) {
  const grid = document.getElementById('recent-issues-grid');
  renderSkeletons(grid, 8);

  const today = new Date().toISOString().split('T')[0];

  try {
    const { createComicCard } = await import('../components/ComicCard.js');
    const data = await API.get('/catalog', { 
        page: 1, 
        limit: 8, 
        view_type: 'issues',
        sort: 'recent', 
        order_dir: 'desc',
        date_max: today,
        content_type: contentType
    });

    grid.innerHTML = '';
    if (!data.items || data.items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>Поки що нічого</h3></div>';
      return;
    }
    data.items.forEach(item => grid.appendChild(createComicCard(item)));
  } catch (err) {
    console.error('Error loading recent issues:', err);
    grid.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити</h3></div>';
  }
}

function renderSkeletons(grid, limit = 8) {
  grid.innerHTML = '';
  for (let i = 0; i < limit; i++) {
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
}

function getComicWeek() {
    const today = new Date();
    // 0 is Sunday, 1 is Monday, ..., 3 is Wednesday, ...
    const day = today.getDay();
    // If today is Sun(0), Mon(1), Tue(2), we go to previous Wednesday
    // If today is Wed(3), Thu(4), Fri(5), Sat(6), we go to this Wednesday
    const diffToWednesday = (day >= 3) ? (day - 3) : (day + 4);
    
    const start = new Date(today);
    start.setDate(today.getDate() - diffToWednesday);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    // Safety check: "New Releases" shouldn't include future releases even if the "week" ends in the future
    const realToday = new Date();
    const finalEnd = end > realToday ? realToday : end;

    return { start, end: finalEnd };
}

function formatDate(date) {
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
}
