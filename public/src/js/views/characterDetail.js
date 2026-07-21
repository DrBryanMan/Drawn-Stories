import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { translateOrigin } from '../helpers/character.js';
import { openEditCharacterModal } from '../components/modals/EditCharacterModal.js';

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
  female:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/></svg>',
  dna:          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5C5 9.5 6 9 7 9s2 .5 2.5 1.5M19.5 13.5c-.5 1-1.5 1.5-2.5 1.5s-2-.5-2.5-1.5M6 6c1.5 0 3 1.5 3 3M18 18c-1.5 0-3-1.5-3-3M3 21l18-18M9 9l6 6"/></svg>',
  tag:          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.39.39 1.02.39 1.41 0l7.59-7.59c.39-.39.39-1.02 0-1.41L12 2zM7 7h.01"/></svg>'
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
    document.title = `${char.real_name_uk || char.name_uk || char.name} — Drawn Stories`;
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
  const displayName = char.real_name_uk || char.name_uk || char.name;
  const rawSubName = char.real_name || char.name;
  const subName = rawSubName !== displayName ? rawSubName : null;

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

          <!-- Tab Pane: Appearances (Grouped by Series) -->
          <div class="container" style="margin-top: 32px; margin-bottom: 48px;">
            <div class="personnel-detail-pane is-active" data-pane="appearances">
              <div id="appearances-content">
                ${renderAppearancesHTML(personaVolumes, personaIssues, [])}
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
            <!-- Over title simple metadata -->
            <div class="character-detail-over-title" style="display: flex; gap: 12px; font-size: 13px; font-weight: 500; color: var(--text-2); margin-bottom: 8px;">
              ${char.franchise ? `<span style="display: inline-flex; align-items: center; gap: 4px;">${ICON.book} ${escapeHtmlAttribute(char.franchise)}</span>` : ''}
              ${char.earth ? `<span style="display: inline-flex; align-items: center; gap: 4px;">${ICON.globe} ${escapeHtmlAttribute(char.earth)}</span>` : ''}
            </div>

            <h1>${escapeHtmlAttribute(displayName)}</h1>
            ${subName ? `<div class="character-detail-subname" style="margin-bottom: 12px;">${escapeHtmlAttribute(subName)}</div>` : ''}

            <!-- Badges Row -->
            <div class="character-detail-badges" style="margin-top: 12px;">
              ${char.origin ? `<span class="character-badge">${ICON.tag} ${escapeHtmlAttribute(translateOrigin(char.origin))}</span>` : ''}
              ${char.gender === 1 ? `<span class="character-badge gender-male">${ICON.male} ${t('gender_male')}</span>` : ''}
              ${char.gender === 2 ? `<span class="character-badge gender-female">${ICON.female} ${t('gender_female')}</span>` : ''}
              ${pubInfo ? `<a href="#/publishers/${pubInfo.id}" class="character-badge">${ICON.building} ${escapeHtmlAttribute(pubInfo.name)}</a>` : ''}
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
                  ${factItemHTML(ICON.user, "Творці", escapeHtmlAttribute(char.creators))}
                  ${factItemHTML(char.gender === 1 ? ICON.male : ICON.female, "Стать", genderText(char.gender))}
                  ${factItemHTML(ICON.building, "Видавництво", pubInfo ? `<a href="#/publishers/${pubInfo.id}">${escapeHtmlAttribute(pubInfo.name)}</a>` : null)}
                  ${factItemHTML(ICON.tag, "Походження", escapeHtmlAttribute(translateOrigin(char.origin)))}
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

        <!-- Tab 2: Appearances Pane (Grouped by Series) -->
        <div class="personnel-detail-pane" data-pane="appearances" style="padding-top: 28px;">
          <div id="appearances-content">
            ${renderAppearancesHTML(volumes, issues, mangaChapters)}
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
  `;

  // Attach event listeners
  setupEventListeners(container, char, volumes, issues, mangaChapters);
}

function renderAppearancesHTML(volumes, issues, mangaChapters) {
  if ((!issues || issues.length === 0) && (!volumes || volumes.length === 0) && (!mangaChapters || mangaChapters.length === 0)) {
    return `<div class="entity-releases-empty">Появ не знайдено</div>`;
  }

  const volumeMap = new Map();

  // Seed volumeMap from volumes array if provided
  if (volumes && volumes.length > 0) {
    volumes.forEach(v => {
      volumeMap.set(v.id, {
        id: v.id,
        title: v.name_uk || v.name || 'Серія',
        volume: v,
        issues: []
      });
    });
  }

  // Assign issues to volumeMap
  if (issues && issues.length > 0) {
    issues.forEach(iss => {
      const volId = iss.volume_id;
      if (!volumeMap.has(volId)) {
        const title = iss.volume_name_uk || iss.volume_name || 'Серія';
        volumeMap.set(volId, {
          id: volId,
          title: title,
          volume: null,
          issues: []
        });
      }
      volumeMap.get(volId).issues.push(iss);
    });
  }

  let html = '';

  // Render each volume section block
  volumeMap.forEach(group => {
    if (group.issues.length === 0) {
      if (group.volume) {
        html += `
          <div class="entity-recent-section" style="margin-bottom: 24px;">
            <div class="entity-section-header">
              <a href="#/volumes/${group.id}" class="entity-section-title" style="font-size: 15px; font-weight: 700; text-decoration: none; color: var(--text);">
                ${escapeHtmlAttribute(group.title)}
              </a>
              <a href="#/volumes/${group.id}" class="entity-section-link">
                Перейти до серії ${ICON.chevronRight}
              </a>
            </div>
            <div class="entity-releases-grid">
              ${renderVolumeCardHTML(group.volume)}
            </div>
          </div>
        `;
      }
    } else {
      html += `
        <div class="entity-recent-section" style="margin-bottom: 24px;">
          <div class="entity-section-header">
            <a href="#/volumes/${group.id}" class="entity-section-title" style="font-size: 15px; font-weight: 700; text-decoration: none; color: var(--text);">
              ${escapeHtmlAttribute(group.title)}
            </a>
            <a href="#/volumes/${group.id}" class="entity-section-link">
              Перейти до серії ${ICON.chevronRight}
            </a>
          </div>
          <div class="entity-releases-grid">
            ${group.issues.map(i => renderIssueCardHTML(i)).join('')}
          </div>
        </div>
      `;
    }
  });

  // Render Manga Chapters if any
  if (mangaChapters && mangaChapters.length > 0) {
    html += `
      <div class="entity-recent-section" style="margin-bottom: 24px;">
        <div class="entity-section-header">
          <span class="entity-section-title" style="font-size: 15px; font-weight: 700; color: var(--text);">
            Глави мангі (${mangaChapters.length})
          </span>
        </div>
        <div class="entity-releases-grid">
          ${mangaChapters.map(mc => renderMangaChapterCardHTML(mc)).join('')}
        </div>
      </div>
    `;
  }

  return html;
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
    container.querySelector('#char-edit-btn')?.addEventListener('click', () => {
      openEditCharacterModal(char, (updated) => {
        if (updated === null) {
          window.location.hash = '#/characters';
        } else {
          renderCharacterDetail(container, { id: char.id });
        }
      });
    });
  }
}
