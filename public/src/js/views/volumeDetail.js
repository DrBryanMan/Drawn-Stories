import { API } from '../helpers/api.js';
import { currentUser } from '../shell.js';
import { Bookmarks } from '../helpers/bookmarks.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '../helpers/image.js';
import { langDisplay, langName } from '../helpers/lang.js';
import { createPaginator } from '../components/Pagination.js';
import { renderIssueGridCard } from '../components/IssueGridCard.js';
import { VolumeEditor } from '/admin/js/VolumeEditor.js';
import { VolumePicker } from '/admin/js/VolumePicker.js';

let currentItems = [];
let currentView = localStorage.getItem('ds-volume-view') || 'grid';

// ── Helpers ─────────────────────────────────────────
function formatDate(value) {
    if (!value) return '—';
    return String(value).replace(/-00/g, '');
}

function themeName(theme) {
    return theme.ua_name || theme.name || 'Тема';
}

function themeType(theme) {
    return theme.type || 'theme';
}

function isMangaVolume(volume, themes = [], translationParents = []) {
    if (volume.hikka_slug) return true;
    if (translationParents.some(parent => parent.hikka_slug || parent.rel_type === 'translation')) return true;

    return themes.some(theme => {
        const name = `${theme.name || ''} ${theme.ua_name || ''}`.toLowerCase();
        return name.includes('manga') || name.includes('манга') || name.includes('манґа');
    });
}

function isCollectionVolume(themes = []) {
    return themes.some(theme => {
        const name = `${theme.name || ''} ${theme.ua_name || ''}`.toLowerCase();
        return name.includes('collection') || name.includes('збірник') || name.includes('збірка');
    });
}

function isTranslatedVolume(themes = []) {
    return themes.some(theme => {
        const name = (theme.name || '').toLowerCase();
        return name === 'translated';
    });
}

function formatYearPeriod(volume) {
    const start = volume.start_year;
    const end = volume.end_year;
    if (!start) return 'Рік невідомий';
    
    if (end === 'Ongoing') return `${start} — Триває`;
    if (end && end !== start) return `${start} — ${end}`;
    return String(start);
}

function formatIssueRanges(nums) {
    if (!nums || !nums.length) return '';
    const sorted = [...nums].map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!sorted.length) return '';
    
    const parts = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i];
        if (curr === prev + 1) {
            prev = curr;
        } else {
            if (start === prev) parts.push(start);
            else parts.push(`${start}-${prev}`);
            start = curr;
            prev = curr;
        }
    }
    return parts.join(', ');
}

// ── Lucide SVG icons ────────────────────────────────
const ICON = {
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    arrowLeft: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    building: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    calendar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    hash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    bookOpen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    tags: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/><path d="M6 9.01V9"/><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    languages: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    newspaper: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M10 6h8v4h-8V6Z"/></svg>',
    heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    bookmark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

// ── Readlist options config ──────────────────────────
const READLIST_OPTIONS = [
    { value: '',          label: 'Додати в список', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>', color: '#94a3b8', bg: 'var(--bg-card)', borderColor: 'var(--border-s)' },
    { value: 'Planned',   label: 'Заплановано',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: '#2563eb', bg: 'color-mix(in srgb, #2563eb 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #2563eb 20%, var(--border-s))' },
    { value: 'Reading',   label: 'Читаю',           icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', color: '#16a34a', bg: 'color-mix(in srgb, #16a34a 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #16a34a 20%, var(--border-s))' },
    { value: 'Completed', label: 'Прочитано',        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', color: '#059669', bg: 'color-mix(in srgb, #059669 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #059669 20%, var(--border-s))' },
    { value: 'On Hold',   label: 'Відкладено',       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>', color: '#d97706', bg: 'color-mix(in srgb, #d97706 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #d97706 20%, var(--border-s))' },
    { value: 'Dropped',   label: 'Закинуто',         icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 8%, var(--bg-card))', borderColor: 'color-mix(in srgb, #dc2626 20%, var(--border-s))' },
];

function readlistOptionLabel(value) {
    return READLIST_OPTIONS.find(o => o.value === value) || READLIST_OPTIONS[0];
}

const THEME_ICON = {
    type: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
    genre: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    theme: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
};

// ── HTML builders ───────────────────────────────────
function volumeFact(label, value) {
    if (!value) return '';
    return `
        <div class="volume-fact">
            <dt>${label}</dt>
            <dd>${escapeHtmlAttribute(String(value))}</dd>
        </div>
    `;
}

function themeChipHTML(theme) {
    const name = escapeHtmlAttribute(themeName(theme));
    const url = `#/catalog?theme_ids=${theme.id}`;
    return `<a href="${url}" class="volume-theme-chip volume-theme-chip--${themeType(theme)}">${name}</a>`;
}

function relationCardHTML(item, { title, icon, isModerator, onRemove }) {
    if (!item?.id) return '';

    const cover = comicVineImageUrl(item.cv_img || item.hikka_img);
    const name = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
    const originalName = item.name_uk && item.name_uk !== item.name ? item.name : '';
    const lang = langDisplay(item.lang);

    return `
        <a class="volume-relation-card" href="#/volumes/${item.id}">
            ${isModerator && onRemove ? `<button class="btn-remove-rel" onclick="event.preventDefault(); event.stopPropagation(); ${onRemove}" title="Видалити зв'язок">✕</button>` : ''}
            <span class="volume-relation-cover">
                ${cover
                    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${name}" loading="lazy">`
                    : icon}
            </span>
            <span class="volume-relation-content">
                <span class="volume-relation-label">${icon}${title}</span>
                <span class="volume-relation-title">
                    ${lang.code ? `<span class="volume-relation-lang">${escapeHtmlAttribute(lang.code)}</span>` : ''}
                    ${name}
                </span>
                ${originalName ? `<span class="volume-relation-meta">${escapeHtmlAttribute(originalName)}</span>` : ''}
                ${item.publisher_name ? `<span class="volume-relation-meta">${escapeHtmlAttribute(item.publisher_name)}</span>` : ''}
                ${item.collections_count ? `<span class="volume-relation-meta">${Number(item.collections_count).toLocaleString('uk-UA')} збір.</span>` : ''}
            </span>
        </a>
    `;
}

function heroRelationsHTML({ translationParents, magazineParents, magazine, isModerator, currentVolumeId }) {
    const source = translationParents.find(parent => parent.rel_type === 'source');
    const magazines = magazineParents.length ? magazineParents : (magazine ? [magazine] : []);
    const original = magazines.length > 0 ? null : translationParents.find(parent => parent.rel_type === 'translation');
    
    const cards = [
        original ? relationCardHTML(original, {
            title: 'Оригінал',
            icon: ICON.bookOpen,
            isModerator,
            onRemove: `window.removeTranslation(${original.id}, ${currentVolumeId})`
        }) : '',
        source ? relationCardHTML(source, {
            title: 'Джерело',
            icon: ICON.link,
            isModerator,
            onRemove: `window.removeTranslation(${source.id}, ${currentVolumeId})`
        }) : '',
        ...magazines.map(item => relationCardHTML(item, {
            title: 'Журнал',
            icon: ICON.newspaper,
            isModerator,
            onRemove: `window.removeMagazineChild(${item.id}, ${currentVolumeId})`
        })),
    ].filter(Boolean);

    if (!cards.length) return '';
    return `<div class="volume-hero-relations">${cards.join('')}</div>`;
}

function translationCardHTML(item, { isModerator, currentVolumeId }) {
    const isCurrent = item.id === currentVolumeId;
    const cover = comicVineImageUrl(item.cv_img || item.hikka_img);
    const title = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');
    const originalTitle = item.name_uk && item.name_uk !== item.name ? item.name : '';
    const collectionsCount = Number(item.collections_count || 0);
    const lang = langDisplay(item.lang);

    const tag = isCurrent ? 'div' : 'a';
    const hrefAttr = isCurrent ? '' : ` href="#/volumes/${item.id}"`;
    const currentClass = isCurrent ? ' is-current' : '';

    return `
        <${tag} class="volume-translation-card${currentClass}"${hrefAttr}>
            ${isModerator && !isCurrent ? `<button class="btn-remove-rel" onclick="event.preventDefault(); event.stopPropagation(); window.removeTranslation(${currentVolumeId}, ${item.id})" title="Видалити переклад">✕</button>` : ''}
            <span class="volume-translation-poster">
                ${cover
                    ? `<img src="${escapeHtmlAttribute(cover)}" alt="${title}" loading="lazy">`
                    : ICON.bookOpen}
            </span>
            <span class="volume-translation-body">
                <span class="volume-translation-title">${lang.code ? `<span class="volume-translation-lang">${escapeHtmlAttribute(lang.code)}</span>` : ''} ${title}</span>
                ${originalTitle ? `<span class="volume-translation-original">${escapeHtmlAttribute(originalTitle)}</span>` : ''}
                <span class="volume-translation-count">${item.publisher_name + ' / ' || ''}${collectionsCount.toLocaleString('uk-UA')} збір.</span>
            </span>
        </${tag}>
    `;
}

function translationsSectionHTML(translations, { isModerator, currentVolumeId }) {
    if (!isModerator && !translations.length) return '';

    return `
        <section class="volume-translations-section block">
            <div class="volume-section-heading">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <h2>Збірні видання ${translations.length ? `(${translations.length})` : ''}</h2>
                    ${isModerator ? `<button class="btn-admin btn-admin--secondary" id="volume-add-translation-btn" title="Додати переклад" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;">${ICON.plus}</button>` : ''}
                </div>
            </div>
            <div class="volume-translations-grid">
                ${translations.map(t => translationCardHTML(t, { isModerator, currentVolumeId })).join('')}
            </div>
        </section>
    `;
}

function readlistUIHTML(isCollection = false, stats = {}) {
    if (isCollection) {
        const total = stats.collections || 0;
        const owned = stats.owned_collections || 0;
        const allOwned = total > 0 && owned === total;
        const someOwned = owned > 0 && owned < total;

        let btnClass = 'btn-add-all-collection';
        let btnText = 'Додати все до колекції';
        let btnIcon = ICON.plus;

        if (allOwned) {
            btnClass += ' btn-all-owned';
            btnText = `В колекції (${owned}/${total})`;
            btnIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (someOwned) {
            btnClass += ' btn-some-owned';
            btnText = `Додати решту (${total - owned})`;
        }

        return `
            <div class="volume-readlist-controls">
                <button class="${btnClass} ${!currentUser ? 'btn-disabled' : ''}" id="btn-add-all-collection" ${!currentUser || allOwned ? 'disabled' : ''}>
                    ${btnIcon}
                    <span>${btnText}</span>
                </button>
            </div>
        `;
    }

    const defaultOpt = READLIST_OPTIONS[0];
    const activeOpts = READLIST_OPTIONS.filter(opt => opt.value !== '');
    return `
        <div class="volume-readlist-controls">
            <div class="readlist-select-wrap">
                <select class="filter-select readlist-select" id="readlist-select" ${!currentUser ? 'disabled' : ''}>
                    <button>
                        <span class="readlist-select-chosen">
                            <span class="readlist-icon" style="color: ${defaultOpt.color}">${defaultOpt.icon}</span>
                            <span class="select-label">${defaultOpt.label}</span>
                        </span>
                        <span class="select-chevron-v">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                        </span>
                    </button>
                    ${activeOpts.map(opt => `
                        <option value="${opt.value}">
                            <span class="readlist-icon" style="color: ${opt.color}">${opt.icon}</span>
                            <span>${opt.label}</span>
                        </option>
                    `).join('')}
                    <option value="" class="readlist-remove-option">
                        <span class="readlist-icon" style="color: #dc2626"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></span>
                        <span>Видалити</span>
                    </option>
                </select>
            </div>
            <button class="readlist-btn ${!currentUser ? 'readlist-btn--anon' : ''}" id="readlist-favorite-btn" title="${currentUser ? 'В обране' : 'У закладки'}">
                ${currentUser ? ICON.heart : ICON.bookmark}
            </button>
        </div>
    `;
}

// ── Skeleton ────────────────────────────────────────
function renderSkeleton(main) {
    main.innerHTML = `
        <div class="volume-detail">
            <div class="container">
                <nav class="breadcrumbs volume-breadcrumbs">
                    <div class="skeleton skeleton-text" style="width: 200px; height: 16px;"></div>
                </nav>
            </div>
            <section class="volume-hero-band">
                <div class="container volume-skeleton-hero">
                    <div class="volume-cover-column">
                        <div class="skeleton skeleton-rect" style="width: 100%; aspect-ratio: 2/3;"></div>
                    </div>
                    <div class="volume-hero-info" style="gap: 14px;">
                        <div class="skeleton skeleton-text" style="width: 120px; height: 22px; border-radius: 999px;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; height: 36px;"></div>
                        <div class="skeleton skeleton-text" style="width: 45%; height: 16px;"></div>
                    </div>
                </div>
            </section>
        </div>
    `;
}

// ── Render items (grid / table) ─────────────────────
function renderItems(container, items) {
    if (!items.length) {
        container.innerHTML = `
            <div class="volume-empty-issues">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>
                </svg>
                <h3>Нічого не знайдено</h3>
                <p>Для цього тому ще не додані випуски.</p>
            </div>
        `;
        return;
    }

    if (currentView === 'grid') {
        container.innerHTML = `
            <div class="issues-view-grid">
                ${items.map(item => renderIssueGridCard(item, { showVolumeName: !!item.volume_name })).join('')}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="issues-view-table">
                <table class="issues-table">
                    <thead>
                        <tr>
                            <th style="width: 60px">#</th>
                            <th>Назва</th>
                            <th style="width: 120px">Дата</th>
                            <th style="width: 120px">У збірниках</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
                            const cover = comicVineImageUrl(item.cv_img || item.hikka_img);
                            const isCollection = item.type === 'collection' || item.is_collection;
                            const isVolume = item.type === 'volume';
                            const link = isVolume ? `#/volumes/${item.id}` : (isCollection ? `#/collections/${item.id}` : null);
                            const title = escapeHtmlAttribute(item.name_uk || item.name || 'Без назви');

                            return `
                                <tr ${link ? `onclick="location.hash='${link}'" style="cursor: pointer;"` : ''}>
                                    <td class="table-issue-num">${escapeHtmlAttribute(item.issue_number || '—')}</td>
                                    <td>
                                        <div class="table-issue-info">
                                            ${cover ? `<img class="table-issue-thumb" src="${escapeHtmlAttribute(cover)}" loading="lazy">` : ''}
                                            <div style="display:flex; flex-direction:column; gap:1px; min-width:0;">
                                                <span class="table-issue-name">${title}</span>
                                                ${(() => {
                                                    const volLabel = item.volume_name_uk || item.volume_name || '';
                                                    const isDup = !volLabel || volLabel === (item.name_uk || item.name || '');
                                                    return (!isCollection && !isVolume && !isDup)
                                                        ? `<span class="table-issue-volume-label">${escapeHtmlAttribute(volLabel)}</span>`
                                                        : '';
                                                })()}
                                            </div>
                                            ${isVolume ? '<span class="issue-grid-type-badge" style="position:static; margin-left:8px; padding:2px 6px;">Манґа</span>' : (isCollection ? '<span class="issue-grid-type-badge" style="position:static; margin-left:8px; padding:2px 6px;">Збірник</span>' : '')}
                                        </div>
                                    </td>
                                    <td class="table-issue-date">${isVolume ? (item.start_year || '') : formatDate(item.cover_date || item.release_date)}</td>
                                    <td>
                                        ${isCollection ? `
                                            <button class="issue-grid-toggle-btn ${item.is_owned ? 'is-owned' : ''}" data-id="${item.id}" title="${item.is_owned ? 'Видалити з колекції' : 'Додати в колекцію'}" style="position: static; width: 28px; height: 28px;">
                                                ${item.is_owned ? ICON.trash : ICON.plus}
                                            </button>
                                        ` : ''}
                                        ${(!isCollection && !isVolume) ? `
                                            <button class="table-membership-btn" data-issue-id="${item.id}">
                                                ${ICON.layers}
                                                ${item.collection_count > 0 ? `<span class="membership-count">${item.collection_count}</span>` : ''}
                                            </button>` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

// ── Sort ─────────────────────────────────────────────
function sortItems(items, order) {
    return [...items].sort((a, b) => {
        if (order === 'series_asc') {
            const volA = (a.volume_name_uk || a.volume_name || '').toLowerCase();
            const volB = (b.volume_name_uk || b.volume_name || '').toLowerCase();
            const volCmp = volA.localeCompare(volB, 'uk');
            if (volCmp !== 0) return volCmp;
            const nA = Number.parseFloat(a.issue_number);
            const nB = Number.parseFloat(b.issue_number);
            if (Number.isFinite(nA) && Number.isFinite(nB) && nA !== nB) return nA - nB;
            return String(a.issue_number || '').localeCompare(String(b.issue_number || ''), 'uk', { numeric: true });
        }
        if (order === 'date_desc' || order === 'date_asc') {
            const dateA = a.cover_date || a.release_date || '';
            const dateB = b.cover_date || b.release_date || '';
            return order === 'date_desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
        }
        const numA = Number.parseFloat(a.issue_number);
        const numB = Number.parseFloat(b.issue_number);
        if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
            return order === 'number_desc' ? numB - numA : numA - numB;
        }
        return String(a.issue_number || '').localeCompare(String(b.issue_number || ''), 'uk', { numeric: true });
    });
}

// ── Main render ─────────────────────────────────────
export async function renderVolumeDetail(main, params = {}) {
    const volumeId = Number(params.id);
    if (!Number.isFinite(volumeId)) {
        main.innerHTML = '<div class="container"><div class="error-state">Некоректний ідентифікатор тому.</div></div>';
        return;
    }

    renderSkeleton(main);

    try {
        const [data, readlistStatus] = await Promise.all([
            API.get(`/volumes/${volumeId}`),
            API.get(`/user/readlist/${volumeId}`)
        ]);

        const {
            volume,
            themes = [],
            stats = {},
            magazine,
            translation_parents: translationParents = [],
            translations = [],
            magazine_parents: magazineParents = [],
            magazine_children: magazineChildren = [],
        } = data;

        const coverUrl = comicVineImageUrl(volume.cv_img || volume.hikka_img);
        const bannerUrl = comicVineImageUrl(volume.cover_img || coverUrl);
        const heroBannerStyle = bannerUrl ? ` style="--volume-banner-url: url('${escapeHtmlAttribute(bannerUrl)}')"` : '';
        const heroBannerClass = bannerUrl ? ' volume-hero-band--banner' : '';
        const title = escapeHtmlAttribute(volume.name_uk || volume.name_en || volume.name);
        const subTitleValue = volume.name && volume.name !== (volume.name_uk || volume.name_en || volume.name) ? volume.name : '';
        const subTitle = escapeHtmlAttribute(subTitleValue);
        const publisherName = escapeHtmlAttribute(volume.publisher_name || 'Невідоме видавництво');
        const hasThemes = themes.length > 0;
        const isModerator = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
        const heroRelations = heroRelationsHTML({ 
            translationParents, 
            magazineParents, 
            magazine, 
            isModerator, 
            currentVolumeId: volumeId 
        });

        const isManga = isMangaVolume(volume, themes, translationParents);
        const isCollection = isCollectionVolume(themes);
        const isMagazine = themes.some(t => t.id === 35);
        const isMangaWithMagazine = isManga && Boolean(magazine);

        const issuesTabLabel = isMagazine ? 'Номери' : (isManga ? 'Розділи' : 'Випуски');
        const collectionsTabLabel = isMagazine ? 'Серії манґи' : (isManga ? 'Томи' : 'Збірники');
        
        const shouldSeparate = isManga || isCollection;
        currentItems = shouldSeparate ? (data.issues || []) : (data.items || data.issues || []);

        const hasUaSynopsis = !!(volume.synopsis_ua || volume.description);
        const activeTab = hasUaSynopsis ? 'ua' : 'en';

        main.innerHTML = `
            <div class="volume-detail">
                <div class="container">
                    <nav class="breadcrumbs volume-breadcrumbs" aria-label="Навігація">
                        <a href="#/">Drawn Stories</a>
                        <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                        <a href="#/catalog">Каталог</a>
                        <span class="breadcrumb-separator">${ICON.chevronRight}</span>
                        <span>${title}</span>
                    </nav>
                </div>

                <section class="volume-hero-band${heroBannerClass}"${heroBannerStyle}>
                    <div class="container">
                    </div>
                    <div class="container volume-hero">
                        <div class="volume-cover-column">
                            ${coverUrl
                                ? `<img class="volume-cover" src="${escapeHtmlAttribute(coverUrl)}" alt="${title}">`
                                : `<div class="volume-cover volume-cover--empty">
                                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>
                                    </svg>
                                  </div>`}
                            ${readlistUIHTML(isCollection, stats)}
                        </div>

                        <div class="volume-hero-info">
                            <div class="volume-header">
                                <div class="volume-title">
                                    <span class="volume-main-title">
                                        <h1>
                                            ${title}
                                            <button class="btn-synonyms" id="btn-show-synonyms" title="Всі назви та синоніми">
                                                ${ICON.languages}
                                            </button>
                                        </h1>
                                    </span>
                                    <span class="volume-original-title">${subTitle}</span>
                                </div>
                                <div class="volume-ratings">
                                    <div class="rating-item rating-main" title="Системний рейтинг (незабаром)">
                                        ${ICON.star}
                                        <span class="rating-value">—</span>
                                    </div>
                                    ${volume.hikka_score ? `
                                        <div class="rating-item rating--hikka" title="Голосів на Hikka: ${volume.hikka_scored_by || 0}">
                                            <span class="rating-value">${volume.hikka_score}</span>
                                            <span class="rating-label rating--hikka">Hikka</span>
                                        </div>
                                    ` : ''}
                                    ${volume.mal_score ? `
                                        <div class="rating-item rating--mal" title="Голосів на MAL: ${volume.mal_scored_by || 0}">
                                            <span class="rating-value">${volume.mal_score}</span>
                                            <span class="rating-label">MAL</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="volume-hero-badges">
                                ${magazine ? `
                                    <a href="#/catalog?magazine_ids=${magazine.id}" class="volume-badge volume-magazine-badge" title="Журнал">
                                        ${ICON.book}
                                        ${escapeHtmlAttribute(magazine.name)}
                                    </a>
                                ` : `
                                    <a href="#/catalog?publisher_ids=${volume.publisher}" class="volume-badge volume-publisher-badge" title="Видавництво">
                                        ${ICON.building}
                                        ${publisherName}
                                    </a>
                                `}
                                ${volume.lang ? `
                                    <span class="volume-badge volume-lang-badge" title="Мова видання">
                                        ${ICON.languages}
                                        ${langName(volume.lang)}
                                    </span>
                                ` : ''}
                                <span class="volume-badge volume-year-badge" title="Період видання">
                                    ${ICON.calendar}
                                    ${formatYearPeriod(volume)}
                                </span>
                            </div>

                            <div class="volume-hero-actions">
                                <div class="source-links">
                                    ${volume.cv_id ? `
                                        <a href="https://comicvine.gamespot.com/${volume.cv_slug}/4050-${volume.cv_id}/" class="source-link-cv" target="_blank" rel="noreferrer">
                                            CV
                                            ${ICON.externalLink}
                                        </a>
                                    ` : ''}
                                    ${volume.hikka_slug ? `
                                        <a href="https://hikka.io/manga/${volume.hikka_slug}" class="source-link-hikka" target="_blank" rel="noreferrer">
                                            Hikka
                                            ${ICON.externalLink}
                                        </a>
                                    ` : ''}
                                    ${volume.mal_id ? `
                                        <a href="https://myanimelist.net/manga/${volume.mal_id}" class="source-link-mal" target="_blank" rel="noreferrer">
                                            MAL
                                            ${ICON.externalLink}
                                        </a>
                                    ` : ''}
                                    ${volume.site_link ? `
                                        <a href="${escapeHtmlAttribute(volume.site_link)}" class="source-link-site" target="_blank" rel="noreferrer">
                                            SITE
                                            ${ICON.externalLink}
                                        </a>
                                    ` : ''}
                                </div>
                                <button class="volume-action-btn volume-details-trigger" title="Деталі">
                                    ${ICON.info}
                                    Деталі
                                </button>
                            </div>

                            ${isModerator ? `
                                <div class="volume-hero-admin-actions">
                                    <button class="btn-admin btn-admin--secondary" id="volume-edit-btn" title="Редагувати">
                                        <i class="bi bi-pencil-square"></i>
                                    </button>
                                    <button class="btn-admin btn-admin--danger" id="volume-delete-btn" title="Видалити том">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                    ${!isMagazine && !isCollection ? `
                                        <button class="btn-admin btn-admin--secondary" id="volume-add-magazine-btn" title="Додати до журналу">
                                            <i class="bi bi-book"></i>
                                        </button>
                                    ` : ''}
                                    ${!isMagazine && isCollection ? `
                                        <button class="btn-admin btn-admin--secondary" id="volume-add-original-btn" title="Додати до оригіналу">
                                            <i class="bi bi-bookmark-star"></i>
                                        </button>
                                    ` : ''}
                                    ${!isMagazine && data.convertable_count > 0 ? `
                                        <button class="btn-admin btn-admin--warning" id="volume-convert-btn" title="Конвертувати всі випуски у збірники">
                                            ${ICON.layers}
                                            У збірники (${data.convertable_count})
                                        </button>
                                    ` : ''}
                                    ${isCollection && data.collections.length > 0 ? `
                                        <button class="btn-admin btn-admin--danger" id="volume-revert-btn" title="Конвертувати всі збірники у випуски">
                                            ${ICON.hash}
                                            У випуски (${data.collections.length})
                                        </button>
                                    ` : ''}
                                </div>
                            ` : ''}

                            ${heroRelations}
                            
                            <div class="volume-synopsis">
                                <div class="synopsis-header">
                                    <h2 class="synopsis-title">Синопсис</h2>
                                    <div class="synopsis-tabs">
                                        <button class="synopsis-tab ${activeTab === 'ua' ? 'is-active' : ''}" data-tab="ua">UA</button>
                                        <button class="synopsis-tab ${activeTab === 'en' ? 'is-active' : ''}" data-tab="en">EN</button>
                                    </div>
                                </div>
                                <div class="synopsis-content">
                                    <div class="synopsis-pane ${activeTab === 'ua' ? 'is-active' : ''}" id="synopsis-ua">
                                        ${volume.synopsis_ua || 'Немає синопсису українською.'}
                                    </div>
                                    <div class="synopsis-pane ${activeTab === 'en' ? 'is-active' : ''}" id="synopsis-en">
                                        ${volume.synopsis || 'No description available in English.'}
                                    </div>
                                </div>
                                ${volume.description ? `
                                    <div class="volume-description-extra">
                                        <h2 class="synopsis-title" style="margin-top: 1.5rem;">Опис</h2>
                                        <div class="synopsis-pane is-active" style="padding: 0;">
                                            ${volume.description}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </section>

                <div class="container volume-body">

                    ${(() => {
                        if (!hasThemes) return '';
                        const groups = {
                            type: themes.filter(t => t.type === 'type'),
                            genre: themes.filter(t => t.type === 'genre'),
                            theme: themes.filter(t => (t.type === 'theme' || !t.type))
                        };

                        const groupLabels = {
                            type: 'Тип',
                            genre: 'Жанри',
                            theme: 'Теми'
                        };

                        return `
                            <div class="volume-themes-row block">
                                ${Object.entries(groups).map(([type, items]) => {
                                    if (!items.length) return '';
                                    return `
                                        <div class="volume-theme-group">
                                            <span style="color: var(--text-muted); line-height: 0;">${THEME_ICON[type] || ''}</span>
                                            <span class="volume-theme-group-label">${groupLabels[type]}</span>
                                            <div class="volume-theme-chips-wrap">
                                                ${items.map(theme => themeChipHTML(theme)).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    })()}

                    ${!isMagazine && (translations.length > 0 || translationParents.length === 0)
                        ? translationsSectionHTML(translations, { isModerator, currentVolumeId: volumeId })
                        : ''
                    }

                    <section class="volume-issues-section">
                        <div class="volume-issues-toolbar block">
                            <div class="volume-tabs-segmented" id="issues-tab-switcher">
                                <button class="volume-tab-btn is-active" data-tab="issues">
                                    ${ICON.hash}
                                    <span>${issuesTabLabel}</span>
                                </button>
                                <button class="volume-tab-btn" data-tab="collections">
                                    ${ICON.layers}
                                    <span>${collectionsTabLabel}</span>
                                </button>
                            </div>

                            <div class="volume-toolbar-right" id="issues-toolbar-right">
                                <div id="volume-pagination-container"></div>
                                <div class="filter-group volume-sort-group">
                                    <select class="filter-select" id="volume-issue-sort">
                                        <button>
                                            <span class="select-label">${isCollection ? 'За серією' : 'За номером (1-9)'}</span>
                                            <span class="select-chevron-v">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                                            </span>
                                        </button>
                                        ${isCollection ? '<option value="series_asc" selected>За серією</option>' : ''}
                                        <option value="number_asc" ${isCollection ? '' : 'selected'}>За номером (1-9)</option>
                                        <option value="number_desc">За номером (9-1)</option>
                                        <option value="date_desc">Спочатку нові</option>
                                        <option value="date_asc">Спочатку старі</option>
                                    </select>
                                </div>
                                <div class="view-toggle-mini" id="issues-view-switcher">
                                    <button class="view-toggle-btn ${currentView === 'grid' ? 'is-active' : ''}" data-view="grid" title="Плитка">${ICON.grid}</button>
                                    <button class="view-toggle-btn ${currentView === 'table' ? 'is-active' : ''}" data-view="table" title="Список">${ICON.list}</button>
                                </div>
                            </div>
                        </div>

                        <div id="volume-parent-volumes-summary" style="display: none;"></div>

                        <div id="volume-items-view-container" class="volume-items-content-fade"></div>
                    </section>

                    ${isModerator && isCollection && data.direct_issues && data.direct_issues.length > 0 ? `
                        <section class="volume-direct-issues-section block" style="margin-top: 2rem; border-top: 1px solid var(--border-s); padding-top: 2rem;">
                            <div class="volume-section-heading">
                                <h2>Прямі випуски тома (модерація)</h2>
                                <p class="text-muted" style="font-size: 0.9rem; margin-top: 4px;">Ці випуски належать безпосередньо цьому тому. Використовуйте кнопку конвертації, щоб перетворити їх у збірники.</p>
                            </div>
                            <div id="volume-direct-issues-container"></div>
                        </section>
                    ` : ''}
                </div>
            </div>
        `;

        // ── Bind events ──────────────────────────────
        const readlistSelect = main.querySelector('#readlist-select');
        const favoriteBtn = main.querySelector('#readlist-favorite-btn');

        const syncReadlistButton = () => {
            if (!readlistSelect) return;
            const opt = readlistOptionLabel(readlistSelect.value);
            const iconEl = readlistSelect.querySelector('.readlist-select-chosen .readlist-icon');
            const labelEl = readlistSelect.querySelector('.readlist-select-chosen .select-label');
            if (iconEl) { iconEl.innerHTML = opt.icon; iconEl.style.color = opt.color; }
            if (labelEl) labelEl.textContent = opt.label;

            if (opt.bg) {
                readlistSelect.style.setProperty('background-color', opt.bg, 'important');
            } else {
                readlistSelect.style.removeProperty('background-color');
            }
            if (opt.borderColor) {
                readlistSelect.style.setProperty('border-color', opt.borderColor, 'important');
            } else {
                readlistSelect.style.removeProperty('border-color');
            }

            // Show "Delete" option only if the volume is currently added to some list
            const removeOption = readlistSelect.querySelector('option.readlist-remove-option');
            if (removeOption) {
                if (readlistSelect.value === '') {
                    removeOption.style.setProperty('display', 'none', 'important');
                } else {
                    removeOption.style.setProperty('display', 'flex', 'important');
                }
            }
        };

        if (readlistSelect) {
            readlistSelect.value = readlistStatus.list_name || '';
            syncReadlistButton();
        }
        
        if (favoriteBtn) {
            const isFavorite = currentUser ? readlistStatus.is_favorite : Bookmarks.has(volumeId, 'volume');
            favoriteBtn.classList.toggle('is-active', isFavorite);
        }

        if (readlistSelect) {
            readlistSelect.addEventListener('change', async (e) => {
                const listName = e.target.value;
                syncReadlistButton();
                try {
                    await API.post('/user/readlist/update', {
                        volume_id: volumeId,
                        list_name: listName || null
                    });
                } catch (err) {
                    console.error('Readlist update error:', err);
                    // Revert UI on error
                    e.target.value = readlistStatus.list_name || '';
                    syncReadlistButton();
                }
            });
        }

        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    const active = Bookmarks.toggle(volumeId, 'volume');
                    favoriteBtn.classList.toggle('is-active', active);
                    return;
                }
                try {
                    const res = await API.post('/user/readlist/toggle-favorite', { volume_id: volumeId });
                    favoriteBtn.classList.toggle('is-active', res.is_favorite);
                } catch (err) {
                    console.error('Favorite toggle error:', err);
                }
            });
        }

        const addAllBtn = main.querySelector('#btn-add-all-collection');
        if (addAllBtn) {
            addAllBtn.addEventListener('click', async () => {
                if (!currentUser) return;
                try {
                    const res = await API.post('/collections/add-all-from-volume', { volume_id: volumeId });
                    // Refresh the view to show updated button state and owned items
                    renderVolumeDetail(main, params);
                } catch (err) {
                    console.error('Add all to collection error:', err);
                    alert('Помилка при додаванні до колекції.');
                }
            });
        }

        const deleteBtn = main.querySelector('#volume-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Ви впевнені, що хочете видалити цей том? Всі пов\'язані дані (теми, зв\'язки) будуть видалені.')) return;
                
                try {
                    const res = await API.delete(`/volumes/${volumeId}`);
                    alert(res.message);
                    window.location.hash = '#/catalog';
                } catch (err) {
                    alert('Помилка видалення: ' + err.message);
                }
            });
        }

        const editBtn = main.querySelector('#volume-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                const editor = new VolumeEditor(volume, () => {
                    // Reload the view on save
                    renderVolumeDetail(main, params);
                });
                await editor.render();
            });
        }

        const setOriginalBtn = main.querySelector('#volume-add-original-btn');
        if (setOriginalBtn) {
            setOriginalBtn.addEventListener('click', () => {
                const disabledIds = [
                    ...translations.map(t => t.id),
                    ...translationParents.map(p => p.id)
                ];
                const picker = new VolumePicker({
                    title: 'Вибрати оригінал',
                    excludeId: volumeId,
                    disabledIds: disabledIds,
                    onSelect: async (selectedVol) => {
                        try {
                            await API.post(`/volumes/${selectedVol.id}/translations`, {
                                child_id: volume.id,
                                rel_type: 'translation'
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const addTranslationBtn = main.querySelector('#volume-add-translation-btn');
        if (addTranslationBtn) {
            addTranslationBtn.addEventListener('click', () => {
                const disabledIds = [
                    ...translations.map(t => t.id),
                    ...translationParents.map(p => p.id)
                ];
                const picker = new VolumePicker({
                    title: 'Додати переклад',
                    excludeId: volumeId,
                    disabledIds: disabledIds,
                    onSelect: async (selectedVol) => {
                        try {
                            await API.post(`/volumes/${volumeId}/translations`, {
                                child_id: selectedVol.id,
                                rel_type: 'translation'
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const addMagazineBtn = main.querySelector('#volume-add-magazine-btn');
        if (addMagazineBtn) {
            addMagazineBtn.addEventListener('click', () => {
                const picker = new VolumePicker({
                    title: 'Вибрати журнал',
                    themeId: 35,
                    disabledIds: magazineParents.map(m => m.id),
                    onSelect: async (selectedVol) => {
                        try {
                            await API.post(`/volumes/${selectedVol.id}/magazine-children`, {
                                child_id: volume.id
                            });
                            renderVolumeDetail(main, params);
                        } catch (err) {
                            alert('Помилка: ' + err.message);
                        }
                    }
                });
                picker.render();
            });
        }

        const convertBtn = main.querySelector('#volume-convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', async () => {
                if (!confirm(`Конвертувати всі випуски (${data.convertable_count}) у збірники? Це видалить випуски та створить замість них збірники.`)) return;
                
                try {
                    const res = await API.post(`/volumes/${volumeId}/convert-all-to-collections`);
                    alert(res.message);
                    renderVolumeDetail(main, params);
                } catch (err) {
                    alert('Помилка конвертації: ' + err.message);
                }
            });
        }

        const revertBtn = main.querySelector('#volume-revert-btn');
        if (revertBtn) {
            revertBtn.addEventListener('click', async () => {
                if (!confirm(`Конвертувати всі збірники (${data.collections.length}) у випуски? Це видалить збірники та створить замість них випуски.`)) return;
                
                try {
                    const res = await API.post(`/volumes/${volumeId}/convert-all-collections-to-issues`);
                    alert(res.message);
                    renderVolumeDetail(main, params);
                } catch (err) {
                    alert('Помилка конвертації: ' + err.message);
                }
            });
        }

        const detailsBtn = main.querySelector('.volume-details-trigger');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                openFactsModal(volume, stats);
            });
        }

        const synonymsBtn = main.querySelector('#btn-show-synonyms');
        if (synonymsBtn) {
            synonymsBtn.addEventListener('click', () => {
                openSynonymsModal(volume);
            });
        }

        const synopsisTabs = main.querySelectorAll('.synopsis-tab');
        synopsisTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const lang = tab.dataset.tab;
                synopsisTabs.forEach(t => t.classList.toggle('is-active', t === tab));
                main.querySelectorAll('.synopsis-content .synopsis-pane').forEach(p => {
                    p.classList.toggle('is-active', p.id === `synopsis-${lang}`);
                });
            });
        });

        const itemsView = document.getElementById('volume-items-view-container');
        const tabs = main.querySelectorAll('.volume-tab-btn');
        const viewSwitcher = document.getElementById('issues-view-switcher');
        const toolbarRight = document.getElementById('issues-toolbar-right');
        const sortSelect = document.getElementById('volume-issue-sort');
        const paginationContainer = document.getElementById('volume-pagination-container');
        const sortGroup = main.querySelector('.volume-sort-group');

        let currentTab = 'issues';
        let currentCollections = isMagazine ? magazineChildren : [];
        const paginator = createPaginator({ pageSize: 12 });

        const refreshItems = () => {
            const isIssues = currentTab === 'issues';
            const source = isIssues ? currentItems : currentCollections;
            const total = source.length;

            // Оновлення блоку батьківських томів (vol-summary)
            const parentVolumesContainer = document.getElementById('volume-parent-volumes-summary');
            if (parentVolumesContainer) {
                if (isIssues && isCollection && currentItems.length > 0) {
                    const volumesMap = new Map();
                    for (const item of currentItems) {
                        const volId = item.volume_db_id || item.volume_id;
                        if (!volId) continue;
                        
                        if (!volumesMap.has(volId)) {
                            volumesMap.set(volId, {
                                id: volId,
                                name: item.volume_name_uk || item.volume_name || 'Без назви',
                                cover: comicVineImageUrl(item.volume_cover_img || item.volume_cv_img),
                                numbers: []
                            });
                        }
                        
                        if (item.issue_number != null) {
                            volumesMap.get(volId).numbers.push(String(item.issue_number));
                        }
                    }

                    if (volumesMap.size > 0) {
                        const sortedVolumes = Array.from(volumesMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
                        
                        const listHtml = sortedVolumes.map(vol => {
                            const range = formatIssueRanges(vol.numbers) || '—';
                            return `
                                <a href="#/volumes/${vol.id}" class="vol-summary-card">
                                    <div class="vol-summary-card__info">
                                        <span class="vol-summary-card__name" title="${escapeHtmlAttribute(vol.name)}">${escapeHtmlAttribute(vol.name)}</span>
                                        <span class="vol-summary-card__range" title="Номери випусків"># ${escapeHtmlAttribute(range)}</span>
                                    </div>
                                </a>
                            `;
                        }).join('');

                        parentVolumesContainer.innerHTML = `
                            <div class="vol-summary">
                                <div class="vol-summary__label">Серії випусків у збірниках</div>
                                <div class="vol-summary__list">
                                    ${listHtml}
                                </div>
                            </div>
                        `;
                        parentVolumesContainer.style.display = 'block';
                    } else {
                        parentVolumesContainer.innerHTML = '';
                        parentVolumesContainer.style.display = 'none';
                    }
                } else {
                    parentVolumesContainer.innerHTML = '';
                    parentVolumesContainer.style.display = 'none';
                }
            }

            // Update pagination UI
            paginationContainer.innerHTML = '';
            if (total > paginator.getPageSize()) {
                paginationContainer.appendChild(paginator.render(total, () => {
                    refreshItems();
                    window.scrollTo({ top: main.querySelector('.volume-issues-section').offsetTop - 80, behavior: 'smooth' });
                }));
            }

            const page = paginator.getPage();
            const pageSize = paginator.getPageSize();
            const start = (page - 1) * pageSize;
            const end = start + pageSize;

            itemsView.innerHTML = '';
            if (isIssues) {
                const sorted = sortItems([...currentItems], sortSelect.value);
                const sliced = sorted.slice(start, end);
                renderItems(itemsView, sliced);
            } else {
                const sliced = currentCollections.slice(start, end);
                if (isMagazine) {
                    renderItems(itemsView, sliced);
                } else {
                    renderCollectionsFromIssues(itemsView, sliced, {
                        emptyMessage: isManga ? 'Для цього тому немає збірників' : 'Цей том не входить у жоден відомий збірник',
                        typeLabel: isManga ? 'Том' : 'Збірник',
                    });
                }
            }
        };

        const switchTab = async (tabName) => {
            currentTab = tabName;
            paginator.reset();
            tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));

            if (sortGroup) {
                sortGroup.style.display = (tabName === 'issues' && !isMagazine) ? 'block' : 'none';
            }

            itemsView.classList.remove('is-visible');

            setTimeout(async () => {
                if (tabName === 'issues' || isMagazine) {
                    refreshItems();
                } else {
                    if (currentCollections.length === 0) {
                        itemsView.innerHTML = `<div class="loading-state">Завантаження ${isManga ? 'томів' : 'збірників'}...</div>`;
                        try {
                            const response = await API.get(`/volumes/${volumeId}/collections-from-issues`);
                            currentCollections = response.data || [];
                        } catch (err) {
                            itemsView.innerHTML = `<div class="error-state">Помилка: ${err.message}</div>`;
                            return;
                        }
                    }
                    refreshItems();
                }
                itemsView.classList.add('is-visible');
            }, 100);
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('is-active')) return;
                switchTab(tab.dataset.tab);
            });
        });

        if (viewSwitcher) {
            viewSwitcher.querySelectorAll('.view-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.view === currentView) return;
                    currentView = btn.dataset.view;
                    localStorage.setItem('ds-volume-view', currentView);
                    viewSwitcher.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('is-active', b === btn));
                    refreshItems();
                });
            });
        }

        const directIssuesContainer = document.getElementById('volume-direct-issues-container');
        if (directIssuesContainer && data.direct_issues) {
            const uncollected = data.direct_issues.filter(i => (i.collection_count || 0) === 0);
            if (uncollected.length > 0) {
                renderItems(directIssuesContainer, uncollected);
            } else {
                const section = directIssuesContainer.closest('.volume-direct-issues-section');
                if (section) section.style.display = 'none';
            }
        }

        sortSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const label = main.querySelector('.volume-sort-group .select-label');
            if (label) label.textContent = selectedOption.text;
            paginator.reset();
            refreshItems();
        });

        main.addEventListener('click', async (e) => {
            const membershipBtn = e.target.closest('.issue-grid-membership-btn, .table-membership-btn');
            if (membershipBtn) {
                e.stopPropagation();
                openIssueMembershipModal(membershipBtn.dataset.issueId);
                return;
            }

            const toggleBtn = e.target.closest('.issue-grid-toggle-btn');
            if (toggleBtn) {
                e.stopPropagation();
                if (!currentUser) {
                    alert('Будь ласка, увійдіть, щоб керувати колекцією');
                    return;
                }
                const id = parseInt(toggleBtn.dataset.id);
                try {
                    const res = await API.post('/collections/toggle', { collection_id: id });
                    const isOwned = res.status === 'added';
                    
                    toggleBtn.classList.toggle('is-owned', isOwned);
                    toggleBtn.innerHTML = isOwned ? ICON.trash : ICON.plus;
                    toggleBtn.title = isOwned ? 'Видалити з колекції' : 'Додати в колекцію';

                    // Update local items if they are in the current view
                    currentItems.forEach(item => {
                        if ((item.type === 'collection' || item.is_collection) && item.id === id) {
                            item.is_owned = isOwned;
                        }
                    });
                } catch (err) {
                    console.error(err);
                    alert('Помилка: ' + err.message);
                }
            }
        });

        switchTab('issues');

    } catch (error) {
        main.innerHTML = `
            <div class="container">
                <div class="error-state">Помилка завантаження тому: ${escapeHtmlAttribute(error.message)}</div>
            </div>
        `;
    }
}

// ── Relations Management ───────────────────────────
window.removeTranslation = async (parentId, childId) => {
    if (!confirm('Від\'єднати цей переклад від оригіналу?')) return;
    try {
        await API.delete(`/volumes/${parentId}/translations/${childId}`);
        const volumeId = Number(new URL(window.location).hash.split('/').pop());
        if (volumeId) {
            const main = document.querySelector('main');
            renderVolumeDetail(main, { id: volumeId });
        }
    } catch (err) {
        alert('Помилка: ' + err.message);
    }
};

window.removeMagazineChild = async (magazineId, childId) => {
    if (!confirm('Від\'єднати цей том від журналу?')) return;
    try {
        await API.delete(`/volumes/${magazineId}/magazine-children/${childId}`);
        const volumeId = Number(new URL(window.location).hash.split('/').pop());
        if (volumeId) {
            const main = document.querySelector('main');
            renderVolumeDetail(main, { id: volumeId });
        }
    } catch (err) {
        alert('Помилка: ' + err.message);
    }
};

function openFactsModal(volume, stats) {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    modal.innerHTML = `
        <div class="ds-modal ds-modal--small">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    ${ICON.info}
                    Детальна інформація
                </div>
                <button class="ds-modal-close" id="modal-close">&times;</button>
            </div>
            <div class="ds-modal-body">
                <dl class="volume-facts">
                    ${volumeFact('ComicVine ID', volume.cv_id)}
                    ${volumeFact('Hikka Slug', volume.hikka_slug)}
                    ${volumeFact('MAL ID', volume.mal_id)}
                    ${volumeFact('Старт року', volume.start_year)}
                    ${volumeFact('Мова', volume.lang)}
                    ${volumeFact('Випусків', stats.issues)}
                    ${volumeFact('Збірників', stats.collections)}
                    ${volumeFact('Створено', formatDate(volume.created_at))}
                    ${volumeFact('Оновлено', formatDate(volume.updated_at))}
                </dl>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        document.removeEventListener('keydown', handleEsc);
        modal.remove();
        document.body.style.overflow = '';
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    modal.querySelector('#modal-close').addEventListener('click', close);
}

function openSynonymsModal(volume) {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    
    const synonyms = (Array.isArray(volume.synonyms) ? volume.synonyms : []).filter(s => s);
    const mainNames = [
        { label: 'Українська', value: volume.name_uk },
        { label: 'Англійська', value: volume.name_en },
        { label: 'Оригінальна', value: volume.name },
        { label: 'Рідна', value: volume.name_native },
    ].filter(n => n.value);

    modal.innerHTML = `
        <div class="ds-modal ds-modal--small">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    ${ICON.languages}
                    Всі назви та синоніми
                </div>
                <button class="ds-modal-close" id="modal-close">&times;</button>
            </div>
            <div class="ds-modal-body">
                <div class="synonyms-list">
                    ${mainNames.map(n => `
                        <div class="synonym-item">
                            <span class="synonym-label">${n.label}</span>
                            <span class="synonym-value">${escapeHtmlAttribute(n.value)}</span>
                        </div>
                    `).join('')}

                    ${synonyms.length > 0 ? `
                        <div class="synonym-item">
                            <span class="synonym-label">Синоніми</span>
                            ${synonyms.map(s => `
                                <span class="synonym-value">${escapeHtmlAttribute(s)}</span>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${mainNames.length === 0 && synonyms.length === 0 ? '<p class="text-muted">Назв не знайдено</p>' : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        document.removeEventListener('keydown', handleEsc);
        modal.remove();
        document.body.style.overflow = '';
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    modal.querySelector('#modal-close').addEventListener('click', close);
}

async function openIssueMembershipModal(issueId) {
    if (document.querySelector('.ds-modal-overlay')) return;
    const modal = document.createElement('div');
    modal.className = 'ds-modal-overlay';
    modal.innerHTML = `
        <div class="ds-modal">
            <div class="ds-modal-header">
                <div class="ds-modal-title">
                    ${ICON.layers}
                    Входить у збірники
                </div>
                <button class="ds-modal-close" id="modal-close">&times;</button>
            </div>
            <div class="ds-modal-body">
                <div id="membership-loading" class="skeleton skeleton-text" style="width: 100%; height: 60px;"></div>
                <div id="membership-list" class="collection-membership-list" style="display: none;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        document.removeEventListener('keydown', handleEsc);
        modal.remove();
        document.body.style.overflow = '';
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    modal.querySelector('#modal-close').addEventListener('click', close);

    try {
        const response = await API.get(`/volumes/issue/${issueId}/collections-membership`);
        const collections = response.data || [];
        const listContainer = modal.querySelector('#membership-list');
        const loader = modal.querySelector('#membership-loading');

        loader.style.display = 'none';
        listContainer.style.display = 'flex';

        if (collections.length === 0) {
            listContainer.innerHTML = `
                <div class="ds-empty-state">
                    <h3>Нічого не знайдено</h3>
                    <p>Випуск не входить у жоден відомий збірник</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = collections.map(col => {
                const cover = comicVineImageUrl(col.cv_img);
                return `
                    <div class="membership-item">
                        ${cover ? `<img src="${cover}" class="membership-item-cover">` : `<div class="membership-item-cover-empty"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>`}
                        <div class="membership-item-info">
                            <div class="membership-item-title">${escapeHtmlAttribute(col.volume_name)}</div>
                            <div class="membership-item-num">Випуск #${escapeHtmlAttribute(col.issue_number)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        modal.querySelector('.ds-modal-body').innerHTML = `<div class="error-state">Помилка завантаження: ${err.message}</div>`;
    }
}

function renderCollectionsFromIssues(container, collections, options = {}) {
    const emptyMessage = options.emptyMessage || 'Цей том не входить у жоден відомий збірник';
    const typeLabel = options.typeLabel || 'Збірник';

    if (!collections.length) {
        container.innerHTML = `
            <div class="ds-empty-state">
                <h3>Нічого не знайдено</h3>
                <p>${escapeHtmlAttribute(emptyMessage)}</p>
            </div>
        `;
        return;
    }

    // Group by parent volume
    const groups = {};
    collections.forEach(col => {
        const key = col.parent_vol_id || 'unknown';
        if (!groups[key]) {
            groups[key] = {
                id: col.parent_vol_id,
                name: col.parent_vol_name || 'Інші збірники',
                lang: col.parent_vol_lang,
                items: []
            };
        }
        groups[key].items.push(col);
    });

    container.innerHTML = Object.values(groups).map(group => `
        <div class="collections-group">
            <div class="collections-group-header">
                <div class="collections-group-title">
                    ${group.id ? `<a href="#/volumes/${group.id}">${group.name}</a>` : group.name}
                    ${group.lang ? `<span class="collections-group-lang">${group.lang}</span>` : ''}
                </div>
            </div>
            <div class="issues-view-grid">
                ${group.items.map(col => {
                    const cover = comicVineImageUrl(col.cv_img);
                    const range = formatIssueRanges(col.volume_issue_numbers);
                    return `
                        <div class="issue-grid-card" onclick="location.hash='#/collections/${col.id}'" style="cursor: pointer;">
                            <div class="issue-grid-cover-wrap">
                                ${cover 
                                    ? `<img class="issue-grid-cover" src="${escapeHtmlAttribute(cover)}" loading="lazy">` 
                                    : `<div class="issue-grid-cover-empty"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
                                ${col.issue_number ? `<div class="issue-grid-number">#${escapeHtmlAttribute(col.issue_number)}</div>` : ''}
                                <div class="issue-grid-type-badge">${typeLabel}</div>
                                <div class="issue-grid-actions">
                                    <button class="issue-grid-toggle-btn ${col.is_owned ? 'is-owned' : ''}" data-id="${col.id}" title="${col.is_owned ? 'Видалити з колекції' : 'Додати в колекцію'}">
                                        ${col.is_owned ? ICON.trash : ICON.plus}
                                    </button>
                                </div>
                            </div>
                            <div class="issue-grid-body">
                                <div class="issue-grid-title">${escapeHtmlAttribute(col.name || 'Без назви')}</div>
                                <div class="issue-grid-meta">
                                    ${range ? `<span class="issue-grid-range">${ICON.hash} ${range}</span>` : ''}
                                    <span class="issue-grid-date">${formatDate(col.cover_date || col.release_date)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}
