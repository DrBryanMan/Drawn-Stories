import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createPaginator } from '../components/Pagination.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { getPublisherColor } from '../helpers/publisher.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { openEditPublisherModal } from '../components/modals/EditPublisherModal.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { icon } from '../helpers/icons.js';

// ── Paginator instance (for volumes tab) ─────────────
const volumesPaginator = createPaginator({ pageSize: 24 });
let currentVolType = 'volumes';
let volumesSearchQuery = '';

// ── Helpers ───────────────────────────────────────────
function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function getWorkTypeText(workType) {
  if (!workType) return null;
  const map = { manga: 'Манґа', comics: 'Комікси' };
  const items = workType.split(',').flatMap(s => {
    const trimmed = s.trim().toLowerCase();
    if (trimmed === 'mixed') return ['Манґа', 'Комікси'];
    return [map[trimmed] || s.trim()];
  });
  return items.join(', ');
}

function workTypeBadgesHTML(workType) {
  if (!workType) return '';
  const map = { manga: 'Манґа', comics: 'Комікси' };
  const items = workType.split(',').flatMap(s => {
    const trimmed = s.trim().toLowerCase();
    if (trimmed === 'mixed') return ['Манґа', 'Комікси'];
    return [map[trimmed] || s.trim()];
  });
  return items.map(label => 
    `<span class="pub-detail-type-badge">${icon('layers', 14, { strokeWidth: 2.1 })} ${escapeHtmlAttribute(label)}</span>`
  ).join(' ');
}

function statusBadgeHTML(pub) {
  const raw = (pub.status || '').toLowerCase();
  const isActive = raw === 'active' || raw === 'активне' || raw === 'активна';
  const label = isActive ? 'Активне' : 'Неактивне';
  const cls = isActive ? 'pub-detail-status-badge--active' : 'pub-detail-status-badge--inactive';
  const dot = isActive
    ? '<svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>'
    : '<svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" opacity=".5"><circle cx="4" cy="4" r="4"/></svg>';
  return `<span class="pub-detail-status-badge ${cls}">${dot} ${label}</span>`;
}

function logoHTML(pub) {
  const color = getPublisherColor(pub.name);
  const imgUrl = normalizeImageUrl(pub.image);
  const initial = pub.name ? pub.name.charAt(0).toUpperCase() : '?';

  if (imgUrl) {
    return `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(pub.name)} logo" loading="lazy">`;
  }
  return `<span style="background: linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #7c3aed)); display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#fff; font-size:5rem; font-weight:800; font-family:var(--font-oswald);">${initial}</span>`;
}

function factItemHTML(label, valueHTML) {
  if (!valueHTML) return '';
  return `
    <li class="pub-detail-fact-item">
      <span class="pub-detail-fact-label">${label}</span>
      <span class="pub-detail-fact-value">${valueHTML}</span>
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

function collectionReleaseCardHTML(coll) {
  const imgUrl = normalizeImageUrl(coll.image);
  const title = escapeHtmlAttribute(coll.name || `Збірник #${coll.issue_number || '?'}`);
  const volName = escapeHtmlAttribute(coll.volume_name_uk || coll.volume_name || '');
  const numText = coll.issue_number ? `#${coll.issue_number}` : '';
  const displayTitle = numText ? `${volName} ${numText}` : volName;
  const coverHtml = imgUrl
    ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${title}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}</div>`;

  return `
    <a href="#/collections/${coll.id}" class="entity-release-card">
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
    <div class="pub-detail">
      <div class="container" style="padding-top:16px;">
        <div class="skeleton" style="width:260px;height:14px;margin-bottom:20px;"></div>
      </div>
      <section class="pub-detail-hero-band">
        <div class="container pub-detail-hero">
          <div class="pub-detail-logo-col">
            <div class="skeleton" style="width:200px;height:200px;border-radius:var(--r-xl);"></div>
          </div>
          <div class="pub-detail-info" style="gap:12px;">
            <div class="skeleton" style="width:90px;height:12px;"></div>
            <div class="skeleton" style="width:55%;height:34px;border-radius:4px;"></div>
            <div class="skeleton" style="width:220px;height:20px;border-radius:99px;"></div>
            <div class="skeleton" style="width:100%;height:70px;border-radius:var(--r-lg);"></div>
          </div>
        </div>
      </section>
      <div class="pub-detail-tabs-band">
        <div class="container">
          <div class="pub-detail-tabs">
            <div class="skeleton" style="width:80px;height:40px;border-radius:4px;"></div>
            <div class="skeleton" style="width:110px;height:40px;border-radius:4px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Main render ───────────────────────────────────────
export async function renderPublisherDetail(container, params) {
  const id = params.id;
  currentVolType = 'volumes';
  volumesSearchQuery = '';

  renderSkeleton(container);

  try {
    const pub = await API.get(`/publishers/${id}`);

    document.title = `${pub.name} — Drawn Stories`;

    const edits = await fetchEntityEdits('publisher', id);

    container.innerHTML = buildDetailHTML(pub, edits);

    initTabs(container, pub, id);
    volumesPaginator.reset();

    // Edit button click
    container.querySelector('#pub-edit-btn')?.addEventListener('click', () => {
      openEditPublisherModal(pub, () => renderPublisherDetail(container, params));
    });

    initEditorsHistoryBlock(container, edits);
  } catch (err) {
    container.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="pub-detail-empty">
          ${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}
          <h3>Видавництво не знайдено</h3>
          <p>${escapeHtmlAttribute(err.message)}</p>
          <a href="#/publishers" class="pub-detail-action-btn" style="margin-top:8px;">← Назад до видавництв</a>
        </div>
      </div>
    `;
  }
}

// ── Build HTML ────────────────────────────────────────
function buildDetailHTML(pub, edits = []) {
  const latestVolumes = pub.latest_volumes || [];
  const latestIssues = pub.latest_issues || [];
  const latestCollections = pub.latest_collections || [];

  const workTypeText = getWorkTypeText(pub.work_type);
  const volumeCount = pub.volume_count || 0;

  // Location string
  const locationParts = [pub.place, pub.country].filter(Boolean);
  const location = locationParts.join(', ');

  // Aliases
  const aliases = parseAliases(pub.aliases);

  return `
    <div class="pub-detail">
      <!-- Hero Band -->
      <section class="pub-detail-hero-band">
        <div class="container pub-detail-hero">
          <!-- Logo Column -->
          <div class="pub-detail-logo-col">
            <div class="pub-detail-logo">${logoHTML(pub)}</div>
          </div>

          <!-- Info Column -->
          <div class="pub-detail-info">
            <h1>${escapeHtmlAttribute(pub.name)}</h1>

            <div class="pub-detail-badges-row">
              ${statusBadgeHTML(pub)}
              ${workTypeBadgesHTML(pub.work_type)}
            </div>

            <div class="pub-detail-meta-row">
              ${pub.founded_date ? `<span class="pub-detail-meta-item">${icon('calendar', 14, { strokeWidth: 2.1 })} засновано: <strong>${escapeHtmlAttribute(pub.founded_date)}</strong></span>` : ''}
              ${location ? `<span class="pub-detail-meta-item">${icon('mapPin', 14, { strokeWidth: 2.1 })} ${escapeHtmlAttribute(location)}</span>` : ''}
            </div>

            <div class="pub-detail-actions">
              <a href="#/catalog?publisher_ids=${pub.id}" class="pub-detail-action-btn pub-detail-action-btn--primary">
                ${icon('book', 14, { strokeWidth: 2.1 })} Всі серії у каталозі
              </a>
              ${pub.website ? `
                <a href="${escapeHtmlAttribute(pub.website)}" class="pub-detail-action-btn" target="_blank" rel="noopener noreferrer">
                  ${icon('globe', 14, { strokeWidth: 2.1 })} Сайт ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                </a>
              ` : ''}
            </div>
          </div>

          ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'pub-edit-btn', editTitle: 'Редагувати' })}
        </div>
      </section>

      <!-- Tabs Bar -->
      <div class="pub-detail-tabs-band">
        <div class="container">
          <div class="pub-detail-tabs" role="tablist">
            <button class="pub-detail-tab-btn is-active" data-tab="overview" role="tab" aria-selected="true">
              Огляд
            </button>
            <button class="pub-detail-tab-btn" data-tab="volumes" role="tab" aria-selected="false">
              Серії <span class="tab-count">${volumeCount.toLocaleString('uk-UA')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Panes -->
      <div class="container" style="margin-top: 0;">
        <!-- Overview -->
        <div class="pub-detail-pane is-active" data-pane="overview">
          <div class="pub-detail-overview">
            <!-- Info block -->
            <aside>
              <div class="pub-detail-info-block">
                <div class="pub-detail-info-block-title">Інформація</div>
                <ul class="pub-detail-fact-list">
                  ${factItemHTML('Статус', statusBadgeHTML(pub))}
                  ${factItemHTML('Тип', workTypeText ? escapeHtmlAttribute(workTypeText) : null)}
                  ${factItemHTML('Засновано', pub.founded_date ? escapeHtmlAttribute(pub.founded_date) : null)}
                  ${factItemHTML('Країна', pub.country ? escapeHtmlAttribute(pub.country) : null)}
                  ${factItemHTML('Місто', pub.place ? escapeHtmlAttribute(pub.place) : null)}
                  ${factItemHTML('Адреса', pub.address ? escapeHtmlAttribute(pub.address) : null)}
                  ${factItemHTML('Сайт', pub.website ? `<a href="${escapeHtmlAttribute(pub.website)}" target="_blank" rel="noopener">${escapeHtmlAttribute(pub.website)} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
                  ${factItemHTML('Псевдоніми', aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML('CV ID', pub.cv_id ? `<a href="https://comicvine.gamespot.com/publisher/${pub.cv_slug || pub.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(pub.cv_id))} ${icon('externalLink', 12, { strokeWidth: 2.2 })}</a>` : null)}
                </ul>
              </div>
            </aside>

            <!-- Recent releases column (3 blocks) -->
            <div class="entity-recent-col">
              <!-- New Series -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Нові серії</span>
                  <a href="#/catalog?publisher_ids=${pub.id}" class="entity-section-link">
                    Всі серії ${icon('chevronRight', 14, { strokeWidth: 2.2 })}
                  </a>
                </div>
                ${latestVolumes.length > 0
                  ? `<div class="entity-releases-grid">${latestVolumes.map(volumeReleaseCardHTML).join('')}</div>`
                  : `<div class="entity-releases-empty">Серій поки немає</div>`
                }
              </div>

              <!-- Latest Issues -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Крайні випуски</span>
                  <a href="#/catalog?publisher_ids=${pub.id}&mode=issues" class="entity-section-link">
                    Всі випуски ${icon('chevronRight', 14, { strokeWidth: 2.2 })}
                  </a>
                </div>
                ${latestIssues.length > 0
                  ? `<div class="entity-releases-grid">${latestIssues.map(issueReleaseCardHTML).join('')}</div>`
                  : `<div class="entity-releases-empty">Випусків поки немає</div>`
                }
              </div>

              <!-- New Collections -->
              <div class="entity-recent-section">
                <div class="entity-section-header">
                  <span class="entity-section-title">Нові збірники</span>
                  <a href="#/catalog?publisher_ids=${pub.id}&mode=collections" class="entity-section-link">
                    Всі збірники ${icon('chevronRight', 14, { strokeWidth: 2.2 })}
                  </a>
                </div>
                ${latestCollections.length > 0
                  ? `<div class="entity-releases-grid">${latestCollections.map(collectionReleaseCardHTML).join('')}</div>`
                  : `<div class="entity-releases-empty">Збірників поки немає</div>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Volumes tab -->
        <div class="pub-detail-pane" data-pane="volumes">
          <div class="pub-detail-volumes-pane">
            <div id="pub-volumes-filter-bar-container" style="margin-bottom: 20px;"></div>
            <div id="pub-volumes-grid" class="pub-detail-volume-grid">
              ${buildVolumeSkeletons(8)}
            </div>
            <div id="pub-volumes-pagination" style="margin-top: 24px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildVolumeSkeletons(count) {
  return Array.from({ length: count }).map(() =>
    `<div class="skeleton" style="aspect-ratio: 2/3; border-radius: var(--r-lg);"></div>`
  ).join('');
}

// ── Tab switching ─────────────────────────────────────
function initTabs(container, pub, publisherId) {
  const tabs = container.querySelectorAll('.pub-detail-tab-btn');
  const panes = container.querySelectorAll('.pub-detail-pane');

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

      // Lazy load volumes tab
      if (target === 'volumes') {
        const filterContainer = container.querySelector('#pub-volumes-filter-bar-container');
        if (filterContainer && !filterContainer.querySelector('.filter-bar')) {
          mountVolumesFilterBar(container, publisherId);
        }
      }
    });
  });
}

function mountVolumesFilterBar(container, publisherId) {
  const filterContainer = container.querySelector('#pub-volumes-filter-bar-container');
  if (!filterContainer) return;

  const filterBar = mountFilterBar(filterContainer, {
    resultsCount: 0,
    resultsLabel: 'Знайдено',
    showResults: true,
    showSearch: true,
    searchPlaceholder: 'Шукати в серіях...',
    searchValue: volumesSearchQuery,
    onSearch: (val) => {
      volumesSearchQuery = val;
      volumesPaginator.reset();
      fetchAndRenderVolumes(container, publisherId, filterBar);
    },
    showSort: false,
    showSortOrder: false,
    extraMiddleHtml: `
      <div class="wanted-ct-group" role="group">
        <button class="wanted-ct-btn ${currentVolType === 'volumes' ? 'is-active' : ''}" data-type="volumes">Серії</button>
        <button class="wanted-ct-btn ${currentVolType === 'collections' ? 'is-active' : ''}" data-type="collections">Збірники</button>
      </div>
    `
  });

  // Bind click event to type select buttons
  filterContainer.querySelectorAll('.wanted-ct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === currentVolType) return;

      filterContainer.querySelectorAll('.wanted-ct-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      currentVolType = type;
      volumesPaginator.reset();
      fetchAndRenderVolumes(container, publisherId, filterBar);
    });
  });

  // Initial load
  fetchAndRenderVolumes(container, publisherId, filterBar);
}

// ── Volumes loading ───────────────────────────────────
async function fetchAndRenderVolumes(container, publisherId, filterBar) {
  const grid = container.querySelector('#pub-volumes-grid');
  const paginationWrap = container.querySelector('#pub-volumes-pagination');
  if (!grid) return;

  grid.innerHTML = buildVolumeSkeletons(12);

  const params = {
    publisher_ids: publisherId,
    mode: 'volumes',
    search: volumesSearchQuery || undefined,
    page: volumesPaginator.getPage(),
    limit: volumesPaginator.getPageSize(),
  };

  if (currentVolType === 'volumes') {
    params.exclude_theme_ids = '44';
  } else if (currentVolType === 'collections') {
    params.theme_ids = '44';
  }

  try {
    const data = await API.get('/catalog', params);

    const items = data.items || [];
    if (filterBar) {
      filterBar.updateCount(data.total || 0);
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="pub-detail-empty" style="grid-column: 1 / -1;">
          ${icon('book', 14, { strokeWidth: 2.1 })}
          <h3>Серій не знайдено</h3>
          <p>У цього видавництва поки немає серій у каталозі</p>
        </div>
      `;
      if (paginationWrap) paginationWrap.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
      item.type = 'volume';
      const card = createComicCard(item);
      grid.appendChild(card);
    });

    if (paginationWrap) {
      paginationWrap.innerHTML = '';
      paginationWrap.appendChild(volumesPaginator.render(data.total, () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchAndRenderVolumes(container, publisherId, filterBar);
      }));
    }

  } catch (err) {
    grid.innerHTML = `
      <div class="pub-detail-empty" style="grid-column: 1 / -1;">
        ${icon('imagePlaceholder', 36, { strokeWidth: 1.5 })}
        <h3>Помилка завантаження</h3>
        <p>${escapeHtmlAttribute(err.message)}</p>
      </div>
    `;
  }
}
