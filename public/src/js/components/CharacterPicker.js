/* public/src/js/components/CharacterPicker.js */
import { API } from '../helpers/api.js';
import { normalizeImageUrl } from '../helpers/image.js';
import { icon } from '../helpers/icons.js';
import { getFuse } from '../helpers/fuse.js';

/**
 * Створює або ініціалізує CharacterPicker у вказаному контейнері.
 * 
 * @param {Object} opts
 * @param {HTMLElement} opts.container - Контейнер для монтування UI
 * @param {HTMLInputElement} opts.hiddenInput - Прихований інпут для запису id (character_id)
 * @param {number|string|Array} opts.initialId - Початковий ID або ID-шники обраних персонажів
 * @param {boolean} [opts.multiple=false] - Дозволити вибір кількох персонажів
 * @param {Function} [opts.onSelect] - Коллбек при виборі/зміні
 */
export class CharacterPicker {
  constructor(opts) {
    this.container = opts.container;
    this.hiddenInput = opts.hiddenInput;
    this.multiple = opts.multiple || false;
    this.onSelect = opts.onSelect || null;
    this.selectedCharacters = new Map(); // id -> char object
    this.searchTimeout = null;

    this.render();
    if (opts.initialId) {
      this.loadInitial(opts.initialId);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="character-picker-wrap">
        <div class="character-picker-inputs">
          <div class="character-picker-name-field" style="position: relative; flex: 2;">
            <input type="text" class="admin-input char-search-name" placeholder="Ім'я (оригінал, UA, справжнє ім'я...)">
          </div>
          <div class="character-picker-earth-field" style="position: relative; flex: 1;">
            <input type="text" class="admin-input char-search-earth" placeholder="Земля (напр. 616)">
          </div>
          <div class="character-picker-franchise-field" style="position: relative; flex: 1;">
            <input type="text" class="admin-input char-search-franchise" placeholder="Франшиза (напр. Marvel)">
          </div>
          <div class="character-picker-id-field" style="position: relative; flex: 1;">
            <input type="number" class="admin-input char-search-id" placeholder="ID (напр. 42)">
          </div>
        </div>

        <div class="character-picker-results" style="display: none;"></div>

        <div class="character-selected-badges"></div>
      </div>
    `;

    this.nameInput = this.container.querySelector('.char-search-name');
    this.earthInput = this.container.querySelector('.char-search-earth');
    this.franchiseInput = this.container.querySelector('.char-search-franchise');
    this.idInput = this.container.querySelector('.char-search-id');
    this.resultsContainer = this.container.querySelector('.character-picker-results');
    this.badgesContainer = this.container.querySelector('.character-selected-badges');

    this.bindEvents();
  }

  bindEvents() {
    const handleInput = () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.fetchSearch(), 250);
    };

    this.nameInput.addEventListener('input', handleInput);
    this.earthInput.addEventListener('input', handleInput);
    this.franchiseInput.addEventListener('input', handleInput);

    // Пряме введення ID персонажа
    const handleDirectId = async () => {
      const val = parseInt(this.idInput.value.trim());
      if (val && !isNaN(val)) {
        await this.loadInitial(val);
      }
    };
    this.idInput.addEventListener('change', handleDirectId);
    this.idInput.addEventListener('input', () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(handleDirectId, 400);
    });

    const handleFocus = () => {
      if (this.nameInput.value.trim() || this.earthInput.value.trim() || this.franchiseInput.value.trim()) {
        this.fetchSearch();
      }
    };

    this.nameInput.addEventListener('focus', handleFocus);
    this.earthInput.addEventListener('focus', handleFocus);
    this.franchiseInput.addEventListener('focus', handleFocus);

    // Закриття результатів при кліку поза полем
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.resultsContainer.style.display = 'none';
      }
    });
  }

  clear() {
    this.selectedCharacters.clear();
    if (this.nameInput) this.nameInput.value = '';
    if (this.earthInput) this.earthInput.value = '';
    if (this.franchiseInput) this.franchiseInput.value = '';
    if (this.idInput) this.idInput.value = '';
    this.updateUI();
  }

  async setSelected(id) {
    if (!id) {
      this.clear();
      return;
    }
    await this.loadInitial(id);
  }

  async loadInitial(initialId) {
    const ids = Array.isArray(initialId) ? initialId : [initialId];
    for (const id of ids) {
      if (!id) continue;
      try {
        const char = await API.get(`/characters/${id}`);
        if (char && char.id) {
          if (!this.multiple) {
            this.selectedCharacters.clear();
          }
          this.selectedCharacters.set(char.id, char);
        }
      } catch (e) {
        console.warn(`Could not load character #${id}`, e);
      }
    }
    this.updateUI();
  }

  async fetchSearch() {
    const nameQuery = this.nameInput.value.trim();
    const earthQuery = this.earthInput.value.trim();
    const franchiseQuery = this.franchiseInput.value.trim();

    if (!nameQuery && !earthQuery && !franchiseQuery) {
      this.resultsContainer.style.display = 'none';
      return;
    }

    this.resultsContainer.style.display = 'flex';
    this.resultsContainer.innerHTML = '<div style="padding: 10px; font-size: 13px; color: var(--text-muted);">Пошук персонажів...</div>';

    try {
      const searchParam = nameQuery || earthQuery || franchiseQuery || undefined;

      const res = await API.get('/characters', {
        search: searchParam,
        earth: earthQuery || undefined,
        franchise: franchiseQuery || undefined,
        limit: 100
      });

      let items = res.items || (Array.isArray(res) ? res : []);

      // Якщо користувач шукає за іменем — застосовуємо Fuse.js для гнучкого (fuzzy) сортування результатів
      if (nameQuery && items.length > 0) {
        const Fuse = await getFuse();
        if (Fuse) {
          const fuse = new Fuse(items, {
            keys: [
              { name: 'name_uk', weight: 0.35 },
              { name: 'name', weight: 0.35 },
              { name: 'real_name_uk', weight: 0.15 },
              { name: 'real_name', weight: 0.15 },
              { name: 'franchise', weight: 0.1 },
              { name: 'earth', weight: 0.1 }
            ],
            threshold: 0.45,
            ignoreLocation: true
          });
          const fuseRes = fuse.search(nameQuery);
          if (fuseRes && fuseRes.length > 0) {
            items = fuseRes.map(r => r.item);
          }
        }
      }

      this.renderResults(items);
    } catch (err) {
      this.resultsContainer.innerHTML = `<div style="padding: 10px; font-size: 13px; color: #ef4444;">Помилка пошуку: ${err.message || 'Невідома помилка'}</div>`;
    }
  }

  renderResults(items) {
    if (!items || items.length === 0) {
      this.resultsContainer.innerHTML = '<div style="padding: 10px; font-size: 13px; color: var(--text-muted);">Персонажів не знайдено</div>';
      return;
    }

    this.resultsContainer.innerHTML = items.map(c => {
      const img = c.image || (c.character_info?.image) || '/images/placeholders/character.webp';
      const nameUa = c.name_uk || c.name || 'Невідомий';
      const nameOrig = c.name && c.name !== c.name_uk ? c.name : '';
      const realName = c.real_name_uk || c.real_name || c.person_name_uk || c.person_name || '';
      
      const earthCode = c.earth || c.earth_code || (c.earth_info ? (c.earth_info.code || c.earth_info.name) : '');
      const earthBadge = earthCode ? `<span class="character-badge-earth">Земля ${escapeHtml(earthCode)}</span>` : '';
      const franchiseBadge = c.franchise ? `<span style="font-size: 0.75rem; padding: 1px 6px; background: var(--bg-hover, #e2e8f0); color: var(--text-primary); border-radius: 10px; font-weight: 500;">${escapeHtml(c.franchise)}</span>` : '';

      return `
        <div class="character-picker-result-item" data-id="${c.id}">
          <img src="${normalizeImageUrl(img)}" class="character-picker-avatar" alt="">
          <div class="character-picker-item-info">
            <div class="character-picker-item-name">
              ${escapeHtml(nameUa)} ${nameOrig ? `<small style="opacity:0.7; font-weight:normal;">(${escapeHtml(nameOrig)})</small>` : ''}
            </div>
            <div class="character-picker-item-meta">
              ${realName ? `<span>Спр. ім'я: ${escapeHtml(realName)}</span>` : ''}
              ${earthBadge}
              ${franchiseBadge}
              <span style="margin-left: auto; font-size: 11px; opacity:0.6;">ID: ${c.id}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.resultsContainer.querySelectorAll('.character-picker-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id);
        const selectedObj = items.find(i => i.id === id);
        if (selectedObj) {
          this.selectCharacter(selectedObj);
        }
      });
    });
  }

  selectCharacter(char) {
    if (!this.multiple) {
      this.selectedCharacters.clear();
    }
    this.selectedCharacters.set(char.id, char);

    this.nameInput.value = '';
    this.earthInput.value = '';
    if (this.franchiseInput) this.franchiseInput.value = '';
    if (this.idInput) this.idInput.value = '';
    this.resultsContainer.style.display = 'none';

    this.updateUI();
  }

  removeCharacter(id) {
    this.selectedCharacters.delete(id);
    this.updateUI();
  }

  updateUI() {
    const list = Array.from(this.selectedCharacters.values());

    // Зберігаємо value в hiddenInput
    if (this.hiddenInput) {
      if (this.multiple) {
        this.hiddenInput.value = list.map(c => c.id).join(',');
      } else {
        this.hiddenInput.value = list.length > 0 ? list[0].id : '';
      }
      this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (list.length === 0) {
      this.badgesContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Персонажа не вибрано</span>';
      return;
    }

    this.badgesContainer.innerHTML = list.map(c => {
      const img = c.image || '/images/placeholders/character.webp';
      const name = c.name_uk || c.name || `Персонаж #${c.id}`;
      const earthCode = c.earth || c.earth_code || (c.earth_info ? (c.earth_info.code || c.earth_info.name) : '');
      const earthBadge = earthCode ? `<span class="character-badge-earth">Земля ${escapeHtml(earthCode)}</span>` : '';

      return `
        <div class="character-badge" data-id="${c.id}">
          <img src="${normalizeImageUrl(img)}" class="character-badge-avatar" alt="">
          <span>${escapeHtml(name)}</span>
          ${earthBadge}
          <button type="button" class="character-badge-remove" data-remove-id="${c.id}" title="Видалити">${icon('x', 14)}</button>
        </div>
      `;
    }).join('');

    this.badgesContainer.querySelectorAll('.character-badge-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.removeId);
        this.removeCharacter(id);
      });
    });

    if (this.onSelect) {
      this.onSelect(list);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
