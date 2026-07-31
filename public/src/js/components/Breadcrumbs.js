import { icon } from '../helpers/icons.js';

/**
 * Generates HTML string for Breadcrumbs navigation.
 * @param {Array<{label: string, href?: string}>} items - List of breadcrumb links/steps (excluding Home, which is prepended automatically)
 * @param {string} className - Optional custom CSS class for the nav element
 * @returns {string} HTML string
 */
export function createBreadcrumbs(items = [], className = 'breadcrumbs') {
  const chevron = `<span class="breadcrumb-separator">${icon('chevron', 16, { strokeWidth: 2.2 })}</span>`;
  
  const allItems = [
    { label: 'Drawn Stories', href: '#/' },
    ...items
  ];

  const html = allItems.map((item, idx) => {
    const isLast = idx === allItems.length - 1;
    const idAttr = item.id ? ` id="${item.id}"` : '';
    if (isLast || !item.href) {
      return `<span${idAttr}>${item.label}</span>`;
    }
    return `<a href="${item.href}"${idAttr}>${item.label}</a>`;
  }).join(chevron);

  return `<nav class="${className}" aria-label="Навігація">${html}</nav>`;
}
