import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { t, l, getCurrentLanguage } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { translateOrigin } from '../helpers/character.js';
import { openEditCharacterModal } from '../components/modals/EditCharacterModal.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { mountFilterBar } from '../components/FilterBar.js';
import { 
  renderEntityIssueCard, 
  renderEntityVolumeCard, 
  renderEntityMangaChapterCard 
} from '../components/cards/EntityReleaseCard.js';
import { icon } from '../helpers/icons.js';

let currentAppearanceType = 'volumes'; // 'volumes' | 'issues' | 'manga'
let appearancesSearchQuery = '';

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

const NAME_RULES = { uk: ['real_name_uk', 'name_uk', 'name'], en: ['name'] };

export async function renderCharacterDetail(container, params, query = {}) {
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
    const [char, edits] = await Promise.all([
      API.get(`/characters/${characterId}`),
      fetchEntityEdits('character', characterId)
    ]);
    const charTitle = l(char, 'name', NAME_RULES) || char.name;
    document.title = `${charTitle} — Drawn Stories`;
    renderCharacterContent(container, char, params, edits, query);
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

function renderCharacterContent(container, char, params, edits = [], query = {}) {
  const displayName = l(char, 'name', NAME_RULES) || char.name;
  const rawSubName = l(char, 'subname', { uk: ['real_name', 'name'], en: ['real_name', 'real_name_uk'] });
  const subName = rawSubName && rawSubName !== displayName ? rawSubName : null;

  // Images gallery
  const images = [];
  if (char.image) images.push({ key: 'main', label: t('photo_main'), url: normalizeImageUrl(char.image) });
  if (char.portret_img) images.push({ key: 'portrait', label: t('photo_portrait'), url: normalizeImageUrl(char.portret_img) });
  if (char.costume_img) images.push({ key: 'costume', label: t('photo_costume'), url: normalizeImageUrl(char.costume_img) });
  if (char.portret_costume_img) images.push({ key: 'portret_costume', label: t('photo_portrait_costume'), url: normalizeImageUrl(char.portret_costume_img) });

  const activeImage = images.length > 0 ? images[0].url : null;
  const pubInfo = char.publisher_info;
  const firstApp = char.first_appearance_info;

  // Essence details
  const essSlug = char.essence;
  const essName = char.essence_info ? (l(char.essence_info, 'essence_name', { uk: ['essence_name_uk', 'essence_name'], en: ['essence_name'] }) || essSlug) : essSlug;
  const essLinkHTML = essSlug ? `<a href="#/essences/${escapeHtmlAttribute(essSlug)}">${escapeHtmlAttribute(essName)}</a>` : '';
  const charEssenceFact = essSlug ? factItemHTML(icon('sparkles'), t('essence'), essLinkHTML) : '';

  const volumes = char.volumes || [];
  const issues = char.issues || [];
  const mangaChapters = char.manga_chapters || [];
  const teams = char.teams || [];
  const aliases = parseAliases(char.aliases);
  const personas = parsePersonas(char.personas);
  const issueVolumeIds = new Set(issues.map(iss => iss.volume_id));
  const standaloneVolumes = volumes.filter(v => !issueVolumeIds.has(v.id));
  const totalAppearances = standaloneVolumes.length + issues.length + mangaChapters.length;

  const availableTabs = ['overview', 'appearances'];
  if (teams.length > 0) availableTabs.push('teams');
  const initialTab = availableTabs.includes(query?.tab) ? query.tab : 'overview';
  const initialType = ['volumes', 'issues', 'manga'].includes(query?.type) ? query.type : 'volumes';
  currentAppearanceType = initialType;
  appearancesSearchQuery = query?.search || '';

  // Persona Subpage Mode
  if (params && params.personaIdx !== undefined) {
    const pIdx = parseInt(params.personaIdx, 10);
    const persona = !isNaN(pIdx) && personas[pIdx] ? personas[pIdx] : null;

    if (persona) {
      const pTitle = l(persona, 'name', { uk: ['name_uk', 'name'], en: ['name'] });
      const pSubTitle = getCurrentLanguage() === 'uk' && persona.name_uk && persona.name !== persona.name_uk ? persona.name : null;
      const pImg = persona.image ? normalizeImageUrl(persona.image) : activeImage;

      // Filter issues and volumes by persona_idx
      const personaIssues = issues.filter(iss => iss.persona_idx === pIdx);
      const personaVolumeIds = new Set(personaIssues.map(iss => iss.volume_id));
      const personaVolumes = volumes.filter(v => personaVolumeIds.has(v.id));

      container.innerHTML = `
        <div class="character-detail character-persona-detail">
          <!-- Hero Band (Simplified for Persona) -->
          <section class="character-detail-hero-band">
            <div class="container character-detail-hero">
              <div class="character-detail-avatar-col">
                <div class="character-detail-avatar-frame">
                  ${pImg 
                    ? `<img src="${escapeHtmlAttribute(pImg)}" alt="${escapeHtmlAttribute(pTitle)}">`
                    : `<div class="character-detail-avatar-empty">${icon('user', 14)}<span>${t('no_photo')}</span></div>`
                  }
                </div>
              </div>

              <div class="character-detail-info">
                <a href="#/characters/${char.id}" class="persona-back-link">
                  &larr; ${t('back_to_character', { name: escapeHtmlAttribute(displayName) })}
                </a>
                <h1 style="margin-top: 6px;">${escapeHtmlAttribute(pTitle)}</h1>
                ${pSubTitle ? `<div class="character-detail-subname">${escapeHtmlAttribute(pSubTitle)}</div>` : ''}

                <div class="character-detail-badges" style="margin-top: 14px;">
                  ${persona.first_appearance || persona.issue_id ? `
                    <a href="${persona.issue_id ? `#/issues/${persona.issue_id}` : 'javascript:void(0)'}" class="character-badge">
                      ${icon('sparkles', 14)} ${t('first_appearance')}: ${escapeHtmlAttribute(persona.first_appearance || `#${persona.issue_id}`)}
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

      setupEventListeners(container, char, personaVolumes, personaIssues, [], edits, initialTab);
      return;
    }
  }

  container.innerHTML = `
    <div class="character-detail">
      <!-- Hero Band -->
      <section class="character-detail-hero-band">
        <div class="container character-detail-hero">
          <!-- Avatar Column -->
          <div class="character-detail-avatar-col">
            <div class="character-detail-avatar-frame">
              ${activeImage 
                ? `<img id="char-main-img" src="${escapeHtmlAttribute(activeImage)}" alt="${escapeHtmlAttribute(displayName)}">`
                : `<div class="character-detail-avatar-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}<span>${t('no_photo')}</span></div>`
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
            ${char.cv_id || char.hikka_slug ? `
              <div class="character-cover-ext-sources">
                <div class="ext-sources-title">${t('external_sources') || 'Зовнішні джерела'}</div>
                <div class="source-links">
                  ${char.cv_id ? `
                    <a href="https://comicvine.gamespot.com/${char.cv_slug ? escapeHtmlAttribute(char.cv_slug) + '/' : ''}4005-${char.cv_id}/" target="_blank" rel="noreferrer">
                      CV
                      ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                    </a>
                  ` : ''}
                  ${char.hikka_slug ? `
                    <a href="https://hikka.io/characters/${escapeHtmlAttribute(char.hikka_slug)}" target="_blank" rel="noreferrer">
                      Hikka
                      ${icon('externalLink', 12, { strokeWidth: 2.2 })}
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Info Column -->
          <div class="character-detail-info">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
              <div>
                <!-- Over title simple metadata -->
                <div class="character-detail-over-title" style="display: flex; gap: 8px; font-size: 13px; font-weight: 500; color: var(--text-2);">
                  ${char.essence ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;" title="${escapeHtmlAttribute(t('essence'))}">${icon('sparkles', 14)} ${essLinkHTML}</span> • ` : ''}
                  ${char.franchise ? `<span style="display: inline-flex; align-items: center; gap: 4px;" title="${escapeHtmlAttribute(t('franchise'))}">${icon('book', 14)} ${escapeHtmlAttribute(char.franchise)}</span>` : ''}
                  ${char.earth ? ` • <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;" title="${escapeHtmlAttribute(t('universe'))}">${icon('globe', 14)} ${escapeHtmlAttribute(char.earth)}</span>` : ''}
                </div>

                <h1>${escapeHtmlAttribute(displayName)}</h1>
                ${subName ? `<div class="character-detail-subname">${escapeHtmlAttribute(subName)}</div>` : ''}
              </div>
            </div>

            <!-- Badges Row -->
            <div class="character-detail-badges" style="margin-top: 12px;">
              ${char.origin ? `<span class="character-badge" title="${escapeHtmlAttribute(t('species'))}">${icon('tag', 14)} ${escapeHtmlAttribute(translateOrigin(char.origin))}</span>` : ''}
              ${char.gender === 1 ? `<span class="character-badge gender-male" title="${escapeHtmlAttribute(t('gender'))}">${icon('male', 14)} ${t('gender_male')}</span>` : ''}
              ${char.gender === 2 ? `<span class="character-badge gender-female" title="${escapeHtmlAttribute(t('gender'))}">${icon('female', 14)} ${t('gender_female')}</span>` : ''}
            </div>

            <!-- Personas Cards Section in Hero -->
            ${personas.length > 0 ? `
              <div class="character-personas-section" style="margin-top: 1em;">
                <h3 class="character-personas-title">${t('other_personas')}</h3>
                <div class="character-personas-grid">
                    ${personas.map((p, pIdx) => {
                      const pName = l(p, 'name', { uk: ['name_uk', 'name'], en: ['name'] });
                      const pSubName = getCurrentLanguage() === 'uk' && p.name_uk && p.name !== p.name_uk ? p.name : null;
                      const pImg = p.image ? normalizeImageUrl(p.image) : null;
                      return `
                        <a href="#/characters/${char.id}/persona/${pIdx}" class="character-persona-card">
                          <div class="character-persona-avatar">
                            ${pImg 
                              ? `<img src="${escapeHtmlAttribute(pImg)}" alt="${escapeHtmlAttribute(pName)}">`
                              : `<div class="character-detail-avatar-empty">${icon('user', 14)}</div>`
                            }
                          </div>
                          <div class="character-persona-info">
                            <div class="character-persona-name">${escapeHtmlAttribute(pName)}</div>
                            ${pSubName ? `<div class="character-persona-subname">${escapeHtmlAttribute(pSubName)}</div>` : ''}
                          </div>
                        </a>
                      `;
                    }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          ${renderEditorsHistoryBlock(edits, currentUser, { editButtonId: 'char-edit-btn', editTitle: t('edit') })}
        </div>
      </section>

      <!-- Tabs Band with "Огляд", "Появи", "Команди" -->
      <div class="personnel-detail-tabs-band">
        <div class="container" style="padding: 0 2em;">
          <div class="personnel-detail-tabs" role="tablist">
            <button class="personnel-detail-tab-btn ${initialTab === 'overview' ? 'is-active' : ''}" data-tab="overview" role="tab" aria-selected="${initialTab === 'overview'}">
              ${t('tab_overview')}
            </button>
            <button class="personnel-detail-tab-btn ${initialTab === 'appearances' ? 'is-active' : ''}" data-tab="appearances" role="tab" aria-selected="${initialTab === 'appearances'}">
              ${icon('book', 14)} ${t('tab_appearances')} <span class="tab-count">${totalAppearances.toLocaleString()}</span>
            </button>
            ${teams.length > 0 ? `
              <button class="personnel-detail-tab-btn ${initialTab === 'teams' ? 'is-active' : ''}" data-tab="teams" role="tab" aria-selected="${initialTab === 'teams'}">
                ${icon('users', 14)} ${t('tab_teams')} <span class="tab-count">${teams.length}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Main Container -->
      <div class="container" style="margin-top: 0;">
        <!-- Tab 1: Overview -->
        <div class="personnel-detail-pane ${initialTab === 'overview' ? 'is-active' : ''}" data-pane="overview">
          <div class="character-detail-overview">
            <!-- Sidebar Custom Character Info Block -->
            <aside>
              <div class="character-detail-info-block">
                <div class="character-detail-info-block-title">${icon('user', 14)} ${t('details')}</div>
                <ul class="character-detail-fact-list">
                  ${charEssenceFact}
                  ${(() => {
                    const creatorsStr = char.creators;
                    if (!creatorsStr) return '';
                    const creatorsInfoList = char.creators_info || [];
                    const creatorNames = creatorsStr.replace(/;/g, ',').split(',').map(c => c.trim()).filter(Boolean);

                    const cardsHTML = creatorNames.map(name => {
                      const found = creatorsInfoList.find(p => p.name.toLowerCase() === name.toLowerCase() || (p.name_uk && p.name_uk.toLowerCase() === name.toLowerCase()));
                      const pId = found ? found.id : null;
                      const pImg = found && found.image ? normalizeImageUrl(found.image) : null;
                      const pDisplayName = found ? (found.name_uk || found.name) : name;
                      const tag = pId ? 'a' : 'div';
                      const hrefAttr = pId ? `href="#/persons/${pId}"` : '';

                      return `
                        <${tag} ${hrefAttr} style="margin-top: 5px; display: flex; align-items: center; gap: .5em;">
                          <span class="volume-staff-avatar" style="width: 32px;">
                            ${pImg 
                              ? `<img src="${escapeHtmlAttribute(pImg)}" alt="${escapeHtmlAttribute(pDisplayName)}" loading="lazy">` 
                              : `<div class="volume-staff-avatar-empty" style="font-size: 11px;">${icon('user')}</div>`}
                          </span>
                          <span class="volume-staff-content">
                            <span class="volume-staff-name" style="font-size: 13px; font-weight: 700;">${escapeHtmlAttribute(pDisplayName)}</span>
                          </span>
                        </${tag}>
                      `;
                    }).join('');

                    return factItemHTML(icon('user'), t('creators_label'), `${cardsHTML}`);
                  })()}
                  ${factItemHTML(char.gender === 1 ? icon('male') : icon('female'), t('gender'), genderText(char.gender))}
                  ${factItemHTML(icon('building'), t('publisher'), pubInfo ? `<a href="#/publishers/${pubInfo.id}">${escapeHtmlAttribute(pubInfo.name)}</a>` : null)}
                  ${factItemHTML(icon('tag'), t('origin_label'), escapeHtmlAttribute(translateOrigin(char.origin)))}
                  ${factItemHTML(icon('book'), t('franchise'), escapeHtmlAttribute(char.franchise))}
                  ${factItemHTML(icon('globe'), t('universe_earth'), escapeHtmlAttribute(char.earth))}
                  ${factItemHTML(icon('calendar'), t('birth'), escapeHtmlAttribute(char.birth))}
                  ${factItemHTML(icon('calendar'), t('death'), escapeHtmlAttribute(char.death))}
                  ${factItemHTML(icon('calendar'), t('first_appearance'), firstApp 
                    ? `<a href="#/issues/${firstApp.id}">${escapeHtmlAttribute(firstApp.volume_name_uk || firstApp.volume_name)} #${firstApp.issue_number}</a>`
                    : (char.first_appearance ? `#${char.first_appearance}` : null))}
                  ${factItemHTML(icon('sparkles'), t('aliases'), aliases.length ? escapeHtmlAttribute(aliases.join(', ')) : null)}
                  ${factItemHTML(icon('externalLink'), "ComicVine", char.cv_id ? `<a href="https://comicvine.gamespot.com/${char.cv_slug ? escapeHtmlAttribute(char.cv_slug) + '/' : ''}4005-${char.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(char.cv_id))} ${icon('externalLink', 12)}</a>` : null)}
                  ${factItemHTML(icon('externalLink'), "Hikka", char.hikka_slug ? `<a href="https://hikka.io/characters/${escapeHtmlAttribute(char.hikka_slug)}" target="_blank" rel="noopener">${escapeHtmlAttribute(char.hikka_slug)} ${icon('externalLink', 12)}</a>` : null)}
                </ul>
              </div>
            </aside>

            <!-- Overview Right Column: Recent releases -->
            <div class="entity-recent-col">
              ${volumes.length > 0 ? `
                <div class="entity-recent-section">
                  <div class="entity-section-header">
                    <span class="entity-section-title">${t('series_volumes')}</span>
                  </div>
                  <div class="entity-releases-grid">
                    ${volumes.slice(0, 8).map(v => renderEntityVolumeCard(v)).join('')}
                  </div>
                </div>
              ` : ''}

              ${issues.length > 0 ? `
                <div class="entity-recent-section" style="margin-top: 24px;">
                  <div class="entity-section-header">
                    <span class="entity-section-title">${t('releases')}</span>
                  </div>
                  <div class="entity-releases-grid">
                    ${issues.slice(0, 12).map(i => renderEntityIssueCard(i)).join('')}
                  </div>
                </div>
              ` : ''}

              ${volumes.length === 0 && issues.length === 0 ? `<div class="entity-releases-empty">${t('no_data')}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Tab 2: Appearances Pane -->
        <div class="personnel-detail-pane ${initialTab === 'appearances' ? 'is-active' : ''}" data-pane="appearances" style="padding-top: 20px;">
          <div class="personnel-detail-works-pane">
            <div id="char-appearances-filter-bar-container" style="margin-bottom: 20px;"></div>
            <div id="appearances-content"></div>
          </div>
        </div>

        <!-- Tab 3: Teams Pane (Full width, no sidebar) -->
        ${teams.length > 0 ? `
          <div class="personnel-detail-pane ${initialTab === 'teams' ? 'is-active' : ''}" data-pane="teams" style="padding-top: 28px;">
            <div class="character-teams-grid">
              ${teams.map(t => {
                const tName = escapeHtmlAttribute(t.name_uk || t.name);
                return `
                  <a href="#/teams/${t.id}" class="char-team-card">
                    <div class="char-team-avatar">${icon('users', 14)}</div>
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
  setupEventListeners(container, char, volumes, issues, mangaChapters, edits, initialTab);
}

function updateCharacterUrl(charId, tab, appType) {
  const hashWithoutQuery = window.location.hash.split('?')[0] || `#/characters/${charId}`;
  const q = new URLSearchParams();
  if (tab && tab !== 'overview') {
    q.set('tab', tab);
    if (tab === 'appearances' && appType) {
      q.set('type', appType);
    }
  }
  const qs = q.toString();
  const newHash = qs ? `${hashWithoutQuery}?${qs}` : hashWithoutQuery;
  window.history.replaceState(null, '', newHash);
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

function mountAppearancesFilterBar(container, charId, volumes, issues, mangaChapters) {
  const filterContainer = container.querySelector('#char-appearances-filter-bar-container');
  if (!filterContainer) return;

  const hasManga = mangaChapters && mangaChapters.length > 0;

  const filterBar = mountFilterBar(filterContainer, {
    resultsCount: 0,
    resultsLabel: 'Знайдено',
    showResults: true,
    showSearch: true,
    searchPlaceholder: 'Шукати в появах...',
    searchValue: appearancesSearchQuery,
    onSearch: (val) => {
      appearancesSearchQuery = val.trim().toLowerCase();
      renderFilteredAppearances(container, volumes, issues, mangaChapters, filterBar);
    },
    showSort: false,
    showSortOrder: false,
    extraMiddleHtml: `
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="entity-toggle-all-btn" id="appearances-toggle-all-btn" type="button" style="${(currentAppearanceType === 'issues' || currentAppearanceType === 'manga') ? '' : 'display: none;'}">
          ${icon('chevronsUpDown', 13)} <span>Розгорнути все</span>
        </button>
        <div class="wanted-ct-group" role="group">
          <button class="wanted-ct-btn ${currentAppearanceType === 'volumes' ? 'is-active' : ''}" data-type="volumes">Серії</button>
          <button class="wanted-ct-btn ${currentAppearanceType === 'issues' ? 'is-active' : ''}" data-type="issues">Випуски</button>
          ${hasManga ? `<button class="wanted-ct-btn ${currentAppearanceType === 'manga' ? 'is-active' : ''}" data-type="manga">Манґа</button>` : ''}
        </div>
      </div>
    `
  });

  filterContainer.querySelectorAll('.wanted-ct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === currentAppearanceType) return;

      filterContainer.querySelectorAll('.wanted-ct-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      currentAppearanceType = type;
      updateCharacterUrl(charId, 'appearances', currentAppearanceType);

      const toggleAllBtn = filterContainer.querySelector('#appearances-toggle-all-btn');
      if (toggleAllBtn) {
        toggleAllBtn.style.display = (currentAppearanceType === 'issues' || currentAppearanceType === 'manga') ? '' : 'none';
      }

      renderFilteredAppearances(container, volumes, issues, mangaChapters, filterBar);
    });
  });

  renderFilteredAppearances(container, volumes, issues, mangaChapters, filterBar);
}

function renderFilteredAppearances(container, volumes, issues, mangaChapters, filterBar) {
  const appearancesContent = container.querySelector('#appearances-content');
  if (!appearancesContent) return;

  const q = (appearancesSearchQuery || '').trim().toLowerCase();

  if (currentAppearanceType === 'volumes') {
    const filtered = (volumes || []).filter(v => {
      if (!q) return true;
      const name = (v.name || '').toLowerCase();
      const nameUk = (v.name_uk || '').toLowerCase();
      return name.includes(q) || nameUk.includes(q);
    });

    if (filterBar) filterBar.updateCount(filtered.length);

    if (filtered.length === 0) {
      appearancesContent.innerHTML = `<div class="entity-releases-empty">${t('no_appearances_found') || 'Серій не знайдено'}</div>`;
    } else {
      appearancesContent.innerHTML = `
        <div class="entity-releases-grid">
          ${filtered.map(v => renderEntityVolumeCard(v)).join('')}
        </div>
      `;
    }
  } else if (currentAppearanceType === 'issues') {
    const filtered = (issues || []).filter(iss => {
      if (!q) return true;
      const name = (iss.name || '').toLowerCase();
      const volName = (iss.volume_name || '').toLowerCase();
      const volNameUk = (iss.volume_name_uk || '').toLowerCase();
      const num = String(iss.issue_number || '').toLowerCase();
      return name.includes(q) || volName.includes(q) || volNameUk.includes(q) || num.includes(q);
    });

    if (filterBar) filterBar.updateCount(filtered.length);

    if (filtered.length === 0) {
      appearancesContent.innerHTML = `<div class="entity-releases-empty">${t('no_appearances_found') || 'Випусків не знайдено'}</div>`;
    } else {
      const volumeMap = new Map();
      filtered.forEach(iss => {
        const volId = iss.volume_id;
        if (!volumeMap.has(volId)) {
          const title = iss.volume_name_uk || iss.volume_name || t('series') || 'Серія';
          const image = iss.volume_image || iss.volume_cover_img || null;
          volumeMap.set(volId, { id: volId, title, image, issues: [] });
        }
        volumeMap.get(volId).issues.push(iss);
      });

      let html = '';
      const isAutoExpanded = !!q;
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
      appearancesContent.innerHTML = html;
      initCollapsibleSections(container, '#appearances-toggle-all-btn');
    }
  } else if (currentAppearanceType === 'manga') {
    const filtered = (mangaChapters || []).filter(mc => {
      if (!q) return true;
      const title = (mc.title || '').toLowerCase();
      const volName = (mc.volume_name || '').toLowerCase();
      const volNameUk = (mc.volume_name_uk || '').toLowerCase();
      const num = String(mc.chapter_number || '').toLowerCase();
      return title.includes(q) || volName.includes(q) || volNameUk.includes(q) || num.includes(q);
    });

    if (filterBar) filterBar.updateCount(filtered.length);

    if (filtered.length === 0) {
      appearancesContent.innerHTML = `<div class="entity-releases-empty">${t('no_appearances_found') || 'Глав манґи не знайдено'}</div>`;
    } else {
      const volumeMap = new Map();
      filtered.forEach(mc => {
        const volId = mc.volume_id || 0;
        if (!volumeMap.has(volId)) {
          const title = mc.volume_name_uk || mc.volume_name || t('manga_chapters') || 'Манґа';
          const image = mc.volume_image || mc.volume_cover_img || null;
          volumeMap.set(volId, { id: volId, title, image, chapters: [] });
        }
        volumeMap.get(volId).chapters.push(mc);
      });

      let html = '';
      const isAutoExpanded = !!q;
      volumeMap.forEach(group => {
        const cover = normalizeImageUrl(group.image);
        html += `
          <div class="entity-recent-section ${isAutoExpanded ? '' : 'is-collapsed'}" style="margin-bottom: 16px;" data-volume-id="${group.id}">
            <div class="entity-section-header entity-section-header--collapsible" role="button" tabindex="0" aria-expanded="${isAutoExpanded}">
              <div class="entity-section-header-left">
                <div class="entity-section-vol-thumb">
                  ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(group.title)}" loading="lazy">` : `<div class="entity-section-vol-thumb-empty">${icon('book', 14)}</div>`}
                </div>
                ${group.id ? `
                  <a href="#/volumes/${group.id}" class="entity-section-vol-title" onclick="event.stopPropagation();" title="${escapeHtmlAttribute(group.title)}">
                    ${escapeHtmlAttribute(group.title)}
                  </a>
                ` : `
                  <span class="entity-section-vol-title">${escapeHtmlAttribute(group.title)}</span>
                `}
                <span class="entity-section-count-badge">${group.chapters.length} вип.</span>
              </div>
              <div class="entity-section-header-right">
                <span class="entity-section-chevron">${icon('chevronDown', 16, { strokeWidth: 2.2 })}</span>
              </div>
            </div>
            <div class="entity-section-content">
              <div class="entity-releases-grid">
                ${group.chapters.map(mc => renderEntityMangaChapterCard(mc)).join('')}
              </div>
            </div>
          </div>
        `;
      });
      appearancesContent.innerHTML = html;
      initCollapsibleSections(container, '#appearances-toggle-all-btn');
    }
  }
}

function renderAppearancesHTML(volumes, issues, mangaChapters) {
  if ((!issues || issues.length === 0) && (!volumes || volumes.length === 0) && (!mangaChapters || mangaChapters.length === 0)) {
    return `<div class="entity-releases-empty">${t('no_appearances_found')}</div>`;
  }

  const volumeMap = new Map();

  // Seed volumeMap from volumes array if provided
  if (volumes && volumes.length > 0) {
    volumes.forEach(v => {
      volumeMap.set(v.id, {
        id: v.id,
        title: v.name_uk || v.name || t('series'),
        image: v.image || v.cover_img || null,
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
        const title = iss.volume_name_uk || iss.volume_name || t('series');
        const image = iss.volume_image || iss.volume_cover_img || null;
        volumeMap.set(volId, {
          id: volId,
          title: title,
          image: image,
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
    const cover = normalizeImageUrl(group.image);
    if (group.issues.length === 0) {
      if (group.volume) {
        html += `
          <div class="entity-recent-section" style="margin-bottom: 16px;">
            <div class="entity-section-header">
              <div class="entity-section-header-left">
                <div class="entity-section-vol-thumb">
                  ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${escapeHtmlAttribute(group.title)}" loading="lazy">` : `<div class="entity-section-vol-thumb-empty">${icon('book', 14)}</div>`}
                </div>
                <a href="#/volumes/${group.id}" class="entity-section-vol-title" title="${escapeHtmlAttribute(group.title)}">
                  ${escapeHtmlAttribute(group.title)}
                </a>
              </div>
            </div>
            <div class="entity-section-content">
              <div class="entity-releases-grid">
                ${renderEntityVolumeCard(group.volume)}
              </div>
            </div>
          </div>
        `;
      }
    } else {
      html += `
        <div class="entity-recent-section is-collapsed" style="margin-bottom: 16px;" data-volume-id="${group.id}">
          <div class="entity-section-header entity-section-header--collapsible" role="button" tabindex="0" aria-expanded="false">
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
    }
  });

  // Render Manga Chapters if any
  if (mangaChapters && mangaChapters.length > 0) {
    html += `
      <div class="entity-recent-section" style="margin-bottom: 16px;">
        <div class="entity-section-header">
          <span class="entity-section-title" style="font-size: 14px; font-weight: 700; color: var(--text);">
            ${t('manga_chapters_count', { count: mangaChapters.length })}
          </span>
        </div>
        <div class="entity-releases-grid">
          ${mangaChapters.map(mc => renderEntityMangaChapterCard(mc)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

function setupEventListeners(container, char, volumes, issues, mangaChapters, edits, initialTab = 'overview') {
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
      container.querySelectorAll('.personnel-detail-tab-btn').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      container.querySelectorAll('.personnel-detail-pane').forEach(p => p.classList.remove('is-active'));

      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const targetPane = container.querySelector(`.personnel-detail-pane[data-pane="${tabId}"]`);
      if (targetPane) targetPane.classList.add('is-active');

      updateCharacterUrl(char.id, tabId, currentAppearanceType);

      if (tabId === 'appearances') {
        const filterContainer = container.querySelector('#char-appearances-filter-bar-container');
        if (filterContainer && !filterContainer.querySelector('.filter-bar')) {
          mountAppearancesFilterBar(container, char.id, volumes, issues, mangaChapters);
        }
      }
    });
  });

  // Modal controls
  container.querySelector('#char-edit-btn')?.addEventListener('click', () => {
    openEditCharacterModal(char, (updated) => {
      if (updated === null) {
        window.location.hash = '#/characters';
      } else {
        renderCharacterDetail(container, { id: char.id });
      }
    });
  });

  if (initialTab === 'appearances') {
    mountAppearancesFilterBar(container, char.id, volumes, issues, mangaChapters);
  }

  initEditorsHistoryBlock(container, edits);
}
