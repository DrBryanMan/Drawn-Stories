/**
 * wantedDuplicates.js — розділ перегляду та злиття дублікатів персон за EN іменем у Wanted.
 */
import { API } from '../helpers/api.js';
import { icon } from '../helpers/icons.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { createPaginator } from '../components/Pagination.js';
import { openMergePersonsModal } from '../components/modals/MergePersonsModal.js';

export function createWantedDuplicatesView() {
  const state = {
    search: '',
    sort: 'count',
    order_dir: 'desc',
    page: 1,
    limit: 12,
    loading: false,
    data: null,
    selectedPrimary: null,
    selectedDonor: null,
  };

  let searchTimeout = null;
  const paginator = createPaginator({ pageSize: state.limit });

  async function loadData(container) {
    state.loading = true;
    renderLoading(container);

    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        sort: state.sort,
        order_dir: state.order_dir,
      });
      if (state.search) {
        params.set('search', state.search);
      }

      const res = await API.get(`/wanted/person-duplicates?${params.toString()}`);
      state.data = res;
    } catch (err) {
      console.error('Failed to load person duplicates:', err);
      state.data = { items: [], total: 0, total_persons: 0, page: 1, pages: 1 };
    } finally {
      state.loading = false;
      renderContent(container);
    }
  }

  function renderLoading(container) {
    const listEl = container.querySelector('#wanted-dup-content-area');
    if (listEl) {
      listEl.innerHTML = `
        <div class="wanted-dup-loading">
          ${icon('loader', 28)}
          <span>Завантаження дублікатів персон...</span>
        </div>
      `;
    }
  }

  function handlePersonSelect(person, container) {
    if (state.selectedPrimary && state.selectedPrimary.id === person.id) {
      state.selectedPrimary = null;
    } else if (state.selectedDonor && state.selectedDonor.id === person.id) {
      state.selectedDonor = null;
    } else if (!state.selectedPrimary) {
      state.selectedPrimary = person;
    } else if (!state.selectedDonor) {
      state.selectedDonor = person;
    } else {
      state.selectedDonor = person;
    }

    updateSelectionUI(container);
  }

  function updateSelectionUI(container) {
    // Update cards classes & tags
    container.querySelectorAll('.wanted-dup-person-card').forEach(card => {
      const pid = parseInt(card.dataset.personId, 10);
      const isPrimary = state.selectedPrimary && state.selectedPrimary.id === pid;
      const isDonor = state.selectedDonor && state.selectedDonor.id === pid;

      card.classList.toggle('is-primary-selected', isPrimary);
      card.classList.toggle('is-donor-selected', isDonor);

      const tagEl = card.querySelector('.wanted-dup-select-tag');
      if (tagEl) {
        if (isPrimary) {
          tagEl.className = 'wanted-dup-select-tag is-primary';
          tagEl.innerHTML = `${icon('check', 11)} 1. Основна`;
          tagEl.style.display = 'inline-flex';
        } else if (isDonor) {
          tagEl.className = 'wanted-dup-select-tag is-donor';
          tagEl.innerHTML = `${icon('trash', 11)} 2. Донор`;
          tagEl.style.display = 'inline-flex';
        } else {
          tagEl.style.display = 'none';
        }
      }
    });

    // Update floating merge bar
    const barEl = container.querySelector('#wanted-dup-merge-bar');
    if (barEl) {
      if (state.selectedPrimary && state.selectedDonor) {
        barEl.innerHTML = `
          <div class="wanted-merge-bar-content">
            <div class="wanted-merge-bar-left">
              <span class="wanted-merge-badge">${icon('copy', 13)} Злиття</span>
              <div class="wanted-merge-pair">
                <span class="wanted-merge-chip primary" title="Основна персона #${state.selectedPrimary.id} (залишиться)">
                  ${icon('check', 11)} #${state.selectedPrimary.id}
                </span>
                <span class="wanted-merge-arrow">&larr;</span>
                <span class="wanted-merge-chip donor" title="Персона-донор #${state.selectedDonor.id} (буде видалена)">
                  ${icon('trash', 11)} #${state.selectedDonor.id}
                </span>
              </div>
            </div>
            <div class="wanted-merge-bar-actions">
              <button type="button" class="wanted-merge-btn-cancel" id="btn-cancel-merge-selection">
                Скинути
              </button>
              <button type="button" class="wanted-merge-btn-action" id="btn-open-merge-modal">
                ${icon('copy', 14)}
                <span>Об'єднати</span>
              </button>
            </div>
          </div>
        `;
        barEl.classList.add('is-visible');

        barEl.querySelector('#btn-cancel-merge-selection')?.addEventListener('click', () => {
          state.selectedPrimary = null;
          state.selectedDonor = null;
          updateSelectionUI(container);
        });

        barEl.querySelector('#btn-open-merge-modal')?.addEventListener('click', () => {
          if (state.selectedPrimary && state.selectedDonor) {
            openMergePersonsModal(state.selectedPrimary, state.selectedDonor, () => {
              state.selectedPrimary = null;
              state.selectedDonor = null;
              loadData(container);
            });
          }
        });
      } else if (state.selectedPrimary) {
        barEl.innerHTML = `
          <div class="wanted-merge-bar-content">
            <div class="wanted-merge-bar-left">
              <span class="wanted-merge-badge">${icon('copy', 13)} Злиття</span>
              <span class="wanted-merge-chip primary">1. Основна: #${state.selectedPrimary.id}</span>
              <span class="wanted-merge-bar-hint">Оберіть 2-у персону-донора</span>
            </div>
            <div class="wanted-merge-bar-actions">
              <button type="button" class="wanted-merge-btn-cancel" id="btn-cancel-merge-selection">
                Скасувати
              </button>
            </div>
          </div>
        `;
        barEl.classList.add('is-visible');

        barEl.querySelector('#btn-cancel-merge-selection')?.addEventListener('click', () => {
          state.selectedPrimary = null;
          state.selectedDonor = null;
          updateSelectionUI(container);
        });
      } else {
        barEl.classList.remove('is-visible');
        barEl.innerHTML = '';
      }
    }
  }

  function renderPersonCard(person) {
    const imgUrl = normalizeImageUrl(person.image);
    const posterHtml = imgUrl
      ? `<img src="${escapeHtmlAttribute(imgUrl)}" alt="${escapeHtmlAttribute(person.name)}" loading="lazy">`
      : `<div class="wanted-dup-person-placeholder">${icon('personnel', 28, { strokeWidth: 1.5 })}</div>`;

    const nameUkHtml = person.name_uk 
      ? `<span class="wanted-dup-person-uk">${escapeHtmlAttribute(person.name_uk)}</span>`
      : `<span class="wanted-dup-person-uk is-empty">Немає укр. назви</span>`;

    const pseudoHtml = person.pseudo 
      ? `<span class="wanted-dup-chip" title="Псевдонім">${icon('atSign', 11)} ${escapeHtmlAttribute(person.pseudo)}</span>`
      : '';

    const countryHtml = person.country || person.hometown
      ? `<span class="wanted-dup-chip" title="Країна / Місце">${icon('mapPin', 11)} ${escapeHtmlAttribute(person.country || person.hometown)}</span>`
      : '';

    const volCount = parseInt(person.volumes_count || 0, 10);
    const issCount = parseInt(person.issues_count || 0, 10);

    const volChipClass = volCount > 0 ? 'chip-volumes' : 'chip-zero';
    const issChipClass = issCount > 0 ? 'chip-issues' : 'chip-zero';

    const volChip = `<span class="wanted-dup-chip ${volChipClass}" title="Томи манґи/коміксів">${icon('volumes', 11)} ${volCount} томів</span>`;
    const issChip = `<span class="wanted-dup-chip ${issChipClass}" title="Випуски">${icon('issues', 11)} ${issCount} випусків</span>`;

    const dateFormatted = person.created_at ? new Date(person.created_at).toLocaleDateString('uk-UA') : '';

    const isPrimary = state.selectedPrimary && state.selectedPrimary.id === person.id;
    const isDonor = state.selectedDonor && state.selectedDonor.id === person.id;

    return `
      <div class="wanted-dup-person-card ${isPrimary ? 'is-primary-selected' : ''} ${isDonor ? 'is-donor-selected' : ''}" data-person-id="${person.id}">
        <div class="wanted-dup-person-poster-col">
          <div class="wanted-dup-person-poster">
            ${posterHtml}
          </div>
          <a class="wanted-dup-person-open-btn" href="/#/persons/${person.id}" target="_blank" rel="noopener" title="Відкрити сторінку персони #${person.id}">
            ${icon('externalLink', 12)}
          </a>
        </div>
        <div class="wanted-dup-person-info">
          <div class="wanted-dup-person-head">
            <div class="wanted-dup-head-left">
              <span class="wanted-dup-person-id">#${person.id}</span>
              <span class="wanted-dup-select-tag ${isPrimary ? 'is-primary' : (isDonor ? 'is-donor' : '')}" style="${isPrimary || isDonor ? 'display:inline-flex;' : 'display:none;'}">
                ${isPrimary ? `${icon('check', 10)} Основна` : (isDonor ? `${icon('trash', 10)} Донор` : '')}
              </span>
            </div>
          </div>

          <div class="wanted-dup-person-names">
            <span class="wanted-dup-person-name" title="${escapeHtmlAttribute(person.name)}">${escapeHtmlAttribute(person.name)}</span>
            ${nameUkHtml}
          </div>

          <div class="wanted-dup-person-meta">
            ${pseudoHtml}
            ${countryHtml}
            ${volChip}
            ${issChip}
          </div>

          ${dateFormatted ? `<div class="wanted-dup-person-date">${icon('clock', 10)} Додано: ${dateFormatted}</div>` : ''}
        </div>
      </div>
    `;
  }

  function renderGroupCard(group) {
    const countBadge = `${group.duplicate_count} дублікати`;
    const personsHtml = (group.persons || []).map(renderPersonCard).join('');

    return `
      <div class="wanted-dup-group-card" data-group-name="${escapeHtmlAttribute(group.name)}">
        <div class="wanted-dup-group-head">
          <div class="wanted-dup-group-name-wrap">
            <span class="wanted-dup-group-icon">${icon('copy', 15)}</span>
            <span class="wanted-dup-group-name">${escapeHtmlAttribute(group.name)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="wanted-dup-ignore-btn" data-group-name="${escapeHtmlAttribute(group.name)}" title="Ігнорувати цю групу дублікатів">
              ${icon('eyeOff', 13)}
              <span>Ігнорувати</span>
            </button>
            <span class="wanted-dup-count-badge">${countBadge}</span>
          </div>
        </div>
        <div class="wanted-dup-persons-grid">
          ${personsHtml}
        </div>
      </div>
    `;
  }

  function attachGroupEvents(container) {
    // Ignore button click
    container.querySelectorAll('.wanted-dup-ignore-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const groupName = btn.dataset.groupName;
        if (!groupName) return;

        btn.disabled = true;
        btn.innerHTML = `${icon('loader', 12)} <span>Обробка...</span>`;

        try {
          await API.post('/wanted/person-duplicates/ignore', { name: groupName });
          const groupCard = btn.closest('.wanted-dup-group-card');
          if (groupCard) {
            groupCard.style.transition = 'opacity 0.25s, transform 0.25s';
            groupCard.style.opacity = '0';
            groupCard.style.transform = 'scale(0.97)';
            setTimeout(() => {
              loadData(container);
            }, 250);
          } else {
            loadData(container);
          }
        } catch (err) {
          console.error('Failed to ignore group:', err);
          btn.disabled = false;
          btn.innerHTML = `${icon('eyeOff', 13)} <span>Ігнорувати</span>`;
          alert('Помилка при ігноруванні дублікатів: ' + err.message);
        }
      });
    });

    // Person card click for selection
    const allPersonsMap = {};
    if (state.data && state.data.items) {
      state.data.items.forEach(g => {
        (g.persons || []).forEach(p => {
          allPersonsMap[p.id] = p;
        });
      });
    }

    container.querySelectorAll('.wanted-dup-person-card').forEach(card => {
      const pid = parseInt(card.dataset.personId, 10);
      const person = allPersonsMap[pid];
      if (!person) return;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.wanted-dup-person-open-btn')) return;
        handlePersonSelect(person, container);
      });
    });
  }

  function renderContent(container) {
    const listEl = container.querySelector('#wanted-dup-content-area');
    const statsTotalGroupsEl = container.querySelector('#wanted-dup-total-groups');
    const statsTotalPersonsEl = container.querySelector('#wanted-dup-total-persons');
    const paginationEl = container.querySelector('#wanted-dup-pagination');

    const data = state.data || { items: [], total: 0, total_persons: 0, pages: 1, page: 1 };

    if (statsTotalGroupsEl) statsTotalGroupsEl.textContent = `${data.total || 0} груп`;
    if (statsTotalPersonsEl) statsTotalPersonsEl.textContent = `${data.total_persons || 0} персон`;

    if (!listEl) return;

    if (!data.items || data.items.length === 0) {
      listEl.innerHTML = `
        <div class="wanted-dup-empty-state">
          ${icon('check', 44)}
          <h3 class="wanted-dup-empty-title">Дублікатів не знайдено</h3>
          <p class="wanted-dup-empty-desc">
            ${state.search 
              ? `За пошуковим запитом «${escapeHtmlAttribute(state.search)}» збігів не виявлено.`
              : 'Усі персони мають унікальні англійські імена або всі дублікати вже об\'єднано / проігноровано.'}
          </p>
        </div>
      `;
      if (paginationEl) paginationEl.innerHTML = '';
      updateSelectionUI(container);
      return;
    }

    listEl.innerHTML = `
      <div class="wanted-dup-groups-list">
        ${data.items.map(renderGroupCard).join('')}
      </div>
    `;

    attachGroupEvents(container);
    updateSelectionUI(container);

    if (paginationEl) {
      paginationEl.innerHTML = '';
      paginator.setPage(state.page);
      paginationEl.appendChild(paginator.render(data.total || 0, () => {
        state.page = paginator.getPage();
        loadData(container);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
    }
  }

  function buildTemplate() {
    return `
      <div class="wanted-duplicates-view">
        <div class="wanted-dup-topbar">
          <div class="wanted-dup-title-area">
            <div class="wanted-dup-title-row">
              <h1 class="wanted-dup-title">
                ${icon('copy', 20)}
                Дублікати персон за EN іменем
              </h1>
            </div>
            <div class="wanted-dup-stats-row">
              <span>Виявлено:</span>
              <span class="wanted-dup-stat-badge highlight" id="wanted-dup-total-groups">—</span>
              <span class="wanted-dup-stat-badge" id="wanted-dup-total-persons">—</span>
            </div>
          </div>

          <div class="wanted-dup-toolbar">
            <div class="wanted-dup-search-box">
              ${icon('search', 15)}
              <input
                type="search"
                class="wanted-dup-search-input"
                id="wanted-dup-search"
                placeholder="Пошук за іменем чи укр. назвою..."
                value="${escapeHtmlAttribute(state.search)}"
              />
            </div>

            <select class="wanted-dup-sort-select" id="wanted-dup-sort">
              <option value="count" ${state.sort === 'count' ? 'selected' : ''}>За кількістю дублікатів</option>
              <option value="name" ${state.sort === 'name' ? 'selected' : ''}>За назвою (A-Z)</option>
              <option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>За датою додавання</option>
            </select>
          </div>
        </div>

        <div id="wanted-dup-content-area"></div>
        <div id="wanted-dup-pagination" class="wanted-pagination-wrapper"></div>
        <div id="wanted-dup-merge-bar" class="wanted-merge-floating-bar"></div>
      </div>
    `;
  }

  function attachEvents(container) {
    const searchInput = container.querySelector('#wanted-dup-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          state.search = e.target.value.trim();
          state.page = 1;
          loadData(container);
        }, 300);
      });
    }

    const sortSelect = container.querySelector('#wanted-dup-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        state.page = 1;
        loadData(container);
      });
    }
  }

  return {
    async mount(container) {
      container.innerHTML = buildTemplate();
      attachEvents(container);
      await loadData(container);
    },
  };
}
