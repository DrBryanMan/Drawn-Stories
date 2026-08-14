import { API } from '../../helpers/api.js';
import { normalizeImageUrl, escapeHtmlAttribute } from '../../helpers/image.js';
import { icon } from '../../helpers/icons.js';

export function openMergePersonsModal(primaryPerson, donorPerson, onMerged) {
  const modalId = 'merge-persons-modal-overlay';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ds-modal-overlay';

  let selectedImageChoice = 'primary'; // 'primary' | 'secondary'
  const hasP1Img = Boolean(primaryPerson.image);
  const hasP2Img = Boolean(donorPerson.image);

  if (!hasP1Img && hasP2Img) {
    selectedImageChoice = 'secondary';
  }

  function renderFieldDiffRow(label, v1, v2) {
    const val1 = v1 ? String(v1).trim() : '';
    const val2 = v2 ? String(v2).trim() : '';

    if (!val1 && !val2) return '';

    let willFill = false;
    let resultVal = val1;
    if (!val1 && val2) {
      willFill = true;
      resultVal = val2;
    }

    return `
      <div class="merge-diff-row">
        <div class="merge-diff-label">${escapeHtmlAttribute(label)}</div>
        <div class="merge-diff-val ${val1 ? '' : 'is-empty'}">
          ${val1 ? escapeHtmlAttribute(val1) : '<span class="merge-empty-tag">Порожньо</span>'}
        </div>
        <div class="merge-diff-val ${val2 ? '' : 'is-empty'}">
          ${val2 ? escapeHtmlAttribute(val2) : '<span class="merge-empty-tag">Порожньо</span>'}
        </div>
        <div class="merge-diff-result ${willFill ? 'is-added' : ''}">
          ${willFill ? `<span class="merge-add-badge">${icon('plus', 11)} Буде додано:</span>` : ''}
          ${escapeHtmlAttribute(resultVal)}
        </div>
      </div>
    `;
  }

  function renderPhotoSelector() {
    if (!hasP1Img && !hasP2Img) {
      return '';
    }

    if (hasP1Img && !hasP2Img) {
      return `
        <div class="merge-photo-section">
          <div class="merge-section-title">Світлина персони</div>
          <div class="merge-photo-notice">Буде збережено світлину основної персони (#${primaryPerson.id}).</div>
        </div>
      `;
    }

    if (!hasP1Img && hasP2Img) {
      return `
        <div class="merge-photo-section">
          <div class="merge-section-title">Світлина персони</div>
          <div class="merge-photo-notice is-donor">Світлину буде автоматично перенесено з персони-донора (#${donorPerson.id}).</div>
        </div>
      `;
    }

    // Both have images -> selectable UI
    const img1Url = normalizeImageUrl(primaryPerson.image);
    const img2Url = normalizeImageUrl(donorPerson.image);

    return `
      <div class="merge-photo-section">
        <div class="merge-section-title">Оберіть світлину для збереження</div>
        <div class="merge-photo-grid">
          <div class="merge-photo-card ${selectedImageChoice === 'primary' ? 'is-selected' : ''}" data-choice="primary">
            <div class="merge-photo-thumb">
              <img src="${escapeHtmlAttribute(img1Url)}" alt="Фото #${primaryPerson.id}">
            </div>
            <div class="merge-photo-meta">
              <span class="merge-photo-tag">Основна (#${primaryPerson.id})</span>
              <span class="merge-photo-check">${icon('check', 14)}</span>
            </div>
          </div>

          <div class="merge-photo-card ${selectedImageChoice === 'secondary' ? 'is-selected' : ''}" data-choice="secondary">
            <div class="merge-photo-thumb">
              <img src="${escapeHtmlAttribute(img2Url)}" alt="Фото #${donorPerson.id}">
            </div>
            <div class="merge-photo-meta">
              <span class="merge-photo-tag">Донор (#${donorPerson.id})</span>
              <span class="merge-photo-check">${icon('check', 14)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="ds-modal ds-modal--large merge-persons-modal" id="merge-persons-modal-content">
      <div class="ds-modal-header">
        <div class="ds-modal-title">
          ${icon('copy', 18)}
          Злиття персон: #${primaryPerson.id} &larr; #${donorPerson.id}
        </div>
        <button class="ds-modal-close btn-close-merge-modal" type="button">&times;</button>
      </div>

      <div class="ds-modal-body merge-modal-body">
        <!-- Target summary bar -->
        <div class="merge-summary-cards">
          <div class="merge-person-summary is-primary">
            <div class="merge-role-badge primary">${icon('check', 12)} Основна (залишиться)</div>
            <div class="merge-person-title">#${primaryPerson.id} &mdash; ${escapeHtmlAttribute(primaryPerson.name)}</div>
            <div class="merge-person-sub">${escapeHtmlAttribute(primaryPerson.name_uk || 'Немає укр. назви')}</div>
            <div class="merge-person-stats">${primaryPerson.volumes_count || 0} томів &bull; ${primaryPerson.issues_count || 0} випусків</div>
          </div>

          <div class="merge-arrow-wrap">
            <span class="merge-arrow-icon">&larr;</span>
          </div>

          <div class="merge-person-summary is-donor">
            <div class="merge-role-badge donor">${icon('trash', 12)} Донор (буде видалена)</div>
            <div class="merge-person-title">#${donorPerson.id} &mdash; ${escapeHtmlAttribute(donorPerson.name)}</div>
            <div class="merge-person-sub">${escapeHtmlAttribute(donorPerson.name_uk || 'Немає укр. назви')}</div>
            <div class="merge-person-stats">${donorPerson.volumes_count || 0} томів &bull; ${donorPerson.issues_count || 0} випусків</div>
          </div>
        </div>

        <!-- Photo selector -->
        <div id="merge-photo-selector-container">
          ${renderPhotoSelector()}
        </div>

        <!-- Data Diff Table -->
        <div class="merge-diff-container">
          <div class="merge-diff-header">
            <div class="merge-diff-col-label">Поле</div>
            <div class="merge-diff-col-val">Основна (#${primaryPerson.id})</div>
            <div class="merge-diff-col-val">Донор (#${donorPerson.id})</div>
            <div class="merge-diff-col-res">Результат після злиття</div>
          </div>
          <div class="merge-diff-rows">
            ${renderFieldDiffRow('Укр. назва', primaryPerson.name_uk, donorPerson.name_uk)}
            ${renderFieldDiffRow('Псевдонім', primaryPerson.pseudo, donorPerson.pseudo)}
            ${renderFieldDiffRow('Рідне ім’я', primaryPerson.name_native, donorPerson.name_native)}
            ${renderFieldDiffRow('Країна', primaryPerson.country, donorPerson.country)}
            ${renderFieldDiffRow('Місто', primaryPerson.hometown, donorPerson.hometown)}
            ${renderFieldDiffRow('Дата народження', primaryPerson.birth, donorPerson.birth)}
            ${renderFieldDiffRow('Дата смерті', primaryPerson.death, donorPerson.death)}
            ${renderFieldDiffRow('Професія', primaryPerson.occupation, donorPerson.occupation)}
            ${renderFieldDiffRow('Сайт', primaryPerson.website, donorPerson.website)}
            ${renderFieldDiffRow('ComicVine ID', primaryPerson.cv_id, donorPerson.cv_id)}
            ${renderFieldDiffRow('Hikka Slug', primaryPerson.hikka_slug, donorPerson.hikka_slug)}
            
            <div class="merge-diff-row is-relations-row">
              <div class="merge-diff-label">Появи у томах</div>
              <div class="merge-diff-val">${primaryPerson.volumes_count || 0} томів</div>
              <div class="merge-diff-val">${donorPerson.volumes_count || 0} томів</div>
              <div class="merge-diff-result is-added">
                <span class="merge-add-badge">${icon('plus', 11)} Всі появи будуть перенесені</span>
              </div>
            </div>

            <div class="merge-diff-row is-relations-row">
              <div class="merge-diff-label">Появи у випусках</div>
              <div class="merge-diff-val">${primaryPerson.issues_count || 0} випусків</div>
              <div class="merge-diff-val">${donorPerson.issues_count || 0} випусків</div>
              <div class="merge-diff-result is-added">
                <span class="merge-add-badge">${icon('plus', 11)} Всі випуски будуть перенесені</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Warning block -->
        <div class="merge-warning-box">
          ${icon('warning', 20)}
          <div class="merge-warning-text">
            <strong>Увага:</strong> Запис персони <strong>#${donorPerson.id}</strong> буде остаточно видалено з бази даних.
            Усі ролі в томах та випусках перейдуть до <strong>#${primaryPerson.id}</strong> без дублювання.
          </div>
        </div>

        <div id="merge-modal-error" class="merge-modal-error-msg" style="display: none;"></div>
      </div>

      <div class="ds-modal-footer merge-modal-footer">
        <button type="button" class="merge-modal-btn merge-modal-btn--cancel btn-close-merge-modal">
          Скасувати
        </button>
        <button type="button" class="merge-modal-btn merge-modal-btn--confirm" id="btn-confirm-merge">
          ${icon('copy', 14)}
          <span>Підтвердити злиття</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelectorAll('.btn-close-merge-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Photo selection click
  modal.querySelectorAll('.merge-photo-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedImageChoice = card.dataset.choice;
      modal.querySelectorAll('.merge-photo-card').forEach(c => {
        c.classList.toggle('is-selected', c.dataset.choice === selectedImageChoice);
      });
    });
  });

  // Confirm merge
  const confirmBtn = modal.querySelector('#btn-confirm-merge');
  const errorEl = modal.querySelector('#merge-modal-error');

  confirmBtn?.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `${icon('loader', 14)} Злиття...`;
    if (errorEl) errorEl.style.display = 'none';

    try {
      const res = await API.post('/wanted/person-duplicates/merge', {
        primary_id: primaryPerson.id,
        secondary_id: donorPerson.id,
        image_choice: selectedImageChoice,
      });

      closeModal();
      if (onMerged) onMerged(res);
    } catch (err) {
      console.error('Merge error:', err);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${icon('copy', 14)} Підтвердити злиття`;
      if (errorEl) {
        errorEl.textContent = err.message || 'Сталася помилка при злитті персон';
        errorEl.style.display = 'block';
      }
    }
  });
}
