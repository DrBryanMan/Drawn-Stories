import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { currentUser } from '../shell.js';
import { t } from '../helpers/i18n.js';

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
                        <h2>${mode === 'login' ? t('auth_login') : t('auth_register')}</h2>
                        <p>${mode === 'login' ? t('auth_login_sub') : t('auth_register_sub')}</p>
                    </div>
                    <form id="auth-form" class="auth-form">
                        <div class="form-group">
                            <label for="username">${t('username')}</label>
                            <div class="input-wrapper">
                                ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
                                <input type="text" id="username" name="username" required maxlength="10" pattern="^[a-zA-Z0-9а-яА-ЯёЁіІїЇєЄґҐ\\.]+$" title="Дозволено лише літери, цифри та крапку (макс. 10 симв.)" placeholder="${t('auth_username_placeholder')}">
                            </div>
                        </div>
                        ${mode === 'register' ? `
                        <div class="form-group">
                            <label for="nickname">${t('nickname')}</label>
                            <div class="input-wrapper">
                                ${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
                                <input type="text" id="nickname" name="nickname" required maxlength="10" pattern="^[a-zA-Z0-9а-яА-ЯёЁіІїЇєЄґҐ\\.]+$" title="Дозволено лише літери, цифри та крапку (макс. 10 симв.)" placeholder="${t('auth_nickname_placeholder')}">
                            </div>
                        </div>
                        ` : ''}
                        <div class="form-group">
                            <label for="password">${t('auth_password')}</label>
                            <div class="input-wrapper">
                                ${icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}
                                <input type="password" id="password" name="password" required placeholder="••••••••">
                            </div>
                        </div>
                        <div id="auth-error" class="auth-error hidden"></div>
                        <button type="submit" class="auth-btn">
                            ${mode === 'login' ? t('auth_login') : t('auth_register')}
                        </button>
                    </form>
                    <div class="auth-footer">
                        ${mode === 'login' 
                            ? `${t('auth_no_account')} <a href="#" id="toggle-mode">${t('auth_register')}</a>` 
                            : `${t('auth_has_account')} <a href="#" id="toggle-mode">${t('auth_login')}</a>`}
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
                    msg.textContent = t('auth_success_reg');
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
