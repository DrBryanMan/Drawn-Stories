/* public/src/js/components/ScrapeProgressModal.js */

const ICON = {
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    refreshCw: '<svg class="spin-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 3h5v5"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alertTriangle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

let _modal = null;
let _eventSource = null;
let _isFinished = false;

export function openScrapeProgressModal(type, id) {
    if (document.getElementById('scrape-progress-modal-overlay')) {
        return;
    }

    _isFinished = false;

    const overlay = document.createElement('div');
    overlay.id = 'scrape-progress-modal-overlay';
    overlay.className = 'ds-modal-overlay';
    overlay.style.display = 'flex';

    const titleText = type === 'volume' 
        ? 'Скрапінг томів' 
        : (type === 'manga-characters' ? 'Парсинг персонажів манґи' : 'Скрапінг випуску');

    overlay.innerHTML = `
        <div class="ds-modal scrape-progress-modal">
            <div class="ds-modal-header">
                <div class="ds-modal-title">${titleText}</div>
                <button class="ds-modal-close" id="spm-close-x-btn" style="display: none;">${ICON.x}</button>
            </div>
            <div class="ds-modal-body">
                <div class="spm-status-bar">
                    <span class="spm-status-icon">${ICON.refreshCw}</span>
                    <span class="spm-status-text">Ініціалізація підключення...</span>
                </div>
                <div class="scrape-terminal" id="spm-terminal">
                    <div class="terminal-line terminal-system">Підключення до сервера...</div>
                </div>
            </div>
            <div class="ds-modal-footer">
                <button class="btn-admin btn-admin--secondary" id="spm-action-btn">Зупинити</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    _modal = overlay;

    const terminal = document.getElementById('spm-terminal');
    const statusText = overlay.querySelector('.spm-status-text');
    const statusIcon = overlay.querySelector('.spm-status-icon');
    const actionBtn = document.getElementById('spm-action-btn');
    const closeXBtn = document.getElementById('spm-close-x-btn');

    const appendLog = (text, category = 'info') => {
        const line = document.createElement('div');
        line.className = `terminal-line terminal-${category}`;
        
        // Convert typical console color sequences to spans or plain text
        let cleanText = text
            .replace(/\033\[[0-9;]*m/g, '') // remove bash color codes if any seep through
            .replace(/\[DONE\]/g, '')
            .replace(/\[ERROR\]/g, '');

        line.textContent = cleanText;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    };

    const finishProcess = (success) => {
        _isFinished = true;
        if (_eventSource) {
            _eventSource.close();
            _eventSource = null;
        }

        actionBtn.textContent = 'Закрити та оновити';
        actionBtn.className = 'btn-admin btn-admin--primary';
        closeXBtn.style.display = 'block';

        if (success) {
            statusIcon.innerHTML = ICON.check;
            statusIcon.className = 'spm-status-icon spm-status-success';
            statusText.textContent = 'Парсинг успішно завершено!';
            appendLog('Процес завершено успішно.', 'success');
        } else {
            statusIcon.innerHTML = ICON.alertTriangle;
            statusIcon.className = 'spm-status-icon spm-status-error';
            statusText.textContent = 'Сталася помилка під час парсингу';
            appendLog('Процес перервано через помилку.', 'error');
        }
    };

    // Close logic
    const close = () => {
        if (_eventSource) {
            _eventSource.close();
        }
        if (_modal) {
            _modal.remove();
            _modal = null;
        }
        if (_isFinished) {
            window.location.reload();
        }
    };

    actionBtn.onclick = () => {
        if (_isFinished) {
            close();
        } else {
            appendLog('Процес зупинено користувачем.', 'system');
            finishProcess(false);
        }
    };

    closeXBtn.onclick = close;

    // Connect to SSE
    const sseUrl = `/api/scrape/${type}/${id}`;
    _eventSource = new EventSource(sseUrl);

    _eventSource.onmessage = (event) => {
        const data = event.data;
        
        if (data.includes('[DONE]')) {
            appendLog(data, 'success');
            finishProcess(true);
        } else if (data.includes('[ERROR]')) {
            appendLog(data, 'error');
            finishProcess(false);
        } else {
            let cat = 'info';
            if (data.toLowerCase().includes('помилка')) cat = 'error';
            else if (data.toLowerCase().includes('попередження')) cat = 'warning';
            else if (data.toLowerCase().includes('успішно')) cat = 'success';
            else if (data.toLowerCase().includes('початок')) cat = 'system';
            
            appendLog(data, cat);
            statusText.textContent = type === 'manga-characters' 
                ? 'Виконується парсинг даних з MyAnimeList...' 
                : 'Виконується парсинг даних з Comic Vine...';
        }
    };

    _eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        if (!_isFinished) {
            appendLog('Помилка з\'єднання з сервером.', 'error');
            finishProcess(false);
        }
    };
}
