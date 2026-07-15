import { escapeHtmlAttribute, normalizeImageUrl } from '../../helpers/image.js';
import { getPublisherColor } from '../../helpers/publisher.js';

const FORMAT_LABELS = {
  'weekly': 'Тижневий',
  'biweekly': 'Двотижневий',
  'monthly': 'Місячний',
  'bimonthly': 'Двомісячний',
  'quarterly': 'Квартальний',
  'semiannually': 'Піврічний',
  'digital': 'Цифровий',
  'irregular': 'Нерегулярний'
};

const DEMOGRAPHIC_LABELS = {
  'shonen': 'shonen',
  'seinen': 'seinen',
  'shojo': 'shojo',
  'josei': 'josei',
  'kodomo': 'kodomo'
};

/**
 * Creates the HTML string for a magazine card.
 * @param {object} mag - Magazine data from API
 * @returns {string} HTML markup for the card
 */
export function renderMagazineCard(mag) {
  const pubColor = getPublisherColor(mag.publisher_name);
  const publisherName = escapeHtmlAttribute(mag.publisher_name || '').toUpperCase();
  const title = escapeHtmlAttribute(mag.name || 'Без назви');
  const nativeName = mag.name_native ? `<div class="magazine-card-native">${escapeHtmlAttribute(mag.name_native)}</div>` : '';
  const labelText = escapeHtmlAttribute(mag.label || 'MAG');
  const formatText = FORMAT_LABELS[mag.format] || mag.format || 'Нерегулярний';
  const demographicText = DEMOGRAPHIC_LABELS[mag.demographic] || mag.demographic || 'Інше';
  
  const seriesText = `${mag.series_count || 0} <span>(${mag.series_ongoing_count || 0})</span>`;
  const issuesCount = mag.issues_count || 0;
  const startYear = mag.start_year || '—';
  
  const popularList = mag.popular_series || [];
  const popularHtml = popularList.length > 0 
    ? `
      <div class="magazine-card-series-section">
        <div class="magazine-card-series-title">Відомі серії</div>
        <div class="magazine-card-series-list">
          ${popularList.map(ser => {
            const serCover = normalizeImageUrl(ser.image);
            const serTitle = escapeHtmlAttribute(ser.name_uk || ser.name || 'Без назви');
            const score = ser.mal_score ? Number(ser.mal_score).toFixed(2) : '—';
            return `
              <a href="#/volumes/${ser.id}" class="magazine-card-series-item" title="${serTitle}">
                ${serCover 
                  ? `<img class="magazine-card-series-cover" src="${escapeHtmlAttribute(serCover)}" alt="${serTitle}" loading="lazy">`
                  : `<div class="magazine-card-series-cover-placeholder"></div>`}
                <div class="magazine-card-series-score">${score}</div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  return `
    <div class="magazine-card" style="--pubColor: ${pubColor}; border-top: 4px solid ${pubColor}; background: color-mix(in srgb, ${pubColor} 3%, #ffffff);">
      <a href="#/magazines/${mag.id}" class="magazine-card-link-overlay"></a>
      <div class="magazine-card-header">
        <span class="magazine-card-label" style="border: 1px solid color-mix(in srgb, ${pubColor} 20%, var(--border-s)); background: color-mix(in srgb, ${pubColor} 10%, #ffffff); color: ${pubColor};">
          ${labelText}
        </span>
        <span class="magazine-card-publisher" style="color: ${pubColor};">${publisherName}</span>
      </div>
      <div class="magazine-card-content">
        <div class="magazine-card-title-group">
          <h3 class="magazine-card-title">${title}</h3>
          ${nativeName}
        </div>
        <div class="magazine-card-badges">
          <span class="magazine-card-badge">${demographicText}</span>
          <span class="magazine-card-badge">${formatText}</span>
        </div>
        <div class="magazine-card-stats">
          <div class="magazine-card-stat">
            <div class="magazine-card-stat-value">${seriesText}</div>
            <div class="magazine-card-stat-label">Серій</div>
          </div>
          <div class="magazine-card-stat">
            <div class="magazine-card-stat-value">0</div>
            <div class="magazine-card-stat-label">Ваншотів</div>
          </div>
          <div class="magazine-card-stat">
            <div class="magazine-card-stat-value">${issuesCount}</div>
            <div class="magazine-card-stat-label">Випусків</div>
          </div>
          <div class="magazine-card-stat">
            <div class="magazine-card-stat-value">${startYear}</div>
            <div class="magazine-card-stat-label">Рік</div>
          </div>
        </div>
        ${popularHtml}
      </div>
    </div>
  `;
}
