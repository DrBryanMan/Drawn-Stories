import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { openAddIssueModal } from '../components/addIssueModal.js';

// ── Lucide Monotone Icons ────────────────────────────
const ICON = {
  user:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  book:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  layers:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  sparkles:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
  calendar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  globe:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  building:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
  externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  image:        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  users:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  male:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></svg>',
  female:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/></svg>'
};

function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

function genderText(g) {
  if (g === 1) return t('gender_male') || 'Чоловік';
  if (g === 2) return t('gender_female') || 'Жінка';
  return null;
}

function parsePersonas(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string' && data.trim()) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return [];
    }
  }
  return [];
}

function factItemHTML(iconSvg, label, valueHTML) {
  if (!valueHTML) return '';
  return `
    <li class="character-detail-fact-item">
      <div class="character-detail-fact-icon">${iconSvg}</div>
      <div class="character-detail-fact-content">
        <span class="character-detail-fact-label">${label}</span>
        <span class="character-detail-fact-value">${valueHTML}</span>
      </div>
    </li>
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

export async function renderCharacterDetail(container, params) {
  const characterId = params.id ? parseInt(params.id, 10) : null;
  if (!characterId) {
    container.innerHTML = `<div class="container"><div class="error-state">${t('loading_error')}</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="character-detail">
      <div class="loader-container" style="padding: 100px 0;"><div class="loader"></div></div>
    </div>
  `;

  try {
    const char = await API.get(`/characters/${characterId}`);
    document.title = `${char.name_uk || char.name} — Drawn Stories`;
    renderCharacterContent(container, char, params);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="container" style="padding: 60px 0;">
        <div class="error-state">
          <h3>${t('loading_error')}</h3>
          <p>${escapeHtmlAttribute(err.message || '')}</p>
        </div>
      </div>
    `;
  }
}

function renderCharacterContent(container, char, params) {
  const displayName = char.name_uk || char.name;
  const subName = [char.real_name_uk || char.real_name, char.name_native, char.name !== displayName ? char.name : null]
    .filter(Boolean).join(' • ');

  // Images gallery
  const images = [];
  if (char.image) images.push({ key: 'main', label: 'Основна', url: normalizeImageUrl(char.image) });
  if (char.portret_img) images.push({ key: 'portrait', label: 'Портрет', url: normalizeImageUrl(char.portret_img) });
  if (char.costume_img) images.push({ key: 'costume', label: 'Костюм', url: normalizeImageUrl(char.costume_img) });
  if (char.portret_costume_img) images.push({ key: 'portret_costume', label: 'Портрет у костюмі', url: normalizeImageUrl(char.portret_costume_img) });

  const activeImage = images.length > 0 ? images[0].url : null;
  const pubInfo = char.publisher_info;
  const firstApp = char.first_appearance_info;

  const volumes = char.volumes || [];
  const issues = char.issues || [];
  const mangaChapters = char.manga_chapters || [];
  const teams = char.teams || [];
  const aliases = parseAliases(char.aliases);
  const personas = parsePersonas(char.personas);
  const totalAppearances = volumes.length + issues.length + mangaChapters.length;

  // Persona Subpage Mode
  if (params && params.personaIdx !== undefined) {
    const pIdx = parseInt(params.personaIdx, 10);
    const persona = !isNaN(pIdx) && personas[pIdx] ? personas[pIdx] : null;

    if (persona) {
      const pTitle = persona.name_uk || persona.name;
      const pImg = persona.image ? normalizeImageUrl(persona.image) : activeImage;

      // Filter issues and volumes by persona_idx
      const personaIssues = issues.filter(iss => iss.persona_idx === pIdx);
      const personaVolumeIds = new Set(personaIssues.map(iss => iss.volume_id));
      const personaVolumes = volumes.filter(v => personaVolumeIds.has(v.id));

      container.innerHTML = `
        <div class="character-detail character-persona-detail">
          <!-- Breadcrumbs -->
          <div class="container">
            ${createBreadcrumbs([
              { label: t('characters'), href: '#/characters' },
              { label: displayName, href: `#/characters/${char.id}` },
              { label: pTitle }
            ])}
          </div>

          <!-- Hero Band (Simplified for Persona) -->
          <section class="character-detail-hero-band">
            <div class="container character-detail-hero">
              <div class="character-detail-avatar-col">
                <div class="character-detail-avatar-frame">
                  ${pImg 
                    ? `<img src="${escapeHtmlAttribute(pImg)}" alt="${escapeHtmlAttribute(pTitle)}">`
                    : `<div class="character-detail-avatar-empty">${ICON.user}<span>Без фото</span></div>`
                  }
                </div>
              </div>

              <div class="character-detail-info">
                <a href="#/characters/${char.id}" class="persona-back-link">
                  &larr; Назад до персонажа ${escapeHtmlAttribute(displayName)}
                </a>
                <h1 style="margin-top: 6px;">${escapeHtmlAttribute(pTitle)}</h1>
                ${persona.name_uk && persona.name !== persona.name_uk ? `<div class="character-detail-subname">${escapeHtmlAttribute(persona.name)}</div>` : ''}

                <div class="character-detail-badges" style="margin-top: 14px;">
                  ${persona.first_appearance || persona.issue_id ? `
                    <a href="${persona.issue_id ? `#/issues/${persona.issue_id}` : 'javascript:void(0)'}" class="character-badge">
                      ${ICON.sparkles} Перша поява: ${escapeHtmlAttribute(persona.first_appearance || `Випуск #${persona.issue_id}`)}
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          </section>

          <!-- Tab Pane: Appearances (Directly without top tabs bar) -->
          <div class="container" style="margin-top: 32px; margin-bottom: 48px;">
            <div class="personnel-detail-pane is-active" data-pane="appearances">
              <div class="appearances-filter-bar">
                <div class="appearances-subtabs">
                  <button class="subtab-btn active" data-subtab="volumes">Томи (${personaVolumes.length})</button>
                  <button class="subtab-btn" data-subtab="issues">Випуски (${personaIssues.length})</button>
                </div>
              </div>

              <div id="appearances-content">
                ${renderAppearancesHTML(personaVolumes, personaIssues, [], 'volumes')}
              </div>
            </div>
          </div>
        </div>
      `;

      setupEventListeners(container, char, personaVolumes, personaIssues, []);
      return;
    }
  }

  container.innerHTML = `
    <div class="character-detail">
      <!-- Breadcrumbs -->
      <div class="container">
        ${createBreadcrumbs([
          { label: t('characters'), href: '#/characters' },
          { label: displayName }
        ])}
      </div>

      <!-- Hero Band -->
      <section class="character-detail-hero-band">
        <div class="container character-detail-hero">
          <!-- Avatar Column -->
          <div class="character-detail-avatar-col">
            <div class="character-detail-avatar-frame">
              ${activeImage 
                ? `<img id="char-main-img" src="${escapeHtmlAttribute(activeImage)}" alt="${escapeHtmlAttribute(displayName)}">`
                : `<div class="character-detail-avatar-empty">${ICON.image}<span>Без фото</span></div>`
              }
            </div>
            ${images.length > 1 ? `
              <div class="character-detail-image-switcher">
                ${images.map((imgObj, idx) => `
                  <button class="character-img-thumb ${idx === 0 ? 'active' : ''}" data-url="${escapeHtmlAttribute(imgObj.url)}">
                    ${imgObj.label}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Info Column -->
          <div class="character-detail-info">
            <h1>${escapeHtmlAttribute(displayName)}</h1>
            ${subName ? `<div class="character-detail-subname">${escapeHtmlAttribute(subName)}</div>` : ''}

            <!-- Badges Row -->
            <div class="character-detail-badges">
              ${char.gender === 1 ? `<span class="character-badge gender-male">${ICON.male} ${t('gender_male')}</span>` : ''}
              ${char.gender === 2 ? `<span class="character-badge gender-female">${ICON.female} ${t('gender_female')}</span>` : ''}
              ${pubInfo ? `<a href="#/publishers/${pubInfo.id}" class="character-badge">${ICON.building} ${escapeHtmlAttribute(pubInfo.name)}</a>` : ''}
              ${char.origin ? `<span class="character-badge">${ICON.sparkles} ${escapeHtmlAttribute(char.origin)}</span>` : ''}
              ${char.earth ? `<span class="character-badge">${ICON.globe} ${escapeHtmlAttribute(char.earth)}</span>` : ''}
              ${char.franchise ? `<span class="character-badge">${ICON.book} ${escapeHtmlAttribute(char.franchise)}</span>` : ''}
            </div>

            <!-- Personas Cards Section in Hero -->
            ${personas.length > 0 ? `
              <div class="character-personas-section">
                <h3 class="character-personas-title">Інші особистості</h3>
                <div class="character-personas-grid">
                  ${personas.map((p, pIdx) => `
                    <a href="#/characters/${char.id}/persona/${pIdx}" class="character-persona-card">
                      <div class="character-persona-cover">
                        ${p.image 
                          ? `<img src="${escapeHtmlAttribute(normalizeImageUrl(p.image))}" alt="${escapeHtmlAttribute(p.name)}">`
                          : `<div class="character-persona-cover-empty">${ICON.user}</div>`
                        }
                      </div>
                      <div class="character-persona-info">
                        <span class="character-persona-name">${escapeHtmlAttribute(p.name_uk || p.name)}</span>
                        ${p.name_uk && p.name !== p.name_uk ? `<span class="character-persona-subname">${escapeHtmlAttribute(p.name)}</span>` : ''}
                        ${p.first_appearance || p.issue_id ? `
                          <div class="character-persona-first-app">
                            <span style="color: #6486d6ff;">Перша поява:</span><br>
                            <strong>${escapeHtmlAttribute(p.first_appearance || `Випуск #${p.issue_id}`)}</strong>
                          </div>
                        ` : ''}
                      </div>
                    </a>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Actions (Edit button as on Personnel page) -->
            <div class="personnel-detail-actions">
              ${isModerator() ? `
                <button class="personnel-detail-action-btn" id="char-edit-btn">
                  ${ICON.edit} Редагувати
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </section>

      <!-- Tabs Band with "Огляд", "Появи", "Команди" -->
      <div class="personnel-detail-tabs-band">
        <div class="container">
          <div class="personnel-detail-tabs" role="tablist">
            <button class="personnel-detail-tab-btn is-active" data-tab="overview" role="tab">
              Огляд
            </button>
            <button class="personnel-detail-tab-btn" data-tab="appearances" role="tab">
              ${ICON.book} Появи <span class="tab-count">${totalAppearances.toLocaleString('uk-UA')}</span>
            </button>
            ${teams.length > 0 ? `
              <button class="personnel-detail-tab-btn" data-tab="teams" role="tab">
                ${ICON.users} Команди <span class="tab-count">${teams.length}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Main Container -->
      <div class="container" style="margin-top: 0;">
        <!-- Tab 1: Overview -->
        <div class="personnel-detail-pane is-active" data-pane="overview">
          <div class="character-detail-overview">
            <!-- Sidebar Custom Character Info Block -->
            <aside>
              <div class="character-detail-info-block">
                <div class="character-detail-info-block-title">${ICON.user} Відомості</div>
                <ul class="character-detail-fact-list">
                  ${factItemHTML(ICON.sparkles, "Сутність", escapeHtmlAttribute(char.essence))}
                  ${char.real_name 
                    ? factItemHTML(ICON.user, "Геройське ім'я", escapeHtmlAttribute(char.name_uk || char.name))
                    : factItemHTML(ICON.user, "Справжнє ім'я", escapeHtmlAttribute(char.real_name_uk || char.real_name))
                  }
                  ${char.real_name 
                    ? factItemHTML(ICON.user, "Ім'я", escapeHtmlAttribute(char.real_name_uk || char.real_name))
                    : ''
                  }
                  ${factItemHTML(ICON.user, "Творці", escapeHtmlAttribute(char.creators))}
                  ${factItemHTML(char.gender === 1 ? ICON.male : ICON.female, "Стать", genderText(char.gender))}
                  ${factItemHTML(ICON.building, "Видавництво", pubInfo ? `<a href="#/publishers/${pubInfo.id}">${escapeHtmlAttribute(pubInfo.name)}</a>` : null)}
                  ${factItemHTML(ICON.sparkles, "Походження", escapeHtmlAttribute(char.origin))}
                  ${factItemHTML(ICON.book, "Франшиза", escapeHtmlAttribute(char.franchise))}
                  ${factItemHTML(ICON.globe, "Всесвіт / Земля", escapeHtmlAttribute(char.earth))}
                  ${factItemHTML(ICON.calendar, "Народження", escapeHtmlAttribute(char.birth))}
                  ${factItemHTML(ICON.calendar, "Смерть", escapeHtmlAttribute(char.death))}
                  ${factItemHTML(ICON.calendar, "Перша поява", firstApp 
                    ? `<a href="#/issues/${firstApp.id}">${escapeHtmlAttribute(firstApp.volume_name_uk || firstApp.volume_name)} #${firstApp.issue_number}</a>`
                    : (char.first_appearance ? `#${char.first_appearance}` : null))}
                  ${factItemHTML(ICON.sparkles, "Псевдоніми", aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML(ICON.externalLink, "ComicVine", char.cv_slug ? `<a href="https://comicvine.gamespot.com/${char.cv_slug}/4005-${char.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(char.cv_id || 'CV'))} ${ICON.externalLink}</a>` : null)}
                </ul>
              </div>
            </aside>

            <!-- Overview Right Column: Recent releases -->
            <div class="entity-recent-col">
              ${volumes.length > 0 ? `
                <div class="entity-recent-section">
                  <div class="entity-section-header">
                    <span class="entity-section-title">Серії / Томи</span>
                  </div>
                  <div class="entity-releases-grid">
                    ${volumes.slice(0, 8).map(v => renderVolumeCardHTML(v)).join('')}
                  </div>
                </div>
              ` : ''}

              ${issues.length > 0 ? `
                <div class="entity-recent-section" style="margin-top: 24px;">
                  <div class="entity-section-header">
                    <span class="entity-section-title">Випуски</span>
                  </div>
                  <div class="entity-releases-grid">
                    ${issues.slice(0, 12).map(i => renderIssueCardHTML(i)).join('')}
                  </div>
                </div>
              ` : ''}

              ${volumes.length === 0 && issues.length === 0 ? `<div class="entity-releases-empty">Даних немає</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Tab 2: Appearances Pane (Full width, no sidebar) -->
        <div class="personnel-detail-pane" data-pane="appearances" style="padding-top: 28px;">
          <div class="appearances-filter-bar">
            <!-- Requirement 4: First "Усі" subtab removed -->
            <div class="appearances-subtabs">
              <button class="subtab-btn active" data-subtab="volumes">Томи (${volumes.length})</button>
              <button class="subtab-btn" data-subtab="issues">Випуски (${issues.length})</button>
              ${mangaChapters.length > 0 ? `<button class="subtab-btn" data-subtab="manga">Глави мангі (${mangaChapters.length})</button>` : ''}
            </div>
          </div>

          <div id="appearances-content">
            ${renderAppearancesHTML(volumes, issues, mangaChapters, 'volumes')}
          </div>
        </div>

        <!-- Tab 3: Teams Pane (Full width, no sidebar) -->
        ${teams.length > 0 ? `
          <div class="personnel-detail-pane" data-pane="teams" style="padding-top: 28px;">
            <div class="character-teams-grid">
              ${teams.map(t => {
                const tName = escapeHtmlAttribute(t.name_uk || t.name);
                return `
                  <a href="#/teams/${t.id}" class="char-team-card">
                    <div class="char-team-avatar">${ICON.users}</div>
                    <div class="char-team-name">${tName}</div>
                  </a>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Edit Modal for Moderators -->
    ${isModerator() ? renderEditModalHTML(char) : ''}
  `;

  // Attach event listeners
  setupEventListeners(container, char, volumes, issues, mangaChapters);
}

function renderAppearancesHTML(volumes, issues, mangaChapters, filter) {
  if (filter === 'issues') {
    if (issues.length === 0) return `<div class="entity-releases-empty">Випусків не знайдено</div>`;
    return `
      <div class="entity-releases-grid">
        ${issues.map(i => renderIssueCardHTML(i)).join('')}
      </div>
    `;
  }

  if (filter === 'manga') {
    if (mangaChapters.length === 0) return `<div class="entity-releases-empty">Глав мангі не знайдено</div>`;
    return `
      <div class="entity-releases-grid">
        ${mangaChapters.map(mc => renderMangaChapterCardHTML(mc)).join('')}
      </div>
    `;
  }

  // Default filter: 'volumes'
  if (volumes.length === 0) return `<div class="entity-releases-empty">Томів не знайдено</div>`;
  return `
    <div class="entity-releases-grid">
      ${volumes.map(v => renderVolumeCardHTML(v)).join('')}
    </div>
  `;
}

function renderVolumeCardHTML(vol) {
  const cover = normalizeImageUrl(vol.cover_img || vol.image);
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || 'Без назви');
  const countText = vol.char_issue_count ? `${vol.char_issue_count} вип.` : `${vol.issue_count || 0} вип.`;

  return `
    <a href="#/volumes/${vol.id}" class="entity-release-card">
      <div class="entity-release-cover">
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="entity-release-cover-empty">${ICON.image}</div>`}
        <span class="entity-role-badge">${countText}</span>
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${title}">${title}</div>
        <div class="entity-release-sub">${vol.name || ''}</div>
      </div>
    </a>
  `;
}

function renderIssueCardHTML(issue) {
  const cover = normalizeImageUrl(issue.image);
  const volName = escapeHtmlAttribute(issue.volume_name_uk || issue.volume_name || '');
  const numText = issue.issue_number ? `#${issue.issue_number}` : '';
  const displayTitle = numText ? `${volName} ${numText}` : volName;
  const issueTitle = escapeHtmlAttribute(issue.name || '');

  return `
    <a href="#/issues/${issue.id}" class="entity-release-card">
      <div class="entity-release-cover">
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${displayTitle}" loading="lazy">` : `<div class="entity-release-cover-empty">${ICON.image}</div>`}
        ${issue.role ? `<span class="entity-role-badge">${escapeHtmlAttribute(issue.role)}</span>` : ''}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title" title="${displayTitle}">${displayTitle}</div>
        ${issueTitle ? `<div class="entity-release-sub" title="${issueTitle}">${issueTitle}</div>` : ''}
      </div>
    </a>
  `;
}

function renderMangaChapterCardHTML(mc) {
  const displayTitle = `Глава ${mc.chapter_number}`;
  const subTitle = escapeHtmlAttribute(mc.title || mc.volume_name || '');

  return `
    <a href="#/manga-chapters/${mc.id}" class="entity-release-card">
      <div class="entity-release-cover">
        <div class="entity-release-cover-empty">${ICON.book}</div>
        ${mc.role ? `<span class="entity-role-badge">${escapeHtmlAttribute(mc.role)}</span>` : ''}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title">${displayTitle}</div>
        ${subTitle ? `<div class="entity-release-sub">${subTitle}</div>` : ''}
      </div>
    </a>
  `;
}

function renderEditModalHTML(char) {
  const personas = parsePersonas(char.personas);
  const genderOptions = `
    <option value="" ${!char.gender ? 'selected' : ''}>Не вказано</option>
    <option value="1" ${char.gender === 1 ? 'selected' : ''}>Чоловік</option>
    <option value="2" ${char.gender === 2 ? 'selected' : ''}>Жінка</option>
  `;

  return `
    <div class="ds-modal-overlay" id="char-edit-modal" style="display: none;">
      <div class="ds-modal ds-modal--large">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.edit} Редагувати дані персонажа</div>
          <button class="ds-modal-close" type="button" data-close-modal="char-edit-modal">&times;</button>
        </div>
        <form id="char-edit-form">
          <div class="ds-modal-body">
            <div class="admin-form-grid">
              <!-- Group 1: Основні дані -->
              <div class="admin-form-section-title">Основні дані</div>

              <div class="admin-form-group">
                <label class="admin-label">Оригінальне ім'я *</label>
                <input type="text" name="name" class="admin-input" value="${escapeHtmlAttribute(char.name || '')}" required>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Українська назва/ім'я</label>
                <input type="text" name="name_uk" class="admin-input" value="${escapeHtmlAttribute(char.name_uk || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Справжнє ім'я (Оригінал)</label>
                <input type="text" name="real_name" class="admin-input" value="${escapeHtmlAttribute(char.real_name || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Справжнє ім'я (Українською)</label>
                <input type="text" name="real_name_uk" class="admin-input" value="${escapeHtmlAttribute(char.real_name_uk || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Стать</label>
                <select name="gender" class="admin-input">${genderOptions}</select>
              </div>
              <div class="admin-form-group">
                <label class="admin-label">Франшиза</label>
                <input type="text" name="franchise" class="admin-input" value="${escapeHtmlAttribute(char.franchise || '')}">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Земля / Всесвіт</label>
                <input type="text" name="earth" class="admin-input" value="${escapeHtmlAttribute(char.earth || '')}" placeholder="Наприклад: Earth-616, Earth-65">
              </div>
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Творці (пошук по персонах або введення)</label>
                <div class="creators-selector-container">
                  <div class="creators-badges-wrap" id="creators-badges-wrap"></div>
                  <div class="creator-search-box">
                    <input type="text" id="creator-search-input" class="admin-input" placeholder="Введіть ім'я творця для пошуку або додавання..." autocomplete="off">
                    <div class="creator-search-dropdown" id="creator-search-dropdown"></div>
                  </div>
                </div>
                <input type="hidden" name="creators" id="creators-hidden-input" value="${escapeHtmlAttribute(char.creators || '')}">
              </div>

              <!-- Group 2: Зображення -->
              <div class="admin-form-section-title">Зображення</div>

              <div class="admin-form-group">
                <label class="admin-label">URL Головного фото</label>
                <input type="text" name="image" class="admin-input" value="${escapeHtmlAttribute(char.image || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">URL Портрета</label>
                <input type="text" name="portret_img" class="admin-input" value="${escapeHtmlAttribute(char.portret_img || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">URL Костюма</label>
                <input type="text" name="costume_img" class="admin-input" value="${escapeHtmlAttribute(char.costume_img || '')}">
              </div>
              <div class="admin-form-group">
                <label class="admin-label">URL Портрета в костюмі</label>
                <input type="text" name="portret_costume_img" class="admin-input" value="${escapeHtmlAttribute(char.portret_costume_img || '')}">
              </div>

              <!-- Group 3: Окремі особистості (Personas) -->
              <div class="admin-form-section-title">Окремі особистості (Personas)</div>

              <div class="admin-form-group admin-form-group--full">
                <div class="personas-manager-container">
                  <div class="personas-list-wrap" id="personas-list-wrap"></div>
                  
                  <div class="persona-add-form">
                    <input type="text" id="persona-input-name" class="admin-input" placeholder="Назва особистості (Ghost-Spider)">
                    <input type="text" id="persona-input-name-uk" class="admin-input" placeholder="Українською (Привид-Павук)">
                    <input type="text" id="persona-input-image" class="admin-input" placeholder="URL фото / аватарки" style="grid-column: span 2;">
                    
                    <div class="persona-issue-search-box" style="grid-column: span 2; position: relative;">
                      <div style="display: flex; gap: 8px;">
                        <input type="text" id="persona-input-app" class="admin-input" placeholder="Перша поява (введіть назву/номер випуску для пошуку або довільний текст)" style="flex: 1;" autocomplete="off">
                        <button type="button" id="persona-open-issue-modal-btn" class="btn-admin btn-admin--secondary" style="white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                          ${ICON.book} База випусків
                        </button>
                      </div>
                      <div class="persona-issue-dropdown" id="persona-issue-dropdown"></div>
                      <div id="persona-selected-issue-container" style="margin-top: 4px;"></div>
                    </div>

                    <button type="button" id="persona-add-btn" class="btn-admin btn-admin--secondary" style="grid-column: span 2; margin-top: 4px;">+ Додати особистість до списку</button>
                  </div>
                </div>
                <input type="hidden" name="personas" id="personas-hidden-input" value="${escapeHtmlAttribute(JSON.stringify(personas))}">
              </div>
            </div>
          </div>
          <div class="ds-modal-footer">
            <button class="btn-admin btn-admin--secondary" type="button" data-close-modal="char-edit-modal">Скасувати</button>
            <button class="btn-admin btn-admin--primary" type="submit">Зберегти зміни</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function setupEventListeners(container, char, volumes, issues, mangaChapters) {
  // Image switcher
  const mainImg = container.querySelector('#char-main-img');
  container.querySelectorAll('.character-img-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.character-img-thumb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (mainImg) {
        mainImg.src = btn.dataset.url;
      }
    });
  });

  // Main Tabs switching
  container.querySelectorAll('.personnel-detail-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      container.querySelectorAll('.personnel-detail-tab-btn').forEach(b => b.classList.remove('is-active'));
      container.querySelectorAll('.personnel-detail-pane').forEach(p => p.classList.remove('is-active'));

      btn.classList.add('is-active');
      const targetPane = container.querySelector(`.personnel-detail-pane[data-pane="${tabId}"]`);
      if (targetPane) targetPane.classList.add('is-active');
    });
  });

  // Appearances Subtabs switching
  const appearancesContent = container.querySelector('#appearances-content');
  container.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subtab = btn.dataset.subtab;
      container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (appearancesContent) {
        appearancesContent.innerHTML = renderAppearancesHTML(volumes, issues, mangaChapters, subtab);
      }
    });
  });

  // Modal controls
  if (isModerator()) {
    container.querySelector('#char-edit-btn')?.addEventListener('click', () => openModal('char-edit-modal'));

    container.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    container.querySelectorAll('.ds-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Creators Selector Logic
    let personas = [...parsePersonas(char.personas)];

    const creatorsBadgesWrap = container.querySelector('#creators-badges-wrap');
    const creatorSearchInput = container.querySelector('#creator-search-input');
    const creatorSearchDropdown = container.querySelector('#creator-search-dropdown');
    const creatorsHiddenInput = container.querySelector('#creators-hidden-input');

    if (creatorsBadgesWrap && creatorSearchInput && creatorSearchDropdown) {
      let selectedCreators = char.creators 
        ? char.creators.split(/[,;]/).map(c => c.trim()).filter(Boolean)
        : [];
      let creatorDetails = {}; // Cache person details { name_lowercase: { image, name_uk } }

      // Prefetch person info for initial creators if possible
      if (selectedCreators.length > 0) {
        API.get('/personnel', { search: selectedCreators[0], limit: 10 }).then(res => {
          (res.items || []).forEach(p => {
            creatorDetails[p.name.toLowerCase()] = p;
            if (p.name_uk) creatorDetails[p.name_uk.toLowerCase()] = p;
          });
          updateCreatorsState();
        }).catch(() => {});
      }

      const updateCreatorsState = () => {
        creatorsHiddenInput.value = selectedCreators.join(', ');

        if (selectedCreators.length === 0) {
          creatorsBadgesWrap.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">Творців не обрано</span>`;
          return;
        }

        creatorsBadgesWrap.innerHTML = selectedCreators.map(name => {
          const detail = creatorDetails[name.toLowerCase()] || {};
          const imgUrl = detail.image ? normalizeImageUrl(detail.image) : null;
          const displayName = escapeHtmlAttribute(name);

          return `
            <span class="creator-badge-tag">
              <span class="creator-badge-avatar">
                ${imgUrl ? `<img src="${escapeHtmlAttribute(imgUrl)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.user}
              </span>
              <span>${displayName}</span>
              <button type="button" class="creator-badge-remove" data-remove-name="${displayName}">&times;</button>
            </span>
          `;
        }).join('');

        // Remove button listener
        creatorsBadgesWrap.querySelectorAll('.creator-badge-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nameToRemove = btn.dataset.removeName;
            selectedCreators = selectedCreators.filter(c => c.toLowerCase() !== nameToRemove.toLowerCase());
            updateCreatorsState();
          });
        });
      };

      const addCreator = (name, personDetail = null) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        
        const exists = selectedCreators.some(c => c.toLowerCase() === trimmed.toLowerCase());
        if (!exists) {
          selectedCreators.push(trimmed);
          if (personDetail) {
            creatorDetails[trimmed.toLowerCase()] = personDetail;
          }
          updateCreatorsState();
        }
        creatorSearchInput.value = '';
        creatorSearchDropdown.classList.remove('active');
      };

      updateCreatorsState();

      // Search input typing handler with debounce
      let searchDebounceTimer = null;
      creatorSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchDebounceTimer);

        if (query.length < 2) {
          creatorSearchDropdown.classList.remove('active');
          return;
        }

        searchDebounceTimer = setTimeout(async () => {
          try {
            const res = await API.get('/personnel', { search: query, limit: 6 });
            const items = res.items || [];

            if (items.length === 0) {
              creatorSearchDropdown.innerHTML = `
                <div class="creator-search-item" id="add-custom-creator-btn">
                  <div class="creator-search-avatar">${ICON.user}</div>
                  <div class="creator-search-info">
                    <span class="creator-search-name">Додати "${escapeHtmlAttribute(query)}"</span>
                    <span class="creator-search-sub">Персону не знайдено в БД, додати текстове ім'я</span>
                  </div>
                </div>
              `;
              creatorSearchDropdown.classList.add('active');

              const addBtn = creatorSearchDropdown.querySelector('#add-custom-creator-btn');
              if (addBtn) {
                addBtn.addEventListener('click', () => addCreator(query));
              }
              return;
            }

            creatorSearchDropdown.innerHTML = items.map(person => {
              const pName = person.name_uk || person.name;
              const pImg = normalizeImageUrl(person.image);
              const isAlreadyAdded = selectedCreators.some(c => c.toLowerCase() === person.name.toLowerCase() || c.toLowerCase() === pName.toLowerCase());

              return `
                <div class="creator-search-item" data-person-name="${escapeHtmlAttribute(person.name)}" data-person-img="${escapeHtmlAttribute(person.image || '')}">
                  <div class="creator-search-avatar">
                    ${pImg ? `<img src="${escapeHtmlAttribute(pImg)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.user}
                  </div>
                  <div class="creator-search-info">
                    <span class="creator-search-name">${escapeHtmlAttribute(pName)}</span>
                    ${person.name !== pName ? `<span class="creator-search-sub">${escapeHtmlAttribute(person.name)}</span>` : ''}
                  </div>
                  ${isAlreadyAdded ? `<span style="margin-left:auto; font-size:11px; color:var(--accent); font-weight:700;">Обрано</span>` : ''}
                </div>
              `;
            }).join('');

            creatorSearchDropdown.classList.add('active');

            // Attach item click listeners
            creatorSearchDropdown.querySelectorAll('.creator-search-item').forEach(item => {
              item.addEventListener('click', () => {
                const pName = item.dataset.personName;
                const pImg = item.dataset.personImg;
                addCreator(pName, { image: pImg });
              });
            });

          } catch (err) {
            console.error(err);
          }
        }, 250);
      });

      // Enter key listener on search input
      creatorSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = creatorSearchInput.value.trim();
          if (query) {
            addCreator(query);
          }
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) return;
        if (!creatorSearchInput.contains(e.target) && !creatorSearchDropdown.contains(e.target)) {
          creatorSearchDropdown.classList.remove('active');
        }
      });
    }

    // Personas JSONB Manager Logic
    const personasListWrap = container.querySelector('#personas-list-wrap');
    const personasHiddenInput = container.querySelector('#personas-hidden-input');
    const personaAddBtn = container.querySelector('#persona-add-btn');
    const personaOpenIssueBtn = container.querySelector('#persona-open-issue-modal-btn');
    const personaSelectedIssueContainer = container.querySelector('#persona-selected-issue-container');
    let selectedPersonaIssue = null;

    const renderSelectedPersonaIssue = () => {
      if (!personaSelectedIssueContainer) return;
      if (!selectedPersonaIssue) {
        personaSelectedIssueContainer.innerHTML = '';
        return;
      }
      personaSelectedIssueContainer.innerHTML = `
        <div class="persona-selected-issue-tag">
          ${ICON.book} <span>Випуск #${selectedPersonaIssue.id}: ${escapeHtmlAttribute(selectedPersonaIssue.title)}</span>
          <button type="button" class="creator-badge-remove" id="remove-persona-issue-btn">&times;</button>
        </div>
      `;
      personaSelectedIssueContainer.querySelector('#remove-persona-issue-btn')?.addEventListener('click', () => {
        selectedPersonaIssue = null;
        renderSelectedPersonaIssue();
      });
    };

    if (personaOpenIssueBtn) {
      personaOpenIssueBtn.addEventListener('click', () => {
        openAddIssueModal({
          title: 'Вибрати випуск першої появи',
          layout: 'vertical',
          onAdd: async (selectedItems) => {
            if (selectedItems && selectedItems.length > 0) {
              const firstItem = selectedItems[0];
              const issueId = typeof firstItem === 'object' && firstItem !== null ? (firstItem.id || firstItem.issue_id) : firstItem;

              if (!issueId) return;

              try {
                const issue = await API.get(`/issues/${issueId}`);
                const volName = issue.volume_name_uk || issue.volume_name || '';
                const numText = issue.issue_number ? `#${issue.issue_number}` : '';
                const displayTitle = `${volName} ${numText}`.trim() || issue.name || `Випуск #${issueId}`;

                selectedPersonaIssue = {
                  id: issueId,
                  title: displayTitle
                };
                renderSelectedPersonaIssue();
                const appInp = container.querySelector('#persona-input-app');
                if (appInp) appInp.value = displayTitle;
              } catch (err) {
                console.error("Failed to fetch issue detail for persona first app:", err);
                selectedPersonaIssue = {
                  id: issueId,
                  title: `Випуск #${issueId}`
                };
                renderSelectedPersonaIssue();
              }
            }
          }
        });
      });
    }

    const personaInputApp = container.querySelector('#persona-input-app');
    const personaIssueDropdown = container.querySelector('#persona-issue-dropdown');

    if (personaInputApp && personaIssueDropdown) {
      let appSearchTimer = null;
      personaInputApp.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(appSearchTimer);

        if (selectedPersonaIssue) {
          selectedPersonaIssue = null;
          renderSelectedPersonaIssue();
        }

        if (query.length < 2) {
          personaIssueDropdown.classList.remove('active');
          return;
        }

        appSearchTimer = setTimeout(async () => {
          try {
            const params = { limit: 6 };
            if (/^\d+$/.test(query)) {
              params.ds_id = parseInt(query, 10);
            } else {
              params.search = query;
            }

            const res = await API.get('/issues', params);
            const items = res.data || res.items || (Array.isArray(res) ? res : []);

            if (items.length === 0) {
              personaIssueDropdown.innerHTML = `<div class="persona-issue-item" style="color:var(--text-muted); font-size:12px; padding:8px 12px;">Випусків не знайдено</div>`;
              personaIssueDropdown.classList.add('active');
              return;
            }

            personaIssueDropdown.innerHTML = items.map(iss => {
              const volName = iss.volume_name_uk || iss.volume_name || '';
              const numText = iss.issue_number ? `#${iss.issue_number}` : '';
              const titleText = `${volName} ${numText}`.trim() || iss.name || `Випуск #${iss.id}`;
              const imgUrl = normalizeImageUrl(iss.image);

              return `
                <div class="persona-issue-item" data-issue-id="${iss.id}" data-issue-title="${escapeHtmlAttribute(titleText)}">
                  ${imgUrl ? `<img src="${escapeHtmlAttribute(imgUrl)}" class="persona-issue-cover">` : `<div class="persona-issue-cover" style="display:flex;align-items:center;justify-content:center;">${ICON.book}</div>`}
                  <div style="display:flex; flex-direction:column; min-width:0;">
                    <span style="font-size:13px; font-weight:600; color:var(--text);">${escapeHtmlAttribute(titleText)}</span>
                    ${iss.name ? `<span style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtmlAttribute(iss.name)}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('');

            personaIssueDropdown.classList.add('active');

            personaIssueDropdown.querySelectorAll('.persona-issue-item').forEach(item => {
              item.addEventListener('click', () => {
                const issId = parseInt(item.dataset.issueId, 10);
                const issTitle = item.dataset.issueTitle;
                selectedPersonaIssue = { id: issId, title: issTitle };
                renderSelectedPersonaIssue();
                personaInputApp.value = issTitle;
                personaIssueDropdown.classList.remove('active');
              });
            });
          } catch (err) {
            console.error(err);
          }
        }, 250);
      });

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) return;
        if (!personaInputApp.contains(e.target) && !personaIssueDropdown.contains(e.target)) {
          personaIssueDropdown.classList.remove('active');
        }
      });
    }

    if (personasListWrap && personasHiddenInput) {
      let editingPersonaIdx = null;

      const updatePersonasState = () => {
        personasHiddenInput.value = JSON.stringify(personas);

        const personaAddForm = container.querySelector('.persona-add-form');
        const personaAddBtn = container.querySelector('#persona-add-btn');

        if (editingPersonaIdx !== null) {
          personaAddForm?.classList.add('editing');
          if (personaAddBtn) {
            personaAddBtn.textContent = 'Зберегти редагування особистості';
            personaAddBtn.className = 'btn-admin btn-admin--primary';
            personaAddBtn.style.gridColumn = 'span 2';
            personaAddBtn.style.marginTop = '4px';
          }
        } else {
          personaAddForm?.classList.remove('editing');
          if (personaAddBtn) {
            personaAddBtn.textContent = '+ Додати особистість до списку';
            personaAddBtn.className = 'btn-admin btn-admin--secondary';
            personaAddBtn.style.gridColumn = 'span 2';
            personaAddBtn.style.marginTop = '4px';
          }
        }

        if (personas.length === 0) {
          personasListWrap.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">Особистостей ще не додано</span>`;
          return;
        }

        personasListWrap.innerHTML = personas.map((p, idx) => {
          const pImg = p.image ? normalizeImageUrl(p.image) : null;
          const isEditingThis = editingPersonaIdx === idx;
          return `
            <div class="persona-item-chip ${isEditingThis ? 'active' : ''}">
              <div class="persona-chip-img">
                ${pImg ? `<img src="${escapeHtmlAttribute(pImg)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.user}
              </div>
              <div class="persona-chip-details">
                <span class="persona-chip-title">${escapeHtmlAttribute(p.name_uk || p.name)}</span>
                ${p.first_appearance || p.issue_id ? `<span class="persona-chip-sub">${escapeHtmlAttribute(p.first_appearance || `Випуск #${p.issue_id}`)}</span>` : ''}
              </div>
              <div class="persona-chip-actions">
                <button type="button" class="persona-chip-edit" data-persona-idx="${idx}" title="Редагувати особистість">${ICON.edit}</button>
                <button type="button" class="persona-chip-remove" data-persona-idx="${idx}" title="Видалити">&times;</button>
              </div>
            </div>
          `;
        }).join('');

        personasListWrap.querySelectorAll('.persona-chip-edit').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.personaIdx, 10);
            const p = personas[idx];
            if (!p) return;

            editingPersonaIdx = idx;

            const nameInput = container.querySelector('#persona-input-name');
            const nameUkInput = container.querySelector('#persona-input-name-uk');
            const imageInput = container.querySelector('#persona-input-image');
            const appInput = container.querySelector('#persona-input-app');

            if (nameInput) nameInput.value = p.name || '';
            if (nameUkInput) nameUkInput.value = p.name_uk || '';
            if (imageInput) imageInput.value = p.image || '';
            if (appInput) appInput.value = p.first_appearance || '';

            if (p.issue_id) {
              selectedPersonaIssue = {
                id: p.issue_id,
                title: p.first_appearance || `Випуск #${p.issue_id}`
              };
            } else {
              selectedPersonaIssue = null;
            }
            renderSelectedPersonaIssue();
            updatePersonasState();

            const personaAddForm = container.querySelector('.persona-add-form');
            personaAddForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        });

        personasListWrap.querySelectorAll('.persona-chip-remove').forEach(btn => {
          btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.personaIdx, 10);
            if (editingPersonaIdx === index) {
              editingPersonaIdx = null;
            } else if (editingPersonaIdx !== null && editingPersonaIdx > index) {
              editingPersonaIdx--;
            }
            personas.splice(index, 1);
            updatePersonasState();
          });
        });
      };

      updatePersonasState();

      if (personaAddBtn) {
        personaAddBtn.addEventListener('click', async () => {
          const nameInput = container.querySelector('#persona-input-name');
          const nameUkInput = container.querySelector('#persona-input-name-uk');
          const imageInput = container.querySelector('#persona-input-image');
          const appInput = container.querySelector('#persona-input-app');

          const pName = nameInput?.value.trim();
          if (!pName) {
            alert("Введіть назву особистості");
            return;
          }

          const manualApp = appInput?.value.trim() || null;
          let issueId = selectedPersonaIssue ? selectedPersonaIssue.id : null;
          let firstAppTitle = selectedPersonaIssue ? selectedPersonaIssue.title : null;

          if (!selectedPersonaIssue && manualApp) {
            if (/^\d+$/.test(manualApp)) {
              issueId = parseInt(manualApp, 10);
              try {
                const issue = await API.get(`/issues/${issueId}`);
                const volName = issue.volume_name_uk || issue.volume_name || '';
                const numText = issue.issue_number ? `#${issue.issue_number}` : '';
                firstAppTitle = `${volName} ${numText}`.trim() || issue.name || `Випуск #${issueId}`;
              } catch (err) {
                firstAppTitle = `Випуск #${issueId}`;
              }
            } else {
              firstAppTitle = manualApp;
            }
          }

          const personaObj = {
            name: pName,
            name_uk: nameUkInput?.value.trim() || null,
            image: imageInput?.value.trim() || null,
            first_appearance: firstAppTitle,
            issue_id: issueId
          };

          if (editingPersonaIdx !== null) {
            personas[editingPersonaIdx] = personaObj;
            editingPersonaIdx = null;
          } else {
            personas.push(personaObj);
          }

          selectedPersonaIssue = null;
          renderSelectedPersonaIssue();

          if (nameInput) nameInput.value = '';
          if (nameUkInput) nameUkInput.value = '';
          if (imageInput) imageInput.value = '';
          if (appInput) appInput.value = '';

          updatePersonasState();
        });
      }
    }

    const editForm = container.querySelector('#char-edit-form');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Auto-add pending persona input if user filled fields but forgot to click "+ Додати особистість"
        const pendingName = container.querySelector('#persona-input-name')?.value.trim();
        if (pendingName) {
          const pendingNameUk = container.querySelector('#persona-input-name-uk')?.value.trim();
          const pendingImage = container.querySelector('#persona-input-image')?.value.trim();
          const pendingApp = container.querySelector('#persona-input-app')?.value.trim();

          let issueId = selectedPersonaIssue ? selectedPersonaIssue.id : null;
          let firstAppTitle = selectedPersonaIssue ? selectedPersonaIssue.title : null;

          if (!selectedPersonaIssue && pendingApp) {
            if (/^\d+$/.test(pendingApp)) {
              issueId = parseInt(pendingApp, 10);
              try {
                const issue = await API.get(`/issues/${issueId}`);
                const volName = issue.volume_name_uk || issue.volume_name || '';
                const numText = issue.issue_number ? `#${issue.issue_number}` : '';
                firstAppTitle = `${volName} ${numText}`.trim() || issue.name || `Випуск #${issueId}`;
              } catch (err) {
                firstAppTitle = `Випуск #${issueId}`;
              }
            } else {
              firstAppTitle = pendingApp;
            }
          }

          personas.push({
            name: pendingName,
            name_uk: pendingNameUk || null,
            image: pendingImage || null,
            first_appearance: firstAppTitle,
            issue_id: issueId
          });
          if (typeof updatePersonasState === 'function') {
            updatePersonasState();
          }
        }

        const formData = new FormData(editForm);
        const data = {
          name: formData.get('name')?.trim(),
          name_uk: formData.get('name_uk')?.trim() || null,
          real_name: formData.get('real_name')?.trim() || null,
          real_name_uk: formData.get('real_name_uk')?.trim() || null,
          gender: formData.get('gender') ? Number(formData.get('gender')) : null,
          creators: formData.get('creators')?.trim() || null,
          franchise: formData.get('franchise')?.trim() || null,
          earth: formData.get('earth')?.trim() || null,
          image: formData.get('image')?.trim() || null,
          portret_img: formData.get('portret_img')?.trim() || null,
          costume_img: formData.get('costume_img')?.trim() || null,
          portret_costume_img: formData.get('portret_costume_img')?.trim() || null,
          personas: JSON.stringify(personas),
        };

        try {
          await API.put(`/characters/${char.id}`, data);
          closeModal('char-edit-modal');
          renderCharacterDetail(container, { id: char.id });
        } catch (err) {
          alert('Помилка при збереженні: ' + (err.message || ''));
        }
      });
    }
  }
}
