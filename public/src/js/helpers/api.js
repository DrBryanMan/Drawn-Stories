export const API = {
    baseUrl: '/api',

    async get(endpoint, params = {}) {
        const url = new URL(this.baseUrl + endpoint, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url);
        if (!response.ok) {
            let message = response.statusText || `HTTP ${response.status}`;
            try {
                const payload = await response.clone().json();
                message = payload.detail || payload.error || message;
            } catch {
                message = await response.text() || message;
            }
            throw new Error(message);
        }
        return await response.json();
    },

    async post(endpoint, body = {}) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            let message = response.statusText || `HTTP ${response.status}`;
            try {
                const payload = await response.clone().json();
                message = payload.detail || payload.error || message;
            } catch {
                message = await response.text() || message;
            }
            throw new Error(message);
        }
        return await response.json();
    },

    async put(endpoint, body = {}) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            let message = response.statusText || `HTTP ${response.status}`;
            try {
                const payload = await response.clone().json();
                message = payload.detail || payload.error || message;
            } catch {
                message = await response.text() || message;
            }
            throw new Error(message);
        }
        return await response.json();
    },

    async delete(endpoint) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'DELETE'
        });
        if (!response.ok) {
            let message = response.statusText || `HTTP ${response.status}`;
            try {
                const payload = await response.clone().json();
                message = payload.detail || payload.error || message;
            } catch {
                message = await response.text() || message;
            }
            throw new Error(message);
        }
        return await response.json();
    },

    async upload(endpoint, formData) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            let message = response.statusText || `HTTP ${response.status}`;
            try {
                const payload = await response.clone().json();
                message = payload.detail || payload.error || message;
            } catch {
                message = await response.text() || message;
            }
            throw new Error(message);
        }
        return await response.json();
    }
};
