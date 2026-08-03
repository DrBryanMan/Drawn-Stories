import { API } from '../helpers/api.js';
import { t, getCurrentLanguage } from '../helpers/i18n.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

/**
 * Renders the home page into the given container.
 * @param {HTMLElement} main
 */
export async function renderHome(main) {
  let stats = { volumes: 0, collections: 0, issues: 0, publishers: 0, themes: 0, characters: 0, authors: 0 };
  let popularData = { publishers: [], manga: [], magazines: [], manga_ongoing: [] };
  try {
    stats = await API.get('/stats');
  } catch { /* fallback to zeros */ }

  try {
    popularData = await API.get('/stats/popular');
  } catch (err) {
    console.error('Failed to load popular data:', err);
  }

  const { start, end } = getComicWeek();
  const dateRangeStr = `${formatDate(start)} – ${formatDate(end)}`;
  const numLocale = getCurrentLanguage() === 'uk' ? 'uk-UA' : 'en-US';

  main.innerHTML = `
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="container hero-content">
        <div class="hero-left">
          <h1 class="hero-title" id="home-hero-title">Слідкуй за новими <span class="accent">випусками коміксів</span></h1>
          <p class="hero-sub" id="home-hero-sub">
            ${t('home_hero_sub')}
          </p>
          <div class="hero-popular" id="home-hero-popular"></div>
        </div>
        <div class="hero-right">
          <div class="home-tabs-container">
            <div class="catalog-segmented--vertical" role="group" aria-label="Тип контенту">
              <button class="catalog-segment is-active" type="button" data-home-tab="comics">${t('comics')}</button>
              <button class="catalog-segment" type="button" data-home-tab="manga">${t('manga')}</button>
              <button class="catalog-segment" type="button" data-home-tab="magazines">${t('manga_magazines')}</button>
              <button class="catalog-segment" type="button" data-home-tab="translated">Українською</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="container">
      <div class="home-main-layout" id="home-main-layout">
        <div class="home-left-col">
          <div class="section" id="weekly-releases-section">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                ${t('home_weekly_releases')} <span class="section-subtitle" style="font-size: 0.75em; color: var(--text-muted); margin-left: 8px;">(${dateRangeStr})</span>
              </div>
              <a class="section-link" id="weekly-releases-more" href="#/catalog?view_type=issues&sort=date">${t('home_view_all')}</a>
            </div>
            <div class="comic-grid" id="weekly-releases-grid">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
          </div>

          <div class="section" id="recent-volumes-section">
            <div class="section-header">
              <div class="section-title" id="recent-volumes-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                ${t('home_recent_volumes')}
              </div>
              <a class="section-link" id="recent-volumes-more" href="#/catalog">${t('home_view_all')}</a>
            </div>
            <div class="comic-grid" id="recent-volumes-grid">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
            <div id="weekly-chapters-block" style="display: none;">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
          </div>

          <div class="section" id="recent-issues-section">
            <div class="section-header">
              <div class="section-title" id="recent-issues-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${t('home_recent_issues')}
              </div>
              <a class="section-link" id="recent-issues-more" href="#/catalog?view_type=issues&sort=recent">${t('home_view_all')}</a>
            </div>
            <div class="comic-grid" id="recent-issues-grid">
              <div class="loader-container"><div class="loader"></div></div>
            </div>
          </div>

          <div id="ukrainian-releases-block" style="display: none;">
            <div class="section" id="uk-announcements-section">
              <div class="section-header">
                <div class="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
                  Анонси
                </div>
                <a class="section-link" href="#/catalog?lang=uk&release_status=announced">Дивитись все →</a>
              </div>
              <div class="comic-grid" id="uk-announcements-grid">
                <div class="loader-container"><div class="loader"></div></div>
              </div>
            </div>

            <div class="section" id="uk-new-releases-section">
              <div class="section-header">
                <div class="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Нові релізи
                </div>
                <a class="section-link" href="#/catalog?lang=uk&sort=date">Дивитись все →</a>
              </div>
              <div class="comic-grid" id="uk-new-releases-grid">
                <div class="loader-container"><div class="loader"></div></div>
              </div>
            </div>

            <div class="section" id="uk-recent-series-section">
              <div class="section-header">
                <div class="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Останні додані серії
                </div>
                <a class="section-link" href="#/catalog?lang=uk&sort=recent">Дивитись все →</a>
              </div>
              <div class="comic-grid" id="uk-recent-series-grid">
                <div class="loader-container"><div class="loader"></div></div>
              </div>
            </div>

            <div class="section" id="uk-recent-collections-section">
              <div class="section-header">
                <div class="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z"/></svg>
                  Останні додані збірники
                </div>
                <a class="section-link" href="#/catalog?lang=uk&view_type=collections&sort=recent">Дивитись все →</a>
              </div>
              <div class="comic-grid" id="uk-recent-collections-grid">
                <div class="loader-container"><div class="loader"></div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="home-right-col" id="home-right-sidebar" style="display: none;">
          <!-- Сайдбар журналів рендериться динамічно -->
        </div>
      </div>


      
      <section class="stats-section">
        <div class="section-header">
          <div class="section-title">
            Статистика
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon--volumes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.volumes || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_volumes')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--collections">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.collections || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_collections')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--issues">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.issues || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_issues')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--publishers">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="12" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.publishers || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_publishers')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--themes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.themes || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_themes')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--authors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l5 2"/><path d="M2 2l2 5"/><path d="M14 14l3-2"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.authors || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_authors')}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--characters">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">${(stats.characters || 0).toLocaleString(numLocale)}</div>
              <div class="stat-label">${t('home_stats_characters')}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  let activeTab = 'comics';

  const renderPopularWidget = (tab) => {
    const popularContainer = main.querySelector('#home-hero-popular');
    if (!popularContainer) return;

    if (tab === 'comics') {
      const items = popularData.publishers || [];
      if (items.length === 0) {
        popularContainer.innerHTML = '';
        return;
      }
      popularContainer.innerHTML = `
        <div class="popular-title">Топ видавництв:</div>
        <div class="popular-list">
          ${items.map(p => {
            const img = normalizeImageUrl(p.image);
            return `
              <a href="#/catalog?publisher_ids=${p.id}" class="popular-item">
                ${img ? `<img class="popular-item-img" src="${img}" alt="${escapeHtmlAttribute(p.name)}">` : `<span class="popular-icon" style="color: var(--accent);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/></svg></span>`}
                <span class="popular-item-name">${escapeHtmlAttribute(p.name)}</span>
                <span class="popular-item-badge">${p.volume_count} томів</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'manga') {
      const items = popularData.manga || [];
      if (items.length === 0) {
        popularContainer.innerHTML = '';
        return;
      }
      popularContainer.innerHTML = `
        <div class="popular-title">Топ манґа-серій (MAL):</div>
        <div class="popular-list">
          ${items.map(m => {
            const img = normalizeImageUrl(m.image);
            const title = m.name_uk || m.name;
            return `
              <a href="#/volumes/${m.id}" class="popular-item">
                ${img ? `<img class="popular-item-img" src="${img}" alt="${escapeHtmlAttribute(title)}">` : `<span class="popular-icon" style="color: var(--accent);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>`}
                <span class="popular-item-name">${escapeHtmlAttribute(title)}</span>
                <span class="popular-item-badge"><svg class="popular-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>${m.mal_score != null ? Number(m.mal_score).toFixed(2) : '—'}</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'magazines') {
      const items = popularData.manga_ongoing || [];
      if (items.length === 0) {
        popularContainer.innerHTML = '';
        return;
      }
      popularContainer.innerHTML = `
        <div class="popular-title">Популярні онґоїнґи (MAL):</div>
        <div class="popular-list">
          ${items.map(m => {
            const img = normalizeImageUrl(m.image);
            const title = m.name_uk || m.name;
            return `
              <a href="#/volumes/${m.id}" class="popular-item">
                ${img ? `<img class="popular-item-img" src="${img}" alt="${escapeHtmlAttribute(title)}">` : `<span class="popular-icon" style="color: var(--accent);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>`}
                <span class="popular-item-name">${escapeHtmlAttribute(title)}</span>
                <span class="popular-item-badge"><svg class="popular-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>${m.mal_score != null ? Number(m.mal_score).toFixed(2) : '—'}</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'translated') {
      const items = popularData.publishers_uk || [];
      if (items.length === 0) {
        popularContainer.innerHTML = '';
        return;
      }
      popularContainer.innerHTML = `
        <div class="popular-title">Топ українських видавництв:</div>
        <div class="popular-list">
          ${items.map(p => {
            const img = normalizeImageUrl(p.image);
            return `
              <a href="#/catalog?publisher_ids=${p.id}&lang=uk" class="popular-item">
                ${img ? `<img class="popular-item-img" src="${img}" alt="${escapeHtmlAttribute(p.name)}">` : `<span class="popular-icon" style="color: var(--accent);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/></svg></span>`}
                <span class="popular-item-name">${escapeHtmlAttribute(p.name)}</span>
                <span class="popular-item-badge">${p.volume_count} видань</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }
  };

  const renderMagazinesSidebar = () => {
    const sidebar = main.querySelector('#home-right-sidebar');
    if (!sidebar) return;

    const items = popularData.magazines || [];
    sidebar.innerHTML = `
      <div class="magazine-sidebar-block">
        <h3 class="sidebar-title">ЖУРНАЛИ</h3>
        <div class="magazine-sidebar-list">
          ${items.map(m => {
            const color = getMagazineColor(m.name);
            const countNoun = getSeriesNounUk(m.series_count);
            return `
              <div class="magazine-sidebar-item">
                <div class="magazine-sidebar-item-left">
                  <span class="magazine-dot" style="background-color: ${color};"></span>
                  <a href="#/magazines/${m.id}" class="magazine-sidebar-link">${escapeHtmlAttribute(m.name)}</a>
                </div>
                <span class="magazine-sidebar-count">${m.series_count} ${countNoun}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const updateTab = (tab) => {
    activeTab = tab;
    
    // Move recent-issues-section dynamically
    const recentIssuesSec = main.querySelector('#recent-issues-section');
    const mainLayout = main.querySelector('#home-main-layout');
    const leftCol = main.querySelector('.home-left-col');
    const container = mainLayout ? mainLayout.parentElement : null;

    if (container && recentIssuesSec && mainLayout && leftCol) {
      if (tab === 'magazines') {
        container.insertBefore(recentIssuesSec, mainLayout);
      } else {
        leftCol.appendChild(recentIssuesSec);
      }
    }
    
    // Update button active states
    main.querySelectorAll('[data-home-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.homeTab === tab);
    });

    // Update Hero headers
    const titleEl = main.querySelector('#home-hero-title');
    const subEl = main.querySelector('#home-hero-sub');
    if (titleEl) titleEl.innerHTML = t(`home_hero_title_${tab}`);
    if (subEl) subEl.innerHTML = t(`home_hero_sub_${tab}`);

    // Update Hero popular content block
    renderPopularWidget(tab);

    // Update layout grid for magazines (sidebar)
    const rightSidebar = main.querySelector('#home-right-sidebar');
    if (mainLayout && rightSidebar) {
      if (tab === 'magazines') {
        mainLayout.classList.add('has-sidebar');
        rightSidebar.style.display = 'block';
        renderMagazinesSidebar();
      } else {
        mainLayout.classList.remove('has-sidebar');
        rightSidebar.style.display = 'none';
      }
    }

    // Update sections visibility and titles
    const weeklySection = main.querySelector('#weekly-releases-section');
    const recentVolumesTitle = main.querySelector('#recent-volumes-title');
    const recentIssuesTitle = main.querySelector('#recent-issues-title');
    const recentVolumesGrid = main.querySelector('#recent-volumes-grid');
    const weeklyChaptersBlock = main.querySelector('#weekly-chapters-block');

    const recentVolumesSec = main.querySelector('#recent-volumes-section');
    const ukrainianReleasesBlock = main.querySelector('#ukrainian-releases-block');

    const weeklyMore = main.querySelector('#weekly-releases-more');
    const volumesMore = main.querySelector('#recent-volumes-more');
    const issuesMore = main.querySelector('#recent-issues-more');

    if (tab === 'translated') {
      if (weeklySection) weeklySection.style.display = 'none';
      if (recentVolumesSec) recentVolumesSec.style.display = 'none';
      if (recentIssuesSec) recentIssuesSec.style.display = 'none';
      if (weeklyChaptersBlock) weeklyChaptersBlock.style.display = 'none';
      if (ukrainianReleasesBlock) ukrainianReleasesBlock.style.display = 'block';
    } else if (tab === 'magazines') {
      if (weeklySection) weeklySection.style.display = 'none';
      if (recentVolumesSec) {
        recentVolumesSec.style.display = 'block';
        if (recentVolumesGrid) recentVolumesGrid.style.display = 'none';
      }
      if (recentIssuesSec) recentIssuesSec.style.display = 'block';
      if (weeklyChaptersBlock) weeklyChaptersBlock.style.display = 'block';
      if (ukrainianReleasesBlock) ukrainianReleasesBlock.style.display = 'none';
      
      if (recentVolumesTitle) {
        recentVolumesTitle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V15a2 2 0 0 1 2-2h14M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5a2.5 2.5 0 0 0 2.5 2.5H20M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5"/></svg>
          Новинки розділів за тиждень
        `;
      }
      if (recentIssuesTitle) {
        recentIssuesTitle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Останні випуски журналів
        `;
      }

      if (weeklyMore) weeklyMore.style.display = 'none';
      if (volumesMore) {
        volumesMore.style.display = 'none'; // hide "view all" link for chapters calendar
      }
      if (issuesMore) {
        issuesMore.style.display = 'inline-block';
        issuesMore.href = `#/manga-magazines?view=issues`;
      }
    } else {
      if (weeklySection) weeklySection.style.display = 'block';
      if (recentVolumesSec) {
        recentVolumesSec.style.display = 'block';
        if (recentVolumesGrid) recentVolumesGrid.style.display = 'grid';
      }
      if (recentIssuesSec) recentIssuesSec.style.display = 'block';
      if (weeklyChaptersBlock) weeklyChaptersBlock.style.display = 'none';
      if (ukrainianReleasesBlock) ukrainianReleasesBlock.style.display = 'none';
      
      if (recentVolumesTitle) {
        recentVolumesTitle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          ${t('home_recent_volumes')}
        `;
      }
      if (recentIssuesTitle) {
        recentIssuesTitle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${t('home_recent_issues')}
        `;
      }

      if (weeklyMore) {
        weeklyMore.style.display = 'inline-block';
        weeklyMore.href = `#/catalog?view_type=issues&sort=date&content_type=${tab}`;
      }
      if (volumesMore) {
        volumesMore.style.display = 'inline-block';
        volumesMore.href = `#/catalog?content_type=${tab}`;
      }
      if (issuesMore) {
        issuesMore.style.display = 'inline-block';
        issuesMore.href = `#/catalog?view_type=issues&sort=recent&content_type=${tab}`;
      }
    }

    // Reload content with filters
    if (tab === 'translated') {
      loadUkrainianTabData();
    } else if (tab === 'magazines') {
      loadWeeklyChapters();
      loadRecentIssues(tab);
    } else {
      loadWeeklyReleases(start, end, tab);
      loadRecentVolumes(tab);
      loadRecentIssues(tab);
    }
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
    const { createComicCard } = await import('../components/cards/ComicCard.js');
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
      grid.innerHTML = `<div class="empty-state"><h3>${t('home_empty')}</h3></div>`;
      return;
    }
    data.items.forEach(item => grid.appendChild(createComicCard(item)));
  } catch (err) {
    console.error('Error loading weekly releases:', err);
    grid.innerHTML = `<div class="empty-state"><h3>${t('home_error')}</h3></div>`;
  }
}

async function loadRecentVolumes(contentType) {
  const grid = document.getElementById('recent-volumes-grid');
  if (!grid) return;
  renderSkeletons(grid, 8);

  try {
    if (contentType === 'magazines') {
      const data = await API.get('/magazines/recent', { limit: 8 });
      grid.innerHTML = '';
      const items = data.items || [];
      if (items.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h3>${t('home_empty')}</h3></div>`;
        return;
      }
      items.forEach(item => {
        const cover = normalizeImageUrl(item.image);
        const title = item.name || 'Без назви';
        const series = item.series_count ? `${t('home_stats_volumes')}: ${item.series_count}` : t('no_series');
        const card = document.createElement('div');
        card.className = 'comic-card';
        card.innerHTML = `
          <a href="#/magazines/${item.id}" style="text-decoration: none; color: inherit;">
            <div class="comic-cover-wrap">
              ${cover ? `<img class="comic-cover" src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(title)}" loading="lazy">` : `<div class="comic-cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
            </div>
            <div class="comic-body">
              <h4 class="comic-title" title="${escapeHtmlAttribute(title)}">${escapeHtmlAttribute(title)}</h4>
              <div class="comic-meta" style="font-size: 0.8em; color: var(--text-muted); margin-top: 4px;">${series}</div>
            </div>
          </a>
        `;
        grid.appendChild(card);
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const { createComicCard } = await import('../components/cards/ComicCard.js');
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
        grid.innerHTML = `<div class="empty-state"><h3>${t('home_empty')}</h3></div>`;
        return;
      }
      data.items.forEach(item => grid.appendChild(createComicCard(item)));
    }
  } catch (err) {
    console.error('Error loading recent volumes:', err);
    grid.innerHTML = `<div class="empty-state"><h3>${t('home_error')}</h3></div>`;
  }
}

async function loadRecentIssues(contentType) {
  const grid = document.getElementById('recent-issues-grid');
  if (!grid) return;
  renderSkeletons(grid, 8);

  try {
    if (contentType === 'magazines') {
      const data = await API.get('/magazines/recent-issues', { limit: 8 });
      grid.innerHTML = '';
      const items = data.items || [];
      if (items.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h3>${t('home_empty')}</h3></div>`;
        return;
      }
      items.forEach(item => {
        const cover = normalizeImageUrl(item.image);
        const title = item.name || `${item.magazine_name} #${item.issue_number}`;
        const card = document.createElement('div');
        card.className = 'comic-card';
        card.innerHTML = `
          <a href="#/magazines/issues/${item.id}" style="text-decoration: none; color: inherit;">
            <div class="comic-cover-wrap">
              ${cover ? `<img class="comic-cover" src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(title)}" loading="lazy">` : `<div class="comic-cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
            </div>
            <div class="comic-body">
              <h4 class="comic-title" title="${escapeHtmlAttribute(title)}">${escapeHtmlAttribute(title)}</h4>
              <div class="comic-meta" style="font-size: 0.8em; color: var(--accent); font-weight: 500; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtmlAttribute(item.magazine_name)}
              </div>
            </div>
          </a>
        `;
        grid.appendChild(card);
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const { createComicCard } = await import('../components/cards/ComicCard.js');
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
        grid.innerHTML = `<div class="empty-state"><h3>${t('home_empty')}</h3></div>`;
        return;
      }
      data.items.forEach(item => grid.appendChild(createComicCard(item)));
    }
  } catch (err) {
    console.error('Error loading recent issues:', err);
    grid.innerHTML = `<div class="empty-state"><h3>${t('home_error')}</h3></div>`;
  }
}

async function loadUkrainianTabData() {
  const grids = {
    announcements: document.getElementById('uk-announcements-grid'),
    newReleases: document.getElementById('uk-new-releases-grid'),
    recentSeries: document.getElementById('uk-recent-series-grid'),
    recentCollections: document.getElementById('uk-recent-collections-grid')
  };

  Object.values(grids).forEach(grid => {
    if (grid) renderSkeletons(grid, 8);
  });

  try {
    const data = await API.get('/stats/ukrainian-tab', { limit: 8 });
    const { createComicCard } = await import('../components/cards/ComicCard.js');

    const fillGrid = (grid, items) => {
      if (!grid) return;
      grid.innerHTML = '';
      if (!items || items.length === 0) {
        grid.innerHTML = `<div class="empty-state-small"><p>Немає даних для відображення</p></div>`;
        return;
      }
      items.forEach(item => {
        grid.appendChild(createComicCard(item));
      });
    };

    fillGrid(grids.announcements, data.announcements);
    fillGrid(grids.newReleases, data.new_releases);
    fillGrid(grids.recentSeries, data.recent_series);
    fillGrid(grids.recentCollections, data.recent_collections);

  } catch (err) {
    console.error('Error loading Ukrainian tab data:', err);
    Object.values(grids).forEach(grid => {
      if (grid) grid.innerHTML = `<div class="empty-state"><h3>Помилка завантаження</h3></div>`;
    });
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
    const day = today.getDay();
    const diffToWednesday = (day >= 3) ? (day - 3) : (day + 4);
    
    const start = new Date(today);
    start.setDate(today.getDate() - diffToWednesday);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const realToday = new Date();
    const finalEnd = end > realToday ? realToday : end;

    return { start, end: finalEnd };
}

function formatDate(date) {
    const numLocale = getCurrentLanguage() === 'uk' ? 'uk-UA' : 'en-US';
    return date.toLocaleDateString(numLocale, { day: 'numeric', month: 'long' });
}

async function loadWeeklyChapters() {
  const block = document.getElementById('weekly-chapters-block');
  if (!block) return;
  block.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

  try {
    const { start, end } = getCalendarWeek();
    const formatDateYMD = (date) => date.toISOString().split('T')[0];

    const data = await API.get('/magazines/weekly-chapters', {
      date_min: formatDateYMD(start),
      date_max: formatDateYMD(end)
    });

    const days = [
      { name: 'Понеділок', shortName: 'Пн', key: 1, items: [] },
      { name: 'Вівторок', shortName: 'Вт', key: 2, items: [] },
      { name: 'Середа', shortName: 'Ср', key: 3, items: [] },
      { name: 'Четвер', shortName: 'Чт', key: 4, items: [] },
      { name: 'П\'ятниця', shortName: 'Пт', key: 5, items: [] },
      { name: 'Субота', shortName: 'Сб', key: 6, items: [] },
      { name: 'Неділя', shortName: 'Нд', key: 0, items: [] }
    ];

    const items = data.items || [];
    items.forEach(item => {
      if (item.issue_release_date) {
        const itemDate = new Date(item.issue_release_date);
        const dayOfWeek = itemDate.getDay();
        const targetDay = days.find(d => d.key === dayOfWeek);
        if (targetDay) {
          targetDay.items.push(item);
        }
      }
    });

    const todayDayOfWeek = new Date().getDay();
    let activeDayIndex = days.findIndex(d => d.key === todayDayOfWeek);
    if (activeDayIndex === -1) activeDayIndex = 0;

    block.innerHTML = `
      <div class="weekly-chapters-tabs-container">
        <div class="weekly-days-tabs" role="tablist">
          ${days.map((day, idx) => `
            <button class="weekly-day-tab ${idx === activeDayIndex ? 'is-active' : ''}" 
                    type="button" 
                    role="tab" 
                    data-day-idx="${idx}">
              <span class="day-short">${day.shortName}</span>
              <span class="day-full">${day.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="weekly-chapters-content">
        ${days.map((day, idx) => `
          <div class="weekly-day-panel" 
               id="weekly-day-panel-${idx}" 
               role="tabpanel" 
               style="display: ${idx === activeDayIndex ? 'block' : 'none'};">
            ${renderDayChapters(day.items)}
          </div>
        `).join('')}
      </div>
    `;

    block.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.weekly-day-tab');
      if (tabBtn) {
        const idx = parseInt(tabBtn.dataset.dayIdx);
        block.querySelectorAll('.weekly-day-tab').forEach((btn, bIdx) => {
          btn.classList.toggle('is-active', bIdx === idx);
        });
        block.querySelectorAll('.weekly-day-panel').forEach((panel, pIdx) => {
          panel.style.display = pIdx === idx ? 'block' : 'none';
        });
      }
    });

  } catch (err) {
    console.error('Error loading weekly chapters:', err);
    block.innerHTML = `<div class="empty-state"><h3>${t('home_error')}</h3></div>`;
  }
}

function renderDayChapters(items) {
  if (items.length === 0) {
    return `
      <div class="empty-state-small">
        <p>Немає нових розділів цього дня</p>
      </div>
    `;
  }

  return `
    <div class="weekly-chapters-list">
      ${items.map(item => {
        const cover = normalizeImageUrl(item.manga_cover);
        const title = item.manga_name_uk || item.manga_name || 'Без назви';
        const color = getMagazineColor(item.magazine_name);
        const tagStyle = `
          background-color: color-mix(in srgb, ${color} 8%, var(--bg-card));
          color: ${color};
          border: 1px solid color-mix(in srgb, ${color} 20%, var(--border-s));
        `;

        return `
          <a href="#/manga-chapters/${item.chapter_id}" class="weekly-chapter-card">
            <div class="chapter-card-left">
              ${cover ? `<img src="${escapeHtmlAttribute(cover)}" class="chapter-series-cover" alt="${escapeHtmlAttribute(title)}" loading="lazy">` : `<div class="chapter-series-cover-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`}
              <div class="chapter-series-info">
                <h4 class="chapter-series-title" title="${escapeHtmlAttribute(title)}">${escapeHtmlAttribute(title)}</h4>
                <span class="chapter-magazine-tag" style="${tagStyle}">
                  ${escapeHtmlAttribute(item.magazine_label || item.magazine_name)}
                </span>
              </div>
            </div>
            <div class="chapter-card-right">
              <div class="chapter-number">Розділ ${item.chapter_number}</div>
              ${item.chapter_name ? `<div class="chapter-name" title="${escapeHtmlAttribute(item.chapter_name)}">${escapeHtmlAttribute(item.chapter_name)}</div>` : ''}
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;
}

function getCalendarWeek() {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = (day === 0) ? 6 : (day - 1);

    const start = new Date(today);
    start.setDate(today.getDate() - diffToMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
}

function getMagazineColor(name) {
    if (!name) return '#64748b';
    const normalized = name.trim().toLowerCase();
    const colors = {
        'weekly shonen jump': '#2563eb',
        'shonen jump+': '#eab308',
        'weekly shonen magazine': '#ea580c',
        'young animal': '#a855f7',
        'weekly morning': '#d97706',
        'morning': '#d97706',
        'monthly afternoon': '#ec4899',
        'afternoon': '#ec4899',
        'weekly shonen sunday': '#3b82f6',
        'weekly young jump': '#0ea5e9',
        'young jump': '#0ea5e9',
        'big comic spirits': '#10b981',
        'bessatsu shonen magazine': '#8b5cf6'
    };
    for (const key in colors) {
        if (normalized.includes(key)) {
            return colors[key];
        }
    }
    // Deterministic fallback color based on hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 75%, 50%)`;
}

function getSeriesNounUk(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'серій';
  }
  if (lastDigit === 1) {
    return 'серія';
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'серії';
  }
  return 'серій';
}

