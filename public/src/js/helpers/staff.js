export const STAFF_ROLES = {
    'editor-in-chief': 'Головний редактор',
    'writer': 'Сценарій',
    'artist': 'Малюнок',
    'penciler': 'Нарис',
    'inker': 'Туш',
    'colorist': 'Колір',
    'letterer': 'Верстка',
    'cover': 'Обкладинка',
    'editor': 'Редактура',
    'translator': 'Переклад',
    'designer': 'Дизайн',
    'assistant': 'Асистент',
    'publisher': 'Видавець'
};

export const ROLE_SORT_ORDER = [
    'editor-in-chief',
    'writer',
    'penciler',
    'inker',
    'colorist',
    'letterer',
    'editor'
];

export function translateStaffRole(role) {
    if (!role) return '';
    const cleanRole = role.trim().toLowerCase();
    return STAFF_ROLES[cleanRole] || role;
}

export function getRoleSortIndex(role) {
    const cleanRole = (role || '').trim().toLowerCase();
    const index = ROLE_SORT_ORDER.indexOf(cleanRole);
    return index !== -1 ? index : 999;
}
