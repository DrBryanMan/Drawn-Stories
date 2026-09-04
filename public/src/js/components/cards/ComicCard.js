import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';
import { icon } from '../../helpers/icons.js';

const LIST_COLORS = {
    'Planned': '#2563eb',
    'Reading': '#16a34a',
    'Completed': '#059669',
    'On Hold': '#d97706',
    'Dropped': '#dc2626',
};

const LIST_LABELS = {
    'Planned': 'Заплановано',
    'Reading': 'Читаю',
    'Completed': 'Прочитано',
    'On Hold': 'Відкладено',
    'Dropped': 'Закинуто'
};

/**
 * Creates a comic card element.
 * @param {object} item - Volume, Issue or Collection data from API
 * @returns {HTMLElement}
 */
export function createComicCard(item) {
    const isIssue = item.type === 'issue';
    const isCollection = item.type === 'collection' || item.is_collection;
    const isVolume = item.type === 'volume';

    const publisher = item.publisher_name || '';
    const year = item.start_year || (item.release_date ? item.release_date.split('-')[0] : '');
    const releaseDate = item.release_date ? item.release_date.split('-').reverse().join('.') : '';
    const lang = item.lang || '';
    const coverUrl = normalizeImageUrl(item.image || item.image || item.cover_img);
    const fallbackTitle = isCollection && item.issue_number
        ? `Книга ${item.issue_number}`
        : 'Без назви';
    const title = escapeHtmlAttribute(item.name || fallbackTitle);
    const coverSrc = escapeHtmlAttribute(coverUrl);

    const a = document.createElement('a');
    a.className = 'comic-card';
    
    if (isVolume) {
        a.href = `#/volumes/${item.id}`;
    } else if (isIssue) {
        a.href = `#/issues/${item.id}`;
        a.dataset.issueId = item.id;
    } else if (isCollection) {
        a.href = `#/collections/${item.id}`;
        a.dataset.collectionId = item.id;
    } else {
        const volId = item.volume_id;
        a.href = volId ? `#/volumes/${volId}` : '#';
    }

    const coverHTML = coverUrl
        ? `<img class="comic-cover" src="${coverSrc}" alt="${title}" loading="lazy">`
        : `<div class="comic-cover-placeholder">
             ${icon('imagePlaceholder', 32, { strokeWidth: 1.5 })}
           </div>`;

    let metaText = '';
    let statBadge = '';
    let verificationBadge = '';
    const issueIcon = icon('issues', 11, { strokeWidth: 2.5 });
    const calendarIcon = icon('calendar', 11, { strokeWidth: 2.5 });

    if (isIssue) {
        metaText = `
            <span class="comic-meta-item">${calendarIcon} ${releaseDate || year || '—'}</span>
        `;
    } else if (isCollection) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isAnnounced = item.release_date && item.release_date > today;
        const verificationStatus = isAnnounced ? 'announced' : (item.verification_status || 'unverified');
        const verificationMeta = {
            announced: {
                title: 'Збірник анонсовано, дата релізу в майбутньому',
                icon: icon('clock', 12, { strokeWidth: 2.2 }),
            },
            physical: {
                title: 'Інформація підтверджена з фізичного примірника',
                icon: icon('book', 12, { strokeWidth: 2.2 }),
            },
            open_sources: {
                title: 'Інформація взята з відкритих джерел',
                icon: icon('globe', 12, { strokeWidth: 2.2 }),
            },
            unverified: {
                title: 'Інформація ще не перевірена',
                icon: icon('shieldAlert', 12, { strokeWidth: 2.2 }),
            },
        }[verificationStatus] || {
            title: 'Інформація ще не перевірена',
            icon: icon('shieldAlert', 12, { strokeWidth: 2.2 }),
        };

        verificationBadge = `<span class="comic-source-badge comic-source-badge--verification volume-status-${verificationStatus}" title="${escapeHtmlAttribute(verificationMeta.title)}">${verificationMeta.icon}</span>`;
    } else {
        const issueCount = item.issue_count || 0;
        const collectionCount = item.collection_count || 0;
        const unconvertedCount = item.unconverted_issue_count || 0;
        const translationCount = item.translation_count || 0;
        
        let statText = `${issueCount}`;
        let statClass = 'comic-stat-badge';
        let currentIcon = issueIcon;
        
        if (translationCount > 0) {
            statText = `${translationCount}`;
            currentIcon = icon('language', 11, { strokeWidth: 2.5 });
        } else if (collectionCount > 0) {
            if (unconvertedCount > 0) {
                statText = `${unconvertedCount}? ${collectionCount}`;
                statClass += ' comic-stat-badge--unconverted';
            } else {
                statText = `${collectionCount}`;
            }
        } else if (issueCount > 0) {
            statClass += ' comic-stat-badge--unconverted';
            statText = `${issueCount}`;
        }

        statBadge = `<div class="${statClass}">${currentIcon} ${statText}</div>`;
        metaText = `
            <span class="comic-meta-item">${calendarIcon} ${year}</span>
        `;
    }

    const langBadge = lang && !isCollection ? `<span class="comic-lang-badge">${escapeHtmlAttribute(lang)}</span>` : '';

    const volumeIcon = icon('volumes', 11, { strokeWidth: 2.5 });
    const publisherIcon = icon('publishers', 11, { strokeWidth: 2.5 });

    const subTitle = isIssue
        ? `<div class="comic-publisher">${volumeIcon} <span>${escapeHtmlAttribute(item.volume_name || '')}</span></div>`
        : (publisher ? `<div class="comic-publisher">${publisherIcon} <span>${publisher}</span></div>` : '');

    let badge = '';
    if (isIssue) {
        badge = `<div class="comic-type-badge">#${escapeHtmlAttribute(item.issue_number || '?')}</div>`;
    } else if (isCollection) {
        badge = `<div class="comic-type-badge comic-type-badge--collection">#${escapeHtmlAttribute(item.issue_number || '?')}</div>`;
    } else if (isVolume && item.translation_count > 0) {
        badge = `<div class="comic-type-badge comic-type-badge--original">Оригінал</div>`;
    }

    let listBadge = '';
    if (item.list_name) {
        const color = LIST_COLORS[item.list_name];
        const label = LIST_LABELS[item.list_name];
        const bg = `color-mix(in srgb, ${color} 15%, rgba(255, 255, 255, 0.75))`;
        listBadge = `
            <div class="comic-list-badge" title="${label}" style="color: ${color}; background: ${bg}; border-color: color-mix(in srgb, ${color} 30%, transparent)">
                ${icon(item.list_name, 14, { strokeWidth: 2.2 })}
            </div>
        `;
    }

    const sources = [];
    if (item.mal_id) sources.push('<span class="comic-source-badge comic-source-badge--mal">MAL</span>');
    if (item.hikka_slug) sources.push('<span class="comic-source-badge comic-source-badge--hikka">HIKKA</span>');
    if (item.cv_id) sources.push('<span class="comic-source-badge comic-source-badge--cv">CV</span>');
    if (verificationBadge) sources.push(verificationBadge);
    const sourcesHTML = sources.length > 0 ? `<div class="comic-sources-list">${sources.join('')}</div>` : '';

    a.innerHTML = `
        <div class="comic-media">
            ${coverHTML}
            ${badge}
            ${statBadge}
            ${listBadge}
            ${sourcesHTML}
        </div>
        <div class="comic-body">
            <div class="comic-title">${title}</div>
            ${!isCollection ? `<div class="comic-meta-pill"><span>${metaText}</span>${langBadge}</div>` : ''}
            ${subTitle}
        </div>
    `;

    return a;
}
