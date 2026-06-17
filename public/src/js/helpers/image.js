const COMICVINE_UPLOADS_URL = 'https://comicvine.gamespot.com/a/uploads/';
const COMICVINE_SMALL_URL = `${COMICVINE_UPLOADS_URL}scale_small/`;

/**
 * Converts ComicVine or Fandom image shortcuts into full URLs.
 * @param {string | null | undefined} value
 * @param {number} width Default width for thumbnails (e.g. Fandom)
 * @returns {string}
 */
export function comicVineImageUrl(value, width = 250) {
    if (!value) return '';

    const path = String(value).trim();
    if (!path) return '';

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
