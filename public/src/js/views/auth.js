import { API } from '../helpers/api.js';
import { router } from '../helpers/router.js';
import { currentUser } from '../shell.js';
import { t } from '../helpers/i18n.js';
import { icon } from '../helpers/icons.js';
import { openAuthCriteriaModal } from '../components/modals/AuthCriteriaModal.js';

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
                        ${mode === 'register' ? `
                        <div style="margin-top: 10px;">
                            <button type="button" class="hint-info-btn open-criteria-btn" title="Критерії заповнення полів">
                                ${icon('info', 15)} Критерії заповнення полів
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    <form id="auth-form" class="auth-form">
                        <div class="form-group">
                            <label for="login">${t('username')} *</label>
                            <div class="input-wrapper">
                                ${icon('user', 16)}
                                <input type="text" id="login" name="login" required maxlength="20" pattern="^[a-zA-Z0-9а-яА-ЯёЁіІїЇєЄґҐ_]+$" title="Дозволено лише літери, цифри та нижнє підкреслення (від 1 до 20 симв.)" placeholder="${t('auth_username_placeholder')}">
                            </div>
                        </div>
                        ${mode === 'register' ? `
                        <div class="form-group">
                            <label for="nickname">${t('nickname')}</label>
                            <div class="input-wrapper">
                                ${icon('smile', 16)}
                                <input type="text" id="nickname" name="nickname" maxlength="20" pattern="^[a-zA-Z0-9а-яА-ЯёЁіІїЇєЄґҐ_]+$" title="Дозволено лише літери, цифри та нижнє підкреслення (від 1 до 20 симв.)" class="nickname-highlight" placeholder="${t('auth_nickname_placeholder')}">
                            </div>
                            <div class="nickname-hint-text">Якщо ви не вкажете нікнейм, в якості нього буде використано логін.</div>
                        </div>
                        ` : ''}
                        <div class="form-group">
                            <label for="password">${t('auth_password')} *</label>
                            <div class="input-wrapper">
                                ${icon('lock', 16)}
                                <input type="password" id="password" name="password" required ${mode === 'register' ? 'minlength="6"' : ''} class="has-toggle" placeholder="••••••••">
                                <button type="button" id="toggle-password-btn" class="password-toggle-btn" title="Показати/приховати пароль">
                                    ${icon('eye', 18)}
                                </button>
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
        const togglePasswordBtn = container.querySelector('#toggle-password-btn');
        const passwordInput = container.querySelector('#password');
        const nicknameInput = container.querySelector('#nickname');
        const openCriteriaBtns = container.querySelectorAll('.open-criteria-btn');

        let isPasswordVisible = false;

        togglePasswordBtn?.addEventListener('click', () => {
            isPasswordVisible = !isPasswordVisible;
            passwordInput.type = isPasswordVisible ? 'text' : 'password';
            togglePasswordBtn.innerHTML = icon(isPasswordVisible ? 'eyeOff' : 'eye', 18);
        });

        nicknameInput?.addEventListener('input', () => {
            if (nicknameInput.value.trim().length > 0) {
                nicknameInput.classList.remove('nickname-highlight');
            } else {
                nicknameInput.classList.add('nickname-highlight');
            }
        });

        openCriteriaBtns.forEach(btn => {
            btn.addEventListener('click', () => openAuthCriteriaModal());
        });

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
