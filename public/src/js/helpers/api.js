function extractTitleFromHtml(html) {
    if (!html) return null;
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!match || !match[1]) return null;
    let title = match[1].trim();
    if (title.includes(' · ')) {
        title = title.split(' · ')[0].trim();
    } else if (title.includes(' — ')) {
        title = title.split(' — ')[0].trim();
    } else if (title.includes(' | ')) {
        title = title.split(' | ')[0].trim();
    }
    return title || null;
}

function stripHtmlTags(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getFriendlyStatusMessage(status) {
    switch (status) {
        case 502:
        case 503:
            return 'Сервер тимчасово недоступний. Будь ласка, перевірте, чи запущено сервер, або спробуйте пізніше.';
        case 504:
            return 'Час очікування відповіді сервера вичерпано. Спробуйте пізніше.';
        case 500:
            return 'Внутрішня помилка сервера. Спробуйте пізніше.';
        case 404:
            return 'Запитуваний ресурс не знайдено на сервері.';
        case 401:
            return 'Необхідно авторизуватися для виконання цієї дії.';
        case 403:
            return 'У вас недостатньо прав для виконання цієї дії.';
        default:
            return `Помилка сервера (HTTP ${status})`;
    }
}

async function handleErrorResponse(response) {
    let message = '';
    try {
        const payload = await response.clone().json();
        if (payload && typeof payload === 'object') {
            if (Array.isArray(payload.detail)) {
                message = payload.detail.map(e => {
                    const loc = e.loc ? e.loc.filter(l => l !== 'body' && l !== 'query').join('.') : '';
                    const fieldPrefix = loc ? `Поле "${loc}": ` : '';
                    let msg = e.msg || JSON.stringify(e);
                    if (msg === 'field required') msg = 'обов\'язкове для заповнення';
                    else if (msg.includes('value is not a valid integer')) msg = 'має бути цілим числом';
                    return `${fieldPrefix}${msg}`;
                }).join('; ');
            } else {
                message = payload.detail || payload.error || '';
            }
        }
    } catch {
        try {
            const rawText = await response.text();
            if (rawText) {
                const isHtml = rawText.trim().startsWith('<') || rawText.includes('<html') || rawText.includes('<!DOCTYPE');
                if (isHtml) {
                    const extractedTitle = extractTitleFromHtml(rawText);
                    if (extractedTitle && (extractedTitle.toLowerCase().includes('недоступний') || extractedTitle.toLowerCase().includes('помилка') || extractedTitle.toLowerCase().includes('error'))) {
                        message = extractedTitle;
                    } else {
                        message = getFriendlyStatusMessage(response.status);
                    }
                } else {
                    message = stripHtmlTags(rawText);
                }
            }
        } catch {}
    }

    if (!message || message.trim() === '') {
        message = getFriendlyStatusMessage(response.status);
    }

    if (message === 'Invalid content type') {
        message = 'Некоректний тип контенту для завантаження зображення';
    } else if (message === 'Unsupported file format') {
        message = 'Непідтримуваний формат файлу. Дозволено тільки .webp';
    } else if (message === 'Method Not Allowed') {
        message = 'Метод не дозволений сервером';
    } else if (message === 'Internal Server Error') {
        message = 'Внутрішня помилка сервера';
    } else if (message === 'Not logged in' || message === 'Unauthorized') {
        message = 'Необхідно авторизуватися';
    } else if (message === 'User not found') {
        message = 'Користувача не знайдено';
    } else if (message === 'Forbidden') {
        message = 'Недостатньо прав для виконання цієї дії';
    }

    message = stripHtmlTags(message) || getFriendlyStatusMessage(response.status);
    throw new Error(message);
}

function handleNetworkError(err) {
    if (err && (
        err.name === 'TypeError' ||
        (err.message && (
            err.message.includes('fetch') ||
            err.message.includes('NetworkError') ||
            err.message.includes('Failed to fetch') ||
            err.message.includes('Network request failed') ||
            err.message.includes('Load failed')
        ))
    )) {
        throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу або статус сервера.');
    }
    throw err;
}

export const API = {
    baseUrl: '/api',

    async get(endpoint, params = {}) {
        const url = new URL(this.baseUrl + endpoint, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        try {
            const response = await fetch(url);
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    },

    async post(endpoint, body = {}) {
        try {
            const response = await fetch(this.baseUrl + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    },

    async put(endpoint, body = {}) {
        try {
            const response = await fetch(this.baseUrl + endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    },

    async patch(endpoint, body = {}) {
        try {
            const response = await fetch(this.baseUrl + endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    },

    async delete(endpoint) {
        try {
            const response = await fetch(this.baseUrl + endpoint, {
                method: 'DELETE'
            });
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    },

    async upload(endpoint, formData) {
        try {
            const response = await fetch(this.baseUrl + endpoint, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                await handleErrorResponse(response);
            }
            return await response.json();
        } catch (err) {
            handleNetworkError(err);
        }
    }
};
