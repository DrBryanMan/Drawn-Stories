/**
 * Character helper module
 */

export const ORIGIN_TRANSLATIONS = {
  human: 'Людина',
  mutant: 'Мутант',
  alien: 'Прибулець',
  cyborg: 'Кіборг',
  robot: 'Робот',
  android: 'Андроїд',
  deity: 'Божество',
  god: 'Бог',
  goddess: 'Богиня',
  demon: 'Демон',
  magic: 'Магічна істота',
  magical: 'Магічна істота',
  atlantian: 'Атлант',
  atlantean: 'Атлант',
  amazon: 'Амазонка',
  inhuman: 'Нелюд',
  symbiote: 'Симбіот',
  vampire: 'Вампір',
  zombie: 'Зомбі',
  clone: 'Клон',
  meta: 'Мета-людина',
  metahuman: 'Мета-людина'
};

/**
 * Translates origin value to Ukrainian if translation exists.
 * @param {string} origin 
 * @returns {string}
 */
export function translateOrigin(origin) {
  if (!origin || typeof origin !== 'string') return origin || '';
  const key = origin.trim().toLowerCase();
  return ORIGIN_TRANSLATIONS[key] || origin;
}
