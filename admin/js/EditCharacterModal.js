import { API } from '/static/js/helpers/api.js';
import { comicVineImageUrl, escapeHtmlAttribute } from '/static/js/helpers/image.js';

export function openEditCharacterModal(char, onUpdate) {
    const modalId = 'admin-edit-character-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'admin-modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div class="admin-modal-content" style="
            background: var(--bg-card); border: 1px solid var(--border-s);
            border-radius: var(--r-lg); width: 560px; padding: 24px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: flex;
            flex-direction: column; gap: 20px; position: relative;
            max-height: 90vh; overflow-y: auto;
        ">
            <h4 style="margin: 0; font-family: var(--font-oswald); text-transform: uppercase; font-size: 16px; color: var(--text);">Редагування персонажа</h4>
            
            <!-- Категорія: Імена -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; display: block;">Імена</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Оригінальне ім'я</label>
                        <input type="text" id="edit-char-name" class="admin-input" value="${escapeHtmlAttribute(char.name || '')}" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Українське ім'я</label>
                        <input type="text" id="edit-char-name-uk" class="admin-input" value="${escapeHtmlAttribute(char.name_uk || '')}" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Ромаджі ім'я</label>
                        <input type="text" id="edit-char-name-ro" class="admin-input" value="${escapeHtmlAttribute(char.name_ro || '')}" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Реальне ім'я</label>
                        <input type="text" id="edit-char-real-name" class="admin-input" value="${escapeHtmlAttribute(char.real_name || '')}" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Реальне ім'я (Укр)</label>
                        <input type="text" id="edit-char-real-name-uk" class="admin-input" value="${escapeHtmlAttribute(char.real_name_uk || '')}" style="margin-bottom: 0;">
                    </div>
                </div>
            </div>

            <!-- Категорія: Зображення -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; display: block;">Зображення</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Зображення (URL)</label>
                        <input type="text" id="edit-char-image" class="admin-input" value="${escapeHtmlAttribute(char.image || '')}" placeholder="URL" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Портрет (Звичайний)</label>
                        <input type="text" id="edit-char-portret-img" class="admin-input" value="${escapeHtmlAttribute(char.portret_img || '')}" placeholder="URL" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Костюм (Повний зріст)</label>
                        <input type="text" id="edit-char-costume-img" class="admin-input" value="${escapeHtmlAttribute(char.costume_img || '')}" placeholder="URL" style="margin-bottom: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Костюм (Портрет)</label>
                        <input type="text" id="edit-char-portret-costume-img" class="admin-input" value="${escapeHtmlAttribute(char.portret_costume_img || '')}" placeholder="URL" style="margin-bottom: 0;">
                    </div>
                </div>
            </div>
            
            <!-- Категорія: Інше -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--border-s); padding-bottom: 4px; display: block;">Інше</span>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Сутність (Essence)</label>
                    <select id="edit-char-essence" class="admin-select" style="margin-bottom: 0;">
                        <option value="">-- Не обрано --</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-muted);">Автори</label>
                    <div style="display: flex; gap: 8px; position: relative; width: 100%;">
                        <div style="flex: 1; position: relative;">
                            <input type="text" id="edit-char-creator-search" class="admin-input" placeholder="Пошук автора за ім'ям..." style="margin-bottom: 0; width: 100%;">
                            <div id="edit-char-creator-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--r); z-index: 10005; max-height: 180px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; width: 100px; flex-shrink: 0;">
                            <input type="number" id="edit-char-creator-id-input" class="admin-input" placeholder="ID" style="margin-bottom: 0; width: 100%;">
                        </div>
                    </div>
                    <div id="edit-char-creators-chips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; min-height: 24px;"></div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width: 100%;">
                <button type="button" class="btn-admin btn-admin--danger btn-delete-char-from-db" style="margin-bottom: 0; padding: 0 14px;">Видалити з бази</button>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-admin btn-admin--secondary btn-close-char-modal" style="margin-bottom: 0;">Скасувати</button>
                    <button type="button" class="btn-admin btn-admin--primary btn-save-char-modal" style="margin-bottom: 0;">Зберегти</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    let selectedCreators = [];
    const chipsContainer = modal.querySelector('#edit-char-creators-chips');
    const searchInput = modal.querySelector('#edit-char-creator-search');
    const searchResults = modal.querySelector('#edit-char-creator-search-results');
    const idInput = modal.querySelector('#edit-char-creator-id-input');
    
    const renderChips = () => {
        chipsContainer.innerHTML = selectedCreators.map(c => {
            const avatar = c.image ? comicVineImageUrl(c.image) : '';
            return `
                <div class="creator-chip" style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-2); border: 1px solid var(--border-s); border-radius: 12px; font-size: 11px; color: var(--text);">
                    ${avatar ? `<img src="${escapeHtmlAttribute(avatar)}" style="width: 16px; height: 16px; border-radius: 50%; object-fit: cover;">` : ''}
                    <span>${escapeHtmlAttribute(c.name)} (ID: ${c.id})</span>
                    <button type="button" class="btn-remove-creator" data-id="${c.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 2px; font-size: 10px; font-weight: bold; line-height: 1;">✕</button>
                </div>
            `;
        }).join('');
        
        chipsContainer.querySelectorAll('.btn-remove-creator').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                selectedCreators = selectedCreators.filter(c => c.id !== id);
                renderChips();
            });
        });
    };
    
    // Load initial creators
    if (char.creators) {
        API.get('/personnel', { ids: char.creators, limit: 100 })
            .then(res => {
                selectedCreators = (res.items || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    image: p.image
                }));
                renderChips();
            })
            .catch(err => console.error('Error loading character creators:', err));
    }

    // Load essences and preselect
    const essenceSelect = modal.querySelector('#edit-char-essence');
    API.get('/essences', { limit: 200 })
        .then(res => {
            const list = res.items || [];
            list.forEach(es => {
                const opt = document.createElement('option');
                opt.value = es.slug;
                opt.textContent = `${es.essence_name_uk || es.essence_name} (${es.slug})`;
                if (char.essence === es.slug) {
                    opt.selected = true;
                }
                essenceSelect.appendChild(opt);
            });
        })
        .catch(err => console.error('Error loading essences list for edit character modal:', err));
    
    // Setup drop-down search rendering helper
    const renderSearchResults = (items) => {
        if (items.length === 0) {
            searchResults.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Нічого не знайдено</div>';
            return;
        }
        
        searchResults.innerHTML = items.map(p => {
            const avatar = p.image ? comicVineImageUrl(p.image) : '';
            const avatarHTML = avatar
                ? `<img src="${escapeHtmlAttribute(avatar)}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">`
                : `<div style="width: 20px; height: 20px; border-radius: 50%; background: var(--bg-2); display: flex; align-items: center; justify-content: center; font-size: 8px; color: var(--text-muted);">?</div>`;
            return `
                <div class="creator-search-item" data-id="${p.id}" data-name="${escapeHtmlAttribute(p.name)}" data-image="${escapeHtmlAttribute(p.image || '')}" style="
                    display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px;
                    border-bottom: 1px solid var(--border-s); transition: background var(--t); color: var(--text);
                ">
                    ${avatarHTML}
                    <span>${escapeHtmlAttribute(p.name)} (ID: ${p.id})</span>
                </div>
            `;
        }).join('');
        
        searchResults.querySelectorAll('.creator-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const pid = parseInt(item.dataset.id);
                if (!selectedCreators.some(c => c.id === pid)) {
                    selectedCreators.push({
                        id: pid,
                        name: item.dataset.name,
                        image: item.dataset.image
                    });
                    renderChips();
                }
                searchInput.value = '';
                idInput.value = '';
                searchResults.style.display = 'none';
            });
        });
    };
    
    // Search creators by name
    let timeout = null;
    searchInput.addEventListener('input', () => {
        idInput.value = ''; // Clear ID input
        const q = searchInput.value.trim();
        clearTimeout(timeout);
        if (!q) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }
        
        searchResults.style.display = 'block';
        searchResults.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Пошук...</div>';
        
        timeout = setTimeout(async () => {
            try {
                const res = await API.get('/personnel', { search: q, limit: 8 });
                renderSearchResults(res.items || []);
            } catch (err) {
                console.error(err);
            }
        }, 300);
    });
    
    // Search creator by ID
    idInput.addEventListener('input', () => {
        searchInput.value = ''; // Clear search input
        const idVal = idInput.value.trim();
        clearTimeout(timeout);
        if (!idVal) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }
        
        searchResults.style.display = 'block';
        searchResults.innerHTML = '<div style="padding: 8px; font-size: 12px; color: var(--text-muted);">Пошук...</div>';
        
        timeout = setTimeout(async () => {
            try {
                const res = await API.get('/personnel', { ids: idVal });
                renderSearchResults(res.items || []);
            } catch (err) {
                console.error(err);
            }
        }, 300);
    });
    
    const close = () => {
        modal.remove();
        document.removeEventListener('keydown', onEsc);
    };
    
    modal.querySelector('.btn-close-char-modal').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    
    modal.querySelector('.btn-save-char-modal').addEventListener('click', async () => {
        const creatorsList = selectedCreators.map(c => c.id).join(', ') || null;
        const updated = {
            name: modal.querySelector('#edit-char-name').value.trim(),
            name_uk: modal.querySelector('#edit-char-name-uk').value.trim() || null,
            name_ro: modal.querySelector('#edit-char-name-ro').value.trim() || null,
            real_name: modal.querySelector('#edit-char-real-name').value.trim() || null,
            real_name_uk: modal.querySelector('#edit-char-real-name-uk').value.trim() || null,
            essence: modal.querySelector('#edit-char-essence').value || null,
            creators: creatorsList,
            image: modal.querySelector('#edit-char-image').value.trim() || null,
            portret_img: modal.querySelector('#edit-char-portret-img').value.trim() || null,
            costume_img: modal.querySelector('#edit-char-costume-img').value.trim() || null,
            portret_costume_img: modal.querySelector('#edit-char-portret-costume-img').value.trim() || null
        };
        
        if (!updated.name) {
            alert('Оригінальне ім\'я обов\'язкове');
            return;
        }
        
        try {
            await API.put(`/characters/${char.id}`, updated);
            onUpdate(updated);
            close();
        } catch (err) {
            alert('Помилка збереження: ' + err.message);
        }
    });

    // Delete character from DB
    modal.querySelector('.btn-delete-char-from-db').addEventListener('click', async () => {
        if (!confirm(`Ви впевнені, що хочете остаточно видалити персонажа "${char.name}" з бази даних? Ця дія видалить його з усіх випусків та томів.`)) return;
        
        try {
            await API.delete(`/characters/${char.id}`);
            onUpdate(null); // Signal deletion
            close();
        } catch (err) {
            alert('Помилка видалення: ' + err.message);
        }
    });
    
    // Close search dropdown when clicking outside
    const closeSearch = (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !idInput.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    };
    document.addEventListener('click', closeSearch);
}
