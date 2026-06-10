import { API } from '../helpers/api.js';

export async function renderSettings(main, user) {
  const avatarUrl = `/api/auth/avatar/${user.username}?t=${new Date().getTime()}`;
  
  main.innerHTML = `
    <div class="container settings-page">
      <h1>Налаштування профілю</h1>
      <div class="settings-section">
        <h3>Зображення профілю</h3>
        <div class="avatar-upload">
          <div id="avatar-container">
            <img src="${avatarUrl}" alt="Avatar" class="avatar-preview" id="avatar-preview" onerror="this.outerHTML='<div class=&quot;avatar-preview avatar-fallback&quot;><svg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><path d=&quot;M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2&quot;/><circle cx=&quot;12&quot; cy=&quot;7&quot; r=&quot;4&quot;/></svg></div>'">
          </div>
          <div>
            <input type="file" id="file-input" class="file-input" accept="image/jpeg,image/webp">
            <button class="upload-btn" onclick="document.getElementById('file-input').click()">Вибрати файл</button>
            <p><small>Підтримуються формати: JPG, WebP</small></p>
          </div>
        </div>
      </div>
    </div>
  `;
  // ... rest of the file

  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Помилка завантаження');

      const data = await response.json();
      document.getElementById('avatar-preview').src = data.url + '?t=' + new Date().getTime();
      alert('Зображення оновлено');
    } catch (err) {
      alert(err.message);
    }
  });
}
