/**
 * wanted-entry.js — точка входу для сторінки /wanted.
 * Ця сторінка — standalone, без SPA shell (header/footer).
 */
import { renderWanted } from './views/wanted.js';

renderWanted(document.getElementById('wanted-app'));
