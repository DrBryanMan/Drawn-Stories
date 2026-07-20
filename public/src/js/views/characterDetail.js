import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { createBreadcrumbs } from '../components/Breadcrumbs.js';
import { t } from '../helpers/i18n.js';
import { parseAliases } from '../helpers/lang.js';

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
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
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
    renderCharacterContent(container, char);
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

function renderCharacterContent(container, char) {
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
  const totalAppearances = volumes.length + issues.length + mangaChapters.length;

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
            <div class="personnel-detail-recent-col">
              ${volumes.length > 0 ? `
                <div class="personnel-detail-recent-section">
                  <div class="personnel-detail-section-header">
                    <span class="personnel-detail-section-title">Серії / Томи</span>
                  </div>
                  <div class="character-releases-grid">
                    ${volumes.slice(0, 8).map(v => renderVolumeCardHTML(v)).join('')}
                  </div>
                </div>
              ` : ''}

              ${issues.length > 0 ? `
                <div class="personnel-detail-recent-section" style="margin-top: 24px;">
                  <div class="personnel-detail-section-header">
                    <span class="personnel-detail-section-title">Випуски</span>
                  </div>
                  <div class="character-releases-grid">
                    ${issues.slice(0, 12).map(i => renderIssueCardHTML(i)).join('')}
                  </div>
                </div>
              ` : ''}

              ${volumes.length === 0 && issues.length === 0 ? `<div class="personnel-detail-releases-empty">Даних немає</div>` : ''}
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
    if (issues.length === 0) return `<div class="personnel-detail-releases-empty">Випусків не знайдено</div>`;
    return `
      <div class="character-releases-grid">
        ${issues.map(i => renderIssueCardHTML(i)).join('')}
      </div>
    `;
  }

  if (filter === 'manga') {
    if (mangaChapters.length === 0) return `<div class="personnel-detail-releases-empty">Глав мангі не знайдено</div>`;
    return `
      <div class="character-releases-grid">
        ${mangaChapters.map(mc => renderMangaChapterCardHTML(mc)).join('')}
      </div>
    `;
  }

  // Default filter: 'volumes'
  if (volumes.length === 0) return `<div class="personnel-detail-releases-empty">Томів не знайдено</div>`;
  return `
    <div class="character-releases-grid">
      ${volumes.map(v => renderVolumeCardHTML(v)).join('')}
    </div>
  `;
}

function renderVolumeCardHTML(vol) {
  const cover = normalizeImageUrl(vol.cover_img || vol.image);
  const title = escapeHtmlAttribute(vol.name_uk || vol.name || 'Без назви');
  const countText = vol.char_issue_count ? `${vol.char_issue_count} вип.` : `${vol.issue_count || 0} вип.`;

  return `
    <a href="#/volumes/${vol.id}" class="char-release-card">
      <div class="char-release-cover">
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">` : `<div class="char-release-cover-empty">${ICON.image}</div>`}
        <span class="char-role-badge">${countText}</span>
      </div>
      <div class="char-release-body">
        <div class="char-release-title" title="${title}">${title}</div>
        <div class="char-release-sub">${vol.name || ''}</div>
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
    <a href="#/issues/${issue.id}" class="char-release-card">
      <div class="char-release-cover">
        ${cover ? `<img src="${escapeHtmlAttribute(cover)}" alt="${displayTitle}" loading="lazy">` : `<div class="char-release-cover-empty">${ICON.image}</div>`}
        ${issue.role ? `<span class="char-role-badge">${escapeHtmlAttribute(issue.role)}</span>` : ''}
      </div>
      <div class="char-release-body">
        <div class="char-release-title" title="${displayTitle}">${displayTitle}</div>
        ${issueTitle ? `<div class="char-release-sub" title="${issueTitle}">${issueTitle}</div>` : ''}
      </div>
    </a>
  `;
}

function renderMangaChapterCardHTML(mc) {
  const displayTitle = `Глава ${mc.chapter_number}`;
  const subTitle = escapeHtmlAttribute(mc.title || mc.volume_name || '');

  return `
    <a href="#/manga-chapters/${mc.id}" class="char-release-card">
      <div class="char-release-cover">
        <div class="char-release-cover-empty">${ICON.book}</div>
        ${mc.role ? `<span class="char-role-badge">${escapeHtmlAttribute(mc.role)}</span>` : ''}
      </div>
      <div class="char-release-body">
        <div class="char-release-title">${displayTitle}</div>
        ${subTitle ? `<div class="char-release-sub">${subTitle}</div>` : ''}
      </div>
    </a>
  `;
}

function renderEditModalHTML(char) {
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
          <div class="ds-modal-body" style="display: block;">
            <div class="admin-form-grid">
              <div class="admin-form-group admin-form-group--full">
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
              <div class="admin-form-group admin-form-group--full">
                <label class="admin-label">Творці (через кому)</label>
                <input type="text" name="creators" class="admin-input" value="${escapeHtmlAttribute(char.creators || '')}">
              </div>
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

    const editForm = container.querySelector('#char-edit-form');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editForm);
        const data = {
          name: formData.get('name')?.trim(),
          name_uk: formData.get('name_uk')?.trim() || null,
          real_name: formData.get('real_name')?.trim() || null,
          real_name_uk: formData.get('real_name_uk')?.trim() || null,
          gender: formData.get('gender') ? Number(formData.get('gender')) : null,
          creators: formData.get('creators')?.trim() || null,
          image: formData.get('image')?.trim() || null,
          portret_img: formData.get('portret_img')?.trim() || null,
          costume_img: formData.get('costume_img')?.trim() || null,
          portret_costume_img: formData.get('portret_costume_img')?.trim() || null,
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
