import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { createPaginator } from '../components/Pagination.js';
import { createComicCard } from '../components/cards/ComicCard.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';

// ── Lucide icons ──────────────────────────────────────
const ICON = {
  calendar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  mapPin:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  globe:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  user:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  book:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  image:        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  layers:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
};

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

function editModalHTML(person) {
  const genderOptions = `
    <option value="" ${!person.gender ? 'selected' : ''}>Не вказано</option>
    <option value="1" ${person.gender === 1 ? 'selected' : ''}>Чоловік</option>
    <option value="2" ${person.gender === 2 ? 'selected' : ''}>Жінка</option>
  `;

  return `
    <div class="ds-modal-overlay" id="person-edit-modal" style="display: none;">
      <div class="ds-modal ds-modal--large" id="person-edit-modal-box">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.edit} Редагувати дані особи</div>
          <button class="ds-modal-close" type="button" data-close-modal="person-edit-modal">&times;</button>
        </div>
        <form id="person-edit-form">
          <div class="ds-modal-body">
            <div class="admin-form-grid">
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Ім'я (англійською / оригінал)</label>
                <input type="text" name="name" class="admin-input" value="${escapeHtmlAttribute(person.name || '')}" required>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Ім'я українською</label>
                <input type="text" name="name_uk" class="admin-input" value="${escapeHtmlAttribute(person.name_uk || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Псевдонім</label>
                <input type="text" name="pseudo" class="admin-input" value="${escapeHtmlAttribute(person.pseudo || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Професія / Заняття</label>
                <input type="text" name="occupation" class="admin-input" value="${escapeHtmlAttribute(person.occupation || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Стать</label>
                <select name="gender" class="admin-input">${genderOptions}</select>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Дата народження</label>
                <input type="text" name="birth" class="admin-input" value="${escapeHtmlAttribute(person.birth || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Дата смерті</label>
                <input type="text" name="death" class="admin-input" value="${escapeHtmlAttribute(person.death || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Країна</label>
                <input type="text" name="country" class="admin-input" value="${escapeHtmlAttribute(person.country || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Рідне місто</label>
                <input type="text" name="hometown" class="admin-input" value="${escapeHtmlAttribute(person.hometown || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Веб-сайт</label>
                <input type="url" name="website" class="admin-input" value="${escapeHtmlAttribute(person.website || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">URL фото профілю</label>
                <input type="url" name="image" class="admin-input" value="${escapeHtmlAttribute(person.image || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Псевдоніми / Аліаси (через кому)</label>
                <input type="text" name="aliases" class="admin-input" value="${escapeHtmlAttribute(person.aliases || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">ComicVine ID</label>
                <input type="number" name="cv_id" class="admin-input" value="${person.cv_id || ''}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">ComicVine Slug</label>
                <input type="text" name="cv_slug" class="admin-input" value="${escapeHtmlAttribute(person.cv_slug || '')}">
              </div>
            </div>
          </div>
          <div class="ds-modal-footer">
            <button class="btn-admin btn-admin--secondary" type="button" data-close-modal="person-edit-modal">Скасувати</button>
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

    container.innerHTML = buildDetailHTML(person);

    initTabs(container, person, id);
    worksPaginator.reset();

    // Bind modal controls
    if (isModerator()) {
      container.querySelector('#person-edit-btn')?.addEventListener('click', () => openModal('person-edit-modal'));

      container.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
      });

      container.querySelector('#person-edit-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await API.put(`/personnel/${id}`, {
            name: form.get('name')?.trim(),
            name_uk: form.get('name_uk')?.trim() || null,
            pseudo: form.get('pseudo')?.trim() || null,
            occupation: form.get('occupation')?.trim() || null,
            gender: form.get('gender') ? Number(form.get('gender')) : null,
            birth: form.get('birth')?.trim() || null,
            death: form.get('death')?.trim() || null,
            country: form.get('country')?.trim() || null,
            hometown: form.get('hometown')?.trim() || null,
            website: form.get('website')?.trim() || null,
            image: form.get('image')?.trim() || null,
            aliases: form.get('aliases')?.trim() || null,
            cv_id: form.get('cv_id') ? Number(form.get('cv_id')) : null,
            cv_slug: form.get('cv_slug')?.trim() || null,
          });
          closeModal('person-edit-modal');
          // Re-render page
          await renderPersonnelDetail(container, params);
        } catch (e) {
          alert('Помилка при збереженні: ' + e.message);
        }
      });
    }

  } catch (err) {
    container.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="personnel-detail-empty">
          ${ICON.image}
          <h3>Особу не знайдено</h3>
          <p>${escapeHtmlAttribute(err.message)}</p>
          <a href="#/personnel" class="personnel-detail-action-btn" style="margin-top:8px;">← Назад до персоналу</a>
        </div>
      </div>
    `;
  }
}

// ── Build HTML ────────────────────────────────────────
function buildDetailHTML(person) {
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
      <!-- Breadcrumbs -->
      <div class="container">
        ${createBreadcrumbs([
          { label: t('personnel'), href: '#/personnel' },
          { label: displayName }
        ])}
      </div>

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
              ${person.occupation ? `<span class="personnel-detail-type-badge">${ICON.layers} ${escapeHtmlAttribute(person.occupation)}</span>` : ''}
              ${person.pseudo ? `<span class="personnel-detail-type-badge">${ICON.user} Псевдонім: ${escapeHtmlAttribute(person.pseudo)}</span>` : ''}
            </div>

            <div class="personnel-detail-meta-row">
              ${person.birth ? `<span class="personnel-detail-meta-item">${ICON.calendar} народження: <strong>${escapeHtmlAttribute(person.birth)}</strong></span>` : ''}
              ${location ? `<span class="personnel-detail-meta-item">${ICON.mapPin} ${escapeHtmlAttribute(location)}</span>` : ''}
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
                  ${ICON.globe} Сайт ${ICON.externalLink}
                </a>
              ` : ''}
              ${isModerator() ? `
                <button class="personnel-detail-action-btn" id="person-edit-btn">
                  ${ICON.edit} Редагувати
                </button>
              ` : ''}
            </div>
          </div>
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
              ${ICON.book} Роботи <span class="tab-count">${totalWorks.toLocaleString('uk-UA')}</span>
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
                  ${factItemHTML('Сайт', person.website ? `<a href="${escapeHtmlAttribute(person.website)}" target="_blank" rel="noopener">${escapeHtmlAttribute(person.website)} ${ICON.externalLink}</a>` : null)}
                  ${factItemHTML('Псевдоніми', aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML('CV ID', person.cv_id ? `<a href="https://comicvine.gamespot.com/person/${person.cv_slug || person.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(person.cv_id))} ${ICON.externalLink}</a>` : null)}
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

      <!-- Edit Modal Overlay -->
      ${isModerator() ? editModalHTML(person) : ''}
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
          ${ICON.book}
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
        ${ICON.image}
        <h3>Помилка завантаження</h3>
        <p>${escapeHtmlAttribute(err.message)}</p>
      </div>
    `;
  }
}
