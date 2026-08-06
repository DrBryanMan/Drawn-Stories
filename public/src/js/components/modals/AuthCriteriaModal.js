import { icon } from '../../helpers/icons.js';

export function openAuthCriteriaModal() {
    const existing = document.getElementById('auth-criteria-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'auth-criteria-modal';
    modal.className = 'ds-modal-overlay';
    modal.innerHTML = `
        <div class="ds-modal auth-criteria-modal-content" style="max-width: 520px; margin: auto;">
            <div class="ds-modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-s);">
                <div class="modal-title-with-icon" style="display: flex; align-items: center; gap: 8px;">
                    ${icon('info', 20)}
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text);">Критерії заповнення полів</h3>
                </div>
                <button class="ds-modal-close-btn" id="close-criteria-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
            </div>
            <div class="ds-modal-body auth-criteria-body" style="padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto;">
                <div class="criteria-card">
                    <div class="criteria-card-header">
                        ${icon('user', 18)}
                        <h4>Логін (Username)</h4>
                    </div>
                    <ul class="criteria-list">
                        <li><strong>Довжина:</strong> від 1 до 20 символів.</li>
                        <li><strong>Символи:</strong> літери (латиниця та кирилиця), цифри та нижнє підкреслення <code>_</code>.</li>
                        <li><strong>Заборонено:</strong> крапки, пробіли та інші спецсимволи.</li>
                        <li><strong>Унікальність:</strong> повинен бути унікальним.</li>
                        <li><em>Примітка: Логін є приватним і не відображається іншим користувачам.</em></li>
                    </ul>
                </div>

                <div class="criteria-card">
                    <div class="criteria-card-header">
                        ${icon('smile', 18)}
                        <h4>Нікнейм (Nickname)</h4>
                    </div>
                    <ul class="criteria-list">
                        <li><strong>Довжина:</strong> від 1 до 20 символів.</li>
                        <li><strong>Символи:</strong> літери, цифри та нижнє підкреслення <code>_</code> (без крапок та пробілів).</li>
                        <li><strong>Унікальність:</strong> повинен бути унікальним.</li>
                        <li><strong>За замовчуванням:</strong> якщо ви не вкажете нікнейм при реєстрації, ним стане ваш логін.</li>
                        <li><em>Примітка: Нікнейм є вашим публічним ім'ям на сайті та у посиланнях.</em></li>
                    </ul>
                </div>

                <div class="criteria-card">
                    <div class="criteria-card-header">
                        ${icon('lock', 18)}
                        <h4>Пароль (Password)</h4>
                    </div>
                    <ul class="criteria-list">
                        <li><strong>При реєстрації:</strong> не менше 6 символів.</li>
                        <li><strong>При вході:</strong> не обмежений за довжиною.</li>
                        <li><strong>Символи:</strong> дозволені будь-які символи.</li>
                    </ul>
                </div>
            </div>
            <div class="ds-modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-s); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="confirm-criteria-modal" style="padding: 8px 18px; background: var(--accent); color: white; border: none; border-radius: var(--r); cursor: pointer; font-weight: 500;">Зрозуміло</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const closeModal = () => {
        modal.remove();
        document.body.classList.remove('modal-open');
    };

    modal.querySelector('#close-criteria-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#confirm-criteria-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}
