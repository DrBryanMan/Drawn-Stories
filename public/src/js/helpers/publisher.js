export const PUBLISHER_COLORS = {
    // Top publishers
    'shueisha': '#e8453c',
    'shogakukan': '#3ecf8e',
    'kodansha': '#5b8dee',
    'akita shoten': '#f0943e',
    'futabasha': '#84cc16',
    'futabasha publishers ltd.': '#84cc16',
    'hakusensha': '#a78bfa',
    'houbunsha': '#ec4899',
    'kadokawa shoten': '#06b6d4',
    'shōnen gahōsha': '#f43f5e',
    'shonen gahosha': '#f43f5e',
    'takeshobo': '#0ea5e9',
    'coremagazine': '#f59e0b',
    'ascii media works': '#6366f1',
    'square enix': '#e2a74a',
    'tokuma shoten': '#14b8a6',
    'nihon bungeisha': '#8b5cf6',
    'media factory': '#64748b',
    'wani magazine': '#d946ef',
    'leed publishing': '#a1a1aa',
    'leed publishing co., ltd.': '#a1a1aa',
    'asahi sonorama': '#f472b6',
    'viz': '#ef4444',
    'ichijinsha': '#10b981',
    'shinchosha': '#6d28d9',
    'ushio shuppansha': '#b45309',
    'kobunsha': '#4f46e5',
    'fujimi shobo': '#f59e0b',
    'bunkasha': '#db2777',
    't.i. net': '#475569',
    'tatsumi publishing': '#854d0e',
    'enterbrain': '#0284c7',
    'daewon c.i.': '#059669',
    'got': '#be185d',
    'shinshokan': '#4338ca',
    'bungeishunjū': '#15803d',
    'bungeishunju': '#15803d',
    
    // Other publishers
    'coamix': '#ea580c',
    'carlsen verlag': '#2563eb',
    'mag garden': '#10b981',
    'akaneshinsha': '#ea580c',
    'shodensha': '#c084fc',
    'tong li publishing co.': '#be123c',
    'tong li': '#be123c',
    'magazine magazine': '#64748b',
    'g-walk': '#475569',
    'homesha': '#f43f5e',
    'mushi production': '#7c2d12',
    'geibunsha': '#0284c7',
    'gakken': '#047857',
    'scholar': '#3b82f6',
    'koike shoin': '#0d9488',
    'byakuya shobo': '#6366f1',
    'sekai bunkasha': '#a3e635',
    'shinseikaku': '#a21caf',
    'gakudosha': '#0369a1',
    'dark horse comics': '#1e3a8a',
    'full stop media': '#1e293b',
    'obunsha': '#b45309',
    'magazine house': '#0d9488',
    'icarus publications': '#b91c1c',
    'edizioni star comics': '#059669',
    'planeta deagostini': '#4f46e5',
    'yen press': '#0284c7',
    'tong li publishing group limited': '#be123c',
    'gutsoon': '#f97316',
    'wanibooks': '#d97706',
    'wani books': '#d97706',
    'gentosha': '#db2777',
    'hit publishing': '#9333ea',
    'shobunkan': '#2563eb',
    'max corporation': '#7c3aed',
    'jitsugyo no nihon sha': '#0891b2',
    'elex media komputindo': '#0d9488',
    'issuisya': '#ea580c',
    'sanwa publishing company ltd.': '#dc2626',
    'sanwa publishing': '#dc2626',
    'oaks': '#84cc16',
    'east press': '#db2777',
    'seirindo': '#b45309',
    'shufuto seikatsusha': '#0891b2',
    'hinomaru bunko': '#059669',
    'shinseisha': '#7c3aed',
    'katts': '#be185d',
    'shin nihon sports kikaku': '#475569',
    'takarajimasha': '#e11d48',
    'kasakura shuppansha': '#db2777',
    'sony magazines': '#2563eb',
    'hayakawa shobo': '#1e293b',
    'sanrio': '#ec4899'
};

/**
 * Returns color associated with a publisher name
 * @param {string} name - The publisher's name
 * @returns {string} Hex color code
 */
export function getPublisherColor(name) {
    if (!name) return '#64748b'; // Default color: slate
    const normalized = name.trim().toLowerCase();
    return PUBLISHER_COLORS[normalized] || '#64748b';
}

/**
 * Returns CSS style string for publisher badge
 * @param {string} name - The publisher's name
 * @returns {string} Style attribute content
 */
export function getPublisherBadgeStyle(name) {
    const color = getPublisherColor(name);
    return `border-color: color-mix(in srgb, ${color} 20%, var(--border-s)); background: color-mix(in srgb, ${color} 6%, #ffffff); color: ${color};`;
}
