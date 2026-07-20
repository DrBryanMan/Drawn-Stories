/**
 * public/src/js/components/SearchableUserSelect.js
 * Універсальний кастомний випадаючий список (з пошуком або без)
 */

// Глобальний реєстр відкритих інстанцій для auto-close
const _openInstances = new Set();

export function createSearchableUserSelect({
    container,
    placeholder = 'Оберіть',
    searchPlaceholder = "Пошук...",
    options = [],       // Рядки або об'єкти { value, label }
    value = '',
    searchable = true,  // false — без поля пошуку (для статусів/типів)
    emptyText = 'Не знайдено',
    onChange = () => {}
}) {
    let selectedValue = value || '';
    let searchQuery = '';
    let isOpen = false;

    function getNormalizedOptions() {
        return options.map(opt =>
            typeof opt === 'string' ? { value: opt, label: opt } : opt
        );
    }

    function closeDropdown() {
        if (!isOpen) return;
        isOpen = false;
        searchQuery = '';
        render();
    }

    function render() {
        const normOptions = getNormalizedOptions();
        const selectedObj = normOptions.find(o => o.value === selectedValue);
        const displayLabel = selectedObj ? selectedObj.label : placeholder;

        const searchHtml = searchable ? `
            <div class="user-search-select__search-wrap">
                <span class="user-search-select__search-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input type="text" class="user-search-select__input" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(searchQuery)}" autocomplete="off">
            </div>
        ` : '';

        container.innerHTML = `
            <div class="user-search-select ${isOpen ? 'is-open' : ''}">
                <button type="button" class="user-search-select__trigger ${selectedValue ? 'has-value' : ''}">
                    <span class="user-search-select__label">${escapeHtml(displayLabel)}</span>
                    <span class="user-search-select__arrow">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                </button>

                <div class="user-search-select__dropdown" ${!isOpen ? 'hidden' : ''}>
                    ${searchHtml}
                    <div class="user-search-select__list">
                        ${renderListHTML(normOptions)}
                    </div>
                </div>
            </div>
        `;

        attachEvents();
    }

    function renderListHTML(normOptions) {
        // Якщо є пошук і запит порожній — показуємо підказку замість повного списку
        if (searchable && !searchQuery) {
            return `
                <div class="user-search-select__item ${!selectedValue ? 'is-selected' : ''}" data-value="">
                    <span>${escapeHtml(placeholder)}</span>
                </div>
                <div class="user-search-select__hint">Почніть вводити нікнейм користувача</div>
            `;
        }

        const filtered = normOptions.filter(o =>
            o.label.toLowerCase().includes(searchQuery.toLowerCase())
        );

        let html = `
            <div class="user-search-select__item ${!selectedValue ? 'is-selected' : ''}" data-value="">
                <span>${escapeHtml(placeholder)}</span>
            </div>
        `;

        if (filtered.length === 0) {
            html += `<div class="user-search-select__empty">${escapeHtml(emptyText)}</div>`;
        } else {
            filtered.forEach(item => {
                html += `
                    <div class="user-search-select__item ${item.value === selectedValue ? 'is-selected' : ''}" data-value="${escapeHtml(item.value)}">
                        <span>${escapeHtml(item.label)}</span>
                    </div>
                `;
            });
        }

        return html;
    }

    function attachEvents() {
        const trigger = container.querySelector('.user-search-select__trigger');
        const input = container.querySelector('.user-search-select__input');
        const list = container.querySelector('.user-search-select__list');

        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const shouldOpen = !isOpen;

                // Закрити всі інші відкриті інстанції
                _openInstances.forEach(inst => {
                    if (inst !== api) inst.close();
                });

                isOpen = shouldOpen;
                if (isOpen) {
                    _openInstances.add(api);
                } else {
                    _openInstances.delete(api);
                }

                render();

                if (isOpen && input) {
                    container.querySelector('.user-search-select__input')?.focus();
                }
            });
        }

        if (input) {
            input.addEventListener('input', (e) => {
                e.stopPropagation();
                searchQuery = e.target.value;
                const normOptions = getNormalizedOptions();
                const listEl = container.querySelector('.user-search-select__list');
                if (listEl) {
                    listEl.innerHTML = renderListHTML(normOptions);
                    attachItemEvents(listEl);
                }
            });
            input.addEventListener('click', (e) => e.stopPropagation());
        }

        if (list) {
            attachItemEvents(list);
        }
    }

    function attachItemEvents(listEl) {
        listEl.querySelectorAll('.user-search-select__item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedValue = item.dataset.value;
                isOpen = false;
                searchQuery = '';
                _openInstances.delete(api);
                render();
                onChange(selectedValue);
            });
        });
    }

    function handleDocumentClick(e) {
        if (!container.contains(e.target) && isOpen) {
            isOpen = false;
            searchQuery = '';
            _openInstances.delete(api);
            render();
        }
    }

    document.addEventListener('click', handleDocumentClick);

    const api = {
        setValue(val) {
            selectedValue = val || '';
            render();
        },
        setOptions(newOpts) {
            options = newOpts || [];
            render();
        },
        close() {
            if (isOpen) {
                isOpen = false;
                searchQuery = '';
                _openInstances.delete(api);
                render();
            }
        },
        destroy() {
            document.removeEventListener('click', handleDocumentClick);
            _openInstances.delete(api);
            container.innerHTML = '';
        }
    };

    render();
    return api;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
