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

export function formatDate(dateStr, fallback = null) {
    if (!dateStr) return fallback;
    const currentLang = localStorage.getItem('site_lang') || 'uk';
    const locale = currentLang === 'en' ? 'en-US' : 'uk-UA';
    let formatted = dateStr;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2] === '00') {
            const monthsUk = [
                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
            ];
            const monthsEn = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
            ];
            const months = currentLang === 'en' ? monthsEn : monthsUk;
            const mIdx = parseInt(parts[1], 10) - 1;
            formatted = `${months[mIdx] || parts[1]} ${parts[0]}`;
        } else {
            try {
                const d = new Date(dateStr);
                formatted = d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
            } catch {
                formatted = dateStr;
            }
        }
    }
    if (formatted && typeof formatted === 'string') {
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return formatted;
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


