import { uk } from '../locales/uk.js';
import { en } from '../locales/en.js';

const translations = { uk, en };
let currentLang = localStorage.getItem('site_lang') || 'uk';

// Fallback to uk if language is unsupported
if (!translations[currentLang]) {
  currentLang = 'uk';
}

export function t(key, params = null) {
  let text = translations[currentLang]?.[key] || translations['uk']?.[key] || key;
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
  }
  return text;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    localStorage.setItem('site_lang', lang);
    currentLang = lang;
    window.location.reload();
  }
}

/**
 * Universal helper to get localized data field from an object based on current UI language.
 * 
 * Example usage:
 *   l(char, 'name', { uk: ['real_name_uk', 'name_uk', 'name'], en: ['name'] })
 *   l(entity, 'description')
 * 
 * @param {Object} obj - The entity or object containing data fields
 * @param {string} fieldName - The base field name (e.g. 'name', 'description')
 * @param {Object} [customRules] - Optional per-language field fallback priority arrays { uk: [...], en: [...] }
 * @returns {any} First non-empty value found, or empty string if none.
 */
export function getLocalizedField(obj, fieldName, customRules = null) {
  if (!obj || typeof obj !== 'object') return '';

  const lang = getCurrentLanguage();

  if (customRules && typeof customRules === 'object' && customRules[lang]) {
    const fields = Array.isArray(customRules[lang]) ? customRules[lang] : [customRules[lang]];
    for (const f of fields) {
      if (typeof f === 'function') {
        const res = f(obj);
        if (res !== null && res !== undefined && res !== '') return res;
      } else if (typeof f === 'string' && obj[f] !== null && obj[f] !== undefined && String(obj[f]).trim() !== '') {
        return obj[f];
      }
    }
    return '';
  }

  // Automatic default fallback
  const langKey = `${fieldName}_${lang}`;
  if (obj[langKey] !== null && obj[langKey] !== undefined && String(obj[langKey]).trim() !== '') {
    return obj[langKey];
  }

  if (obj[fieldName] !== null && obj[fieldName] !== undefined && String(obj[fieldName]).trim() !== '') {
    return obj[fieldName];
  }

  const fallbackUkKey = `${fieldName}_uk`;
  if (obj[fallbackUkKey] !== null && obj[fallbackUkKey] !== undefined && String(obj[fallbackUkKey]).trim() !== '') {
    return obj[fallbackUkKey];
  }

  return '';
}

export { getLocalizedField as l };

