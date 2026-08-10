import { API } from '../helpers/api.js';
import { escapeHtmlAttribute } from '../helpers/image.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';
import { icon } from '../helpers/icons.js';
import { getCurrentLanguage, t } from '../helpers/i18n.js';

export const THEME_GROUP_LABELS = {
  type: 'Тип',
  genre: 'Жанр',
  theme: 'Тема',
};

export const getThemeGroupLabels = () => ({
  type: getCurrentLanguage() === 'en' ? 'Type' : 'Тип',
  genre: getCurrentLanguage() === 'en' ? 'Genre' : 'Жанр',
  theme: getCurrentLanguage() === 'en' ? 'Theme' : 'Тема',
});

const LANG_LABELS = {
  'uk': 'Українська',
  'en': 'Англійська',
  'ja': 'Японська',
  'fr': 'Французька',
  'pl': 'Польська',
  'de': 'Німецька',
  'ko': 'Корейська',
  'zh': 'Китайська',
  'it': 'Італійська',
  'es': 'Іспанська',
  'pt': 'Португальська',
  'ru': 'Російська',
};

let allThemes = [];
let themesFuse = null;
let themesPromise = null;
let allPublishers = [];
let publishersFuse = null;
let publishersPromise = null;
let allMagazines = [];
let magazinesFuse = null;
let magazinesPromise = null;

export const loadAllThemes = async () => {
  if (allThemes.length > 0) return allThemes;
  if (themesPromise) return themesPromise;

  themesPromise = (async () => {
    try {
      const data = await API.get('/themes', { limit: 1000 }); // backend allows 1000
      allThemes = data.items || [];
      const lang = getCurrentLanguage() || 'uk';
      const locale = lang === 'en' ? 'en' : 'uk';
      allThemes.sort((a, b) => {
        const nameA = themeLabel(a);
        const nameB = themeLabel(b);
        return nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
      });
      themesFuse = new Fuse(allThemes, {
        keys: ['name', 'ua_name'],
        threshold: 0.35,
        ignoreLocation: true
      });
      return allThemes;
    } catch (e) { 
      console.error('Failed to load themes for Fuse', e); 
      themesPromise = null;
      return []; 
    }
  })();
  return themesPromise;
};

export const loadAllPublishers = async () => {
  if (allPublishers.length > 0) return allPublishers;
  if (publishersPromise) return publishersPromise;

  publishersPromise = (async () => {
    try {
      const data = await API.get('/publishers', { sort: 'volumes', order_dir: 'desc', limit: 500 }); 
      allPublishers = data.items || [];
      publishersFuse = new Fuse(allPublishers, {
        keys: ['name'],
        threshold: 0.35,
        ignoreLocation: true
      });
      return allPublishers;
    } catch (e) { 
      console.error('Failed to load publishers for Fuse', e); 
      publishersPromise = null;
      return []; 
    }
  })();
  return publishersPromise;
};

export const loadAllMagazines = async () => {
  if (allMagazines.length > 0) return allMagazines;
  if (magazinesPromise) return magazinesPromise;

  magazinesPromise = (async () => {
    try {
      const data = await API.get('/catalog', { theme_ids: 35, limit: 500 }); 
      allMagazines = data.items || [];
      allMagazines.sort((a, b) => (b.issue_count || 0) - (a.issue_count || 0));
      magazinesFuse = new Fuse(allMagazines, {
        keys: ['name', 'name_uk', 'name_en'],
        threshold: 0.35,
        ignoreLocation: true
      });
      return allMagazines;
    } catch (e) { 
      console.error('Failed to load magazines for Fuse', e); 
      magazinesPromise = null;
      return []; 
    }
  })();
  return magazinesPromise;
};

export function themeLabel(theme) {
  if (!theme) return '';
  const lang = getCurrentLanguage();
  const raw = (lang === 'en' ? (theme.name || theme.ua_name) : (theme.ua_name || theme.name)) || '';
  return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : '';
}

export function themeIcon(type) {
  return icon(type === 'type' ? 'type' : type === 'genre' ? 'genre' : 'theme', 14, { strokeWidth: 2.1 });
}

export function mountCatalogFilters({
  container,
  selectedPublishers,
  selectedThemes,
  excludedThemes,
  selectedMagazines = [],
  selectedLanguages = [],
  selectedSources = [],
  excludedSources = [],
  onPublishersChange,
  onThemesChange,
  onMagazinesChange,
  onLanguagesChange,
  onSourcesChange,
  onClearAll,
}) {
  if (!container) return;

  let publishers = [...selectedPublishers];
  let themes = [
    ...selectedThemes.map((theme) => ({ ...theme, exclude: false })),
    ...excludedThemes.map((theme) => ({ ...theme, exclude: true })),
  ];
  let magazines = [...selectedMagazines];
  let languages = [...selectedLanguages];
  let sources = [
    ...selectedSources.map(s => ({ id: s, name: s === 'hikka' ? 'Hikka' : s === 'mal' ? 'MAL' : 'ComicVine', exclude: false })),
    ...excludedSources.map(s => ({ id: s, name: s === 'hikka' ? 'Hikka' : s === 'mal' ? 'MAL' : 'ComicVine', exclude: true })),
  ];

  container.innerHTML = `
    <div class="catalog-inline-filter-controls">
      <div class="catalog-inline-filter" id="catalog-inline-publisher-filter">
        <span class="catalog-inline-filter__label" title="Видавництво">${icon('publisher', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-publisher-input placeholder="Видавництво...">
          <div class="catalog-filter-dropdown" data-publisher-dropdown hidden></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-theme-filter">
        <span class="catalog-inline-filter__label" title="Тема">${icon('theme', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-theme-input placeholder="Тема...">
          <div class="catalog-filter-dropdown catalog-filter-dropdown--themes" data-theme-dropdown hidden></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-language-filter">
        <span class="catalog-inline-filter__label" title="Мова">${icon('language', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-language-input placeholder="Мова...">
          <div class="catalog-filter-dropdown" data-language-dropdown hidden></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-source-filter">
        <span class="catalog-inline-filter__label" title="Джерело">${icon('source', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-source-input placeholder="Джерело...">
          <div class="catalog-filter-dropdown" data-source-dropdown hidden></div>
        </div>
      </div>
      <div class="catalog-inline-filter" id="catalog-inline-magazine-filter">
        <span class="catalog-inline-filter__label" title="Журнал">${icon('magazine', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__input-wrap">
          <input class="catalog-inline-filter__input" type="text" data-magazine-input placeholder="Журнал...">
          <div class="catalog-filter-dropdown" data-magazine-dropdown hidden></div>
        </div>
      </div>
    </div>
    <div class="catalog-selected-filters" data-selected-filters hidden>
      <div class="catalog-selected-filter-group" data-publisher-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${icon('publisher', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__chips" data-publisher-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-theme-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${icon('theme', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__chips" data-theme-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-language-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${icon('language', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__chips" data-language-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-source-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${icon('source', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__chips" data-source-chips></div>
      </div>
      <div class="catalog-selected-filter-group" data-magazine-filter-group hidden>
        <span class="catalog-selected-filter-group__label">${icon('magazine', 16, { strokeWidth: 2.1 })}</span>
        <div class="catalog-inline-filter__chips" data-magazine-chips></div>
      </div>
      <button type="button" class="catalog-clear-all-filters-btn" data-clear-all-filters title="Скинути всі фільтри">
        ${icon('trash', 14)}
        <span>Скинути все</span>
      </button>
    </div>
  `;

  const publisherInput = container.querySelector('[data-publisher-input]');
  const publisherDropdown = container.querySelector('[data-publisher-dropdown]');
  const publisherChips = container.querySelector('[data-publisher-chips]');
  const selectedFilters = container.querySelector('[data-selected-filters]');
  const clearAllButton = container.querySelector('[data-clear-all-filters]');
  const publisherGroup = container.querySelector('[data-publisher-filter-group]');
  const themeInput = container.querySelector('[data-theme-input]');
  const themeDropdown = container.querySelector('[data-theme-dropdown]');
  const themeChips = container.querySelector('[data-theme-chips]');
  const themeGroup = container.querySelector('[data-theme-filter-group]');
  const languageInput = container.querySelector('[data-language-input]');
  const languageDropdown = container.querySelector('[data-language-dropdown]');
  const languageChips = container.querySelector('[data-language-chips]');
  const languageGroup = container.querySelector('[data-language-filter-group]');
  const sourceInput = container.querySelector('[data-source-input]');
  const sourceDropdown = container.querySelector('[data-source-dropdown]');
  const sourceChips = container.querySelector('[data-source-chips]');
  const sourceGroup = container.querySelector('[data-source-filter-group]');
  const magazineInput = container.querySelector('[data-magazine-input]');
  const magazineDropdown = container.querySelector('[data-magazine-dropdown]');
  const magazineChips = container.querySelector('[data-magazine-chips]');
  const magazineGroup = container.querySelector('[data-magazine-filter-group]');

  let publisherTimer = null;
  let themeTimer = null;
  let magazineTimer = null;

  const isInsideAny = (target, elements) => elements.some((element) => element && element.contains(target));

  const fireThemeChange = () => {
    onThemesChange(
      themes.filter((theme) => !theme.exclude),
      themes.filter((theme) => theme.exclude),
    );
  };

  const fireSourceChange = () => {
    onSourcesChange(
      sources.filter(s => !s.exclude).map(s => s.id),
      sources.filter(s => s.exclude).map(s => s.id)
    );
  };

  const updateSelectedFiltersVisibility = () => {
    const hasActiveFilters = publishers.length > 0 || themes.length > 0 || magazines.length > 0 || languages.length > 0 || sources.length > 0;
    selectedFilters.hidden = !hasActiveFilters;

    const groups = [publisherGroup, themeGroup, languageGroup, sourceGroup, magazineGroup];
    let isFirst = true;
    groups.forEach((group) => {
      if (group) {
        if (!group.hidden && isFirst) {
          group.classList.add('is-first-visible');
          isFirst = false;
        } else {
          group.classList.remove('is-first-visible');
        }
      }
    });
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

  const renderLanguageChips = () => {
    languageChips.innerHTML = languages.map((lang) => `
      <span class="catalog-selected-filter catalog-selected-filter--language">
        <span>${LANG_LABELS[lang] || lang}</span>
        <button type="button" data-remove-language="${lang}" title="Прибрати мову">×</button>
      </span>
    `).join('');
    languageGroup.hidden = languages.length === 0;
    updateSelectedFiltersVisibility();
  };

  const renderSourceChips = () => {
    sourceChips.innerHTML = sources.map((s) => `
      <span class="catalog-selected-filter catalog-selected-filter--source${s.exclude ? ' is-excluded' : ''}" data-source-id="${s.id}">
        ${icon('source', 16, { strokeWidth: 2.1 })}
        <span>${escapeHtmlAttribute(s.name)}</span>
        <button type="button" data-toggle-source="${s.id}" title="Перемкнути включення/виключення">⇄</button>
        <button type="button" data-remove-source="${s.id}" title="Прибрати">×</button>
      </span>
    `).join('');
    sourceGroup.hidden = sources.length === 0;
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
    if (allPublishers.length === 0) {
      publisherDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Завантаження...</div>';
      publisherDropdown.hidden = false;
    }
    
    await loadAllPublishers();
    let items = [];
    if (!query) {
      items = allPublishers.slice(0, 20);
    } else if (publishersFuse) {
      items = publishersFuse.search(query).map(r => r.item).slice(0, 20);
    }

    publisherDropdown.innerHTML = items.length
      ? items.map((publisher) => {
          const selected = publishers.some((item) => item.id === publisher.id);
          return `
            <button class="catalog-filter-dropdown__item${selected ? ' is-selected' : ''}" type="button" data-publisher-id="${publisher.id}" data-publisher-name="${escapeHtmlAttribute(publisher.name)}">
              <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(publisher.name)}</span>
              <span class="catalog-filter-dropdown__meta">${publisher.volume_count?.toLocaleString('uk-UA') ?? 0}</span>
              ${selected ? `<span class="catalog-filter-state catalog-filter-state--include">${icon('check', 13, { strokeWidth: 2.8 })}</span>` : ''}
            </button>
          `;
        }).join('')
      : '<div class="catalog-filter-dropdown__empty">Нічого не знайдено</div>';
    publisherDropdown.hidden = false;
  };

  const showLanguageDropdown = (query = '') => {
    const commonLangs = ['uk', 'en', 'ja', 'fr', 'pl', 'de', 'ko', 'zh', 'it', 'es', 'pt', 'ru'];
    const items = commonLangs.map(l => ({ id: l, name: LANG_LABELS[l] || l }));
    
    let filtered = items;
    if (query) {
      const fuse = new Fuse(items, { keys: ['name', 'id'], threshold: 0.3 });
      filtered = fuse.search(query).map(r => r.item);
    }

    languageDropdown.innerHTML = filtered.map(lang => {
      const selected = languages.includes(lang.id);
      return `
        <button class="catalog-filter-dropdown__item${selected ? ' is-selected' : ''}" type="button" data-language-id="${lang.id}">
          <span class="catalog-filter-dropdown__name">${lang.name}</span>
          ${selected ? `<span class="catalog-filter-state catalog-filter-state--include">${icon('check', 13, { strokeWidth: 2.8 })}</span>` : ''}
        </button>
      `;
    }).join('');
    languageDropdown.hidden = false;
  };

  const showSourceDropdown = (query = '') => {
    const items = [
        { id: 'hikka', name: 'Hikka' },
        { id: 'mal', name: 'MAL' },
        { id: 'cv', name: 'ComicVine' }
    ];

    let filtered = items;
    if (query) {
      const fuse = new Fuse(items, { keys: ['name'], threshold: 0.3 });
      filtered = fuse.search(query).map(r => r.item);
    }

    sourceDropdown.innerHTML = filtered.map(s => {
        const existing = sources.find(item => item.id === s.id);
        const included = existing && !existing.exclude;
        const excluded = existing && existing.exclude;
        return `
            <div class="catalog-filter-dropdown__item catalog-filter-dropdown__item--source${included ? ' is-included' : ''}${excluded ? ' is-excluded' : ''}" data-source-id="${s.id}" data-source-name="${s.name}">
              <span class="catalog-filter-dropdown__name">${s.name}</span>
              <span class="catalog-filter-dropdown__actions">
                ${included ? `<span class="catalog-filter-state catalog-filter-state--include">${icon('check', 13, { strokeWidth: 2.8 })}</span>` : ''}
                ${excluded ? '<span class="catalog-filter-state catalog-filter-state--exclude">−</span>' : ''}
                <button type="button" data-source-action="include" title="Включити">＋</button>
                <button type="button" data-source-action="exclude" title="Виключити">−</button>
              </span>
            </div>
        `;
    }).join('');
    sourceDropdown.hidden = false;
  };

  const showMagazineDropdown = async (query = '') => {
    if (allMagazines.length === 0) {
      magazineDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Завантаження...</div>';
      magazineDropdown.hidden = false;
    }

    await loadAllMagazines();
    let items = [];
    if (!query) {
      items = allMagazines.slice(0, 20);
    } else if (magazinesFuse) {
      items = magazinesFuse.search(query).map(r => r.item).slice(0, 20);
    }

    magazineDropdown.innerHTML = items.length
      ? items.map((magazine) => {
          const selected = magazines.some((item) => item.id === magazine.id);
          return `
            <button class="catalog-filter-dropdown__item${selected ? ' is-selected' : ''}" type="button" data-magazine-id="${magazine.id}" data-magazine-name="${escapeHtmlAttribute(magazine.name)}">
              <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(magazine.name)}</span>
              ${selected ? `<span class="catalog-filter-state catalog-filter-state--include">${icon('check', 13, { strokeWidth: 2.8 })}</span>` : ''}
            </button>
          `;
        }).join('')
      : '<div class="catalog-filter-dropdown__empty">Нічого не знайдено</div>';
    magazineDropdown.hidden = false;
  };

  const showThemeDropdown = async (query = '') => {
    if (allThemes.length === 0) {
      themeDropdown.innerHTML = '<div class="catalog-filter-dropdown__empty">Завантаження...</div>';
      themeDropdown.hidden = false;
    }

    await loadAllThemes();
    let items = [];
    if (!query) {
      items = allThemes;
    } else if (themesFuse) {
      items = themesFuse.search(query).map(r => r.item);
    }

    const lang = getCurrentLanguage() || 'uk';
    const locale = lang === 'en' ? 'en' : 'uk';

    const groups = { type: [], genre: [], theme: [] };
    items.forEach((theme) => {
      const group = groups[theme.type] ? theme.type : 'theme';
      groups[group].push(theme);
    });

    Object.keys(groups).forEach((groupKey) => {
      groups[groupKey].sort((a, b) => {
        const nameA = themeLabel(a);
        const nameB = themeLabel(b);
        return nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
      });
    });

    const groupLabels = getThemeGroupLabels();
    let html = '';
    Object.entries(groups).forEach(([group, items]) => {
      if (!items.length) return;
      html += `<div class="catalog-filter-dropdown__group">${themeIcon(group)}<span>${groupLabels[group] || THEME_GROUP_LABELS[group] || group}</span></div>`;
      html += items.map((theme) => {
        const existing = themes.find((item) => item.id === theme.id);
        const included = existing && !existing.exclude;
        const excluded = existing && existing.exclude;
        const name = themeLabel(theme);
        return `
          <div class="catalog-filter-dropdown__item catalog-filter-dropdown__item--theme${included ? ' is-included' : ''}${excluded ? ' is-excluded' : ''}" data-theme-id="${theme.id}" data-theme-name="${escapeHtmlAttribute(name)}" data-theme-type="${theme.type || 'theme'}">
            <span class="catalog-filter-dropdown__name">${escapeHtmlAttribute(name)}</span>
            <span class="catalog-filter-dropdown__actions">
              ${included ? `<span class="catalog-filter-state catalog-filter-state--include">${icon('check', 13, { strokeWidth: 2.8 })}</span>` : ''}
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

  const selectSource = (row, exclude) => {
    const id = row.dataset.sourceId;
    const existing = sources.find((s) => s.id === id);

    if (existing) {
      if (existing.exclude === exclude) {
        sources = sources.filter((s) => s.id !== id);
      } else {
        existing.exclude = exclude;
      }
    } else {
      sources.push({
        id,
        name: row.dataset.sourceName,
        exclude,
      });
    }

    fireSourceChange();
    renderSourceChips();
    showSourceDropdown();
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

  languageInput.addEventListener('focus', () => showLanguageDropdown(languageInput.value.trim()));
  languageInput.addEventListener('input', () => showLanguageDropdown(languageInput.value.trim()));
  languageDropdown.addEventListener('click', (event) => {
    const row = event.target.closest('[data-language-id]');
    if (!row) return;

    const id = row.dataset.languageId;
    if (languages.includes(id)) {
      languages = languages.filter(l => l !== id);
    } else {
      languages.push(id);
    }
    languageInput.value = '';
    languageDropdown.hidden = true;
    onLanguagesChange(languages);
    renderLanguageChips();
  });

  languageChips.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-language]');
    if (!button) return;

    languages = languages.filter((l) => l !== button.dataset.removeLanguage);
    onLanguagesChange(languages);
    renderLanguageChips();
    if (!languageDropdown.hidden) showLanguageDropdown(languageInput.value.trim());
  });

  sourceInput.addEventListener('focus', () => showSourceDropdown(sourceInput.value.trim()));
  sourceInput.addEventListener('input', () => showSourceDropdown(sourceInput.value.trim()));
  sourceDropdown.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-source-action]');
    const row = event.target.closest('[data-source-id]');
    if (!row) return;

    selectSource(row, actionButton?.dataset.sourceAction === 'exclude');
    if (!actionButton) {
        sourceInput.value = '';
        sourceDropdown.hidden = true;
    }
  });

  sourceChips.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-source]');
    const toggleButton = event.target.closest('[data-toggle-source]');

    if (removeButton) {
      sources = sources.filter((s) => s.id !== removeButton.dataset.removeSource);
      fireSourceChange();
      renderSourceChips();
    }

    if (toggleButton) {
      const s = sources.find((item) => item.id === toggleButton.dataset.toggleSource);
      if (s) {
        s.exclude = !s.exclude;
        fireSourceChange();
        renderSourceChips();
      }
    }

    if ((removeButton || toggleButton) && !sourceDropdown.hidden) {
      showSourceDropdown(sourceInput.value.trim());
    }
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

    if (!isInsideAny(event.target, [languageInput, languageDropdown])) {
      languageDropdown.hidden = true;
    }

    if (!isInsideAny(event.target, [sourceInput, sourceDropdown])) {
      sourceDropdown.hidden = true;
    }

    if (!isInsideAny(event.target, [magazineInput, magazineDropdown])) {
      magazineDropdown.hidden = true;
    }
  });

  clearAllButton.addEventListener('click', () => {
    publishers = [];
    themes = [];
    magazines = [];
    languages = [];
    sources = [];

    renderPublisherChips();
    renderThemeChips();
    renderLanguageChips();
    renderSourceChips();
    renderMagazineChips();

    publisherInput.value = '';
    themeInput.value = '';
    magazineInput.value = '';

    publisherDropdown.hidden = true;
    themeDropdown.hidden = true;
    languageDropdown.hidden = true;
    sourceDropdown.hidden = true;
    magazineDropdown.hidden = true;

    if (onClearAll) {
      onClearAll();
    } else {
      onPublishersChange(publishers);
      fireThemeChange();
      if (onMagazinesChange) onMagazinesChange(magazines);
      if (onLanguagesChange) onLanguagesChange(languages);
      fireSourceChange();
    }
  });

  renderPublisherChips();
  renderThemeChips();
  renderLanguageChips();
  renderSourceChips();
  renderMagazineChips();

  return {
    setFilters(nextPublishers = [], nextThemes = [], nextExcludedThemes = [], nextMagazines = [], nextLanguages = [], nextSources = [], nextExcludedSources = []) {
      publishers = [...nextPublishers];
      themes = [
        ...nextThemes.map((theme) => ({ ...theme, exclude: false })),
        ...nextExcludedThemes.map((theme) => ({ ...theme, exclude: true })),
      ];
      magazines = [...nextMagazines];
      languages = [...nextLanguages];
      sources = [
        ...nextSources.map(s => ({ id: s, name: s === 'hikka' ? 'Hikka' : s === 'mal' ? 'MAL' : 'ComicVine', exclude: false })),
        ...nextExcludedSources.map(s => ({ id: s, name: s === 'hikka' ? 'Hikka' : s === 'mal' ? 'MAL' : 'ComicVine', exclude: true })),
      ];
      publisherInput.value = '';
      themeInput.value = '';
      magazineInput.value = '';
      publisherDropdown.hidden = true;
      themeDropdown.hidden = true;
      languageDropdown.hidden = true;
      sourceDropdown.hidden = true;
      magazineDropdown.hidden = true;
      renderPublisherChips();
      renderThemeChips();
      renderLanguageChips();
      renderSourceChips();
      renderMagazineChips();
    },
  };
}
