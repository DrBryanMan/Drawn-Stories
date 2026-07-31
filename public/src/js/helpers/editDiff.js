import { icon } from './icons.js';
import { langName } from './lang.js';

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
  'name': { label: 'Назва оригінальна', iconName: 'edit' },
  'name_uk': { label: 'Назва UA', iconName: 'edit' },
  'name_ro': { label: 'Назва (Трансліт)', iconName: 'edit' },
  'name_native': { label: 'Рідна назва', iconName: 'edit' },
  'real_name': { label: 'Справжнє ім\'я (Оригінал)', iconName: 'user' },
  'real_name_uk': { label: 'Справжнє ім\'я (UA)', iconName: 'user' },
  'pseudo': { label: 'Псевдонім', iconName: 'user' },
  'aliases': { label: 'Псевдоніми', iconName: 'users' },

  // Деталі персонажа / персони
  'creators': { label: 'Творці / Автори', iconName: 'users' },
  'franchise': { label: 'Франшиза', iconName: 'layers' },
  'earth': { label: 'Всесвіт / Земля', iconName: 'earth' },
  'essence': { label: 'Сутність / Раса', iconName: 'sparkles' },
  'origin': { label: 'Походження', iconName: 'globe' },
  'gender': { label: 'Стать', iconName: 'user' },
  'occupation': { label: 'Професія / Роль', iconName: 'building' },
  'birth': { label: 'Дата народження', iconName: 'calendar' },
  'birth_place': { label: 'Місце народження', iconName: 'globe' },

  // Дати та класифікація
  'start_year': { label: 'Рік початку', iconName: 'calendar' },
  'issue_number': { label: 'Номер випуску', iconName: 'hash' },
  'publication_date': { label: 'Дата публікації', iconName: 'calendar' },
  'country': { label: 'Країна', iconName: 'globe' },
  'publisher': { label: 'Видавництво', iconName: 'building' },
  'lang': { label: 'Мова', iconName: 'globe' },

  // Посилання
  'site_link': { label: 'Посилання на джерело', iconName: 'externalLink' },
  'website': { label: 'Вебсайт', iconName: 'externalLink' },

  // Зображення
  'image': { label: 'Головне зображення', iconName: 'imagePlaceholder' },
  'cover_img': { label: 'Банер / Обкладинка', iconName: 'imagePlaceholder' },
  'portret_img': { label: 'Портрет', iconName: 'imagePlaceholder' },
  'costume_img': { label: 'Костюм', iconName: 'imagePlaceholder' },
  'portret_costume_img': { label: 'Портрет у костюмі', iconName: 'imagePlaceholder' },
  'logo': { label: 'Логотип', iconName: 'imagePlaceholder' },
  'photo': { label: 'Фото', iconName: 'imagePlaceholder' },

  // Тексти та описи
  'synopsis_ua': { label: 'Синопсис UA', iconName: 'messageSquare' },
  'synopsis': { label: 'Синопсис EN', iconName: 'messageSquare' },
  'description': { label: 'Опис', iconName: 'messageSquare' },
  'bio': { label: 'Біографія', iconName: 'messageSquare' },

  // Складні зв'язки
  'theme_ids': { label: 'Теми', iconName: 'tag' },
  'themes': { label: 'Теми', iconName: 'tag' },
  'staff': { label: 'Персонал', iconName: 'users' },
  'characters': { label: 'Персонажі', iconName: 'users' },
  'personas': { label: 'Альтер-его / Версії', iconName: 'users' },
};

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
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
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
        const def = FIELD_DEFINITIONS[key];
        const label = def ? def.label : key;
        badges.push(`<span class="changed-field-badge">${escapeHtml(label)}</span>`);
      }
    }
  }

  // Теми
  if (after.theme_ids !== undefined && after.theme_ids !== null) {
    const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
    const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();
    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      badges.push(`<span class="changed-field-badge changed-field-badge--themes">Теми</span>`);
    }
  }

  // Персонал
  if (after.staff !== undefined && after.staff !== null) {
    const beforeStaffText = (before.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
    const afterStaffText = (after.staff || []).map(s => `ID: ${s.person_id} (${s.role})`).sort().join('\n');
    if (beforeStaffText !== afterStaffText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--staff">Персонал</span>`);
    }
  }

  // Персонажі
  if (after.characters !== undefined && after.characters !== null) {
    const beforeCharsText = (before.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
    const afterCharsText = (after.characters || []).map(c => `ID: ${c.character_id || c.id} (${c.role})`).sort().join('\n');
    if (beforeCharsText !== afterCharsText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--characters">Персонажі</span>`);
    }
  }

  // Альтер-его / Версії (personas)
  if (after.personas !== undefined && after.personas !== null) {
    const beforePText = formatPersonas(before.personas);
    const afterPText = formatPersonas(after.personas);
    if (beforePText !== afterPText) {
      badges.push(`<span class="changed-field-badge changed-field-badge--characters">Альтер-его / Версії</span>`);
    }
  }

  if (badges.length === 0) {
    return `<div class="changed-fields-wrap"><span class="changed-field-badge changed-field-badge--none">Немає фактичних змін</span></div>`;
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
        const def = FIELD_DEFINITIONS[key] || { label: key, iconName: 'edit' };
        const iconSvg = icon(def.iconName, 14) || '';

        let displayBefore = beforeVal;
        let displayAfter = afterVal;

        if (key === 'lang') {
          displayBefore = beforeVal ? (langName(beforeVal) || beforeVal) : '—';
          displayAfter = afterVal ? (langName(afterVal) || afterVal) : '—';
        } else if (key === 'gender') {
          const genders = { 1: 'Чоловіча', 2: 'Жіноча', 3: 'Інша' };
          displayBefore = genders[beforeVal] || beforeVal || '—';
          displayAfter = genders[afterVal] || afterVal || '—';
        }

        html += renderDiffField(def.label, iconSvg, displayBefore, displayAfter, key, imageKeys.has(key));
      }
    }
  }

  // 2. Порівнюємо Теми
  if (after.theme_ids !== undefined && after.theme_ids !== null) {
    const beforeIds = (before.theme_ids || []).map(id => Number(id)).sort();
    const afterIds = (after.theme_ids || []).map(id => Number(id)).sort();

    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      hasChanges = true;

      const getThemeChipHTML = (id, list) => {
        const found = (list || []).find(t => t.id === id);
        let name = found ? found.name : '';
        if (!name && Array.isArray(themesCache)) {
          const cached = themesCache.find(t => t.id === id);
          name = cached ? (cached.ua_name || cached.name) : '';
        }
        const label = name ? `#${id} ${name}` : `#${id}`;
        return `<span class="diff-theme-chip" title="${escapeHtml(name)}">${escapeHtml(label)}</span>`;
      };

      const beforeText = beforeIds.map(id => getThemeChipHTML(id, before.themes)).join('') || '—';
      const afterText = afterIds.map(id => getThemeChipHTML(id, after.themes)).join('') || '—';
      html += renderDiffField('Теми', icon('tag', 14) || '', beforeText, afterText, 'themes');
    }
  }

  // 3. Порівнюємо персонал
  if (after.staff !== undefined && after.staff !== null) {
    const beforeStaffText = (before.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';
    const afterStaffText = (after.staff || []).map(s => `ID автора: ${s.person_id} (${s.role})`).sort().join('\n') || '—';

    if (beforeStaffText !== afterStaffText) {
      hasChanges = true;
      html += renderDiffField('Персонал', icon('users', 14) || '', beforeStaffText, afterStaffText);
    }
  }

  // 4. Порівнюємо персонажів
  if (after.characters !== undefined && after.characters !== null) {
    const beforeCharsText = (before.characters || []).map(c => `ID персонажа: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';
    const afterCharsText = (after.characters || []).map(c => `ID персонажа: ${c.character_id || c.id} (${c.role || 'cameo'})`).sort().join('\n') || '—';

    if (beforeCharsText !== afterCharsText) {
      hasChanges = true;
      html += renderDiffField('Персонажі', icon('users', 14) || '', beforeCharsText, afterCharsText);
    }
  }

  // 5. Порівнюємо Альтер-его / Версії персонажа (personas)
  if (after.personas !== undefined && after.personas !== null) {
    const beforePText = formatPersonas(before.personas);
    const afterPText = formatPersonas(after.personas);

    if (beforePText !== afterPText) {
      hasChanges = true;
      html += renderDiffField('Альтер-его / Версії', icon('users', 14) || '', beforePText, afterPText);
    }
  }

  if (!hasChanges) {
    html += '<div class="empty-msg" style="padding: 10px 0;">Немає фактичних змін (дані збігаються з поточними в базі даних).</div>';
  }

  html += '</div>';
  return html;
}

function renderDiffField(label, iconHtml, beforeVal, afterVal, key = '', isImage = false) {
  let beforeRendered = beforeVal ? escapeHtml(beforeVal) : '<em>порожньо</em>';
  let afterRendered = afterVal ? escapeHtml(afterVal) : '<em>видалено</em>';

  if (isImage) {
    const isBanner = key === 'cover_img';
    const imgClass = isBanner ? 'diff-image-preview diff-image-preview--banner' : 'diff-image-preview';

    beforeRendered = beforeVal
      ? `<div class="${imgClass}"><img src="${escapeHtml(beforeVal)}" alt="До" onerror="this.onerror=null;this.src='/public/img/no-cover.jpg';"></div>`
      : '<em>немає зображення</em>';

    afterRendered = afterVal
      ? `<div class="${imgClass}"><img src="${escapeHtml(afterVal)}" alt="Після" onerror="this.onerror=null;this.src='/public/img/no-cover.jpg';"></div>`
      : '<em>видалено</em>';
  } else if (key === 'themes') {
    beforeRendered = beforeVal || '<em>немає тем</em>';
    afterRendered = afterVal || '<em>видалено всі теми</em>';
  }

  return `
    <div class="diff-row">
      <div class="diff-row-header">
        <span class="diff-field-icon">${iconHtml}</span>
        <span class="diff-field-label">${escapeHtml(label)}</span>
      </div>
      <div class="diff-values-grid">
        <div class="diff-val diff-val--before">
          <span class="diff-val-tag">До</span>
          <div class="diff-val-content">${beforeRendered}</div>
        </div>
        <div class="diff-val diff-val--after">
          <span class="diff-val-tag">Після</span>
          <div class="diff-val-content">${afterRendered}</div>
        </div>
      </div>
    </div>
  `;
}
