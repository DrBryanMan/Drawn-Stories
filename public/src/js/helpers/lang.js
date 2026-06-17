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
