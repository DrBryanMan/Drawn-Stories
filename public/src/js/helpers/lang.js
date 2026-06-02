export const LANG_MAP = {
    ja:      { label: 'Японська',               flag: '🇯🇵' },
    en:      { label: 'Американська',           flag: '🇺🇸' },
    gb:      { label: 'Британська',             flag: '🇬🇧' },
    fr:      { label: 'Французька',             flag: '🇫🇷' },
    de:      { label: 'Німецька',               flag: '🇩🇪' },
    it:      { label: 'Італійська',             flag: '🇮🇹' },
    es:      { label: 'Іспанська',              flag: '🇪🇸' },
    'es-AR': { label: 'Іспанська (Аргентина)',  flag: '🇦🇷' },
    be:      { label: 'Бельгійська',            flag: '🇧🇪' },
    'pt-br': { label: 'Бразильська',            flag: '🇧🇷' },
    el:      { label: 'Грецька',                flag: '🇬🇷' },
    da:      { label: 'Данська',                flag: '🇩🇰' },
    id:      { label: 'Індонезійська',          flag: '🇮🇩' },
    nb:      { label: 'Норвезька Букмол',       flag: '🇳🇴' },
    nl:      { label: 'Нідерландська',          flag: '🇳🇱' },
    no:      { label: 'Норвезька',              flag: '🇳🇴' },
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
    if (!code) return '';
    const entry = LANG_MAP[code.toLowerCase()];
    // The user said "використовуй монотонні Lucide Icon, а не емоджі" (use monotone Lucide icons, not emoji)
    // So I will return ONLY the label here, the icon will be handled by the SVG in the view.
    return code
}
