async function handleErrorResponse(response) {
    let message = response.statusText || `HTTP ${response.status}`;
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
                message = payload.detail || payload.error || message;
            }
        }
    } catch {
        try {
            message = await response.text() || message;
        } catch {}
    }

    if (message === 'Invalid content type') {
        message = 'Некоректний тип контенту для завантаження зображення';
    } else if (message === 'Unsupported file format') {
        message = 'Непідтримуваний формат файлу. Дозволено тільки .webp';
    } else if (message === 'Method Not Allowed') {
        message = 'Метод не дозволений сервером';
    } else if (message === 'Internal Server Error') {
        message = 'Внутрішня помилка сервера';
    }

    throw new Error(message);
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
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
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error('Не вдалося з\'єднатися з сервером. Перевірте мережу.');
            }
            throw err;
        }
    }
};
