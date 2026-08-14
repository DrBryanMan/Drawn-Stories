let _FuseModule = null;

/**
 * Завантажує та кешує екземпляр Fuse.js
 * @returns {Promise<any>}
 */
export async function getFuse() {
    if (_FuseModule) return _FuseModule;
    if (typeof window !== 'undefined' && window.Fuse) {
        _FuseModule = window.Fuse;
        return _FuseModule;
    }
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs');
        _FuseModule = mod.default || mod;
        return _FuseModule;
    } catch (e) {
        console.warn('Fuse.js CDN load failed, falling back to standard search', e);
        return null;
    }
}

/**
 * Виконує fuzzy search для списку персонажів за допомогою Fuse.js
 * @param {Array} items
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function fuzzySearchCharacters(items, query) {
    if (!query || !items || items.length === 0) return items || [];
    const Fuse = await getFuse();
    if (!Fuse) return items;

    const fuse = new Fuse(items, {
        keys: [
            { name: 'name_uk', weight: 0.35 },
            { name: 'name', weight: 0.35 },
            { name: 'real_name_uk', weight: 0.15 },
            { name: 'real_name', weight: 0.15 },
            { name: 'name_native', weight: 0.1 },
            { name: 'franchise', weight: 0.1 }
        ],
        threshold: 0.45,
        ignoreLocation: true
    });

    const results = fuse.search(query);
    if (results && results.length > 0) {
        return results.map(r => r.item);
    }
    return items;
}
