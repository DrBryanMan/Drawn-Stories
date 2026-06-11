import { API } from '../helpers/api.js';

export async function renderSettings(main, user) {
  const avatarUrl = `/api/auth/avatar/${user.username}?t=${new Date().getTime()}`;

  const icon = (d, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  function getPreviewHtml(url) {
      const iconSvg = `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      return `
        <img src="${url}" alt="Avatar" class="avatar-preview" id="avatar-preview" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="avatar-fallback" style="display:none;">${iconSvg}</div>
      `;
  }

  main.innerHTML = `
    <div class="container settings-page">
      <div class="settings-header">
        <h1>Налаштування</h1>
      </div>

      <div class="settings-grid">
        <div class="block">
          <h3>${icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="m19 19-3.5-3.5"/>')} Фото профілю</h3>
          <div class="avatar-upload-wrapper">
            <div id="avatar-container">
              ${getPreviewHtml(avatarUrl)}
            </div>
            <div class="upload-controls">
              <input type="file" id="file-input" class="file-input" accept="image/jpeg,image/webp">
              <button class="upload-btn" id="select-file-btn">
                ${icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
                Змінити фото
              </button>
              <div class="upload-hint">
                Дозволені формати: JPG, WebP.<br>
                Рекомендований розмір: 400x400px.
              </div>
            </div>
          </div>
        </div>

        <div class="block">
          <h3>${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')} Інформація профілю</h3>
          <form id="profile-info-form" class="info-grid">
            <div class="info-item">
              <span class="info-label">Ім'я користувача</span>
              <div class="input-with-button">
                <input type="text" id="username-input" class="settings-input" value="${user.username}" required>
                <button type="submit" class="save-btn" id="save-username-btn">Зберегти</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('file-input');
  const selectBtn = document.getElementById('select-file-btn');
  const profileForm = document.getElementById('profile-info-form');
  const usernameInput = document.getElementById('username-input');
  const saveUsernameBtn = document.getElementById('save-username-btn');

  // Username update
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = usernameInput.value.trim();
    if (!newUsername || newUsername === user.username) return;

    saveUsernameBtn.disabled = true;
    saveUsernameBtn.textContent = 'Збереження...';

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_username: newUsername })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Помилка оновлення');

      // Update local user object
      user.username = data.username;
      
      // Notify shell and update UI
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: user }));
      
      alert('Ім\'я користувача успішно змінено!');
    } catch (err) {
      alert(err.message);
      usernameInput.value = user.username; // Revert
    } finally {
      saveUsernameBtn.disabled = false;
      saveUsernameBtn.textContent = 'Зберегти';
    }
  });

  selectBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading state
    selectBtn.disabled = true;
    selectBtn.innerHTML = `${icon('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>')} Завантаження...`;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Помилка завантаження');

      const data = await response.json();
      const container = document.getElementById('avatar-container');
      container.innerHTML = getPreviewHtml(data.url + '&t=' + new Date().getTime());

      // Update header avatar
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: user }));

      alert('Зображення успішно оновлено!');
    } catch (err) {
      alert(err.message);
    } finally {
      selectBtn.disabled = false;
      selectBtn.innerHTML = `
        ${icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
        Змінити фото
      `;
      fileInput.value = ''; // Reset input
    }
  });
}

