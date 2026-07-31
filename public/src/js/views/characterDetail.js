import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { t, l, getCurrentLanguage } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';
import { translateOrigin } from '../helpers/character.js';
import { openEditCharacterModal } from '../components/modals/EditCharacterModal.js';
import { fetchEntityEdits, renderEditorsHistoryBlock, initEditorsHistoryBlock } from '../components/editorsHistoryBlock.js';
import { icon } from '../helpers/icons.js';

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
    const [char, edits] = await Promise.all([
      API.get(`/characters/${characterId}`),
      fetchEntityEdits('character', characterId)
    ]);
    const charTitle = l(char, 'name', NAME_RULES) || char.name;
    document.title = `${charTitle} — Drawn Stories`;
    renderCharacterContent(container, char, params, edits);
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

function renderCharacterContent(container, char, params, edits = []) {
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
  const totalAppearances = volumes.length + issues.length + mangaChapters.length;

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

      setupEventListeners(container, char, personaVolumes, personaIssues, [], edits);
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
        <div class="container">
          <div class="personnel-detail-tabs" role="tablist">
            <button class="personnel-detail-tab-btn is-active" data-tab="overview" role="tab">
              ${t('tab_overview')}
            </button>
            <button class="personnel-detail-tab-btn" data-tab="appearances" role="tab">
              ${icon('book', 14)} ${t('tab_appearances')} <span class="tab-count">${totalAppearances.toLocaleString()}</span>
            </button>
            ${teams.length > 0 ? `
              <button class="personnel-detail-tab-btn" data-tab="teams" role="tab">
                ${icon('users', 14)} ${t('tab_teams')} <span class="tab-count">${teams.length}</span>
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
                      const hrefAttr = pId ? `href="#/personnel/${pId}"` : '';

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
                  ${factItemHTML(icon('externalLink'), "ComicVine", char.cv_slug ? `<a href="https://comicvine.gamespot.com/${char.cv_slug}/4005-${char.cv_id}/" target="_blank" rel="noopener">${escapeHtmlAttribute(String(char.cv_id || 'CV'))} ${icon('externalLink', 12)}</a>` : null)}
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
                    ${volumes.slice(0, 8).map(v => renderVolumeCardHTML(v)).join('')}
                  </div>
                </div>
              ` : ''}

              ${issues.length > 0 ? `
                <div class="entity-recent-section" style="margin-top: 24px;">
                  <div class="entity-section-header">
                    <span class="entity-section-title">${t('releases')}</span>
                  </div>
                  <div class="entity-releases-grid">
                    ${issues.slice(0, 12).map(i => renderIssueCardHTML(i)).join('')}
                  </div>
                </div>
              ` : ''}

              ${volumes.length === 0 && issues.length === 0 ? `<div class="entity-releases-empty">${t('no_data')}</div>` : ''}
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
  setupEventListeners(container, char, volumes, issues, mangaChapters, edits);
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
                ${t('go_to_series')} ${icon('chevronRight', 14)}
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
              ${t('go_to_series')} ${icon('chevronRight', 14)}
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
            ${t('manga_chapters_count', { count: mangaChapters.length })}
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
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || t('no_title'));
  const countText = vol.char_issue_count ? t('issues_abbr', { count: vol.char_issue_count }) : t('issues_abbr', { count: vol.issue_count || 0 });

  return `
    <a href="#/volumes/${vol.id}" class="entity-release-card">
      <div class="entity-release-cover">
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}</div>`}
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
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${displayTitle}" loading="lazy">` : `<div class="entity-release-cover-empty">${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}</div>`}
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
  const displayTitle = t('manga_chapter_num', { num: mc.chapter_number });
  const subTitle = escapeHtmlAttribute(mc.title || mc.volume_name || '');

  return `
    <a href="#/manga-chapters/${mc.id}" class="entity-release-card">
      <div class="entity-release-cover">
        <div class="entity-release-cover-empty">${icon('book', 14)}</div>
        ${mc.role ? `<span class="entity-role-badge">${escapeHtmlAttribute(mc.role)}</span>` : ''}
      </div>
      <div class="entity-release-body">
        <div class="entity-release-title">${displayTitle}</div>
        ${subTitle ? `<div class="entity-release-sub">${subTitle}</div>` : ''}
      </div>
    </a>
  `;
}



function setupEventListeners(container, char, volumes, issues, mangaChapters, edits) {
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
  container.querySelector('#char-edit-btn')?.addEventListener('click', () => {
    openEditCharacterModal(char, (updated) => {
      if (updated === null) {
        window.location.hash = '#/characters';
      } else {
        renderCharacterDetail(container, { id: char.id });
      }
    });
  });

  initEditorsHistoryBlock(container, edits);
}
