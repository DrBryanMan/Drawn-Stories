const COMICVINE_UPLOADS_URL = 'https://comicvine.gamespot.com/a/uploads/';
const COMICVINE_SMALL_URL = `${COMICVINE_UPLOADS_URL}scale_small/`;

/**
 * Converts ComicVine image shortcuts into full URLs.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function comicVineImageUrl(value) {
    if (!value) return '';

    const path = String(value).trim();
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('//')) return `https:${path}`;

    const cleanPath = path.replace(/^\/+/, '');
    if (cleanPath.startsWith('a/uploads/')) {
        return `https://comicvine.gamespot.com/${cleanPath}`;
    }
    if (cleanPath.startsWith('uploads/')) {
        return `https://comicvine.gamespot.com/a/${cleanPath}`;
    }
    if (cleanPath.startsWith('scale_')) {
        return `${COMICVINE_UPLOADS_URL}${cleanPath}`;
    }

    return `${COMICVINE_SMALL_URL}${cleanPath}`;
}

/**
 * Escapes text for use inside HTML attributes.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function escapeHtmlAttribute(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}
