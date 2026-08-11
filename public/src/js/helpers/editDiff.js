import { icon } from './icons.js';
import { langName } from './lang.js';
import { t, getCurrentLanguage } from './i18n.js';

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Повна мапа локалізації полів та іконок для всіх типів сутностей 
 * (томи, випуски, персонажі, персони, видавництва, колекції)
 */
export const FIELD_DEFINITIONS = {
  // Назви та імена
  'name': { uk: 'Назва оригінальна', en: 'Original title', iconName: 'edit' },
  'name_uk': { uk: 'Назва UA', en: 'Title (UA)', iconName: 'edit' },
  'name_en': { uk: 'Назва EN', en: 'Title (EN)', iconName: 'edit' },
  'name_ro': { uk: 'Назва (Трансліт)', en: 'Title (Translit)', iconName: 'edit' },
  'name_native': { uk: 'Рідна назва', en: 'Native title', iconName: 'edit' },
  'real_name': { uk: 'Справжнє ім\'я (Оригінал)', en: 'Real name (Original)', iconName: 'user' },
  'real_name_uk': { uk: 'Справжнє ім\'я (UA)', en: 'Real name (UA)', iconName: 'user' },
  'pseudo': { uk: 'Псевдонім', en: 'Pseudonym', iconName: 'user' },
  'aliases': { uk: 'Псевдоніми', en: 'Aliases', iconName: 'users' },

  // Деталі персонажа / персони
  'creators': { uk: 'Творці / Автори', en: 'Creators / Authors', iconName: 'users' },
  'franchise': { uk: 'Франшиза', en: 'Franchise', iconName: 'layers' },
  'earth': { uk: 'Всесвіт / Земля', en: 'Universe / Earth', iconName: 'earth' },
  'essence': { uk: 'Сутність / Раса', en: 'Essence / Race', iconName: 'sparkles' },
  'origin': { uk: 'Походження', en: 'Origin', iconName: 'globe' },
  'gender': { uk: 'Стать', en: 'Gender', iconName: 'user' },
  'occupation': { uk: 'Професія / Роль', en: 'Occupation / Role', iconName: 'building' },
  'birth': { uk: 'Дата народження', en: 'Birth date', iconName: 'calendar' },
  'birth_place': { uk: 'Місце народження', en: 'Birth place', iconName: 'globe' },

  // Дати та класифікація
  'start_year': { uk: 'Рік початку', en: 'Start year', iconName: 'calendar' },
  'issue_number': { uk: 'Номер випуску', en: 'Issue number', iconName: 'hash' },
  'publication_date': { uk: 'Дата публікації', en: 'Publication date', iconName: 'calendar' },
  'country': { uk: 'Країна', en: 'Country', iconName: 'globe' },
  'publisher': { uk: 'Видавництво', en: 'Publisher', iconName: 'building' },
  'lang': { uk: 'Мова', en: 'Language', iconName: 'globe' },

  // Посилання
  'site_link': { uk: 'Посилання на джерело', en: 'Source link', iconName: 'externalLink' },
  'website': { uk: 'Вебсайт', en: 'Website', iconName: 'externalLink' },

  // Зображення
  'image': { uk: 'Головне зображення', en: 'Main image', iconName: 'imagePlaceholder' },
  'cover_img': { uk: 'Банер / Обкладинка', en: 'Banner / Cover', iconName: 'imagePlaceholder' },
  'portret_img': { uk: 'Портрет', en: 'Portrait', iconName: 'imagePlaceholder' },
  'costume_img': { uk: 'Костюм', en: 'Costume', iconName: 'imagePlaceholder' },
  'portret_costume_img': { uk: 'Портрет у костюмі', en: 'Portrait in costume', iconName: 'imagePlaceholder' },
  'logo': { uk: 'Логотип', en: 'Logo', iconName: 'imagePlaceholder' },
  'photo': { uk: 'Фото', en: 'Photo', iconName: 'imagePlaceholder' },

  // Тексти та описи
  'synopsis_ua': { uk: 'Синопсис UA', en: 'Synopsis (UA)', iconName: 'messageSquare' },
  'synopsis': { uk: 'Синопсис EN', en: 'Synopsis (EN)', iconName: 'messageSquare' },
  'description': { uk: 'Опис', en: 'Description', iconName: 'messageSquare' },
  'bio': { uk: 'Біографія', en: 'Biography', iconName: 'messageSquare' },

  // Складні зв'язки
  'theme_ids': { uk: 'Теми', en: 'Themes', iconName: 'tag' },
  'themes': { uk: 'Теми', en: 'Themes', iconName: 'tag' },
  'staff': { uk: 'Персонал', en: 'Staff', iconName: 'users' },
  'characters': { uk: 'Персонажі', en: 'Characters', iconName: 'users' },
  'personas': { uk: 'Альтер-его / Версії', en: 'Alter-ego / Versions', iconName: 'users' },
  'contents': { uk: 'Зміст', en: 'Contents', iconName: 'list' },
};

export function getFieldLabel(key) {
  const def = FIELD_DEFINITIONS[key];
  if (!def) return key;
  const lang = getCurrentLanguage();
  return def[lang] || def.uk || def.label || key;
}

/**
 * Нормалізує значення personas (якщо воно рядок JSON або масив)
 */
function parsePersonas(personasVal) {
  if (!personasVal) return [];
  if (Array.isArray(personasVal)) return personasVal;
  if (typeof personasVal === 'string') {
    try {
      const parsed = JSON.parse(personasVal);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Нормалізує значення contents (якщо воно рядок JSON або масив)
 */
export function parseContents(contentsVal) {
  if (!contentsVal) return [];
  if (Array.isArray(contentsVal)) return contentsVal.filter(Boolean);
  if (typeof contentsVal === 'string') {
    const trimmed = contentsVal.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null') return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : (trimmed ? [trimmed] : []);
    } catch (e) {
      return trimmed ? [trimmed] : [];
    }
  }
  return [];
}

/**
 * Форматує список personas у зрозумілий рядок
 */
function formatPersonas(personasVal) {
  const list = parsePersonas(personasVal);
  if (!list.length) return '—';
  return list.map(p => {
    const ua = p.name_uk || p.name || 'Без назви';
    const orig = p.name && p.name !== p.name_uk ? ` (${p.name})` : '';
    const app = p.first_appearance ? ` [Перша поява: ${p.first_appearance}]` : '';
    return `${ua}${orig}${app}`;
  }).join('\n');
}

/**
 * Нормалізує значення для порівняння
 */
function normalizeVal(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    const s = val.trim();
    if (s === '[]' || s === '{}' || s === 'null') return '';
    return s;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    const filtered = val.filter(Boolean);
    return filtered.length ? JSON.stringify(filtered) : '';
  }
  return JSON.stringify(val);
}

/**
 * Генерує бейджики змінених полів для списку правок
 */
export function getChangedFieldBadges(before = {}, after = {}) {
  const badges = [];
  const processedKeys = new Set();

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (['theme_ids', 'themes', 'staff', 'characters', 'personas', 'image_file', 'cover_img_file'].includes(key)) {
      continue;
    }
    if (after[key] !== undefined && after[key] !== null) {
      const beforeStr = normalizeVal(before[key]);
      const afterStr = normalizeVal(after[key]);
      if (beforeStr !== afterStr && !processedKeys.has(key)) {
        processedKeys.add(key);
        const label = getFieldLabel(key);
        badges.push(`<span class="changed-field-badge">${escapeHtml(label)}</span>`);
      }
    }
  }

  // Теми
  if (after.theme_ids !== undefined && after.theme_ids !== null) {
    const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
    const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();
    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      badges.push(`<span class="changed-field-badge changed-field-badge--themes">${escapeHtml(t('themes'))}</span>`);
    }
  }

  // Персонал
  if (after.staff !== undefined && after.staff !== null) {
    const beforeStaffText = (before.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
    const afterStaffText = (after.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
    if (beforeStaffText !== afterStaffText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--staff">${escapeHtml(t('personnel'))}</span>`);
    }
  }

  // Персонажі
  if (after.characters !== undefined && after.characters !== null) {
    const beforeCharsText = (before.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
    const afterCharsText = (after.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
    if (beforeCharsText !== afterCharsText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--characters">${escapeHtml(t('characters'))}</span>`);
    }
  }

  // Альтер-его / Версії (personas)
  if (after.personas !== undefined && after.personas !== null) {
    const beforePText = formatPersonas(before.personas);
    const afterPText = formatPersonas(after.personas);
    if (beforePText !== afterPText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--characters">${escapeHtml(t('personas_label'))}</span>`);
    }
  }

  if (badges.length === 0) {
    return `<div class="changed-fields-wrap"><span class="changed-field-badge changed-field-badge--none">${escapeHtml(t('no_actual_changes'))}</span></div>`;
  }

  return `<div class="changed-fields-wrap">${badges.join('')}</div>`;
}

/**
 * Генерує HTML з детальним порівнянням полів "До" та "Після"
 */
export function generateDiffHTML(before = {}, after = {}, themesCache = []) {
  let html = '<div class="edit-patch-details">';
  let hasChanges = false;

  const imageKeys = new Set(['image', 'cover_img', 'portret_img', 'costume_img', 'portret_costume_img', 'logo', 'photo']);
  const ignoredKeys = new Set(['theme_ids', 'themes', 'staff', 'characters', 'personas', 'image_file', 'cover_img_file']);

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    if (after[key] !== undefined && after[key] !== null) {
      const beforeVal = String(before[key] || '').trim();
      const afterVal = String(after[key] || '').trim();

      if (beforeVal !== afterVal) {
        hasChanges = true;
        const fieldLabel = getFieldLabel(key);
        const iconSvg = icon(FIELD_DEFINITIONS[key]?.iconName || 'edit', 14) || '';

        let displayBefore = beforeVal;
        let displayAfter = afterVal;

        if (key === 'lang') {
          displayBefore = beforeVal ? (langName(beforeVal) || beforeVal) : '—';
          displayAfter = afterVal ? (langName(afterVal) || afterVal) : '—';
        } else if (key === 'gender') {
          const genders = { 1: t('male'), 2: t('female'), 3: t('other_gender') };
          displayBefore = genders[beforeVal] || beforeVal || '—';
          displayAfter = genders[afterVal] || afterVal || '—';
        } else if (key === 'contents') {
          const listBefore = parseContents(beforeVal);
          const listAfter = parseContents(afterVal);
          if (!listBefore.length && !listAfter.length) {
            continue;
          }
          displayBefore = listBefore.length ? listBefore.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : '—';
          displayAfter = listAfter.length ? listAfter.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : '—';
        }

        html += renderDiffField(fieldLabel, iconSvg, displayBefore, displayAfter, key, imageKeys.has(key));
      }
    }
  }

  // 2. Порівнюємо Теми
  if (after.theme_ids !== undefined && after.theme_ids !== null) {
    const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
    const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();

    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      hasChanges = true;

      const getThemeChipHTML = (id, list, isAdded = false, isRemoved = false) => {
        const found = (list || []).find(t => t.id === id);
        let name = found ? found.name : '';
        if (!name && Array.isArray(themesCache)) {
          const cached = themesCache.find(t => t.id === id);
          name = cached ? (cached.ua_name || cached.name) : '';
        }
        const label = name ? `#${id} ${name}` : `#${id}`;
        let chipClass = 'diff-theme-chip';
        let prefixIcon = '';

        if (isAdded) {
          chipClass += ' diff-theme-chip--added';
          prefixIcon = icon('plus', 11) || '+';
        } else if (isRemoved) {
          chipClass += ' diff-theme-chip--removed';
          prefixIcon = icon('minus', 11) || '-';
        }

        const iconHtml = prefixIcon ? `<span class="diff-chip-icon">${prefixIcon}</span>` : '';
        return `<span class="${chipClass}" title="${escapeHtml(name)}">${iconHtml}${escapeHtml(label)}</span>`;
      };

      const beforeText = beforeIds.length
        ? `<div class="diff-theme-chips">${beforeIds.map(id => getThemeChipHTML(id, before.themes, false, !afterIds.includes(id))).join('')}</div>`
        : '—';
      const afterText = afterIds.length
        ? `<div class="diff-theme-chips">${afterIds.map(id => getThemeChipHTML(id, after.themes, !beforeIds.includes(id), false)).join('')}</div>`
        : '—';
      html += renderDiffField(t('themes'), icon('tag', 14) || '', beforeText, afterText, 'themes');
    }
  }

  // 3. Порівнюємо персонал
  if (after.staff !== undefined && after.staff !== null) {
    const beforeStaffText = (before.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
    const afterStaffText = (after.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n') || '—';

    if (beforeStaffText !== afterStaffText) {
      hasChanges = true;
      html += renderDiffField(t('personnel'), icon('users', 14) || '', beforeStaffText, afterStaffText);
    }
  }

  // 4. Порівнюємо персонажів
  if (after.characters !== undefined && after.characters !== null) {
    const beforeCharsText = (before.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';
    const afterCharsText = (after.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';

    if (beforeCharsText !== afterCharsText) {
      hasChanges = true;
      html += renderDiffField(t('characters'), icon('users', 14) || '', beforeCharsText, afterCharsText);
    }
  }

  // 5. Порівнюємо Альтер-его / Версії персонажа (personas)
  if (after.personas !== undefined && after.personas !== null) {
    const beforePText = formatPersonas(before.personas);
    const afterPText = formatPersonas(after.personas);

    if (beforePText !== afterPText) {
      hasChanges = true;
      html += renderDiffField(t('personas_label'), icon('users', 14) || '', beforePText, afterPText);
    }
  }

  if (!hasChanges) {
    html += `<div class="empty-msg" style="padding: 10px 0;">${escapeHtml(t('no_actual_changes'))}</div>`;
  }

  html += '</div>';
  return html;
}

function renderDiffField(label, iconHtml, beforeVal, afterVal, key = '', isImage = false) {
  let beforeRendered = beforeVal ? escapeHtml(beforeVal) : `<em>${escapeHtml(t('diff_empty'))}</em>`;
  let afterRendered = afterVal ? escapeHtml(afterVal) : `<em>${escapeHtml(t('diff_removed'))}</em>`;

  if (isImage) {
    const isBanner = key === 'cover_img';
    const imgClass = isBanner ? 'diff-image-preview diff-image-preview--banner' : 'diff-image-preview';

    beforeRendered = beforeVal
      ? `<div class="${imgClass}"><img src="${escapeHtml(beforeVal)}" alt="${escapeHtml(t('diff_before'))}" onerror="this.onerror=null;this.src='/public/img/no-cover.jpg';"></div>`
      : `<em>${escapeHtml(t('diff_no_image'))}</em>`;

    afterRendered = afterVal
      ? `<div class="${imgClass}"><img src="${escapeHtml(afterVal)}" alt="${escapeHtml(t('diff_after'))}" onerror="this.onerror=null;this.src='/public/img/no-cover.jpg';"></div>`
      : `<em>${escapeHtml(t('diff_removed'))}</em>`;
  } else if (key === 'themes') {
    beforeRendered = beforeVal || `<em>${escapeHtml(t('diff_no_themes'))}</em>`;
    afterRendered = afterVal || `<em>${escapeHtml(t('diff_removed_all_themes'))}</em>`;
  }

  return `
    <div class="diff-row">
      <div class="diff-row-header">
        <span class="diff-field-icon">${iconHtml}</span>
        <span class="diff-field-label">${escapeHtml(label)}</span>
      </div>
      <div class="diff-values-grid">
        <div class="diff-val diff-val--before">
          <span class="diff-val-tag">${escapeHtml(t('diff_before'))}</span>
          <div class="diff-val-content">${beforeRendered}</div>
        </div>
        <div class="diff-val diff-val--after">
          <span class="diff-val-tag">${escapeHtml(t('diff_after'))}</span>
          <div class="diff-val-content">${afterRendered}</div>
        </div>
      </div>
    </div>
  `;
}
