/**
 * Helper to generate consistent, aesthetically pleasing HSL color schemes
 * for magazine badges (e.g. WSJ, BCS, WYM).
 */

const PRESET_MAGAZINE_COLORS = {
  'WSJ': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', dot: '#ef4444' }, // Weekly Shonen Jump - Soft Red
  'BCS': { bg: '#dcfce7', text: '#16a34a', border: '#86efac', dot: '#22c55e' }, // Soft Green
  'WYM': { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd', dot: '#3b82f6' }, // Soft Blue
  'WSS': { bg: '#fef3c7', text: '#d97706', border: '#fde68a', dot: '#f59e0b' }, // Soft Yellow
  'Ribon': { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8', dot: '#ec4899' }, // Soft Pink
  'Ciao': { bg: '#ccfbf1', text: '#0d9488', border: '#99f6e4', dot: '#14b8a6' }, // Soft Teal
  'YA': { bg: '#f3e8ff', text: '#9333ea', border: '#d8b4fe', dot: '#a855f7' }, // Soft Purple
  'Morning': { bg: '#e0f2fe', text: '#0284c7', border: '#7dd3fc', dot: '#0ea5e9' }
};

export function getMagazineColor(label, id = 0) {
  if (label && PRESET_MAGAZINE_COLORS[label]) {
    return PRESET_MAGAZINE_COLORS[label];
  }

  // Generate deterministic HSL based on string hash or ID
  const str = label || String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 85%, 94%)`,
    text: `hsl(${hue}, 70%, 35%)`,
    border: `hsl(${hue}, 60%, 80%)`,
    dot: `hsl(${hue}, 70%, 50%)`
  };
}
