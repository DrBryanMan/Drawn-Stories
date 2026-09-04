import { getCurrentLanguage } from './i18n.js';

export const LANG_MAP = {
    ja:      { label: 'Японська',               flag: '🇯🇵' },
    en:      { label: 'Американська',           flag: '🇺🇸' },
    gb:      { label: 'Британська',             flag: '🇬🇧' },
    fr:      { label: 'Французька',             flag: '🇫🇷' },
    de:      { label: 'Німецька',               flag: '🇩🇪' },
    it:      { label: 'Італійська',             flag: '🇮🇹' },
    es:      { label: 'Іспанська',              flag: '🇪🇸' },
    ca:      { label: 'Каталонська (Іспанія)',  flag: '🇪🇸' },
    'es-AR': { label: 'Іспанська (Аргентина)',  flag: '🇦🇷' },
    be:      { label: 'Бельгійська',            flag: '🇧🇪' },
    'pt-br': { label: 'Бразильська',            flag: '🇧🇷' },
    el:      { label: 'Грецька',                flag: '🇬🇷' },
    da:      { label: 'Данська',                flag: '🇩🇰' },
    id:      { label: 'Індонезійська',          flag: '🇮🇩' },
    nl:      { label: 'Нідерландська',          flag: '🇳🇱' },
    no:      { label: 'Норвезька',              flag: '🇳🇴' },
    nb:      { label: 'Норвезька Букмол',       flag: '🇳🇴' },
    pl:      { label: 'Польська',               flag: '🇵🇱' },
    pt:      { label: 'Португальська',          flag: '🇵🇹' },
    sr:      { label: 'Сербська',               flag: '🇷🇸' },
    tr:      { label: 'Турецька',               flag: '🇹🇷' },
    fi:      { label: 'Фінська',                flag: '🇫🇮' },
    cs:      { label: 'Чеська',                 flag: '🇨🇿' },
    sv:      { label: 'Шведська',               flag: '🇸🇪' },
    uk:      { label: 'Українська',             flag: '🇺🇦' },
    hr:      { label: 'Хорватська',             flag: '🇭🇷' },
    zh:      { label: 'Китайська',              flag: '🇨🇳' },
    'zh-tw': { label: 'Китайська (Тайвань)',    flag: '🇨🇳' },
    tw:      { label: 'Тайська',                flag: '🇹🇼' },
    ko:      { label: 'Корейська',              flag: '🇰🇷' },
    ru:      { label: 'Російська',              flag: '🇷🇺' },
};

export function langDisplay(code) {
    if (!code) return { code: '', name: '' };
    const lower = code.toLowerCase();
    const entry = LANG_MAP[lower];
    return {
        code: lower,
        name: entry ? entry.label : code
    };
}

export function langName(code) {
    return langDisplay(code).name;
}

export function formatDate(dateStr, fallback = '—') {
    if (!dateStr) return fallback;
    const currentLang = getCurrentLanguage();
    const locale = currentLang === 'en' ? 'en-US' : 'uk-UA';

    try {
        const cleanStr = String(dateStr).trim().replace(' ', 'T');
        if (cleanStr.includes('-') && !cleanStr.includes('T')) {
            const parts = cleanStr.split('-');
            if (parts.length === 2 || (parts.length === 3 && parts[2] === '00')) {
                const year = parseInt(parts[0], 10);
                const monthIdx = parseInt(parts[1], 10) - 1;
                if (!isNaN(year) && !isNaN(monthIdx)) {
                    const d = new Date(year, monthIdx, 1);
                    const formatted = d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
                    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
                }
            }
        }
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return dateStr;

        const hasTime = cleanStr.includes('T') && cleanStr.length > 10;
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        if (hasTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        const formatted = d.toLocaleString(locale, options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
        return dateStr;
    }
}

export function parseAliases(aliases) {
    if (!aliases) return [];
    if (Array.isArray(aliases)) return aliases.map(a => String(a).trim()).filter(Boolean);

    const str = String(aliases).trim();
    if (!str) return [];

    if (str.startsWith('[') && str.endsWith(']')) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parsed.map(item => String(item).trim()).filter(Boolean);
            }
        } catch (e) {
            // Ignore JSON parse error and fallback
        }
    }

    return str.split(/[,;]/).map(item => item.replace(/^[\["'\s]+|[\]"'\s]+$/g, '').trim()).filter(Boolean);
}

export const ENTITY_TYPE_LABELS = {
    uk: {
        volume: 'Том',
        issue: 'Випуск',
        character: 'Персонаж',
        person: 'Персона',
        publisher: 'Видавництво',
        collection: 'Збірник',
        reprint: 'Передрук',
        series: 'Серія',
        magazine: 'Журнал',
        event: 'Подія'
    },
    en: {
        volume: 'Volume',
        issue: 'Issue',
        character: 'Character',
        person: 'Person',
        publisher: 'Publisher',
        collection: 'Collection',
        reprint: 'Reprint',
        series: 'Series',
        magazine: 'Magazine',
        event: 'Event'
    }
};

export function getEntityTypeLabel(type) {
    if (!type) return '';
    const key = String(type).toLowerCase();
    const lang = getCurrentLanguage();
    const dict = ENTITY_TYPE_LABELS[lang] || ENTITY_TYPE_LABELS.uk;
    return dict[key] || (ENTITY_TYPE_LABELS.uk[key] || type);
}

export function getEntityUrl(entityType, entityId) {
    if (!entityType || !entityId) return '#/';
    const type = String(entityType).toLowerCase();
    if (type === 'volume' || type === 'series') return `#/volumes/${entityId}`;
    if (type === 'issue' || type === 'reprint') return `#/issues/${entityId}`;
    if (type === 'character') return `#/characters/${entityId}`;
    if (type === 'person' || type === 'personnel') return `#/persons/${entityId}`;
    if (type === 'publisher') return `#/publishers/${entityId}`;
    if (type === 'collection') return `#/collections/${entityId}`;
    if (type === 'magazine') return `#/magazines/${entityId}`;
    if (type === 'event') return `#/events/${entityId}`;
    return '#/';
}

export function formatIssueRanges(nums) {
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

export const CURRENCY_SYMBOLS = {
    UAH: '₴',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    PLN: 'zł'
};

export function formatCurrency(amount, currency = 'UAH') {
    if (amount === null || amount === undefined || isNaN(amount) || amount === '') return '—';
    const num = parseFloat(amount);
    const currCode = String(currency || 'UAH').toUpperCase();
    const symbol = CURRENCY_SYMBOLS[currCode] || currCode;
    
    const isInt = num % 1 === 0;
    const formattedNum = num.toLocaleString('uk-UA', {
        minimumFractionDigits: isInt ? 0 : 2,
        maximumFractionDigits: 2
    });

    if (currCode === 'USD' || currCode === 'GBP' || currCode === 'EUR' || currCode === 'JPY') {
        return `${symbol}${formattedNum}`;
    }
    return `${formattedNum} ${symbol}`;
}
