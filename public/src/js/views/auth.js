import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { currentUser } from '../shell.js';

export async function renderAuth(container) {
    const params = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const returnUrl = params.get('returnUrl');

    if (currentUser) {
        router.navigate(returnUrl || '/');
        return;
    }
    let mode = 'login'; // 'login' or 'register'

    function render() {
        container.innerHTML = `
            <div class="auth-view">
                <div class="auth-card">
                    <div class="auth-header">
                        <h2>${mode === 'login' ? 'Вхід' : 'Реєстрація'}</h2>
                        <p>${mode === 'login' ? 'Увійдіть у свій акаунт' : 'Створіть новий акаунт'}</p>
                    </div>
                    <form id="auth-form" class="auth-form">
                        <div class="form-group">
                            <label for="username">Ім'я користувача</label>
                            <div class="input-wrapper">
                                ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
                                <input type="text" id="username" name="username" required placeholder="Ваш нікнейм">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="password">Пароль</label>
                            <div class="input-wrapper">
                                ${icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}
                                <input type="password" id="password" name="password" required placeholder="••••••••">
                            </div>
                        </div>
                        <div id="auth-error" class="auth-error hidden"></div>
                        <button type="submit" class="auth-btn">
                            ${mode === 'login' ? 'Увійти' : 'Зареєструватися'}
                        </button>
                    </form>
                    <div class="auth-footer">
                        ${mode === 'login' 
                            ? `Немає акаунту? <a href="#" id="toggle-mode">Зареєструватися</a>` 
                            : `Вже є акаунт? <a href="#" id="toggle-mode">Увійти</a>`}
                    </div>
                </div>
            </div>
        `;

        const form = container.querySelector('#auth-form');
        const errorEl = container.querySelector('#auth-error');
        const toggleBtn = container.querySelector('#toggle-mode');

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mode = mode === 'login' ? 'register' : 'login';
            render();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            errorEl.classList.add('hidden');
            errorEl.textContent = '';

            try {
                const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
                const res = await API.post(endpoint, data);
                
                if (mode === 'register') {
                    mode = 'login';
                    render();
                    const msg = document.createElement('div');
                    msg.className = 'auth-success';
                    msg.textContent = 'Реєстрація успішна! Тепер ви можете увійти.';
                    container.querySelector('.auth-header').appendChild(msg);
                } else {
                    // Login successful
                    window.dispatchEvent(new CustomEvent('auth-changed', { detail: res }));
                    
                    if (returnUrl) {
                        const target = returnUrl.startsWith('#') ? returnUrl.substring(1) : returnUrl;
                        router.navigate(target);
                    } else {
                        router.navigate('/');
                    }
                }
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });
    }

    render();
}

function icon(d, size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}
