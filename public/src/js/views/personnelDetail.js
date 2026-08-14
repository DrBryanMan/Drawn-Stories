import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createPaginator } from '../components/Pagination.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { renderEntityIssueCard, renderEntityVolumeCard } from '../components/cards/EntityReleaseCard.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { openEditPersonModal } from '../components/modals/EditPersonModal.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { icon } from '../helpers/icons.js';

// ── Paginator instance (for works tab) ───────────────
const worksPaginator = createPaginator({ pageSize: 24 });
let currentWorkType = 'volumes'; // 'volumes' | 'issues'
let worksSearchQuery = '';

// ── Helpers ───────────────────────────────────────────
function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function genderLabel(gender) {
  if (gender === 1) return 'Чоловік';
  if (gender === 2) return 'Жінка';
  return null;
}

function avatarHTML(person) {
  const imgUrl = normalizeImageUrl(person.image);
  const initial = person.name ? person.name.charAt(0).toUpperCase() : '?';

  if (imgUrl) {
    return `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(person.name)}" loading="lazy">`;
  }
  return `<span style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#fff; font-size:5rem; font-weight:800; font-family:var(--font-oswald);">${initial}</span>`;
}

function factItemHTML(label, valueHTML) {
  if (!valueHTML) return '';
  return `
    <li class="personnel-detail-fact-item">
      <span class="personnel-detail-fact-label">${label}</span>
      <span class="personnel-detail-fact-value">${valueHTML}</span>
    </li>
  `;
}

// ── Skeleton ──────────────────────────────────────────
function renderSkeleton(container) {
  container.innerHTML = `
    <div class="personnel-detail">
      <div class="container" style="padding-top:16px;">
        <div class="skeleton" style="width:260px;height:14px;margin-bottom:20px;"></div>
      </div>
      <section class="personnel-detail-hero-band">
        <div class="container personnel-detail-hero">
          <div class="personnel-detail-avatar-col">
            <div class="skeleton" style="width:200px;height:200px;border-radius:var(--r-xl);"></div>
          </div>
          <div class="personnel-detail-info" style="gap:12px;">
            <div class="skeleton" style="width:90px;height:12px;"></div>
            <div class="skeleton" style="width:55%;height:34px;border-radius:4px;"></div>
            <div class="skeleton" style="width:220px;height:20px;border-radius:99px;"></div>
            <div class="skeleton" style="width:100%;height:70px;border-radius:var(--r-lg);"></div>
          </div>
        </div>
      </section>
      <div class="personnel-detail-tabs-band">
        <div class="container">
          <div class="personnel-detail-tabs">
            <div class="skeleton" style="width:80px;height:40px;border-radius:4px;"></div>
            <div class="skeleton" style="width:110px;height:40px;border-radius:4px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Main render ───────────────────────────────────────
export async function renderPersonnelDetail(container, params, query = {}) {
  const id = params.id;
  const initialTab = query?.tab === 'works' ? 'works' : 'overview';
  const initialType = (query?.type === 'issues' || query?.mode === 'issues') ? 'issues' : 'volumes';
  currentWorkType = initialType;
  worksSearchQuery = query?.search || '';

  renderSkeleton(container);

  try {
    const person = await API.get(`/persons/${id}`);

    const displayName = person.name_uk || person.name;
    document.title = `${displayName} — Drawn Stories`;

    const edits = await fetchEntityEdits('person', id);
    container.innerHTML = buildDetailHTML(person, edits, initialTab);

    initTabs(container, person, id, initialTab);
    worksPaginator.reset();

    // Edit button click
    container.querySelector('#person-edit-btn')?.addEventListener('click', () => {
      openEditPersonModal(person, () => renderPersonnelDetail(container, params, query));
    });

    initEditorsHistoryBlock(container, edits);
  } catch (err) {
    container.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="personnel-detail-empty">
          ${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}
          <h3>Особу не знайдено</h3>
          <p>${escapeHtmlAttribute(err.message)}</p>
          <a href="#/personnel" class="personnel-detail-action-btn" style="margin-top:8px;">← Назад до персоналу</a>
        </div>
      </div>
    `;
  }
}

// ── Build HTML ────────────────────────────────────────
function buildDetailHTML(person, edits = [], initialTab = 'overview') {
  const latestVolumes = person.latest_volumes || [];
  const latestIssues = person.latest_issues || [];

  const volumeCount = person.volume_count || 0;
  const issueCount = person.issue_count || 0;
  const totalWorks = volumeCount + issueCount;

  const displayName = escapeHtmlAttribute(person.name_uk || person.name);
  const originalName = person.name_uk && person.name_uk !== person.name ? person.name : '';
  const nativeName = person.name_native && person.name_native !== displayName && person.name_native !== originalName ? person.name_native : '';

  // Location string
  const locationParts = [person.hometown, person.country].filter(Boolean);
  const location = locationParts.join(', ');

  // Aliases
  const aliases = parseAliases(person.aliases);

  const hasExternalLinks = person.cv_id || person.hikka_slug || person.website;

  return `
    <div class="personnel-detail">
      <!-- Hero Band -->
      <section class="personnel-detail-hero-band">
        <div class="container personnel-detail-hero">
          <!-- Avatar Column -->
          <div class="personnel-detail-avatar-col">
            <div class="personnel-detail-avatar">${avatarHTML(person)}</div>
            ${hasExternalLinks ? `
              <div class="personnel-cover-ext-sources">
                <div class="ext-sources-title">${t('external_sources') || 'Зовнішні джерела'}</div>
                <div class="source-links">
                  ${person.cv_id ? `
                    <a href="https://comicvine.gamespot.com/${person.cv_slug ? escapeHtmlAttribute(person.cv_slug) + '/' : 'person/'}4040-${person.cv_id}/" target="_blank" rel="noreferrer">
                      CV
                      ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                    </a>
                  ` : ''}
                  ${person.hikka_slug ? `
                    <a href="https://hikka.io/people/${escapeHtmlAttribute(person.hikka_slug)}" target="_blank" rel="noreferrer">
                      Hikka
                      ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                    </a>
                  ` : ''}
                  ${person.website ? `
                    <a href="${escapeHtmlAttribute(person.website)}" target="_blank" rel="noreferrer">
                      Site
                      ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Info Column -->
          <div class="personnel-detail-info">
            <h1>${displayName}</h1>
            ${originalName ? `<div class="personnel-detail-subname">${escapeHtmlAttribute(originalName)}</div>` : ''}
            ${nativeName ? `<div class="personnel-detail-subname" style="font-size:0.95em; opacity:0.85;">${escapeHtmlAttribute(nativeName)}</div>` : ''}

            <div class="personnel-detail-badges-row">
              ${person.occupation ? `<span class="personnel-detail-type-badge">${icon('layers', 14, { strokeWidth: 2.1 })} ${escapeHtmlAttribute(person.occupation)}</span>` : ''}
              ${person.pseudo ? `<span class="personnel-detail-type-badge">${icon('user', 14, { strokeWidth: 2.1 })} Псевдонім: ${escapeHtmlAttribute(person.pseudo)}</span>` : ''}
            </div>

            <div class="personnel-detail-meta-row">
              ${person.birth ? `<span class="personnel-detail-meta-item">${icon('calendar', 14, { strokeWidth: 2.1 })} народження: <strong>${escapeHtmlAttribute(person.birth)}</strong></span>` : ''}
              ${location ? `<span class="personnel-detail-meta-item">${icon('chevronRight', 14, { strokeWidth: 2.2 })} ${escapeHtmlAttribute(location)}</span>` : ''}
            </div>

            <div class="personnel-detail-stats-row">
              <div class="personnel-detail-stat">
                <span class="personnel-detail-stat-value">${volumeCount.toLocaleString('uk-UA')}</span>
                <span class="personnel-detail-stat-label">Серій</span>
              </div>
              <div class="personnel-detail-stat">
                <span class="personnel-detail-stat-value">${issueCount.toLocaleString('uk-UA')}</span>
                <span class="personnel-detail-stat-label">Випусків</span>
              </div>
            </div>
          </div>

          ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'person-edit-btn', editTitle: 'Редагувати' })}
        </div>
      </section>

      <!-- Tabs Bar -->
      <div class="personnel-detail-tabs-band">
        <div class="container">
          <div class="personnel-detail-tabs" role="tablist">
            <button class="personnel-detail-tab-btn ${initialTab === 'overview' ? 'is-active' : ''}" data-tab="overview" role="tab" aria-selected="${initialTab === 'overview'}">
              Огляд
            </button>
            <button class="personnel-detail-tab-btn ${initialTab === 'works' ? 'is-active' : ''}" data-tab="works" role="tab" aria-selected="${initialTab === 'works'}">
              ${icon('book', 14, { strokeWidth: 2.1 })} Роботи <span class="tab-count">${totalWorks.toLocaleString('uk-UA')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Panes -->
      <div class="container" style="margin-top: 0;">
        <!-- Overview -->
        <div class="personnel-detail-pane ${initialTab === 'overview' ? 'is-active' : ''}" data-pane="overview">
          <div class="personnel-detail-overview">
            <!-- Info block -->
            <aside>
              <div class="personnel-detail-info-block">
                <div class="personnel-detail-info-block-title">Інформація</div>
                <ul class="personnel-detail-fact-list">
                  ${factItemHTML('Професія', person.occupation ? escapeHtmlAttribute(person.occupation) : null)}
                  ${factItemHTML('Стать', genderLabel(person.gender))}
                  ${factItemHTML('Псевдонім', person.pseudo ? escapeHtmlAttribute(person.pseudo) : null)}
                  ${factItemHTML('Народження', person.birth ? escapeHtmlAttribute(person.birth) : null)}
                  ${factItemHTML('Смерть', person.death ? escapeHtmlAttribute(person.death) : null)}
                  ${factItemHTML('Місто', person.hometown ? escapeHtmlAttribute(person.hometown) : null)}
                  ${factItemHTML('Країна', person.country ? escapeHtmlAttribute(person.country) : null)}
                  ${factItemHTML('Сайт', person.website ? `<a href="${escapeHtmlAttribute(person.website)}" target="_blank" rel="noopener">${escapeHtmlAttribute(person.website)} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
                  ${factItemHTML('Псевдоніми', aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML('ComicVine', person.cv_id ? `<a href="https://comicvine.gamespot.com/${person.cv_slug ? escapeHtmlAttribute(person.cv_slug) + '/' : 'person/'}4040-${person.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(person.cv_id))} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
                  ${factItemHTML('Hikka', person.hikka_slug ? `<a href="https://hikka.io/people/${escapeHtmlAttribute(person.hikka_slug)}" target="_blank" rel="noopener">${escapeHtmlAttribute(person.hikka_slug)} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
                </ul>
              </div>
            </aside>

            <!-- Recent works column -->
            <div class="entity-recent-col">
              <!-- Recent Volumes -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Нові серії</span>
                </div>
                ${latestVolumes.length > 0
                  ? `<div class="entity-releases-grid">${latestVolumes.map(v => renderEntityVolumeCard(v)).join('')}</div>`
                  : `<div class="entity-releases-empty">Серій поки немає</div>`
                }
              </div>

              <!-- Recent Issues -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Крайні випуски</span>
                </div>
                ${latestIssues.length > 0
                  ? `<div class="entity-releases-grid">${latestIssues.map(i => renderEntityIssueCard(i)).join('')}</div>`
                  : `<div class="entity-releases-empty">Випусків поки немає</div>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Works tab -->
        <div class="personnel-detail-pane ${initialTab === 'works' ? 'is-active' : ''}" data-pane="works">
          <div class="personnel-detail-works-pane">
            <div id="person-works-filter-bar-container" style="margin-bottom: 20px;"></div>
            <div id="person-works-content">
              ${buildWorkSkeletons(8)}
            </div>
            <div id="person-works-pagination" style="margin-top: 24px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildWorkSkeletons(count) {
  return `
    <div class="entity-releases-grid">
      ${Array.from({ length: count }).map(() =>
        `<div class="skeleton" style="aspect-ratio: 2/3; border-radius: var(--r-lg);"></div>`
      ).join('')}
    </div>
  `;
}

function updatePersonnelUrl(personId, tab, workType) {
  const hashWithoutQuery = window.location.hash.split('?')[0] || `#/persons/${personId}`;
  const q = new URLSearchParams();
  if (tab && tab !== 'overview') {
    q.set('tab', tab);
    if (tab === 'works' && workType) {
      q.set('type', workType);
    }
  }
  const qs = q.toString();
  const newHash = qs ? `${hashWithoutQuery}?${qs}` : hashWithoutQuery;
  window.history.replaceState(null, '', newHash);
}

// ── Tab switching ─────────────────────────────────────
function initTabs(container, person, personId, initialTab = 'overview') {
  const tabs = container.querySelectorAll('.personnel-detail-tab-btn');
  const panes = container.querySelectorAll('.personnel-detail-pane');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabs.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      panes.forEach(p => p.classList.remove('is-active'));
      const activePane = container.querySelector(`[data-pane="${target}"]`);
      if (activePane) activePane.classList.add('is-active');

      updatePersonnelUrl(personId, target, currentWorkType);

      // Lazy load works tab
      if (target === 'works') {
        const filterContainer = container.querySelector('#person-works-filter-bar-container');
        if (filterContainer && !filterContainer.querySelector('.filter-bar')) {
          mountWorksFilterBar(container, personId);
        }
      }
    });
  });

  if (initialTab === 'works') {
    mountWorksFilterBar(container, personId);
  }
}

function initCollapsibleSections(container, toggleBtnSelector) {
  const sections = container.querySelectorAll('.entity-recent-section[data-volume-id]');
  const toggleBtn = container.querySelector(toggleBtnSelector);

  sections.forEach(section => {
    const header = section.querySelector('.entity-section-header--collapsible');
    if (!header || header.dataset.bound === 'true') return;
    header.dataset.bound = 'true';

    header.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      section.classList.toggle('is-collapsed');
      const isCollapsed = section.classList.contains('is-collapsed');
      header.setAttribute('aria-expanded', !isCollapsed);
      updateToggleAllBtn(container, toggleBtn);
    });
  });

  if (toggleBtn && toggleBtn.dataset.bound !== 'true') {
    toggleBtn.dataset.bound = 'true';
    toggleBtn.addEventListener('click', () => {
      const currentSections = container.querySelectorAll('.entity-recent-section[data-volume-id]');
      const anyCollapsed = Array.from(currentSections).some(s => s.classList.contains('is-collapsed'));
      currentSections.forEach(s => {
        if (anyCollapsed) {
          s.classList.remove('is-collapsed');
          s.querySelector('.entity-section-header--collapsible')?.setAttribute('aria-expanded', 'true');
        } else {
          s.classList.add('is-collapsed');
          s.querySelector('.entity-section-header--collapsible')?.setAttribute('aria-expanded', 'false');
        }
      });
      updateToggleAllBtn(container, toggleBtn);
    });
  }

  updateToggleAllBtn(container, toggleBtn);
}

function updateToggleAllBtn(container, toggleBtn) {
  if (!toggleBtn) return;
  const sections = container.querySelectorAll('.entity-recent-section[data-volume-id]');
  if (sections.length === 0) return;
  const anyCollapsed = Array.from(sections).some(s => s.classList.contains('is-collapsed'));
  const span = toggleBtn.querySelector('span');
  if (span) {
    span.textContent = anyCollapsed ? 'Розгорнути все' : 'Згорнути все';
  }
}

function mountWorksFilterBar(container, personId) {
  const filterContainer = container.querySelector('#person-works-filter-bar-container');
  if (!filterContainer) return;

  const filterBar = mountFilterBar(filterContainer, {
    resultsCount: 0,
    resultsLabel: 'Знайдено',
    showResults: true,
    showSearch: true,
    searchPlaceholder: 'Шукати в роботах...',
    searchValue: worksSearchQuery,
    onSearch: (val) => {
      worksSearchQuery = val;
      worksPaginator.reset();
      fetchAndRenderWorks(container, personId, filterBar);
    },
    showSort: false,
    showSortOrder: false,
    extraMiddleHtml: `
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="entity-toggle-all-btn" id="person-toggle-all-btn" type="button" style="${currentWorkType === 'issues' ? '' : 'display: none;'}">
          ${icon('chevronsUpDown', 13)} <span>Розгорнути все</span>
        </button>
        <div class="wanted-ct-group" role="group">
          <button class="wanted-ct-btn ${currentWorkType === 'volumes' ? 'is-active' : ''}" data-type="volumes">Серії</button>
          <button class="wanted-ct-btn ${currentWorkType === 'issues' ? 'is-active' : ''}" data-type="issues">Випуски</button>
        </div>
      </div>
    `
  });

  // Bind click event to type select buttons
  filterContainer.querySelectorAll('.wanted-ct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === currentWorkType) return;

      filterContainer.querySelectorAll('.wanted-ct-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      currentWorkType = type;
      updatePersonnelUrl(personId, 'works', currentWorkType);

      const toggleAllBtn = filterContainer.querySelector('#person-toggle-all-btn');
      if (toggleAllBtn) {
        toggleAllBtn.style.display = currentWorkType === 'issues' ? '' : 'none';
      }

      worksPaginator.reset();
      fetchAndRenderWorks(container, personId, filterBar);
    });
  });

  // Initial load
  fetchAndRenderWorks(container, personId, filterBar);
}

// ── Works loading ─────────────────────────────────────
async function fetchAndRenderWorks(container, personId, filterBar) {
  const content = container.querySelector('#person-works-content');
  const paginationWrap = container.querySelector('#person-works-pagination');
  if (!content) return;

  content.innerHTML = buildWorkSkeletons(12);

  const params = {
    person_ids: personId,
    mode: currentWorkType,
    search: worksSearchQuery || undefined,
    page: worksPaginator.getPage(),
    limit: worksPaginator.getPageSize(),
  };

  try {
    const data = await API.get('/catalog', params);

    const items = data.items || [];
    if (filterBar) {
      filterBar.updateCount(data.total || 0);
    }

    if (items.length === 0) {
      content.innerHTML = `
        <div class="personnel-detail-empty">
          ${icon('book', 14, { strokeWidth: 2.1 })}
          <h3>Робіт не знайдено</h3>
          <p>У цієї особи поки немає доданих ${currentWorkType === 'volumes' ? 'серій' : 'випусків'}</p>
        </div>
      `;
      if (paginationWrap) paginationWrap.innerHTML = '';
      return;
    }

    if (currentWorkType === 'volumes') {
      content.innerHTML = `
        <div class="entity-releases-grid">
          ${items.map(v => renderEntityVolumeCard(v)).join('')}
        </div>
      `;
    } else {
      // Group issues by volume_id (as in characterDetail)
      const volumeMap = new Map();
      items.forEach(iss => {
        const volId = iss.volume_id;
        if (!volumeMap.has(volId)) {
          const title = iss.volume_name_uk || iss.volume_name || t('series') || 'Серія';
          const image = iss.volume_image || iss.volume_cover_img || null;
          volumeMap.set(volId, { id: volId, title, image, issues: [] });
        }
        volumeMap.get(volId).issues.push(iss);
      });

      let html = '';
      const isAutoExpanded = !!worksSearchQuery;
      volumeMap.forEach(group => {
        const cover = normalizeImageUrl(group.image);
        html += `
          <div class="entity-recent-section ${isAutoExpanded ? '' : 'is-collapsed'}" style="margin-bottom: 16px;" data-volume-id="${group.id}">
            <div class="entity-section-header entity-section-header--collapsible" role="button" tabindex="0" aria-expanded="${isAutoExpanded}">
              <div class="entity-section-header-left">
                <div class="entity-section-vol-thumb">
                  ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(group.title)}" loading="lazy">` : `<div class="entity-section-vol-thumb-empty">${icon('book', 14)}</div>`}
                </div>
                <a href="#/volumes/${group.id}" class="entity-section-vol-title" onclick="event.stopPropagation();" title="${escapeHtmlAttribute(group.title)}">
                  ${escapeHtmlAttribute(group.title)}
                </a>
                <span class="entity-section-count-badge">${group.issues.length} вип.</span>
              </div>
              <div class="entity-section-header-right">
                <span class="entity-section-chevron">${icon('chevronDown', 16, { strokeWidth: 2.2 })}</span>
              </div>
            </div>
            <div class="entity-section-content">
              <div class="entity-releases-grid">
                ${group.issues.map(i => renderEntityIssueCard(i)).join('')}
              </div>
            </div>
          </div>
        `;
      });
      content.innerHTML = html;
      initCollapsibleSections(container, '#person-toggle-all-btn');
    }

    if (paginationWrap) {
      paginationWrap.innerHTML = '';
      paginationWrap.appendChild(worksPaginator.render(data.total || 0, () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchAndRenderWorks(container, personId, filterBar);
      }));
    }

  } catch (err) {
    content.innerHTML = `
      <div class="personnel-detail-empty">
        ${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}
        <h3>Помилка завантаження</h3>
        <p>${escapeHtmlAttribute(err.message)}</p>
      </div>
    `;
  }
}
