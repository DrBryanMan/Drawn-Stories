import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createPaginator } from '../components/Pagination.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { getPublisherColor } from '../helpers/publisher.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';

let currentVolType = 'volumes'; // 'volumes' | 'collections'
let volumesSearchQuery = '';

// ── Lucide icons ──────────────────────────────────────
const ICON = {
  calendar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  mapPin:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  globe:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  layers:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  book:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  check:        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  circle:       '<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="12"/></svg>',
  image:        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  filter:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
};

// ── Paginator instance (for volumes tab) ─────────────
const volumesPaginator = createPaginator({ pageSize: 24 });

// ── Helpers ───────────────────────────────────────────
function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function workTypeLabel(workType) {
  if (!workType) return null;
  const map = { manga: 'Манґа', comics: 'Комікси', mixed: 'Змішане' };
  return workType.split(',').map(s => map[s.trim().toLowerCase()] || s.trim()).join(', ');
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
  const imgUrl = normalizeImageUrl(vol.cover_img || vol.image);
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || 'Без назви');
  const issueCount = vol.issue_count || 0;
  const coverHtml = imgUrl
    ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${title}" loading="lazy">`
    : `<div class="entity-release-cover-empty">${ICON.image}</div>`;

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
    : `<div class="entity-release-cover-empty">${ICON.image}</div>`;

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
    : `<div class="entity-release-cover-empty">${ICON.image}</div>`;

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

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    document.body.classList.add('modal-open');
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    const openModals = document.querySelectorAll('.ds-modal-overlay[style*="display: flex"], .ds-modal-overlay[style*="display: block"]');
    if (openModals.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }
}

function editModalHTML(pub) {
  const statusOptions = `
    <option value="active" ${pub.status === 'active' || pub.status === 'активне' || pub.status === 'активна' ? 'selected' : ''}>Активне</option>
    <option value="inactive" ${pub.status === 'inactive' || pub.status === 'неактивне' || pub.status === 'неактивна' ? 'selected' : ''}>Неактивне</option>
  `;
  
  const typeOptions = `
    <option value="comics" ${pub.work_type === 'comics' ? 'selected' : ''}>Комікси</option>
    <option value="manga" ${pub.work_type === 'manga' ? 'selected' : ''}>Манґа</option>
    <option value="mixed" ${pub.work_type === 'mixed' ? 'selected' : ''}>Змішане</option>
  `;

  return `
    <div class="ds-modal-overlay" id="pub-edit-modal" style="display: none;">
      <div class="ds-modal ds-modal--large" id="pub-edit-modal-box">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.edit} Редагувати видавництво</div>
          <button class="ds-modal-close" type="button" data-close-modal="pub-edit-modal">&times;</button>
        </div>
        <form id="pub-edit-form">
          <div class="ds-modal-body">
            <div class="admin-form-grid">
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Назва</label>
                <input type="text" name="name" class="admin-input" value="${escapeHtmlAttribute(pub.name || '')}" required>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Статус</label>
                <select name="status" class="admin-input">${statusOptions}</select>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Тип роботи</label>
                <select name="work_type" class="admin-input">${typeOptions}</select>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Рік заснування</label>
                <input type="text" name="founded_date" class="admin-input" value="${escapeHtmlAttribute(pub.founded_date || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Веб-сайт</label>
                <input type="url" name="website" class="admin-input" value="${escapeHtmlAttribute(pub.website || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Країна</label>
                <input type="text" name="country" class="admin-input" value="${escapeHtmlAttribute(pub.country || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Місто</label>
                <input type="text" name="place" class="admin-input" value="${escapeHtmlAttribute(pub.place || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Адреса</label>
                <input type="text" name="address" class="admin-input" value="${escapeHtmlAttribute(pub.address || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">URL зображення (логотипу)</label>
                <input type="url" name="image" class="admin-input" value="${escapeHtmlAttribute(pub.image || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Псевдоніми (через кому)</label>
                <input type="text" name="aliases" class="admin-input" value="${escapeHtmlAttribute(pub.aliases || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">ComicVine ID</label>
                <input type="number" name="cv_id" class="admin-input" value="${pub.cv_id || ''}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">ComicVine Slug</label>
                <input type="text" name="cv_slug" class="admin-input" value="${escapeHtmlAttribute(pub.cv_slug || '')}">
              </div>
            </div>
          </div>
          <div class="ds-modal-footer">
            <button class="btn-admin btn-admin--secondary" type="button" data-close-modal="pub-edit-modal">Скасувати</button>
            <button class="btn-admin btn-admin--primary" type="submit">Зберегти зміни</button>
          </div>
        </form>
      </div>
    </div>
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

    container.innerHTML = buildDetailHTML(pub);

    initTabs(container, pub, id);
    volumesPaginator.reset();

    // Bind modal controls
    if (isModerator()) {
      container.querySelector('#pub-edit-btn')?.addEventListener('click', () => openModal('pub-edit-modal'));
      
      container.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
      });

      container.querySelector('#pub-edit-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await API.put(`/publishers/${id}`, {
            name: form.get('name')?.trim(),
            status: form.get('status')?.trim(),
            work_type: form.get('work_type')?.trim(),
            founded_date: form.get('founded_date')?.trim() || null,
            website: form.get('website')?.trim() || null,
            country: form.get('country')?.trim() || null,
            place: form.get('place')?.trim() || null,
            address: form.get('address')?.trim() || null,
            image: form.get('image')?.trim() || null,
            aliases: form.get('aliases')?.trim() || null,
            cv_id: form.get('cv_id') ? Number(form.get('cv_id')) : null,
            cv_slug: form.get('cv_slug')?.trim() || null,
          });
          closeModal('pub-edit-modal');
          // Re-render page
          await renderPublisherDetail(container, params);
        } catch (e) {
          alert('Помилка при збереженні: ' + e.message);
        }
      });
    }

  } catch (err) {
    container.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="pub-detail-empty">
          ${ICON.image}
          <h3>Видавництво не знайдено</h3>
          <p>${escapeHtmlAttribute(err.message)}</p>
          <a href="#/publishers" class="pub-detail-action-btn" style="margin-top:8px;">← Назад до видавництв</a>
        </div>
      </div>
    `;
  }
}

// ── Build HTML ────────────────────────────────────────
function buildDetailHTML(pub) {
  const latestVolumes = pub.latest_volumes || [];
  const latestIssues = pub.latest_issues || [];
  const latestCollections = pub.latest_collections || [];

  const wt = workTypeLabel(pub.work_type);
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
              ${wt ? `<span class="pub-detail-type-badge">${ICON.layers} ${escapeHtmlAttribute(wt)}</span>` : ''}
            </div>

            <div class="pub-detail-meta-row">
              ${pub.founded_date ? `<span class="pub-detail-meta-item">${ICON.calendar} засновано: <strong>${escapeHtmlAttribute(pub.founded_date)}</strong></span>` : ''}
              ${location ? `<span class="pub-detail-meta-item">${ICON.mapPin} ${escapeHtmlAttribute(location)}</span>` : ''}
            </div>

            <div class="pub-detail-actions">
              <a href="#/catalog?publisher_ids=${pub.id}" class="pub-detail-action-btn pub-detail-action-btn--primary">
                ${ICON.book} Всі серії у каталозі
              </a>
              ${pub.website ? `
                <a href="${escapeHtmlAttribute(pub.website)}" class="pub-detail-action-btn" target="_blank" rel="noopener noreferrer">
                  ${ICON.globe} Сайт ${ICON.externalLink}
                </a>
              ` : ''}
              ${isModerator() ? `
                <button class="pub-detail-action-btn" id="pub-edit-btn">
                  ${ICON.edit} Редагувати
                </button>
              ` : ''}
            </div>
          </div>
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
              ${ICON.book} Серії <span class="tab-count">${volumeCount.toLocaleString('uk-UA')}</span>
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
                  ${factItemHTML('Тип', wt ? escapeHtmlAttribute(wt) : null)}
                  ${factItemHTML('Засновано', pub.founded_date ? escapeHtmlAttribute(pub.founded_date) : null)}
                  ${factItemHTML('Країна', pub.country ? escapeHtmlAttribute(pub.country) : null)}
                  ${factItemHTML('Місто', pub.place ? escapeHtmlAttribute(pub.place) : null)}
                  ${factItemHTML('Адреса', pub.address ? escapeHtmlAttribute(pub.address) : null)}
                  ${factItemHTML('Сайт', pub.website ? `<a href="${escapeHtmlAttribute(pub.website)}" target="_blank" rel="noopener">${escapeHtmlAttribute(pub.website)} ${ICON.externalLink}</a>` : null)}
                  ${factItemHTML('Псевдоніми', aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML('CV ID', pub.cv_id ? `<a href="https://comicvine.gamespot.com/publisher/${pub.cv_slug || pub.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(pub.cv_id))} ${ICON.externalLink}</a>` : null)}
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
                    Всі серії ${ICON.chevronRight}
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
                    Всі випуски ${ICON.chevronRight}
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
                    Всі збірники ${ICON.chevronRight}
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

      <!-- Edit Modal Overlay -->
      ${isModerator() ? editModalHTML(pub) : ''}
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
          ${ICON.book}
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
        ${ICON.image}
        <h3>Помилка завантаження</h3>
        <p>${escapeHtmlAttribute(err.message)}</p>
      </div>
    `;
  }
}
