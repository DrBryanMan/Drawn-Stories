import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { currentUser } from '../shell.js';
import { t } from '../helpers/i18n.js';
import { CharacterPicker } from '../components/CharacterPicker.js';
import { renderEntityLink, initEntityExistenceHandlers } from '../helpers/entityExistence.js';
import { openGlobalAddModal } from '../components/GlobalAddModal.js';

const ICON = {
  user:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  globe:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  edit:         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  sparkles:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
  plus:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  trash:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
  layers:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
};

function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
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

export async function renderEssenceDetail(container, params) {
  initEntityExistenceHandlers();
  const slug = params.slug;
  if (!slug) {
    container.innerHTML = `<div class="container"><div class="error-state">Сутність не знайдено</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="container" style="padding-top: 20px;">
      <div class="loader-container" style="padding: 100px 0;"><div class="loader"></div></div>
    </div>
  `;

  try {
    const essence = await API.get(`/essences/${slug}`);
    document.title = `${essence.essence_name_uk || essence.essence_name} — Drawn Stories`;
    renderEssenceContent(container, essence);
  } catch (err) {
    console.error(err);
    const prettyName = slug.replace(/-/g, ' ');
    const isMod = isModerator();
    const is404 = err.message && (err.message.includes('404') || err.message.includes('не знайдено') || err.message.includes('not found'));
    
    if (is404 && isMod) {
      container.innerHTML = `
        <div class="container" style="padding-top: 40px; text-align: center;">
          <div class="essence-404-box" style="background: var(--bg-card); border-radius: 12px; padding: 48px 24px; border: 1px dashed var(--border-s); max-width: 560px; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
            <div style="font-size: 3rem; margin-bottom: 12px; opacity: 0.8;">✨</div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
              Сутність не знайдена
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5;">
              Сутність із слагом <strong>"${escapeHtmlAttribute(slug)}"</strong> поки що відсутня в енциклопедії. Ви можете створити її та додати до каталогу!
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="#/essences" class="btn-admin btn-admin--secondary">До каталогу сутностей</a>
              <button class="btn-admin btn-admin--primary" id="btn-create-missing-essence">
                ${ICON.plus} Створити сутність "${escapeHtmlAttribute(prettyName)}"
              </button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-create-missing-essence')?.addEventListener('click', () => {
        openGlobalAddModal('essence', { slug: slug, essence_name: prettyName });
      });
    } else if (is404) {
      container.innerHTML = `
        <div class="container" style="padding-top: 40px; text-align: center;">
          <div class="error-state" style="background: var(--bg-card); border-radius: 12px; padding: 48px 24px; border: 1px solid var(--border-s); max-width: 500px; margin: 0 auto;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
              Сутність не знайдена
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">
              Сутність із слагом <strong>"${escapeHtmlAttribute(slug)}"</strong> не існує або була видалена.
            </p>
            <a href="#/essences" class="btn-admin btn-admin--secondary" style="display: inline-block;">Повернутися до каталогу</a>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="container" style="padding: 60px 0; text-align: center;">
          <div class="error-state" style="background: var(--bg-card); border-radius: 12px; padding: 48px 24px; border: 1px solid var(--border-s); max-width: 500px; margin: 0 auto;">
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
              Помилка завантаження
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">
              ${escapeHtmlAttribute(err.message || 'Не вдалося завантажити дані сутності.')}
            </p>
            <a href="#/essences" class="btn-admin btn-admin--secondary" style="display: inline-block;">Повернутися до каталогу</a>
          </div>
        </div>
      `;
    }
  }
}

function buildEssenceTitleHTML(essence) {
  const essenceName = essence.essence_name_uk || essence.essence_name || '';
  const personName = essence.person_name_uk || essence.person_name || (essence.character_info ? (essence.character_info.name_uk || essence.character_info.name) : '');
  const essenceSlug = essence.essence_slug || '';
  const characterId = essence.character_id || null;

  // 3. якщо вказано person_name та character_id, тоді посилання на персонажа та іконка персони
  if (personName && characterId) {
    const exists = Boolean(essence.character_info && essence.character_info.id);
    return renderEntityLink({
      href: `#/characters/${characterId}`,
      exists: exists,
      contentType: 'character',
      identifier: characterId,
      displayName: personName,
      className: 'essence-title-link',
      innerHTML: `${ICON.user} <span>${escapeHtmlAttribute(personName)}</span>`
    });
  }

  // 2. якщо вказано person_name та essence_slug, то посилання на сутність та іконка сутності
  if (personName && essenceSlug) {
    const exists = essence.essence_slug_exists === true;
    return renderEntityLink({
      href: `#/essences/${essenceSlug}`,
      exists: exists,
      contentType: 'essence',
      identifier: essenceSlug,
      displayName: personName,
      className: 'essence-title-link',
      innerHTML: `${ICON.sparkles} <span>${escapeHtmlAttribute(personName)}</span>`
    });
  }

  // 1. якщо вказано essence_name:
  if (essenceName) {
    if (essenceSlug) {
      const exists = essence.essence_slug_exists === true;
      return renderEntityLink({
        href: `#/essences/${essenceSlug}`,
        exists: exists,
        contentType: 'essence',
        identifier: essenceSlug,
        displayName: essenceName,
        className: 'essence-title-link',
        innerHTML: `${ICON.sparkles} <span>${escapeHtmlAttribute(essenceName)}</span>`
      });
    } else {
      // ніякого посилання
      return `
        <div class="essence-title-text" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-top: 8px;">
          ${escapeHtmlAttribute(essenceName)}
        </div>
      `;
    }
  }

  return '';
}

function buildEssenceMetaUnderTitleHTML(essence) {
  // Якщо вказано character_id, отримуємо його номер землі/франшизи
  if (!essence.character_id) return '';

  const charInfo = essence.character_info;
  const earthInfo = essence.character_earth_info;
  const earthCode = charInfo?.earth || earthInfo?.code || earthInfo?.id;
  const franchise = charInfo?.franchise || essence.franchise;

  // Якщо це Земля
  if (earthInfo || earthCode) {
    const earthName = earthInfo ? (earthInfo.name_uk || earthInfo.name) : `Земля-${earthCode}`;
    const earthId = earthInfo ? earthInfo.id : earthCode;
    const codeDisplay = (earthInfo && earthInfo.code) ? earthInfo.code : (earthCode && earthCode !== earthName ? earthCode : '');
    
    const label = codeDisplay ? `${earthName} (${codeDisplay})` : earthName;

    return `
      <a href="#/earths/${earthId}" class="essence-earth-badge" style="margin-top: 8px;">
        ${ICON.globe} ${escapeHtmlAttribute(label)}
      </a>
    `;
  }

  // Якщо це Франшиза
  if (franchise) {
    return `
      <div class="essence-franchise-badge" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); background: var(--bg-hover, #f1f5f9); padding: 4px 10px; border-radius: 12px; margin-top: 8px;">
        ${ICON.layers} ${escapeHtmlAttribute(franchise)}
      </div>
    `;
  }

  return '';
}

function renderEssenceContent(container, essence) {
  const title = essence.essence_name_uk || essence.essence_name;
  const rawImage = essence.image || essence.character_info?.image;
  const hasHeroImage = Boolean(rawImage);
  const imgUrl = hasHeroImage ? normalizeImageUrl(rawImage) : '';

  container.innerHTML = `
    <div class="essence-detail">
      <!-- Hero Band -->
      <section class="essence-detail-hero-band">
        <div class="container essence-detail-hero">
          <!-- Col 1: Poster & Primary Meta -->
          <div class="essence-hero-col1">
            <div class="essence-poster-wrap">
              ${hasHeroImage ? `
                <img class="essence-poster-img" src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="essence-hero-fallback-icon" style="display: none; width: 100%; height: 100%; min-height: 250px; align-items: center; justify-content: center; background: var(--bg-hover, #f1f5f9); color: var(--text-muted, #64748b);">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              ` : `
                <div class="essence-hero-fallback-icon" style="display: flex; width: 100%; height: 100%; min-height: 250px; align-items: center; justify-content: center; background: var(--bg-hover, #f1f5f9); color: var(--text-muted, #64748b);">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              `}
            </div>
            
            ${buildEssenceTitleHTML(essence)}
            ${buildEssenceMetaUnderTitleHTML(essence)}
          </div>

          <!-- Col 2: Info & Other Essences -->
          <div class="essence-hero-col2">
            <div class="essence-header-row">
              <div>
                <div class="essence-subtitle">${escapeHtmlAttribute(essence.franchise || 'Франшиза')}</div>
                <h1 style="font-size: 1.6rem; font-weight: 800;">${escapeHtmlAttribute(title)}</h1>
              </div>

              ${isModerator() ? `
                <button class="btn-admin btn-admin--secondary hero-edit-action-btn" id="btn-edit-essence" title="Редагувати сторінку">
                  ${ICON.edit}
                </button>
              ` : ''}
            </div>

            <!-- Description -->
            <div class="essence-description-box">
              <div class="essence-description-title">${ICON.sparkles} Опис сутності</div>
              <div>${essence.description ? escapeHtmlAttribute(essence.description).replace(/\n/g, '<br>') : '<i style="color: var(--text-muted);">Опис відсутній</i>'}</div>
            </div>

            <!-- Other Essences / Characters -->
            ${essence.other_essences && essence.other_essences.length > 0 ? `
              <div class="essence-other-essences-box">
                <div class="essence-other-title">${ICON.layers} Пов'язані персонажі</div>
                <div class="essence-other-list">
                  ${essence.other_essences.map(item => {
                    const isObj = typeof item === 'object' && item !== null;
                    const charId = isObj ? item.character_id : null;
                    const charName = isObj ? (item.character_name || item.name || item.slug) : item;
                    const essSlug = isObj ? (item.essence_slug || item.slug) : null;
                    const essName = isObj ? (item.essence_name || item.name || item.slug) : null;
                    const rawImg = isObj ? item.image : null;

                    const charHref = charId ? `#/characters/${charId}` : (essSlug ? `#/essences/${essSlug}` : '#');
                    const charExists = isObj ? (item.exists !== false) : true;
                    const imgUrl = rawImg ? normalizeImageUrl(rawImg) : '';

                    const charLinkHTML = renderEntityLink({
                      href: charHref,
                      exists: charExists,
                      contentType: charId ? 'character' : 'essence',
                      identifier: charId || essSlug || '',
                      displayName: charName,
                      className: 'essence-other-char-link'
                    });

                    const essSublinkHTML = essSlug && essName ? `
                      <div class="essence-other-subtitle">
                        (Currently ${renderEntityLink({
                          href: `#/essences/${essSlug}`,
                          exists: true,
                          contentType: 'essence',
                          identifier: essSlug,
                          displayName: essName,
                          className: 'essence-other-sublink'
                        })})
                      </div>
                    ` : '';

                    return `
                      <div class="essence-other-card">
                        <div class="essence-other-card-img-wrap">
                          ${imgUrl ? `
                            <img src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(charName)}" class="essence-other-card-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="essence-version-fallback-icon" style="display: none; width:100%; height:100%; align-items:center; justify-content:center;">
                              ${ICON.user}
                            </div>
                          ` : `
                            <div class="essence-version-fallback-icon" style="display: flex; width:100%; height:100%; align-items:center; justify-content:center;">
                              ${ICON.user}
                            </div>
                          `}
                        </div>
                        <div class="essence-other-card-info">
                          <div class="essence-other-char-name">${charLinkHTML}</div>
                          ${essSublinkHTML}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </section>

      <!-- Main Content Container -->
      <div class="container" style="margin-top: 32px; margin-bottom: 48px;">
        ${renderCategorySections(essence, isModerator())}
      </div>

      <!-- Modals -->
      ${isModerator() ? renderModalsHTML(essence) : ''}
    </div>
  `;

  if (isModerator()) {
    initModeratorHandlers(container, essence);
  }
}

function renderCategorySections(essence, isModerator) {
  const allVersions = essence.characters || [];
  
  const categoriesMap = [
    { key: 'alter', title: 'Альтернативні версії' },
    { key: 'other', title: 'Інші сутності' },
    { key: 'related', title: 'Пов\'язані персонажі' },
    { key: 'teams', title: 'Команди' }
  ];

  // Перша категорія із наявними елементами або 'alter'
  const availableCat = categoriesMap.find(cat => allVersions.some(v => (v.category || 'alter') === cat.key));
  const activeTabKey = availableCat ? availableCat.key : 'alter';

  return `
    <div class="essence-versions-card-block">
      <div class="essence-versions-card-header">
        <div class="volume-tabs-segmented" id="essence-versions-tabs">
          ${categoriesMap.map(cat => {
            const count = allVersions.filter(v => (v.category || 'alter') === cat.key).length;
            const isActive = cat.key === activeTabKey;
            return `
              <button class="volume-tab-btn ${isActive ? 'is-active' : ''}" data-tab="${cat.key}">
                ${ICON.layers} <span>${escapeHtmlAttribute(cat.title)}</span> ${count > 0 ? `<span style="opacity:0.85; font-size:0.8rem; margin-left:2px;">(${count})</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <div class="essence-versions-tab-content" id="essence-versions-tab-content">
        ${renderTabContent(allVersions, activeTabKey, isModerator)}
      </div>
    </div>
  `;
}

function renderTabContent(allVersions, activeTabKey, isModerator) {
  const items = allVersions.filter(v => (v.category || 'alter') === activeTabKey);

  if (items.length === 0 && !isModerator) {
    return `
      <div class="essence-versions-empty">
        У цій категорії ще немає версій чи пов'язаних записів.
      </div>
    `;
  }

  items.sort((a, b) => {
    const orderA = parseInt(a.display_order) || 0;
    const orderB = parseInt(b.display_order) || 0;
    const effectiveA = orderA === 0 ? 999999 : orderA;
    const effectiveB = orderB === 0 ? 999999 : orderB;
    if (effectiveA !== effectiveB) return effectiveA - effectiveB;
    return (a.relation_id || 0) - (b.relation_id || 0);
  });

  return `
    <div class="essence-versions-grid">
      ${items.map(item => renderVersionCard(item, isModerator)).join('')}

      ${isModerator ? `
        <div class="essence-version-add-card-wrap" id="btn-add-version" title="Додати запис у цю категорію">
          <div class="essence-version-card-item">
            <div class="essence-version-card-img-wrap essence-version-add-img-wrap">
              <div class="essence-version-add-icon-box">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
            </div>
            <div class="essence-version-card-title essence-version-add-title">
              Додати
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderVersionCard(item, isModerator) {
  const displayName = item.display_name_uk || item.display_name || item.char_name_uk || item.char_name || item.ess_name_uk || item.ess_name || 'Версія';
  const hasImage = Boolean(item.image);
  const imgUrl = hasImage ? normalizeImageUrl(item.image) : '';
  const exists = item.target_exists !== false;

  let targetHref = '#';
  let contentType = 'character';
  let identifier = item.character_id || '';

  if (item.essence_type === 'essence') {
    contentType = 'essence';
    identifier = item.target_essence_slug || item.essence_slug || '';
    targetHref = `#/essences/${identifier}`;
  } else if (item.essence_type === 'team') {
    contentType = 'team';
    targetHref = `#/characters/${identifier}`;
  } else {
    contentType = 'character';
    targetHref = `#/characters/${identifier}`;
  }

  const earthInfo = item.earth_info;
  const earthCode = item.earth_code || (earthInfo ? (earthInfo.code || earthInfo.id) : '');
  const franchise = item.franchise;

  let earthLineHTML = '';
  if (earthInfo || earthCode) {
    const earthName = earthInfo ? (earthInfo.name_uk || earthInfo.name) : `Земля-${earthCode}`;
    const codeDisplay = (earthInfo && earthInfo.code) ? earthInfo.code : (earthCode && earthCode !== earthName ? earthCode : '');

    earthLineHTML = `
      <div class="essence-version-card-earth-name">
        ${escapeHtmlAttribute(earthName)}
      </div>
      ${codeDisplay ? `
        <div class="essence-version-card-earth-code">
          (${escapeHtmlAttribute(codeDisplay)})
        </div>
      ` : ''}
    `;
  } else if (franchise) {
    earthLineHTML = `
      <div class="essence-version-card-franchise">
        ${escapeHtmlAttribute(franchise)}
      </div>
    `;
  }

  const innerCardHTML = `
    <div class="essence-version-card-img-wrap">
      ${hasImage ? `
        <img src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(displayName)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="essence-version-fallback-icon" style="display: none;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
      ` : `
        <div class="essence-version-fallback-icon" style="display: flex;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
      `}
    </div>

    <div class="essence-version-card-title">
      ${escapeHtmlAttribute(displayName)}
    </div>

    ${earthLineHTML}
  `;

  const linkHTML = renderEntityLink({
    href: targetHref,
    exists: exists,
    contentType: contentType,
    identifier: identifier,
    displayName: displayName,
    className: 'essence-version-card-item',
    innerHTML: innerCardHTML
  });

  return `
    <div class="essence-version-card-wrap">
      ${linkHTML}

      ${isModerator ? `
        <div class="essence-version-card-actions">
          <button class="btn-edit-version essence-version-action-btn essence-version-action-btn--edit" 
            data-item="${escapeHtmlAttribute(JSON.stringify(item))}"
            title="Редагувати">
            ${ICON.edit}
          </button>
          <button class="btn-remove-version essence-version-action-btn essence-version-action-btn--delete" 
            data-id="${item.relation_id || item.character_id}" 
            title="Видалити">
            ${ICON.trash}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderModalsHTML(essence) {
  return `
    <!-- Modal: Edit Essence -->
    <div class="ds-modal-overlay" id="edit-essence-modal" style="display: none;">
      <div class="ds-modal ds-modal--large" id="edit-essence-modal-box">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.edit} Редагувати сутність</div>
          <button class="ds-modal-close" data-close-modal>&times;</button>
        </div>
        <div class="ds-modal-body">
          <form id="edit-essence-form" class="admin-form-grid">
            <div class="admin-form-group">
              <label class="admin-label">Назва (оригінал) *</label>
              <input type="text" name="essence_name" class="admin-input" value="${escapeHtmlAttribute(essence.essence_name || '')}" required>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Назва (українською)</label>
              <input type="text" name="essence_name_uk" class="admin-input" value="${escapeHtmlAttribute(essence.essence_name_uk || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Цивільне ім'я (оригінал)</label>
              <input type="text" name="person_name" class="admin-input" value="${escapeHtmlAttribute(essence.person_name || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Цивільне ім'я (українською)</label>
              <input type="text" name="person_name_uk" class="admin-input" value="${escapeHtmlAttribute(essence.person_name_uk || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Унікальний слаг (slug) *</label>
              <input type="text" name="slug" class="admin-input" value="${escapeHtmlAttribute(essence.slug || '')}" required placeholder="spider-man">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Слаг зв'язаної сутності (essence_slug)</label>
              <input type="text" name="essence_slug" class="admin-input" value="${escapeHtmlAttribute(essence.essence_slug || '')}" placeholder="Наприклад spider-man">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Франшиза</label>
              <input type="text" name="franchise" class="admin-input" value="${escapeHtmlAttribute(essence.franchise || '')}">
            </div>
            <div class="admin-form-group admin-form-group--full">
              <label class="admin-label">${ICON.user} Головний персонаж</label>
              <input type="hidden" name="character_id" id="edit-essence-char-id" value="${essence.character_id || ''}">
              <div id="edit-essence-char-picker"></div>
            </div>
            <div class="admin-form-group admin-form-group--full">
              <label class="admin-label">URL Зображення / Картки</label>
              <input type="text" name="image" class="admin-input" value="${escapeHtmlAttribute(essence.image || '')}">
            </div>
            <div class="admin-form-group admin-form-group--full">
              <label class="admin-label">Опис сутності</label>
              <textarea name="description" class="admin-textarea" rows="4">${escapeHtmlAttribute(essence.description || '')}</textarea>
            </div>

            <!-- Group: Пов'язані сутності (Other Essences) -->
            <div class="admin-form-section-title" style="grid-column: span 2; font-weight: 800; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; margin-top: 12px; text-transform: uppercase; font-size: 12px; color: var(--accent); display: flex; align-items: center; gap: 6px;">
              ${ICON.layers} Пов'язані сутності (Other Essences)
            </div>

            <div class="admin-form-group admin-form-group--full" style="grid-column: span 2;">
              <div class="other-essences-manager-container">
                <div class="other-essences-list-wrap" id="edit-other-essences-list" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;"></div>

                <div class="other-essence-add-form" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:12px; background:var(--bg-2); border-radius:6px; border:1px dashed var(--border-s);">
                  <div style="grid-column: span 2;">
                    <label class="admin-label" style="font-size: 11px; font-weight: bold; color: var(--text-muted); display:flex; align-items:center; gap:4px; margin-bottom:4px;">
                      ${ICON.user} Прив'язати персонажа (необов'язково)
                    </label>
                    <input type="hidden" id="edit-other-ess-char-id" value="">
                    <div id="edit-other-ess-char-picker"></div>
                  </div>

                  <input type="text" id="edit-other-ess-name" class="admin-input" placeholder="Display name / Назва (напр. Miles Morales)">
                  <input type="text" id="edit-other-ess-name-uk" class="admin-input" placeholder="Українською (напр. Майлз Моралес)">
                  <input type="text" id="edit-other-ess-slug" class="admin-input" placeholder="Слаг сутності (напр. miles-morales)">
                  <input type="text" id="edit-other-ess-image" class="admin-input" placeholder="URL картинки / аватарки">

                  <button type="button" id="edit-other-ess-add-btn" class="btn-admin btn-admin--secondary" style="grid-column: span 2;">+ Додати сутність</button>
                </div>
              </div>
              <input type="hidden" name="other_essences" id="edit-other-essences-hidden" value="${escapeHtmlAttribute(JSON.stringify(essence.other_essences || []))}">
            </div>
          </form>
        </div>
        <div class="ds-modal-footer">
          <button class="btn-admin btn-admin--secondary" id="edit-ess-cancel">Скасувати</button>
          <button class="btn-admin btn-admin--primary" id="edit-ess-save">Зберегти зміни</button>
        </div>
      </div>
    </div>

    <!-- Modal: Add Character/Essence Version -->
    <div class="ds-modal-overlay" id="add-version-modal" style="display: none;">
      <div class="ds-modal" id="add-version-modal-box">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.plus} Додати версію або сутність</div>
          <button class="ds-modal-close" data-close-modal>&times;</button>
        </div>
        <div class="ds-modal-body">
          <form id="add-version-form" class="admin-form-grid">
            <div class="admin-form-group">
              <label class="admin-label">Розділ (category) *</label>
              <select name="category" class="admin-select">
                <option value="alter">Альтернативні версії (alter)</option>
                <option value="other">Інші сутності (other)</option>
                <option value="related">Пов'язані (related)</option>
                <option value="teams">Команди (teams)</option>
              </select>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Тип сторінки / DetailPage (essence_type) *</label>
              <select name="essence_type" class="admin-select" id="add-ver-type-select">
                <option value="character">Персонаж (character)</option>
                <option value="essence">Сутність (essence)</option>
                <option value="team">Команда (team)</option>
              </select>
            </div>

            <!-- Display Name (Поставлено одразу після типу сторінки) -->
            <div class="admin-form-group">
              <label class="admin-label">Відображуване ім'я (display_name) *</label>
              <input type="text" name="display_name" id="add-ver-display-name" class="admin-input" required placeholder="Напр. Ultimatum або Spider-Prowler">
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Відображуване ім'я (українською)</label>
              <input type="text" name="display_name_uk" class="admin-input" placeholder="Напр. Ультіматум">
            </div>

            <!-- Target Essence Slug (Для типу essence) -->
            <div class="admin-form-group admin-form-group--full" id="add-ver-slug-group" style="display: none;">
              <label class="admin-label">${ICON.sparkles} Слаг цільової сутності (target_essence_slug) *</label>
              <input type="text" name="target_essence_slug" id="add-ver-target-slug" class="admin-input" placeholder="Наприклад spider-man-616">
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
                Автоматично форматується: нижній регістр, пробіли замінюються на "-"
              </div>
            </div>

            <!-- Character Picker (Для типів character та team) -->
            <div class="admin-form-group admin-form-group--full" id="add-ver-char-group">
              <label class="admin-label">${ICON.user} Персонаж / Команда з системи *</label>
              <input type="hidden" name="character_id" id="add-version-char-id" value="">
              <div id="add-version-char-picker"></div>
            </div>

            <!-- Custom Image -->
            <div class="admin-form-group">
              <label class="admin-label">URL Кастомного зображення (image)</label>
              <input type="text" name="image" class="admin-input" placeholder="Залишіть порожнім для фолбеку">
            </div>

            <!-- Display Order -->
            <div class="admin-form-group">
              <label class="admin-label">Порядковий номер (display_order)</label>
              <input type="number" name="display_order" class="admin-input" value="0" placeholder="0">
            </div>

            <div class="admin-form-group admin-form-group--full">
              <label class="admin-label">Опис версії</label>
              <textarea name="description" class="admin-textarea" rows="3" placeholder="Короткі особливості даної версії..."></textarea>
            </div>
          </form>
        </div>
        <div class="ds-modal-footer">
          <button class="btn-admin btn-admin--secondary" data-close-modal>Скасувати</button>
          <button class="btn-admin btn-admin--primary" id="add-ver-save">Прив'язати запис</button>
        </div>
      </div>
    </div>

    <!-- Modal: Edit Version -->
    <div class="ds-modal-overlay" id="edit-version-modal" style="display: none;">
      <div class="ds-modal" id="edit-version-modal-box">
        <div class="ds-modal-header">
          <div class="ds-modal-title">${ICON.edit} Редагувати версію</div>
          <button class="ds-modal-close" data-close-modal>&times;</button>
        </div>
        <div class="ds-modal-body">
          <form id="edit-version-form" class="admin-form-grid">
            <input type="hidden" name="relation_id" id="edit-ver-relation-id">
            <div class="admin-form-group">
              <label class="admin-label">Розділ (category) *</label>
              <select name="category" id="edit-ver-category" class="admin-select">
                <option value="alter">Альтернативні версії (alter)</option>
                <option value="other">Інші сутності (other)</option>
                <option value="related">Пов'язані (related)</option>
                <option value="teams">Команди (teams)</option>
              </select>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Тип сторінки (essence_type) *</label>
              <select name="essence_type" id="edit-ver-type-select" class="admin-select">
                <option value="character">Персонаж (character)</option>
                <option value="essence">Сутність (essence)</option>
                <option value="team">Команда (team)</option>
              </select>
            </div>

            <div class="admin-form-group">
              <label class="admin-label">Відображуване ім'я (display_name) *</label>
              <input type="text" name="display_name" id="edit-ver-display-name" class="admin-input" required>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Відображуване ім'я (українською)</label>
              <input type="text" name="display_name_uk" id="edit-ver-display-name-uk" class="admin-input">
            </div>

            <div class="admin-form-group admin-form-group--full" id="edit-ver-slug-group">
              <label class="admin-label">${ICON.sparkles} Слаг цільової сутності (target_essence_slug)</label>
              <label class="admin-label">${ICON.user} Персонаж / Команда з системи</label>
              <input type="hidden" name="character_id" id="edit-version-char-id" value="">
              <div id="edit-version-char-picker"></div>
            </div>

            <div class="admin-form-group">
              <label class="admin-label">URL Кастомного зображення (image)</label>
              <input type="text" name="image" id="edit-ver-image" class="admin-input">
            </div>

            <div class="admin-form-group">
              <label class="admin-label">Порядковий номер (display_order)</label>
              <input type="number" name="display_order" id="edit-ver-display-order" class="admin-input" value="0">
            </div>

            <div class="admin-form-group admin-form-group--full">
              <label class="admin-label">Опис версії</label>
              <textarea name="description" id="edit-ver-description" class="admin-textarea" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="ds-modal-footer">
          <button class="btn-admin btn-admin--secondary" data-close-modal>Скасувати</button>
          <button class="btn-admin btn-admin--primary" id="edit-ver-save">Зберегти зміни</button>
        </div>
      </div>
    </div>
  `;
}

function initModeratorHandlers(container, essence) {
  const slugify = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-\u0400-\u04FF]/g, '');
  };

  const editPickerContainer = container.querySelector('#edit-essence-char-picker');
  if (editPickerContainer) {
    new CharacterPicker({
      container: editPickerContainer,
      hiddenInput: container.querySelector('#edit-essence-char-id'),
      initialId: essence.character_id
    });
  }

  // Other Essences Manager Logic
  const otherEssencesHidden = container.querySelector('#edit-other-essences-hidden');
  const otherEssencesList = container.querySelector('#edit-other-essences-list');
  const otherEssAddBtn = container.querySelector('#edit-other-ess-add-btn');
  const otherCharPickerContainer = container.querySelector('#edit-other-ess-char-picker');

  let otherEssences = Array.isArray(essence.other_essences) ? [...essence.other_essences] : [];
  let editingOtherIdx = null;

  let otherCharPicker = null;
  let selectedCharObject = null; // зберігаємо повний об'єкт обраного персонажа

  if (otherCharPickerContainer) {
    otherCharPicker = new CharacterPicker({
      container: otherCharPickerContainer,
      hiddenInput: container.querySelector('#edit-other-ess-char-id'),
      onSelect: (list) => {
        selectedCharObject = list.length > 0 ? list[0] : null;
        // Якщо поле слага порожнє — автоматично підставляємо сутність персонажа
        const slugInp = container.querySelector('#edit-other-ess-slug');
        if (slugInp && !slugInp.value.trim() && selectedCharObject?.essence) {
          slugInp.value = selectedCharObject.essence;
        }
      }
    });
  }

  const updateOtherEssencesState = () => {
    if (otherEssencesHidden) {
      otherEssencesHidden.value = JSON.stringify(otherEssences);
    }

    if (otherEssAddBtn) {
      otherEssAddBtn.textContent = editingOtherIdx !== null ? 'Зберегти зміни сутності' : '+ Додати сутність';
    }

    if (!otherEssencesList) return;

    if (otherEssences.length === 0) {
      otherEssencesList.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">Пов'язаних сутностей ще не додано</span>`;
      return;
    }

    otherEssencesList.innerHTML = otherEssences.map((item, idx) => {
      const isObj = typeof item === 'object' && item !== null;
      const charName = isObj ? (item.character_name || item.name_uk || item.name || '—') : item;
      const essLabel = isObj ? (item.essence_name || item.essence_slug) : null;
      const img = isObj && item.image ? normalizeImageUrl(item.image) : null;
      const isEditingThis = editingOtherIdx === idx;

      return `
        <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 10px; background:var(--bg-2); border:1px solid ${isEditingThis ? 'var(--accent)' : 'var(--border-s)'}; border-radius:6px; font-size:12px;">
          <span style="width:20px; height:20px; border-radius:50%; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; background:var(--bg-hover);">
            ${img ? `<img src="${escapeHtmlAttribute(img)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.user}
          </span>
          <span>${escapeHtmlAttribute(charName)} ${essLabel ? `<small style="color:#15803d; font-weight:700; font-style:italic;">(Currently ${escapeHtmlAttribute(essLabel)})</small>` : ''}</span>
          <button type="button" class="other-ess-edit-btn" data-idx="${idx}" style="background:none; border:none; cursor:pointer; color:var(--text-muted); padding:2px;" title="Редагувати">${ICON.edit}</button>
          <button type="button" class="other-ess-remove-btn" data-idx="${idx}" style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; font-weight:bold; padding:2px;" title="Видалити">&times;</button>
        </div>
      `;
    }).join('');

    otherEssencesList.querySelectorAll('.other-ess-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = otherEssences[idx];
        if (!item) return;
        editingOtherIdx = idx;

        const isObj = typeof item === 'object' && item !== null;
        container.querySelector('#edit-other-ess-name').value = isObj ? (item.name || '') : item;
        container.querySelector('#edit-other-ess-name-uk').value = isObj ? (item.name_uk || '') : '';
        container.querySelector('#edit-other-ess-slug').value = isObj ? (item.essence_slug || item.slug || '') : item;
        container.querySelector('#edit-other-ess-image').value = isObj ? (item.image || '') : '';
        if (otherCharPicker) {
          otherCharPicker.setSelected(isObj ? (item.character_id || null) : null);
        }
        updateOtherEssencesState();
      });
    });

    otherEssencesList.querySelectorAll('.other-ess-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (editingOtherIdx === idx) {
          editingOtherIdx = null;
        } else if (editingOtherIdx !== null && editingOtherIdx > idx) {
          editingOtherIdx--;
        }
        otherEssences.splice(idx, 1);
        updateOtherEssencesState();
      });
    });
  };

  if (otherEssAddBtn) {
    otherEssAddBtn.addEventListener('click', () => {
      const nameInp = container.querySelector('#edit-other-ess-name');
      const nameUkInp = container.querySelector('#edit-other-ess-name-uk');
      const slugInp = container.querySelector('#edit-other-ess-slug');
      const imgInp = container.querySelector('#edit-other-ess-image');
      const charIdInp = container.querySelector('#edit-other-ess-char-id');

      const name = nameInp.value.trim();
      const name_uk = nameUkInp.value.trim();
      const slugRaw = slugInp.value.trim();
      const image = imgInp.value.trim();
      const charIdVal = charIdInp ? parseInt(charIdInp.value.trim(), 10) : null;
      const character_id = charIdVal && !isNaN(charIdVal) ? charIdVal : null;

      if (!character_id && !name && !slugRaw) {
        alert("Оберіть персонажа або введіть назву/слаг сутності");
        return;
      }

      // Ім'я персонажа — з пікера або з ручного вводу
      const charName = selectedCharObject
        ? (selectedCharObject.name_uk || selectedCharObject.name || null)
        : (name || null);

      // Slug сутності — з ручного вводу або з поля essence персонажа
      const essenceSlug = slugRaw || selectedCharObject?.essence || null;

      const newItem = {
        character_id: character_id || undefined,
        character_name: charName || undefined,
        name: name || undefined,
        name_uk: name_uk || undefined,
        slug: essenceSlug || undefined,
        essence_slug: essenceSlug || undefined,
        image: image || undefined
      };

      if (editingOtherIdx !== null) {
        otherEssences[editingOtherIdx] = newItem;
        editingOtherIdx = null;
      } else {
        otherEssences.push(newItem);
      }

      nameInp.value = '';
      nameUkInp.value = '';
      slugInp.value = '';
      imgInp.value = '';
      selectedCharObject = null;
      if (otherCharPicker) otherCharPicker.clear();
      updateOtherEssencesState();
    });
  }

  updateOtherEssencesState();

  let addVerPicker = null;
  const addVerPickerContainer = container.querySelector('#add-version-char-picker');
  if (addVerPickerContainer) {
    addVerPicker = new CharacterPicker({
      container: addVerPickerContainer,
      hiddenInput: container.querySelector('#add-version-char-id')
    });
    window._addVerPicker = addVerPicker;
  }

  let editVerPicker = null;
  const editVerPickerContainer = container.querySelector('#edit-version-char-picker');
  if (editVerPickerContainer) {
    editVerPicker = new CharacterPicker({
      container: editVerPickerContainer,
      hiddenInput: container.querySelector('#edit-version-char-id')
    });
    window._editVerPicker = editVerPicker;
  }

  const typeSelect = container.querySelector('#add-ver-type-select');
  const charGroup = container.querySelector('#add-ver-char-group');
  const slugGroup = container.querySelector('#add-ver-slug-group');
  const displayNameInput = container.querySelector('#add-ver-display-name');
  const targetSlugInput = container.querySelector('#add-ver-target-slug');

  let isSlugManuallyEdited = false;

  if (targetSlugInput) {
    targetSlugInput.addEventListener('input', () => {
      isSlugManuallyEdited = true;
      targetSlugInput.value = slugify(targetSlugInput.value);
    });
  }

  if (displayNameInput) {
    displayNameInput.addEventListener('input', () => {
      if (!isSlugManuallyEdited && targetSlugInput) {
        targetSlugInput.value = slugify(displayNameInput.value);
      }
    });
  }

  if (typeSelect && charGroup && slugGroup) {
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'essence') {
        charGroup.style.display = 'none';
        slugGroup.style.display = 'block';
        if (displayNameInput && targetSlugInput && !targetSlugInput.value) {
          targetSlugInput.value = slugify(displayNameInput.value);
        }
      } else {
        charGroup.style.display = 'block';
        slugGroup.style.display = 'none';
      }
    });
  }

  const editTypeSelect = container.querySelector('#edit-ver-type-select');
  const editCharGroup = container.querySelector('#edit-ver-char-group');
  const editSlugGroup = container.querySelector('#edit-ver-slug-group');
  const editTargetSlugInput = container.querySelector('#edit-ver-target-slug');

  if (editTargetSlugInput) {
    editTargetSlugInput.addEventListener('input', () => {
      editTargetSlugInput.value = slugify(editTargetSlugInput.value);
    });
  }

  if (editTypeSelect && editCharGroup && editSlugGroup) {
    editTypeSelect.addEventListener('change', () => {
      if (editTypeSelect.value === 'essence') {
        editCharGroup.style.display = 'none';
        editSlugGroup.style.display = 'block';
      } else {
        editCharGroup.style.display = 'block';
        editSlugGroup.style.display = 'none';
      }
    });
  }

  container.querySelector('#btn-edit-essence')?.addEventListener('click', () => openModal('edit-essence-modal'));
  container.querySelector('#edit-ess-cancel')?.addEventListener('click', () => closeModal('edit-essence-modal'));

  container.querySelector('#edit-ess-save')?.addEventListener('click', async () => {
    const form = document.getElementById('edit-essence-form');
    if (!form) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const updated = await API.put(`/essences/${essence.slug}`, data);
      closeModal('edit-essence-modal');
      const newSlug = updated?.slug || data.slug || essence.slug;
      if (newSlug !== essence.slug) {
        window.location.hash = `#/essences/${newSlug}`;
      } else {
        renderEssenceDetail(container, { slug: newSlug });
      }
    } catch (e) {
      alert('Помилка оновлення сутності: ' + (e.message || e));
    }
  });

  const suggestNextOrder = (categoryKey) => {
    const allVersions = essence.characters || [];
    const categoryVersions = allVersions.filter(v => (v.category || 'alter') === categoryKey);
    if (categoryVersions.length === 0) return 1;

    const orders = categoryVersions.map(v => parseInt(v.display_order) || 0);
    const maxOrder = Math.max(...orders, 0);
    return maxOrder + 1;
  };

  const addCategorySelect = container.querySelector('#add-version-form select[name="category"]');
  const addDisplayOrderInput = container.querySelector('#add-version-form input[name="display_order"]');

  if (addCategorySelect && addDisplayOrderInput) {
    addCategorySelect.addEventListener('change', () => {
      addDisplayOrderInput.value = suggestNextOrder(addCategorySelect.value);
    });
  }

  container.querySelector('#add-ver-cancel')?.addEventListener('click', () => closeModal('add-version-modal'));
  container.querySelector('#add-ver-save')?.addEventListener('click', async () => {
    const form = document.getElementById('add-version-form');
    if (!form) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const type = data.essence_type || 'character';
    if (type === 'essence' && !data.target_essence_slug) {
      alert("Для типу 'essence' слаг сутності (target_essence_slug) обов'язковий");
      return;
    }
    if (type !== 'essence' && !data.character_id) {
      alert("Для персонажа/команди character_id обов'язковий");
      return;
    }

    try {
      await API.post(`/essences/${essence.slug}/characters`, data);
      closeModal('add-version-modal');
      renderEssenceDetail(container, { slug: essence.slug });
    } catch (e) {
      alert('Помилка додавання версії: ' + (e.message || e));
    }
  });

  container.querySelector('#edit-ver-cancel')?.addEventListener('click', () => closeModal('edit-version-modal'));
  container.querySelector('#edit-ver-save')?.addEventListener('click', async () => {
    const form = document.getElementById('edit-version-form');
    if (!form) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const relationId = data.relation_id;

    if (!relationId) {
      alert("ID запису відсутній");
      return;
    }

    try {
      await API.put(`/essences/${essence.slug}/characters/${relationId}`, data);
      closeModal('edit-version-modal');
      renderEssenceDetail(container, { slug: essence.slug });
    } catch (e) {
      alert('Помилка оновлення версії: ' + (e.message || e));
    }
  });

  const tabsContainer = container.querySelector('#essence-versions-tabs');
  const tabContentContainer = container.querySelector('#essence-versions-tab-content');

  if (tabsContainer && tabContentContainer) {
    tabsContainer.querySelectorAll('.volume-tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tabsContainer.querySelectorAll('.volume-tab-btn').forEach(b => b.classList.remove('is-active'));
        tabBtn.classList.add('is-active');

        const selectedTabKey = tabBtn.dataset.tab;
        tabContentContainer.innerHTML = renderTabContent(essence.characters || [], selectedTabKey, isModerator());

        initCardHandlers(container, essence, addVerPicker, editVerPicker, addCategorySelect, addDisplayOrderInput, suggestNextOrder, editCharGroup, editSlugGroup);
      });
    });
  }

  initCardHandlers(container, essence, addVerPicker, editVerPicker, addCategorySelect, addDisplayOrderInput, suggestNextOrder, editCharGroup, editSlugGroup);
}

function initCardHandlers(container, essence, addVerPicker, editVerPicker, addCategorySelect, addDisplayOrderInput, suggestNextOrder, editCharGroup, editSlugGroup) {
  container.querySelector('#btn-add-version')?.addEventListener('click', () => {
    if (addVerPicker) {
      addVerPicker.clear();
    }
    const activeTab = container.querySelector('.volume-tab-btn.is-active');
    const currentCat = activeTab ? activeTab.dataset.tab : (addCategorySelect ? addCategorySelect.value : 'alter');
    if (addCategorySelect) {
      addCategorySelect.value = currentCat;
    }
    if (addDisplayOrderInput && suggestNextOrder) {
      addDisplayOrderInput.value = suggestNextOrder(currentCat);
    }
    openModal('add-version-modal');
  });

  container.querySelectorAll('.btn-edit-version').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      try {
        const item = JSON.parse(btn.dataset.item);
        const form = document.getElementById('edit-version-form');
        if (!form) return;

        form.querySelector('#edit-ver-relation-id').value = item.relation_id || '';
        form.querySelector('#edit-ver-category').value = item.category || 'alter';
        form.querySelector('#edit-ver-type-select').value = item.essence_type || 'character';
        form.querySelector('#edit-ver-display-name').value = item.display_name || item.char_name || item.ess_name || '';
        form.querySelector('#edit-ver-display-name-uk').value = item.display_name_uk || item.char_name_uk || item.ess_name_uk || '';
        form.querySelector('#edit-ver-target-slug').value = item.target_essence_slug || '';
        form.querySelector('#edit-ver-image').value = item.custom_image || item.image || '';
        form.querySelector('#edit-ver-display-order').value = item.display_order || 0;
        form.querySelector('#edit-ver-description').value = item.relation_description || item.description || '';

        const charId = item.character_id || '';
        form.querySelector('#edit-version-char-id').value = charId;
        if (editVerPicker) {
          editVerPicker.setSelected(charId);
        }

        if (item.essence_type === 'essence') {
          if (editCharGroup) editCharGroup.style.display = 'none';
          if (editSlugGroup) editSlugGroup.style.display = 'block';
        } else {
          if (editCharGroup) editCharGroup.style.display = 'block';
          if (editSlugGroup) editSlugGroup.style.display = 'none';
        }

        openModal('edit-version-modal');
      } catch (err) {
        console.error('Failed to parse version item:', err);
      }
    };
  });

  container.querySelectorAll('.btn-remove-version').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const relationId = btn.dataset.id;
      if (!confirm('Видалити цей запис з альтернативних версій?')) return;
      try {
        await API.delete(`/essences/${essence.slug}/characters/${relationId}`);
        renderEssenceDetail(container, { slug: essence.slug });
      } catch (err) {
        alert('Помилка видалення: ' + (err.message || err));
      }
    };
  });
}
