const COMICVINE_UPLOADS_URL = 'https://comicvine.gamespot.com/a/uploads/';
const COMICVINE_SMALL_URL = `${COMICVINE_UPLOADS_URL}scale_small/`;

/**
 * Normalizes various image URL formats (ComicVine shortcodes, Fandom/Wikia, relative paths)
 * into a full, usable URL.
 * @param {string | null | undefined} value
 * @param {number} width Default width for Fandom thumbnails
 * @returns {string}
 */
export function normalizeImageUrl(value, width = 250) {
    if (!value) return '';

    const path = String(value).trim();
    if (!path) return '';

    if (path.startsWith('data:') || path.startsWith('blob:')) {
        return path;
    }

    // Fandom (Wikia) Support
    // Original: https://static.wikia.nocookie.net/marvel/images/6/6b/Filename.jpeg/revision/latest?path-prefix=ru
    // Target: https://images.wikia.nocookie.net/marvel/ru/images/thumb/6/6b/Filename.jpeg/250px-.
    if (path.includes('static.wikia.nocookie.net')) {
        try {
            const urlObj = new URL(path);
            const pathPrefix = urlObj.searchParams.get('path-prefix');
            const wikiName = urlObj.pathname.split('/')[1];
            
            const parts = urlObj.pathname.split('/');
            const imagesIdx = parts.indexOf('images');
            
            if (imagesIdx !== -1 && wikiName) {
                const imagePathParts = parts.slice(imagesIdx);
                const revisionIdx = imagePathParts.indexOf('revision');
                const cleanParts = revisionIdx !== -1 ? imagePathParts.slice(0, revisionIdx) : imagePathParts;
                
                // Add "thumb" after "images"
                cleanParts.splice(1, 0, 'thumb');
                
                const prefix = pathPrefix ? `${pathPrefix}/` : '';
                return `https://images.wikia.nocookie.net/${wikiName}/${prefix}${cleanParts.join('/')}/${width}px-.`;
            }
        } catch (e) {
            // Fallback to original if parsing fails
        }
    }

    if (/^https?:\/\//i.test(path)) {
        try {
            const url = new URL(path);
            if (typeof window !== 'undefined' && (url.origin === window.location.origin || url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
                return url.pathname + url.search + url.hash;
            }
        } catch (e) {}
        return path;
    }
    if (path.startsWith('//')) return `https:${path}`;

    const cleanPath = path.replace(/^\/+/, '');

    // Local application static/media/api paths
    const isComicVineUpload = /^uploads\/(scale_|original\/)/.test(cleanPath) || /^a\/uploads\//.test(cleanPath) || /^scale_/.test(cleanPath);
    if (cleanPath.startsWith('images/') || cleanPath.startsWith('static/') || cleanPath.startsWith('api/') || (cleanPath.startsWith('uploads/') && !isComicVineUpload)) {
        return `/${cleanPath}`;
    }

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

/** @deprecated Use normalizeImageUrl instead */
export const comicVineImageUrl = normalizeImageUrl;

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
