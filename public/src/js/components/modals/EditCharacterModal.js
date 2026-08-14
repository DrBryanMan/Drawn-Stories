import { API } from '../../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';
import { openAddIssueModal } from '../addIssueModal.js';
import { translateOrigin, ORIGIN_TRANSLATIONS } from '../../helpers/character.js';
import { EssencePicker } from '../EssencePicker.js';
import { t, getCurrentLanguage } from '../../helpers/i18n.js';
import { currentUser } from '../../shell.js';

import { icon } from '../../helpers/icons.js';

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

/**
 * Open universal merged modal to edit character details.
 * Works both in public user portal views and admin panel views.
 * 
 * @param {Object} char - The character object data
 * @param {Function} onUpdate - Callback fired on successful save
 */
export function openEditCharacterModal(char, onUpdate) {
  const modalId = 'universal-edit-character-modal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ds-modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;

  const isPrivileged = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
  const personas = parsePersonas(char.personas);
  const genderOptions = `
    <option value="" ${!char.gender ? 'selected' : ''}>${t('gender_unspecified')}</option>
    <option value="1" ${char.gender === 1 ? 'selected' : ''}>${t('gender_male')}</option>
    <option value="2" ${char.gender === 2 ? 'selected' : ''}>${t('gender_female')}</option>
  `;

  const currentLang = getCurrentLanguage();
  const currentCharOrigin = (char.origin || '').trim().toLowerCase();
  let isCurrentOriginMatched = !currentCharOrigin;

  const originOptionsArr = [
    `<option value="" ${!currentCharOrigin ? 'selected' : ''}>— ${t('unspecified') || 'Не вказано'} —</option>`
  ];

  Object.entries(ORIGIN_TRANSLATIONS).forEach(([key, trans]) => {
    const isSelected = !isCurrentOriginMatched && (
      currentCharOrigin === key.toLowerCase() ||
      currentCharOrigin === (trans.uk || '').toLowerCase() ||
      currentCharOrigin === (trans.en || '').toLowerCase()
    );

    if (isSelected) isCurrentOriginMatched = true;
    const label = trans[currentLang] || trans.uk || key;
    originOptionsArr.push(`<option value="${key}" ${isSelected ? 'selected' : ''}>${label}</option>`);
  });

  if (!isCurrentOriginMatched && char.origin) {
    originOptionsArr.push(`<option value="${escapeHtmlAttribute(char.origin)}" selected>${escapeHtmlAttribute(char.origin)}</option>`);
  }

  const originOptions = originOptionsArr.join('');

  modal.innerHTML = `
    <div class="ds-modal ds-modal--large">
      <div class="ds-modal-header">
        <div class="ds-modal-title">${icon('edit', 14)} ${t('edit_character_title')}</div>
        <button class="ds-modal-close" type="button" id="universal-char-close-btn">&times;</button>
      </div>
      <form id="universal-char-edit-form">
        <div class="ds-modal-body">
          <div class="admin-form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Group 1: Основні дані -->
            <div class="admin-form-section-title" style="grid-column: span 2; font-weight: 800; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; margin-top: 8px; text-transform: uppercase; font-size: 12px; color: var(--accent);">${t('group_main_info')}</div>

            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('original_name')} *</label>
              <input type="text" name="name" class="admin-input" value="${escapeHtmlAttribute(char.name || '')}" required>
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('ukrainian_name')}</label>
              <input type="text" name="name_uk" class="admin-input" value="${escapeHtmlAttribute(char.name_uk || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('real_name_original')}</label>
              <input type="text" name="real_name" class="admin-input" value="${escapeHtmlAttribute(char.real_name || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('real_name_ukrainian')}</label>
              <input type="text" name="real_name_uk" class="admin-input" value="${escapeHtmlAttribute(char.real_name_uk || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('franchise')}</label>
              <input type="text" name="franchise" class="admin-input" value="${escapeHtmlAttribute(char.franchise || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('earth_universe')}</label>
              <input type="text" name="earth" class="admin-input" value="${escapeHtmlAttribute(char.earth || '')}" placeholder="Earth-616, Earth-65">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('origin_species')}</label>
              <select name="origin" class="admin-input">${originOptions}</select>
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('gender')}</label>
              <select name="gender" class="admin-input">${genderOptions}</select>
            </div>

            <!-- Group: Зображення -->
            <div class="admin-form-section-title" style="grid-column: span 2; font-weight: 800; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; margin-top: 8px; text-transform: uppercase; font-size: 12px; color: var(--accent);">${t('group_images')}</div>

            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('url_main_photo')}</label>
              <input type="text" name="image" class="admin-input" value="${escapeHtmlAttribute(char.image || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('url_portrait')}</label>
              <input type="text" name="portret_img" class="admin-input" value="${escapeHtmlAttribute(char.portret_img || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('url_costume')}</label>
              <input type="text" name="costume_img" class="admin-input" value="${escapeHtmlAttribute(char.costume_img || '')}">
            </div>
            <div class="admin-form-group">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('url_portrait_costume')}</label>
              <input type="text" name="portret_costume_img" class="admin-input" value="${escapeHtmlAttribute(char.portret_costume_img || '')}">
            </div>

            <!-- Group: Пошук та вибір -->
            <div class="admin-form-section-title" style="grid-column: span 2; font-weight: 800; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; margin-top: 8px; text-transform: uppercase; font-size: 12px; color: var(--accent);">${t('group_search_select')}</div>

            <div class="admin-form-group admin-form-group--full" style="grid-column: span 2;">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('creators_search_label')}</label>
              <div class="creators-selector-container">
                <div class="creators-badges-wrap" id="universal-creators-badges" style="display:flex; flex-wrap:wrap; gap: 10px;"></div>
                <div class="creator-search-box" style="position:relative;">
                  <input type="text" id="universal-creator-search" class="admin-input" placeholder="${escapeHtmlAttribute(t('enter_creator_name'))}" autocomplete="off">
                  <div class="creator-search-dropdown" id="universal-creator-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border:1px solid var(--border-s); border-radius:4px; max-height:200px; overflow-y:auto; z-index:10005;"></div>
                </div>
              </div>
              <input type="hidden" name="creators" id="universal-creators-hidden" value="${escapeHtmlAttribute(char.creators || '')}">
            </div>

            <div class="admin-form-group admin-form-group--full" style="grid-column: span 2;">
              <label class="admin-label" style="font-size: 12px; font-weight: bold; color: var(--text-muted);">${t('essence')}</label>
              <input type="hidden" name="essence" id="universal-char-essence-input" value="${escapeHtmlAttribute(char.essence || '')}">
              <div id="universal-char-essence-picker"></div>
            </div>

            ${isPrivileged ? `
            <!-- Group: Окремі особистості (Personas) -->
            <div class="admin-form-section-title" style="grid-column: span 2; font-weight: 800; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; margin-top: 8px; text-transform: uppercase; font-size: 12px; color: var(--accent);">${t('group_personas')}</div>

            <div class="admin-form-group admin-form-group--full" style="grid-column: span 2;">
              <div class="personas-manager-container">
                <div class="personas-list-wrap" id="universal-personas-list" style="display:flex; flex-wrap:wrap; gap: 10px;"></div>
                
                <div class="persona-add-form" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:12px; background:var(--bg-2); border-radius:6px; border:1px dashed var(--border-s);">
                  <input type="text" id="universal-persona-name" class="admin-input" placeholder="${escapeHtmlAttribute(t('persona_name_placeholder'))}">
                  <input type="text" id="universal-persona-name-uk" class="admin-input" placeholder="${escapeHtmlAttribute(t('persona_name_uk_placeholder'))}">
                  <input type="text" id="universal-persona-image" class="admin-input" placeholder="${escapeHtmlAttribute(t('persona_image_placeholder'))}" style="grid-column: span 2;">
                  
                  <div class="persona-issue-search-box" style="grid-column: span 2; position: relative;">
                    <div style="display: flex; gap: 8px;">
                      <input type="text" id="universal-persona-app" class="admin-input" placeholder="${escapeHtmlAttribute(t('first_appearance_placeholder'))}" style="flex: 1;" autocomplete="off">
                      <button type="button" id="universal-persona-issue-btn" class="btn-admin btn-admin--secondary" style="white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                        ${icon('book', 14)} ${t('database_btn')}
                      </button>
                    </div>
                    <div class="persona-issue-dropdown" id="universal-persona-issue-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border:1px solid var(--border-s); border-radius:4px; max-height:160px; overflow-y:auto; z-index:10005;"></div>
                    <div id="universal-persona-selected-issue" style="margin-top: 4px;"></div>
                  </div>

                  <button type="button" id="universal-persona-add" class="btn-admin btn-admin--secondary" style="grid-column: span 2;">${t('add_persona_btn')}</button>
                </div>
              </div>
              <input type="hidden" name="personas" id="universal-personas-hidden" value="${escapeHtmlAttribute(JSON.stringify(personas))}">
            </div>
            ` : ''}
          </div>
        </div>
        <div class="ds-modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-top:1px solid var(--border-s);">
          <div style="display:flex; gap:8px; align-items:center;">
            ${currentUser && currentUser.role === 'admin' && char.id ? `
              <button type="button" class="btn-admin btn-admin--danger" id="universal-char-delete-btn" title="${escapeHtmlAttribute(t('delete_from_db'))}" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">${icon('trash', 14)}</button>
            ` : ''}
            ${(!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator' && currentUser.role !== 'editor')) ? `
              <input type="text" id="universal-char-propose-comment" class="admin-input" placeholder="${t('edit_comment_placeholder')}" style="max-width: 260px; font-size: 12px; height: 32px; margin-bottom: 0;">
            ` : ''}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn-admin btn-admin--secondary" type="button" id="universal-char-cancel-btn">${t('cancel')}</button>
            ${(() => {
              const role = currentUser ? currentUser.role : null;
              if (role === 'admin') {
                return `
                  <button type="button" class="btn-admin btn-admin--primary btn-admin--purple" id="universal-char-save-direct">${t('save_to_db')}</button>
                  <button type="button" class="btn-admin btn-admin--primary" id="universal-char-save-approve" style="background: var(--green);">${t('save_and_approve')}</button>
                `;
              } else if (role === 'moderator' || role === 'editor') {
                return `
                  <button type="button" class="btn-admin btn-admin--primary" id="universal-char-save-approve" style="background: var(--green);">${t('save_and_approve')}</button>
                `;
              } else {
                return `
                  <button type="button" class="btn-admin btn-admin--primary" id="universal-char-save-propose" style="background: var(--yellow);">${t('propose_edit')}</button>
                `;
              }
            })()}
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
  };

  // Close handlers
  modal.querySelector('#universal-char-close-btn').addEventListener('click', close);
  modal.querySelector('#universal-char-cancel-btn').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // Initialize EssencePicker
  const essencePickerContainer = modal.querySelector('#universal-char-essence-picker');
  if (essencePickerContainer) {
    new EssencePicker({
      container: essencePickerContainer,
      hiddenInput: modal.querySelector('#universal-char-essence-input'),
      initialSlug: char.essence || ''
    });
  }

  // Creators Selector Logic
  const creatorsBadges = modal.querySelector('#universal-creators-badges');
  const creatorSearch = modal.querySelector('#universal-creator-search');
  const creatorDropdown = modal.querySelector('#universal-creator-dropdown');
  const creatorsHidden = modal.querySelector('#universal-creators-hidden');

  let selectedCreators = char.creators 
    ? char.creators.split(/[,;]/).map(c => c.trim()).filter(Boolean)
    : [];
  let creatorDetails = {};

  if (selectedCreators.length > 0) {
    API.get('/persons', { search: selectedCreators[0], limit: 10 }).then(res => {
      (res.items || []).forEach(p => {
        creatorDetails[p.name.toLowerCase()] = p;
        if (p.name_uk) creatorDetails[p.name_uk.toLowerCase()] = p;
      });
      updateCreatorsState();
    }).catch(() => {});
  }

  const updateCreatorsState = () => {
    creatorsHidden.value = selectedCreators.join(', ');
    if (selectedCreators.length === 0) {
      creatorsBadges.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">Творців не обрано</span>`;
      return;
    }

    creatorsBadges.innerHTML = selectedCreators.map(name => {
      const detail = creatorDetails[name.toLowerCase()] || {};
      const imgUrl = detail.image ? normalizeImageUrl(detail.image) : null;
      const displayName = escapeHtmlAttribute(name);

      return `
        <span class="creator-badge-tag" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; background:var(--bg-2); border:1px solid var(--border-s); border-radius:12px; font-size:11px;">
          <span style="width:16px; height:16px; border-radius:50%; overflow:hidden; display:inline-block;">
            ${imgUrl ? `<img src="${escapeHtmlAttribute(imgUrl)}" style="width:100%;height:100%;object-fit:cover;">` : icon('user', 14)}
          </span>
          <span>${displayName}</span>
          <button type="button" class="creator-badge-remove" data-remove-name="${displayName}" style="background:none; border:none; cursor:pointer; font-weight:bold; margin-left:4px;">&times;</button>
        </span>
      `;
    }).join('');

    creatorsBadges.querySelectorAll('.creator-badge-remove').forEach(btn => {
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
    creatorSearch.value = '';
    creatorDropdown.style.display = 'none';
  };

  updateCreatorsState();

  let searchDebounceTimer = null;
  creatorSearch.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);
    if (query.length < 2) {
      creatorDropdown.style.display = 'none';
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await API.get('/persons', { search: query, limit: 6 });
        const items = res.items || [];
        creatorDropdown.style.display = 'block';

        if (items.length === 0) {
          creatorDropdown.innerHTML = `
            <div class="creator-search-item" id="add-custom-creator-btn-u" style="padding:8px; cursor:pointer; color:var(--text-muted); font-size:12px;">
              ${t('add_custom_creator', { query: escapeHtmlAttribute(query) })}
            </div>
          `;
          creatorDropdown.querySelector('#add-custom-creator-btn-u')?.addEventListener('click', () => addCreator(query));
          return;
        }

        creatorDropdown.innerHTML = items.map(person => {
          const pName = person.name_uk || person.name;
          const pImg = normalizeImageUrl(person.image);
          const isAlreadyAdded = selectedCreators.some(c => c.toLowerCase() === person.name.toLowerCase() || c.toLowerCase() === pName.toLowerCase());

          return `
            <div class="creator-search-item" data-person-name="${escapeHtmlAttribute(person.name)}" data-person-img="${escapeHtmlAttribute(person.image || '')}" style="display:flex; align-items:center; gap:8px; padding:6px 12px; cursor:pointer; border-bottom:1px solid var(--border-s); font-size:12px;">
              <span style="width:20px; height:20px; border-radius:50%; overflow:hidden; display:inline-block;">
                ${pImg ? `<img src="${escapeHtmlAttribute(pImg)}" style="width:100%;height:100%;object-fit:cover;">` : icon('user', 14)}
              </span>
              <span>${escapeHtmlAttribute(pName)}</span>
              ${isAlreadyAdded ? `<span style="margin-left:auto; font-size:10px; color:var(--accent); font-weight:700;">${t('selected')}</span>` : ''}
            </div>
          `;
        }).join('');

        creatorDropdown.querySelectorAll('.creator-search-item').forEach(item => {
          item.addEventListener('click', () => {
            addCreator(item.dataset.personName, { image: item.dataset.personImg });
          });
        });
      } catch (err) {
        console.error(err);
      }
    }, 250);
  });

  creatorSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = creatorSearch.value.trim();
      if (query) addCreator(query);
    }
  });

  document.addEventListener('click', (e) => {
    if (!creatorSearch.contains(e.target) && !creatorDropdown.contains(e.target)) {
      creatorDropdown.style.display = 'none';
    }
  });

  // Personas Manager Logic
  const personasList = modal.querySelector('#universal-personas-list');
  const personasHidden = modal.querySelector('#universal-personas-hidden');
  const personaAdd = modal.querySelector('#universal-persona-add');
  const personaIssueBtn = modal.querySelector('#universal-persona-issue-btn');
  const personaSelectedIssue = modal.querySelector('#universal-persona-selected-issue');

  let selectedPersonaIssue = null;
  let editingPersonaIdx = null;

  const renderSelectedPersonaIssue = () => {
    if (!personaSelectedIssue) return;
    if (!selectedPersonaIssue) {
      personaSelectedIssue.innerHTML = '';
      return;
    }
    personaSelectedIssue.innerHTML = `
      <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; background:var(--bg-card); border:1px solid var(--border-s); border-radius:4px; font-size:11px; margin-top:4px;">
        ${icon('book', 14)} <span>Випуск #${selectedPersonaIssue.id}: ${escapeHtmlAttribute(selectedPersonaIssue.title)}</span>
        <button type="button" id="remove-persona-issue-btn-u" style="background:none; border:none; cursor:pointer; font-weight:bold;">&times;</button>
      </div>
    `;
    personaSelectedIssue.querySelector('#remove-persona-issue-btn-u')?.addEventListener('click', () => {
      selectedPersonaIssue = null;
      renderSelectedPersonaIssue();
    });
  };

  if (personaIssueBtn) {
    personaIssueBtn.addEventListener('click', () => {
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

              selectedPersonaIssue = { id: issueId, title: displayTitle };
              renderSelectedPersonaIssue();
              const appInp = modal.querySelector('#universal-persona-app');
              if (appInp) appInp.value = displayTitle;
            } catch (err) {
              selectedPersonaIssue = { id: issueId, title: `Випуск #${issueId}` };
              renderSelectedPersonaIssue();
            }
          }
        }
      });
    });
  }

  const updatePersonasState = () => {
    personasHidden.value = JSON.stringify(personas);
    if (editingPersonaIdx !== null) {
      personaAdd.textContent = t('save_persona_changes_btn');
    } else {
      personaAdd.textContent = t('add_persona_btn');
    }

    if (personas.length === 0) {
      personasList.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">${t('no_personas_added')}</span>`;
      return;
    }

    personasList.innerHTML = personas.map((p, idx) => {
      const pImg = p.image ? normalizeImageUrl(p.image) : null;
      const isEditingThis = editingPersonaIdx === idx;
      return `
        <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 8px; background:var(--bg-2); border:1px solid ${isEditingThis ? 'var(--accent)' : 'var(--border-s)'}; border-radius:6px; font-size:11px;">
          <span style="width:16px; height:16px; border-radius:50%; overflow:hidden; display:inline-block;">
            ${pImg ? `<img src="${escapeHtmlAttribute(pImg)}" style="width:100%;height:100%;object-fit:cover;">` : icon('user', 14)}
          </span>
          <span>${escapeHtmlAttribute(p.name_uk || p.name)}</span>
          <button type="button" class="persona-edit-btn-u" data-idx="${idx}" style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:10px;">✏️</button>
          <button type="button" class="persona-remove-btn-u" data-idx="${idx}" style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-weight:bold; font-size:12px;">&times;</button>
        </div>
      `;
    }).join('');

    personasList.querySelectorAll('.persona-edit-btn-u').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const p = personas[idx];
        if (!p) return;
        editingPersonaIdx = idx;

        modal.querySelector('#universal-persona-name').value = p.name || '';
        modal.querySelector('#universal-persona-name-uk').value = p.name_uk || '';
        modal.querySelector('#universal-persona-image').value = p.image || '';
        modal.querySelector('#universal-persona-app').value = p.first_appearance || '';

        if (p.issue_id) {
          selectedPersonaIssue = { id: p.issue_id, title: p.first_appearance || `Випуск #${p.issue_id}` };
        } else {
          selectedPersonaIssue = null;
        }
        renderSelectedPersonaIssue();
        updatePersonasState();
      });
    });

    personasList.querySelectorAll('.persona-remove-btn-u').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (editingPersonaIdx === idx) {
          editingPersonaIdx = null;
        } else if (editingPersonaIdx !== null && editingPersonaIdx > idx) {
          editingPersonaIdx--;
        }
        personas.splice(idx, 1);
        updatePersonasState();
      })
    })
  }

  if (personaAdd) {
    personaAdd.addEventListener('click', async () => {
      const nameInp = modal.querySelector('#universal-persona-name');
      const nameUkInp = modal.querySelector('#universal-persona-name-uk');
      const imgInp = modal.querySelector('#universal-persona-image');
      const appInp = modal.querySelector('#universal-persona-app');

      const pName = nameInp ? nameInp.value.trim() : '';
      if (!pName) {
        alert(t('enter_persona_name_alert'));
        return;
      }

      const manualApp = appInp ? appInp.value.trim() || null : null;
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

      const obj = {
        name: pName,
        name_uk: nameUkInp ? nameUkInp.value.trim() || null : null,
        image: imgInp ? imgInp.value.trim() || null : null,
        first_appearance: firstAppTitle,
        issue_id: issueId
      };

      if (editingPersonaIdx !== null) {
        personas[editingPersonaIdx] = obj;
        editingPersonaIdx = null;
      } else {
        personas.push(obj);
      }

      if (nameInp) nameInp.value = '';
      if (nameUkInp) nameUkInp.value = '';
      if (imgInp) imgInp.value = '';
      if (appInp) appInp.value = '';

      selectedPersonaIssue = null;
      renderSelectedPersonaIssue();
      updatePersonasState();
    });
  }

  if (isPrivileged && personasList) {
    updatePersonasState();
  }

  // Save changes
  const form = modal.querySelector('#universal-char-edit-form');
  const handleSave = async (actionType = 'approve') => {
    const formData = new FormData(form);
    const data = {
      name: formData.get('name').trim(),
      name_uk: formData.get('name_uk').trim() || null,
      real_name: formData.get('real_name').trim() || null,
      real_name_uk: formData.get('real_name_uk').trim() || null,
      gender: formData.get('gender') ? Number(formData.get('gender')) : null,
      creators: formData.get('creators').trim() || null,
      franchise: formData.get('franchise').trim() || null,
      essence: formData.get('essence') || null,
      origin: formData.get('origin').trim() || null,
      earth: formData.get('earth').trim() || null,
      image: formData.get('image').trim() || null,
      portret_img: formData.get('portret_img').trim() || null,
      costume_img: formData.get('costume_img').trim() || null,
      portret_costume_img: formData.get('portret_costume_img').trim() || null
    };

    if (isPrivileged) {
      data.personas = JSON.stringify(personas);
    }

    if (!data.name) {
      alert(t('original_name') + ' ' + t('required'));
      return;
    }

    const commentInput = modal.querySelector('#universal-char-propose-comment');
    const comment = commentInput ? commentInput.value.trim() : '';

    try {
      if (actionType === 'direct') {
        await API.put(`/characters/${char.id}`, data);
      } else {
        const autoApprove = actionType === 'approve';
        await API.post('/edits', {
          entity_type: 'character',
          entity_id: char.id,
          patch_data: data,
          auto_approve: autoApprove,
          comment: comment
        });
      }
      close();
      if (onUpdate) onUpdate(data);
    } catch (err) {
      alert(t('error_saving', { error: err.message || err }));
    }
  };

  form.addEventListener('submit', (e) => e.preventDefault());
  modal.querySelector('#universal-char-save-direct')?.addEventListener('click', () => handleSave('direct'));
  modal.querySelector('#universal-char-save-approve')?.addEventListener('click', () => handleSave('approve'));
  modal.querySelector('#universal-char-save-propose')?.addEventListener('click', () => handleSave('propose'));

  // Delete Character Button
  modal.querySelector('#universal-char-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(t('confirm_delete_character', { name: char.name }))) return;
    try {
      await API.delete(`/characters/${char.id}`);
      close();
      if (onUpdate) onUpdate(null);
    } catch (err) {
      alert(t('error_deleting') + ': ' + (err.message || err));
    }
  });
}
