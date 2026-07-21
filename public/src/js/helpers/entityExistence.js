/* public/src/js/helpers/entityExistence.js */
import { openGlobalAddModal } from '../components/GlobalAddModal.js';
import { escapeHtmlAttribute } from './image.js';
import { currentUser } from '../shell.js';

function isModerator() {
  return currentUser?.role === 'moderator' || currentUser?.role === 'admin';
}

/**
 * Генерує HTML лінка на контент (сутність/персонаж/команда).
 * Якщо запису у БД немає (opts.exists === false) та користувач є модератором,
 * відображає червоне посилання (ds-link-missing), яке при кліку відкриває модальне вікно створення.
 * Інакше рендериться звичайне посилання.
 * 
 * @param {Object} opts
 * @param {string} opts.href - Звичайне посилання, напр. '#/essences/spider-man-616'
 * @param {boolean} [opts.exists=true] - Чи існує даний запис у БД
 * @param {string} [opts.contentType='essence'] - Тип контенту: 'essence' | 'character' | 'team' | 'volume' тощо
 * @param {string} [opts.identifier=''] - Слаг або ID цільового контенту
 * @param {string} [opts.displayName=''] - Текстове ім'я
 * @param {string} [opts.className=''] - Додаткові CSS класи
 * @param {string} [opts.innerHTML=''] - Внутрішній вміст лінка (якщо передається карточка)
 * @returns {string} HTML рядок лінка або кнопки
 */
export function renderEntityLink(opts) {
  const {
    href = '#',
    exists = true,
    contentType = 'essence',
    identifier = '',
    displayName = '',
    className = '',
    innerHTML = ''
  } = opts;

  const content = innerHTML || escapeHtmlAttribute(displayName || identifier || 'Запис');
  const isMod = isModerator();

  if (exists || !isMod) {
    return `<a href="${href}" class="${className}">${content}</a>`;
  }

  // Якщо запис відсутній -> червоне посилання з викликом модалки створення
  const payloadData = JSON.stringify({ contentType, identifier, displayName }).replace(/"/g, '&quot;');

  return `<a href="javascript:void(0)" class="ds-link-missing ${className}" data-entity-create="${payloadData}" title="Запис відсутній у БД. Натисніть, щоб створити">${content}</a>`;
}

let _isHandlerInitialized = false;

/**
 * Ініціалізує глобальний делегований обробник для кліків по ds-link-missing
 */
export function initEntityExistenceHandlers() {
  if (_isHandlerInitialized) return;
  _isHandlerInitialized = true;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-entity-create]');
    if (!trigger) return;

    e.preventDefault();
    try {
      const data = JSON.parse(trigger.dataset.entityCreate);
      const contentType = data.contentType || 'essence';
      const defaultData = {};

      if (contentType === 'essence') {
        if (data.identifier) defaultData.slug = data.identifier;
        if (data.displayName) defaultData.essence_name = data.displayName;
      } else if (contentType === 'character' || contentType === 'team') {
        if (data.displayName) defaultData.name = data.displayName;
      }

      openGlobalAddModal(contentType === 'team' ? 'character' : contentType, defaultData);
    } catch (err) {
      console.error('Error handling entity create click:', err);
    }
  });
}
