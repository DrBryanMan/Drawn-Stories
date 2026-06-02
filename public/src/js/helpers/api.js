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
    }
};
