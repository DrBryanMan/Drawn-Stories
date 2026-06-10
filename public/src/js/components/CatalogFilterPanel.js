import { API } from '../helpers/api.js';
import { escapeHtmlAttribute } from '../helpers/image.js';

const ICONS = {
  publisher: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg>',
  theme: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z"/><path d="M7 7h.01"/></svg>',
  type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h18"/></svg>',
  genre: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/><path d="m5 5 14 14"/><path d="m19 5-14 14"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  magazine: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M10 6h8v4h-8V6Z"/></svg>',
};

export const THEME_GROUP_LABELS = {
  type: 'Тип',
  genre: 'Жанр',
  theme: 'Тема',
};

export function themeLabel(theme) {
  return theme.ua_name
    ? `${theme.ua_name.charAt(0).toUpperCase()}${theme.ua_name.slice(1)}`
    : theme.name;
}

export function themeIcon(type) {
  if (type === 'type') return ICONS.type;
  if (type === 'genre') return ICONS.genre;
  return ICONS.theme;
}

export function mountCatalogFilters({
  container,
  selectedPublishers,
  selectedThemes,
  excludedThemes,
  selectedMagazines = [],
  onPublishersChange,
  onThemesChange,
  onMagazinesChange,
}) {
  if (!container) return;

  let publishers = [...selectedPublishers];
  let themes = [
    ...selectedThemes.map((theme) => ({ ...theme, exclude: false })),
    ...excludedThemes.map((theme) => ({ ...theme, exclude: true })),
  ];
  let magazines = [...selectedMagazines];

  container.innerHTML = `
    <div class="catalog-inline-filter-controls">
      <div class="catalog-inline-filter" id="catalog-inline-publisher-filter">
        <span class="catalog-inline-filter__label">${ICONS.publisher}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-publisher-input placeholder="Вибрати видавництво...">
          <div class="catalog-filter-dropdown" data-publisher-dropdown></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-theme-filter">
        <span class="catalog-inline-filter__label">${ICONS.theme}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-theme-input placeholder="Вибрати тему...">
          <div class="catalog-filter-dropdown catalog-filter-dropdown--themes" data-theme-dropdown></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-magazine-filter">
        <span class="catalog-inline-filter__label">${ICONS.magazine}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-magazine-input placeholder="Вибрати журнал...">
          <div class="catalog-filter-dropdown" data-magazine-dropdown></div>
        </div>
      </div>
    </div>
    <div class="catalog-selected-filters" data-selected-filters hidden>
      <div class="catalog-selected-filter-group" data-publisher-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${ICONS.publisher}</span>
        <div class="catalog-inline-filter__chips" data-publisher-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-theme-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${ICONS.theme}</span>
        <div class="catalog-inline-filter__chips" data-theme-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-magazine-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${ICONS.magazine}</span>
        <div class="catalog-inline-filter__chips" data-magazine-chips></div>
      </div>
    </div>
  `;

  const publisherInput = container.querySelector('[data-publisher-input]');
  const publisherDropdown = container.querySelector('[data-publisher-dropdown]');
  const publisherChips = container.querySelector('[data-publisher-chips]');
  const selectedFilters = container.querySelector('[data-selected-filters]');
  const publisherGroup = container.querySelector('[data-publisher-filter-group]');
  const themeInput = container.querySelector('[data-theme-input]');
  const themeDropdown = container.querySelector('[data-theme-dropdown]');
  const themeChips = container.querySelector('[data-theme-chips]');
  const themeGroup = container.querySelector('[data-theme-filter-group]');
  const magazineInput = container.querySelector('[data-magazine-input]');
  const magazineDropdown = container.querySelector('[data-magazine-dropdown]');
  const magazineChips = container.querySelector('[data-magazine-chips]');
  const magazineGroup = container.querySelector('[data-magazine-filter-group]');

  let publisherTimer = null;
  let themeTimer = null;
  let magazineTimer = null;

  const isInsideAny = (target, elements) => elements.some((element) => element.contains(target));

  const fireThemeChange = () => {
    onThemesChange(
      themes.filter((theme) => !theme.exclude),
      themes.filter((theme) => theme.exclude),
    );
  };

  const updateSelectedFiltersVisibility = () => {
    selectedFilters.hidden = publishers.length === 0 && themes.length === 0 && magazines.length === 0;
  };

  const renderPublisherChips = () => {
    publisherChips.innerHTML = publishers.map((publisher) => `
      <span class="catalog-selected-filter catalog-selected-filter--publisher">
        <span>${escapeHtmlAttribute(publisher.name)}</span>
        <button type="button" data-remove-publisher="${publisher.id}" title="Прибрати видавництво">×</button>
      </span>
    `).join('');
    publisherGroup.hidden = publishers.length === 0;
    updateSelectedFiltersVisibility();
  };

  const renderThemeChips = () => {
    themeChips.innerHTML = themes.map((theme) => `
      <span class="catalog-selected-filter catalog-selected-filter--theme${theme.exclude ? ' is-excluded' : ''}">
        ${themeIcon(theme.type)}
        <span>${escapeHtmlAttribute(theme.name)}</span>
        <button type="button" data-toggle-theme="${theme.id}" title="Перемкнути включення/виключення">⇄</button>
        <button type="button" data-remove-theme="${theme.id}" title="Прибрати тему">×</button>
      </span>
    `).join('');
    themeGroup.hidden = themes.length === 0;
    updateSelectedFiltersVisibility();
  };

  const renderMagazineChips = () => {
    if (!magazineChips) return;
    magazineChips.innerHTML = magazines.map((magazine) => `
      <span class="catalog-selected-filter catalog-selected-filter--magazine">
        <span>${escapeHtmlAttribute(magazine.name)}</span>
        <button type="button" data-remove-magazine="${magazine.id}" title="Прибрати журнал">×</button>
      </span>
    `).join('');
    if (magazineGroup) magazineGroup.hidden = magazines.length === 0;
    updateSelectedFiltersVisibility();
  };

  const showPublisherDropdown = async (query = '') => {
    try {
      const data = await API.get('/publishers', {
        search: query || undefined,
        limit: 20,
      });
      const items = data.items || [];
      publisherDropdown.innerHTML = items.length
        ? items.map((publisher) => {
            const selected = publishers.some((item) => item.id === publisher.id);
            return `
              <button class="catalog-filter-dropdown__item${selected ? ' is-selected' : ''}" type="button" data-publisher-id="${publisher.id}" data-publisher-name="${escapeHtmlAttribute(publisher.name)}">
                <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(publisher.name)}</span>
                <span class="catalog-filter-dropdown__meta">${publisher.volume_count?.toLocaleString('uk-UA') ?? 0}</span>
                ${selected ? `<span class="catalog-filter-state catalog-filter-state--include">${ICONS.check}</span>` : ''}
              </button>
            `;
          }).join('')
        : '<div class="catalog-filter-dropdown__empty">Нічого не знайдено</div>';
      publisherDropdown.hidden = false;
    } catch {
      publisherDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Не вдалося завантажити</div>';
      publisherDropdown.hidden = false;
    }
  };

  const showMagazineDropdown = async (query = '') => {
    try {
      const data = await API.get('/catalog', {
        theme_ids: 35,
        search: query || undefined,
        limit: 20,
      });
      const items = data.items || [];
      magazineDropdown.innerHTML = items.length
        ? items.map((magazine) => {
            const selected = magazines.some((item) => item.id === magazine.id);
            return `
              <button class="catalog-filter-dropdown__item${selected ? ' is-selected' : ''}" type="button" data-magazine-id="${magazine.id}" data-magazine-name="${escapeHtmlAttribute(magazine.name)}">
                <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(magazine.name)}</span>
                ${selected ? `<span class="catalog-filter-state catalog-filter-state--include">${ICONS.check}</span>` : ''}
              </button>
            `;
          }).join('')
        : '<div class="catalog-filter-dropdown__empty">Нічого не знайдено</div>';
      magazineDropdown.hidden = false;
    } catch {
      magazineDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Не вдалося завантажити</div>';
      magazineDropdown.hidden = false;
    }
  };

  const showThemeDropdown = async (query = '') => {
    try {
      const data = await API.get('/themes', {
        search: query || undefined,
        limit: query ? 50 : 60,
      });
      const groups = { type: [], genre: [], theme: [] };
      (data.items || []).forEach((theme) => {
        const group = groups[theme.type] ? theme.type : 'theme';
        groups[group].push(theme);
      });

      let html = '';
      Object.entries(groups).forEach(([group, items]) => {
        if (!items.length) return;
        html += `<div class="catalog-filter-dropdown__group">${themeIcon(group)}<span>${THEME_GROUP_LABELS[group]}</span></div>`;
        html += items.map((theme) => {
          const existing = themes.find((item) => item.id === theme.id);
          const included = existing && !existing.exclude;
          const excluded = existing && existing.exclude;
          const name = themeLabel(theme);
          return `
            <div class="catalog-filter-dropdown__item catalog-filter-dropdown__item--theme${included ? ' is-included' : ''}${excluded ? ' is-excluded' : ''}" data-theme-id="${theme.id}" data-theme-name="${escapeHtmlAttribute(name)}" data-theme-type="${theme.type || 'theme'}">
              <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(name)}</span>
              <span class="catalog-filter-dropdown__actions">
                ${included ? `<span class="catalog-filter-state catalog-filter-state--include">${ICONS.check}</span>` : ''}
                ${excluded ? '<span class="catalog-filter-state catalog-filter-state--exclude">−</span>' : ''}
                <button type="button" data-theme-action="include" title="Включити">＋</button>
                <button type="button" data-theme-action="exclude" title="Виключити">−</button>
              </span>
            </div>
          `;
        }).join('');
      });

      themeDropdown.innerHTML = html || '<div class="catalog-filter-dropdown__empty">Нічого не знайдено</div>';
      themeDropdown.hidden = false;
    } catch {
      themeDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Не вдалося завантажити</div>';
      themeDropdown.hidden = false;
    }
  };

  const selectTheme = (row, exclude) => {
    const id = Number(row.dataset.themeId);
    const existing = themes.find((theme) => theme.id === id);

    if (existing) {
      if (existing.exclude === exclude) {
        themes = themes.filter((theme) => theme.id !== id);
      } else {
        existing.exclude = exclude;
      }
    } else {
      themes.push({
        id,
        name: row.dataset.themeName,
        type: row.dataset.themeType,
        exclude,
      });
    }

    fireThemeChange();
    renderThemeChips();
    showThemeDropdown(themeInput.value.trim());
  };

  publisherInput.addEventListener('focus', () => showPublisherDropdown(publisherInput.value.trim()));
  publisherInput.addEventListener('input', () => {
    clearTimeout(publisherTimer);
    publisherTimer = setTimeout(() => showPublisherDropdown(publisherInput.value.trim()), 250);
  });

  publisherDropdown.addEventListener('click', (event) => {
    const row = event.target.closest('[data-publisher-id]');
    if (!row || row.classList.contains('is-selected')) return;

    publishers = [...publishers, {
      id: Number(row.dataset.publisherId),
      name: row.dataset.publisherName,
    }];
    publisherInput.value = '';
    publisherDropdown.hidden = true;
    onPublishersChange(publishers);
    renderPublisherChips();
  });

  publisherChips.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-publisher]');
    if (!button) return;

    publishers = publishers.filter((publisher) => publisher.id !== Number(button.dataset.removePublisher));
    onPublishersChange(publishers);
    renderPublisherChips();
    if (!publisherDropdown.hidden) showPublisherDropdown(publisherInput.value.trim());
  });

  magazineInput.addEventListener('focus', () => showMagazineDropdown(magazineInput.value.trim()));
  magazineInput.addEventListener('input', () => {
    clearTimeout(magazineTimer);
    magazineTimer = setTimeout(() => showMagazineDropdown(magazineInput.value.trim()), 250);
  });

  magazineDropdown.addEventListener('click', (event) => {
    const row = event.target.closest('[data-magazine-id]');
    if (!row || row.classList.contains('is-selected')) return;

    magazines = [...magazines, {
      id: Number(row.dataset.magazineId),
      name: row.dataset.magazineName,
    }];
    magazineInput.value = '';
    magazineDropdown.hidden = true;
    if (onMagazinesChange) onMagazinesChange(magazines);
    renderMagazineChips();
  });

  themeInput.addEventListener('focus', () => showThemeDropdown(themeInput.value.trim()));
  themeInput.addEventListener('input', () => {
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => showThemeDropdown(themeInput.value.trim()), 250);
  });

  themeDropdown.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-theme-action]');
    const row = event.target.closest('[data-theme-id]');
    if (!row) return;

    selectTheme(row, actionButton?.dataset.themeAction === 'exclude');
  });

  themeChips.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-theme]');
    const toggleButton = event.target.closest('[data-toggle-theme]');

    if (removeButton) {
      themes = themes.filter((theme) => theme.id !== Number(removeButton.dataset.removeTheme));
      fireThemeChange();
      renderThemeChips();
    }

    if (toggleButton) {
      const theme = themes.find((item) => item.id === Number(toggleButton.dataset.toggleTheme));
      if (theme) {
        theme.exclude = !theme.exclude;
        fireThemeChange();
        renderThemeChips();
      }
    }

    if ((removeButton || toggleButton) && !themeDropdown.hidden) {
      showThemeDropdown(themeInput.value.trim());
    }
  });

  document.addEventListener('click', (event) => {
    if (!isInsideAny(event.target, [publisherInput, publisherDropdown])) {
      publisherDropdown.hidden = true;
    }

    if (!isInsideAny(event.target, [themeInput, themeDropdown])) {
      themeDropdown.hidden = true;
    }

    if (!isInsideAny(event.target, [magazineInput, magazineDropdown])) {
      magazineDropdown.hidden = true;
    }
  });

  publisherDropdown.hidden = true;
  themeDropdown.hidden = true;
  magazineDropdown.hidden = true;
  renderPublisherChips();
  renderThemeChips();
  renderMagazineChips();

  if (magazineChips) {
    magazineChips.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-magazine]');
      if (!button) return;

      magazines = magazines.filter((m) => m.id !== Number(button.dataset.removeMagazine));
      if (onMagazinesChange) onMagazinesChange(magazines);
      renderMagazineChips();
      if (!magazineDropdown.hidden) showMagazineDropdown(magazineInput.value.trim());
    });
  }

  return {
    setFilters(nextPublishers = [], nextThemes = [], nextExcludedThemes = [], nextMagazines = []) {
      publishers = [...nextPublishers];
      themes = [
        ...nextThemes.map((theme) => ({ ...theme, exclude: false })),
        ...nextExcludedThemes.map((theme) => ({ ...theme, exclude: true })),
      ];
      magazines = [...nextMagazines];
      publisherInput.value = '';
      themeInput.value = '';
      magazineInput.value = '';
      publisherDropdown.hidden = true;
      themeDropdown.hidden = true;
      magazineDropdown.hidden = true;
      renderPublisherChips();
      renderThemeChips();
      renderMagazineChips();
    },
  };
}
