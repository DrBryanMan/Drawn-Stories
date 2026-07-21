/* public/src/js/helpers/modalManager.js */

/**
 * Глобальний менеджер закриття модальних вікон.
 * Автоматично обробляє:
 * 1. Клік за межами модального вікна (на оверлей .ds-modal-overlay)
 * 2. Натискання клавіші Escape для будь-якої відкритої модалки в системі.
 */

export function initGlobalModalListeners() {
    if (window._globalModalListenersInitialized) return;
    window._globalModalListenersInitialized = true;

    // 1. Клік по кнопці закриття або поза модальним вікном (на затемнений фон)
    document.addEventListener('click', (e) => {
        const closeTrigger = e.target.closest('.ds-modal-close, [data-close-modal]');
        if (closeTrigger) {
            const overlay = closeTrigger.closest('.ds-modal-overlay');
            if (overlay) {
                closeModalDirectly(overlay);
                return;
            }
        }

        const overlay = e.target.closest('.ds-modal-overlay');
        if (overlay && e.target === overlay) {
            closeModalOverlay(overlay);
        }
    });

    // 2. Натискання клавіші Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const visibleOverlays = Array.from(document.querySelectorAll('.ds-modal-overlay')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && !el.hasAttribute('hidden');
            });

            if (visibleOverlays.length > 0) {
                // Закриваємо верхню/останню відкриту модалку
                const topOverlay = visibleOverlays[visibleOverlays.length - 1];
                closeModalOverlay(topOverlay);
            }
        }
    });
}

/**
 * Безпосереднє закриття оверлею (без повторної симуляції кліку)
 */
export function closeModalDirectly(overlay) {
    if (!overlay) return;

    if (overlay.style.display && overlay.style.display !== 'none') {
        overlay.style.display = 'none';
    } else if (overlay.id) {
        overlay.style.display = 'none';
    } else {
        overlay.remove();
    }

    const remainingOpen = Array.from(document.querySelectorAll('.ds-modal-overlay')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (remainingOpen.length === 0) {
        document.body.classList.remove('modal-open');
    }
}

/**
 * Універсальне закриття модального оверлею
 */
export function closeModalOverlay(overlay) {
    if (!overlay) return;

    // Якщо є кнопка закриття всередині — симулюємо її натискання
    const closeBtn = overlay.querySelector('.ds-modal-close, [data-close-modal], #modal-close, #aim-close-btn, #arm-close-btn, #spm-close-x-btn, #gam-close');
    if (closeBtn && typeof closeBtn.click === 'function') {
        closeBtn.click();
        return;
    }

    closeModalDirectly(overlay);
}

// Автоматична ініціалізація при підключенні
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalModalListeners);
    } else {
        initGlobalModalListeners();
    }
}
