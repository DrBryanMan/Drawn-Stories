/**
 * Helper to manage anonymous bookmarks in localStorage.
 * Format: [ { id: number, type: 'volume'|'issue'|'person'|'character' }, ... ]
 */

const STORAGE_KEY = 'ds-bookmarks';

export const Bookmarks = {
    getAll() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to parse bookmarks from localStorage', e);
            return [];
        }
    },

    saveAll(bookmarks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        window.dispatchEvent(new CustomEvent('bookmarks-changed', { detail: bookmarks }));
    },

    add(id, type) {
        const bookmarks = this.getAll();
        if (!bookmarks.some(b => b.id === id && b.type === type)) {
            bookmarks.push({ id, type });
            this.saveAll(bookmarks);
        }
    },

    remove(id, type) {
        const bookmarks = this.getAll();
        const filtered = bookmarks.filter(b => !(b.id === id && b.type === type));
        if (filtered.length !== bookmarks.length) {
            this.saveAll(filtered);
        }
    },

    toggle(id, type) {
        if (this.has(id, type)) {
            this.remove(id, type);
            return false;
        } else {
            this.add(id, type);
            return true;
        }
    },

    has(id, type) {
        const bookmarks = this.getAll();
        return bookmarks.some(b => b.id === id && b.type === type);
    },

    count() {
        return this.getAll().length;
    }
};
