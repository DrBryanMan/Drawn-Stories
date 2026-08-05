import { icon } from '../helpers/icons.js';
import { t } from '../helpers/i18n.js';

function getStatusConfig(status) {
    const configs = {
        pending: {
            label: t('status_pending'),
            shortLabel: t('status_pending_short'),
            iconName: 'planned',
            className: 'status-badge--pending'
        },
        approved: {
            label: t('status_approved'),
            shortLabel: t('status_approved_short'),
            iconName: 'check',
            className: 'status-badge--approved'
        },
        rejected: {
            label: t('status_rejected'),
            shortLabel: t('status_rejected_short'),
            iconName: 'x',
            className: 'status-badge--rejected'
        },
        closed: {
            label: t('status_closed'),
            shortLabel: t('status_closed_short'),
            iconName: 'lock',
            className: 'status-badge--closed'
        }
    };
    return configs[status] || {
        label: status || '—',
        shortLabel: status || '—',
        iconName: 'info',
        className: 'status-badge--unknown'
    };
}

/**
 * Генерує HTML рядок статус-бейджів для правок.
 * @param {string} status — 'pending' | 'approved' | 'rejected' | 'closed'
 * @param {Object} [options={}]
 * @param {boolean} [options.iconOnly=false] — показувати тільки іконку
 * @param {boolean} [options.showIcon=true] — показувати іконку
 * @param {boolean} [options.shortText=false] — використовувати скорочений текст ("Прийнято", "Очікує")
 * @param {string} [options.title] — підказка в атрибуті title
 * @param {string} [options.customClass] — додаткові CSS класи
 * @returns {string} HTML рядок статус-бейджа
 */
export function renderEditStatusBadge(status, options = {}) {
    const cfg = getStatusConfig(status);

    const isIconOnly = options.iconOnly || false;
    const showIcon = options.showIcon ?? true;
    const labelText = options.shortText ? cfg.shortLabel : cfg.label;
    const titleAttr = options.title ? ` title="${escapeAttr(options.title)}"` : (isIconOnly ? ` title="${escapeAttr(cfg.label)}"` : '');
    
    const classes = [
        'status-badge',
        cfg.className,
        isIconOnly ? 'status-badge--icon-only' : '',
        options.customClass || ''
    ].filter(Boolean).join(' ');

    const iconHtml = showIcon ? icon(cfg.iconName, 14, { class: 'status-badge-icon' }) : '';
    const textHtml = !isIconOnly ? `<span class="status-badge-text">${labelText}</span>` : '';

    return `<span class="${classes}"${titleAttr}>${iconHtml}${textHtml}</span>`;
}

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
}
