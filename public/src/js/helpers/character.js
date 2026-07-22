import { getCurrentLanguage } from './i18n.js';

export const ORIGIN_TRANSLATIONS = {
  human: { uk: 'Людина', en: 'Human' },
  mutant: { uk: 'Мутант', en: 'Mutant' },
  alien: { uk: 'Прибулець', en: 'Alien' },
  cyborg: { uk: 'Кіборг', en: 'Cyborg' },
  robot: { uk: 'Робот', en: 'Robot' },
  android: { uk: 'Андроїд', en: 'Android' },
  deity: { uk: 'Божество', en: 'Deity' },
  god: { uk: 'Бог', en: 'God' },
  goddess: { uk: 'Богиня', en: 'Goddess' },
  demon: { uk: 'Демон', en: 'Demon' },
  magic: { uk: 'Магічна істота', en: 'Magical Being' },
  magical: { uk: 'Магічна істота', en: 'Magical Being' },
  atlantian: { uk: 'Атлант', en: 'Atlantean' },
  atlantean: { uk: 'Атлант', en: 'Atlantean' },
  amazon: { uk: 'Амазонка', en: 'Amazon' },
  inhuman: { uk: 'Нелюд', en: 'Inhuman' },
  symbiote: { uk: 'Симбіот', en: 'Symbiote' },
  vampire: { uk: 'Вампір', en: 'Vampire' },
  zombie: { uk: 'Зомбі', en: 'Zombie' },
  clone: { uk: 'Клон', en: 'Clone' },
  meta: { uk: 'Мета-людина', en: 'Metahuman' },
  metahuman: { uk: 'Мета-людина', en: 'Metahuman' }
};

/**
 * Translates origin value according to the current UI language.
 * @param {string} origin 
 * @returns {string}
 */
export function translateOrigin(origin) {
  if (!origin || typeof origin !== 'string') return origin || '';
  const key = origin.trim().toLowerCase();
  const lang = getCurrentLanguage();
  const found = ORIGIN_TRANSLATIONS[key];
  if (found) {
    return found[lang] || found.uk || origin;
  }
  return origin;
}

