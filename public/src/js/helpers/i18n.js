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
