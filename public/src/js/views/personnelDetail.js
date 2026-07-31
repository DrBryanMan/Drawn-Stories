import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createPaginator } from '../components/Pagination.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { mountFilterBar } from '../components/FilterBar.js';
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

function volumeReleaseCardHTML(vol) {
  const imgUrl = normalizeImageUrl(vol.image);
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || 'Без назви');
  const issueCount = vol.issue_count || 0;
  const coverHtml = imgUrl
    ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${title}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/volumes/${vol.id}" class="entity-release-card">
      <div class="entity-release-cover">${coverHtml}</div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${title}">${title}</div>
        <div class="entity-release-sub">${issueCount} вип.</div>
      </div>
    </a>
  `;
}

function issueReleaseCardHTML(issue) {
  const imgUrl = normalizeImageUrl(issue.image);
  const title = escapeHtmlAttribute(issue.name || `Випуск #${issue.issue_number || '?'}`);
  const volName = escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '');
  const numText = issue.issue_number ? `#${issue.issue_number}` : '';
  const displayTitle = numText ? `${volName} ${numText}` : volName;
  const coverHtml = imgUrl
    ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${title}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/issues/${issue.id}" class="entity-release-card">
      <div class="entity-release-cover">${coverHtml}</div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${displayTitle}">${displayTitle}</div>
        <div class="entity-release-sub">${title}</div>
      </div>
    </a>
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
export async function renderPersonnelDetail(container, params) {
  const id = params.id;
  currentWorkType = 'volumes';
  worksSearchQuery = '';

  renderSkeleton(container);

  try {
    const person = await API.get(`/personnel/${id}`);

    const displayName = person.name_uk || person.name;
    document.title = `${displayName} — Drawn Stories`;

    const edits = await fetchEntityEdits('person', id);
    container.innerHTML = buildDetailHTML(person, edits);

    initTabs(container, person, id);
    worksPaginator.reset();

    // Edit button click
    container.querySelector('#person-edit-btn')?.addEventListener('click', () => {
      openEditPersonModal(person, () => renderPersonnelDetail(container, params));
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
function buildDetailHTML(person, edits = []) {
  const latestVolumes = person.latest_volumes || [];
  const latestIssues = person.latest_issues || [];

  const volumeCount = person.volume_count || 0;
  const issueCount = person.issue_count || 0;
  const totalWorks = volumeCount + issueCount;

  const displayName = escapeHtmlAttribute(person.name_uk || person.name);
  const originalName = person.name_uk && person.name_uk !== person.name ? person.name : '';

  // Location string
  const locationParts = [person.hometown, person.country].filter(Boolean);
  const location = locationParts.join(', ');

  // Aliases
  const aliases = parseAliases(person.aliases);

  return `
    <div class="personnel-detail">
      <!-- Hero Band -->
      <section class="personnel-detail-hero-band">
        <div class="container personnel-detail-hero">
          <!-- Avatar Column -->
          <div class="personnel-detail-avatar-col">
            <div class="personnel-detail-avatar">${avatarHTML(person)}</div>
          </div>

          <!-- Info Column -->
          <div class="personnel-detail-info">
            <h1>${displayName}</h1>
            ${originalName ? `<div class="personnel-detail-subname">${escapeHtmlAttribute(originalName)}</div>` : ''}

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

            <div class="personnel-detail-actions">
              ${person.website ? `
                <a href="${escapeHtmlAttribute(person.website)}" class="personnel-detail-action-btn" target="_blank" rel="noopener noreferrer">
                  ${icon('globe', 14, { strokeWidth: 2.1 })} Сайт ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                </a>
              ` : ''}
            </div>
          </div>

          ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'person-edit-btn', editTitle: 'Редагувати' })}
        </div>
      </section>

      <!-- Tabs Bar -->
      <div class="personnel-detail-tabs-band">
        <div class="container">
          <div class="personnel-detail-tabs" role="tablist">
            <button class="personnel-detail-tab-btn is-active" data-tab="overview" role="tab" aria-selected="true">
              Огляд
            </button>
            <button class="personnel-detail-tab-btn" data-tab="works" role="tab" aria-selected="false">
              ${icon('book', 14, { strokeWidth: 2.1 })} Роботи <span class="tab-count">${totalWorks.toLocaleString('uk-UA')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Panes -->
      <div class="container" style="margin-top: 0;">
        <!-- Overview -->
        <div class="personnel-detail-pane is-active" data-pane="overview">
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
                  ${factItemHTML('CV ID', person.cv_id ? `<a href="https://comicvine.gamespot.com/person/${person.cv_slug || person.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(person.cv_id))} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
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
                  ? `<div class="entity-releases-grid">${latestVolumes.map(volumeReleaseCardHTML).join('')}</div>`
                  : `<div class="entity-releases-empty">Серій поки немає</div>`
                }
              </div>

              <!-- Recent Issues -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Крайні випуски</span>
                </div>
                ${latestIssues.length > 0
                  ? `<div class="entity-releases-grid">${latestIssues.map(issueReleaseCardHTML).join('')}</div>`
                  : `<div class="entity-releases-empty">Випусків поки немає</div>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Works tab -->
        <div class="personnel-detail-pane" data-pane="works">
          <div class="personnel-detail-works-pane">
            <div id="person-works-filter-bar-container" style="margin-bottom: 20px;"></div>
            <div id="person-works-grid" class="personnel-detail-works-grid">
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
  return Array.from({ length: count }).map(() =>
    `<div class="skeleton" style="aspect-ratio: 2/3; border-radius: var(--r-lg);"></div>`
  ).join('');
}

// ── Tab switching ─────────────────────────────────────
function initTabs(container, person, personId) {
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

      // Lazy load works tab
      if (target === 'works') {
        const filterContainer = container.querySelector('#person-works-filter-bar-container');
        if (filterContainer && !filterContainer.querySelector('.filter-bar')) {
          mountWorksFilterBar(container, personId);
        }
      }
    });
  });
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
      <div class="wanted-ct-group" role="group">
        <button class="wanted-ct-btn ${currentWorkType === 'volumes' ? 'is-active' : ''}" data-type="volumes">Серії</button>
        <button class="wanted-ct-btn ${currentWorkType === 'issues' ? 'is-active' : ''}" data-type="issues">Випуски</button>
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
      worksPaginator.reset();
      fetchAndRenderWorks(container, personId, filterBar);
    });
  });

  // Initial load
  fetchAndRenderWorks(container, personId, filterBar);
}

// ── Works loading ─────────────────────────────────────
async function fetchAndRenderWorks(container, personId, filterBar) {
  const grid = container.querySelector('#person-works-grid');
  const paginationWrap = container.querySelector('#person-works-pagination');
  if (!grid) return;

  grid.innerHTML = buildWorkSkeletons(12);

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
      grid.innerHTML = `
        <div class="personnel-detail-empty" style="grid-column: 1 / -1;">
          ${icon('book', 14, { strokeWidth: 2.1 })}
          <h3>Робіт не знайдено</h3>
          <p>У цієї особи поки немає доданих ${currentWorkType === 'volumes' ? 'серій' : 'випусків'}</p>
        </div>
      `;
      if (paginationWrap) paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
      item.type = currentWorkType === 'volumes' ? 'volume' : 'issue';
      const card = createComicCard(item);
      grid.appendChild(card);
    });

    if (paginationWrap) {
      paginationWrap.innerHTML = '';
      paginationWrap.appendChild(worksPaginator.render(data.total || 0, () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchAndRenderWorks(container, personId, filterBar);
      }));
    }

  } catch (err) {
    grid.innerHTML = `
      <div class="personnel-detail-empty" style="grid-column: 1 / -1;">
        ${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}
        <h3>Помилка завантаження</h3>
        <p>${escapeHtmlAttribute(err.message)}</p>
      </div>
    `;
  }
}
