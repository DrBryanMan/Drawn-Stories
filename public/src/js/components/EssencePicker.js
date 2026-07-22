/* public/src/js/components/EssencePicker.js */
import { API } from '../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../helpers/image.js';

const ICON = {
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  sparkles: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

/**
 * EssencePicker — компонент для вибору сутності з БД (з пошуком за назвою чи слагом).
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container - Контейнер для рендерингу UI
 * @param {HTMLInputElement} opts.hiddenInput - Прихований інпут для запису обраного slug
 * @param {string} [opts.initialSlug] - Початковий slug сутності
 * @param {Function} [opts.onSelect] - Коллбек при виборі сутності
 */
export class EssencePicker {
  constructor(opts) {
    this.container = opts.container;
    this.hiddenInput = opts.hiddenInput;
    this.onSelect = opts.onSelect || null;
    this.selectedEssence = null; // { slug, essence_name, essence_name_uk, image, ... }
    this.searchTimeout = null;

    this.render();
    if (opts.initialSlug) {
      this.loadInitial(opts.initialSlug);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="essence-picker-wrap" style="position: relative;">
        <div class="essence-selected-badge" style="margin-bottom: 10px;"></div>

        <div class="essence-picker-inputs" style="display: flex; gap: 8px;">
          <div class="essence-picker-name-field" style="position: relative; flex: 2;">
            <input type="text" class="admin-input essence-search-input" placeholder="Шукати сутність за назвою (напр. Спідвей)..." autocomplete="off">
          </div>
          <div class="essence-picker-slug-field" style="position: relative; flex: 1;">
            <input type="text" class="admin-input essence-slug-input" placeholder="Або введіть slug..." autocomplete="off">
          </div>
        </div>

        <div class="essence-picker-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 6px; max-height: 220px; overflow-y: auto; z-index: 10010; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-top: 4px;"></div>
      </div>
    `;

    this.searchInput = this.container.querySelector('.essence-search-input');
    this.slugInput = this.container.querySelector('.essence-slug-input');
    this.resultsContainer = this.container.querySelector('.essence-picker-results');
    this.badgeContainer = this.container.querySelector('.essence-selected-badge');

    this.bindEvents();
  }

  bindEvents() {
    const handleSearchInput = () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.fetchSearch(), 250);
    };

    this.searchInput.addEventListener('input', handleSearchInput);
    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim()) this.fetchSearch();
    });

    // Пряме введення/ручний slug
    const handleDirectSlug = () => {
      const slugVal = this.slugInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      if (slugVal) {
        this.selectBySlug(slugVal);
      }
    };

    this.slugInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDirectSlug();
      }
    });

    this.slugInput.addEventListener('blur', () => {
      if (this.slugInput.value.trim() && (!this.selectedEssence || this.selectedEssence.slug !== this.slugInput.value.trim())) {
        handleDirectSlug();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.resultsContainer.style.display = 'none';
      }
    });
  }

  async loadInitial(initialSlug) {
    if (!initialSlug) return;
    await this.selectBySlug(initialSlug);
  }

  async selectBySlug(slug) {
    if (!slug) {
      this.clear();
      return;
    }
    try {
      // Спробуємо завантажити деталі сутності з API
      const res = await API.get('/essences', { search: slug, limit: 10 });
      const items = res.items || (Array.isArray(res) ? res : []);
      const matched = items.find(e => e.slug === slug) || items[0];

      if (matched) {
        this.selectedEssence = matched;
      } else {
        // Якщо точний об'єкт не знайдено в списку — створимо локальний опис за слагом
        this.selectedEssence = {
          slug: slug,
          essence_name: slug,
          essence_name_uk: slug
        };
      }
    } catch (e) {
      this.selectedEssence = {
        slug: slug,
        essence_name: slug,
        essence_name_uk: slug
      };
    }
    this.updateUI();
  }

  async fetchSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.resultsContainer.style.display = 'none';
      return;
    }

    this.resultsContainer.style.display = 'block';
    this.resultsContainer.innerHTML = '<div style="padding: 8px 12px; font-size: 12px; color: var(--text-muted);">Пошук сутностей...</div>';

    try {
      const res = await API.get('/essences', { search: query, limit: 15 });
      const items = res.items || (Array.isArray(res) ? res : []);
      this.renderResults(items, query);
    } catch (err) {
      this.resultsContainer.innerHTML = `<div style="padding: 8px 12px; font-size: 12px; color: #ef4444;">Помилка пошуку: ${err.message || ''}</div>`;
    }
  }

  renderResults(items, query) {
    if (!items || items.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="padding: 8px 12px; font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px;">
          <span>Сутності "${escapeHtmlAttribute(query)}" не знайдено в списку.</span>
          <button type="button" class="btn-admin btn-admin--secondary" id="essence-use-custom-slug" style="font-size:11px; padding:4px 8px; margin-top:4px;">
            Використати як слаг: "${escapeHtmlAttribute(query.toLowerCase().replace(/\s+/g, '-'))}"
          </button>
        </div>
      `;
      this.resultsContainer.querySelector('#essence-use-custom-slug')?.addEventListener('click', () => {
        const customSlug = query.toLowerCase().replace(/\s+/g, '-');
        this.selectBySlug(customSlug);
        this.resultsContainer.style.display = 'none';
      });
      return;
    }

    this.resultsContainer.innerHTML = items.map(item => {
      const name = item.essence_name_uk || item.essence_name || item.slug;
      const img = item.image ? normalizeImageUrl(item.image) : null;
      const isSelected = this.selectedEssence && this.selectedEssence.slug === item.slug;

      return `
        <div class="essence-picker-item" data-slug="${escapeHtmlAttribute(item.slug)}" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; border-bottom: 1px solid var(--border-s); font-size: 12px; background: ${isSelected ? 'var(--bg-2)' : 'transparent'};">
          <div style="width: 24px; height: 24px; border-radius: 4px; overflow: hidden; background: var(--bg-2); display: flex; align-items: center; justify-content: center;">
            ${img ? `<img src="${escapeHtmlAttribute(img)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.sparkles}
          </div>
          <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
            <span style="font-weight: 600; color: var(--text);">${escapeHtmlAttribute(name)}</span>
            <span style="font-size: 10px; color: var(--text-muted);">${escapeHtmlAttribute(item.slug)}</span>
          </div>
          ${isSelected ? `<span style="font-size: 10px; color: var(--accent); font-weight: bold;">Обрано</span>` : ''}
        </div>
      `;
    }).join('');

    this.resultsContainer.querySelectorAll('.essence-picker-item').forEach(el => {
      el.addEventListener('click', () => {
        const slug = el.dataset.slug;
        const itemObj = items.find(i => i.slug === slug);
        if (itemObj) {
          this.selectedEssence = itemObj;
          this.updateUI();
        } else {
          this.selectBySlug(slug);
        }
        this.resultsContainer.style.display = 'none';
      });
    });
  }

  clear() {
    this.selectedEssence = null;
    if (this.hiddenInput) this.hiddenInput.value = '';
    if (this.searchInput) this.searchInput.value = '';
    if (this.slugInput) this.slugInput.value = '';
    this.updateUI();
  }

  updateUI() {
    if (this.selectedEssence) {
      const slug = this.selectedEssence.slug;
      if (this.hiddenInput) this.hiddenInput.value = slug;
      if (this.slugInput) this.slugInput.value = slug;

      const name = this.selectedEssence.essence_name_uk || this.selectedEssence.essence_name || slug;
      const img = this.selectedEssence.image ? normalizeImageUrl(this.selectedEssence.image) : null;

      this.badgeContainer.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-2); border: 1px solid var(--border-s); border-radius: 6px; font-size: 12px;">
          <span style="width: 16px; height: 16px; border-radius: 3px; overflow: hidden; display: inline-block;">
            ${img ? `<img src="${escapeHtmlAttribute(img)}" style="width:100%;height:100%;object-fit:cover;">` : ICON.sparkles}
          </span>
          <span style="font-weight: 600;">${escapeHtmlAttribute(name)}</span>
          <span style="font-size: 10px; color: var(--text-muted);">(${escapeHtmlAttribute(slug)})</span>
          <button type="button" class="essence-picker-remove" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-weight: bold; font-size: 14px; margin-left: 4px;">&times;</button>
        </div>
      `;

      this.badgeContainer.querySelector('.essence-picker-remove')?.addEventListener('click', () => {
        this.clear();
      });
    } else {
      if (this.hiddenInput) this.hiddenInput.value = '';
      this.badgeContainer.innerHTML = '';
    }

    if (this.onSelect) {
      this.onSelect(this.selectedEssence);
    }
  }
}
