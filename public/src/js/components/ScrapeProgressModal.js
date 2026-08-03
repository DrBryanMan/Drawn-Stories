import { icon } from '../helpers/icons.js';

let _modal = null;
let _eventSource = null;
let _isFinished = false;

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function openTerminalLogModal({ title, sseUrl, onFinish, autoReload = false }) {
    if (document.getElementById('scrape-progress-modal-overlay')) {
        return;
    }

    _isFinished = false;

    const overlay = document.createElement('div');
    overlay.id = 'scrape-progress-modal-overlay';
    overlay.className = 'ds-modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML = `
        <div class="ds-modal scrape-progress-modal" id="scrape-progress-modal">
            <div class="ds-modal-header">
                <div class="ds-modal-title">${escapeHtml(title)}</div>
                <button class="ds-modal-close" id="spm-close-x-btn" style="display: none;">${icon('x', 20, { strokeWidth: 2.2 })}</button>
            </div>
            <div class="ds-modal-body">
                <div class="spm-status-bar">
                    <span class="spm-status-icon">${icon('refreshCw', 20, { strokeWidth: 2.2, class: 'spin-icon' })}</span>
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
        
        let cleanText = text
            .replace(/\033\[[0-9;]*m/g, '') // remove bash color codes
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

        actionBtn.textContent = autoReload ? 'Закрити та оновити' : 'Закрити';
        actionBtn.className = 'btn-admin btn-admin--primary';
        closeXBtn.style.display = 'block';

        if (success) {
            statusIcon.innerHTML = icon('check', 20, { strokeWidth: 2.5 });
            statusIcon.className = 'spm-status-icon spm-status-success';
            statusText.textContent = 'Процес успішно завершено!';
            appendLog('Завершено.', 'success');
        } else {
            statusIcon.innerHTML = icon('warning', 20, { strokeWidth: 2.2 });
            statusIcon.className = 'spm-status-icon spm-status-error';
            statusText.textContent = 'Сталася помилка під час виконання';
            appendLog('Процес перервано через помилку.', 'error');
        }

        if (typeof onFinish === 'function') {
            onFinish(success);
        }
    };

    const close = () => {
        if (_eventSource) {
            _eventSource.close();
        }
        if (_modal) {
            _modal.remove();
            _modal = null;
        }
        if (_isFinished && autoReload) {
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
            const lower = data.toLowerCase();
            if (lower.includes('помилка') || data.includes('[x]')) cat = 'error';
            else if (lower.includes('попередження')) cat = 'warning';
            else if (lower.includes('успішно') || data.includes('[~]')) cat = 'success';
            else if (lower.includes('початок') || data.includes('[system]') || lower.includes('запуск')) cat = 'system';
            
            appendLog(data, cat);
            statusText.textContent = 'Виконується обробка даних...';
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

export function openScrapeProgressModal(type, id) {
    const titleText = type === 'volume' 
        ? 'Скрапінг томів' 
        : (type === 'manga-characters' ? 'Парсинг персонажів манґи' : 'Скрапінг випуску');
    openTerminalLogModal({
        title: titleText,
        sseUrl: `/api/scrape/${type}/${id}`,
        autoReload: true
    });
}
