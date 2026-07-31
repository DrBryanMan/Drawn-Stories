import { API } from '/static/js/helpers/api.js';
import { escapeHtmlAttribute } from '/static/js/helpers/image.js';
import { icon } from '/static/js/helpers/icons.js';

export class MagazineChapterEditor {
    constructor(issueId, chapterInfo, onSuccess) {
        this.issueId = issueId;
        this.chapterInfo = chapterInfo; // { chapter_id, order_num, label, ... }
        this.chapterId = chapterInfo.chapter_id;
        this.onSuccess = onSuccess;
        
        this.modal = null;
        this.fullChapterData = null;
    }

    async render() {
        // Load full details of the chapter from API
        try {
            const res = await API.get(`/manga-chapters/${this.chapterId}`);
            this.fullChapterData = res.chapter;
        } catch (err) {
            alert('Помилка завантаження даних розділу: ' + err.message);
            return;
        }

        const labels = this.chapterInfo.label ? this.chapterInfo.label.split(',') : [];

        const modalHtml = `
            <style>
                .chapter-edit-label-chip {
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    cursor: pointer;
                    border: 1px solid var(--border-s);
                    background: var(--bg-card);
                    color: var(--text-muted);
                    transition: all 0.15s ease;
                    user-select: none;
                    text-align: center;
                }
                .chapter-edit-label-chip:hover {
                    border-color: var(--border);
                    color: var(--text);
                }
                .chapter-edit-label-chip[data-label="lead"].is-active {
                    background: #fef3c7 !important;
                    color: #d97706 !important;
                    border-color: #f59e0b !important;
                }
                .chapter-edit-label-chip[data-label="color"].is-active {
                    background: #fce7f3 !important;
                    color: #db2777 !important;
                    border-color: #ec4899 !important;
                }
                .chapter-edit-label-chip[data-label="debut"].is-active {
                    background: #dcfce7 !important;
                    color: #15803d !important;
                    border-color: #22c55e !important;
                }
                .chapter-edit-label-chip[data-label="final"].is-active {
                    background: #fee2e2 !important;
                    color: #b91c1c !important;
                    border-color: #ef4444 !important;
                }
                .chapter-edit-label-chip[data-label="digital"].is-active {
                    background: #e0f2fe !important;
                    color: #0369a1 !important;
                    border-color: #0284c7 !important;
                }
            </style>
            <div class="ds-modal-overlay" id="chapter-editor-overlay">
                <div class="ds-modal ds-modal--large" id="chapter-editor-modal">
                    <div class="ds-modal-header">
                        <div class="ds-modal-title" id="chapter-editor-title">${icon('edit', 14)} Редагувати розділ</div>
                        <button class="ds-modal-close" id="chapter-editor-close">${icon('x', 16)}</button>
                    </div>
                    <div class="ds-modal-body">
                        
                        <div style="font-weight: bold; font-size: 14px; color: var(--primary); border-bottom: 1px solid var(--border-s); padding-bottom: 6px; margin-bottom: 4px;">
                            Налаштування зв'язку з випуском журналу
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Порядковий номер</label>
                                <input type="number" id="edit-link-order" value="${this.chapterInfo.order_num || ''}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                            </div>
                        </div>

                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Лейбли розділу</label>
                            <div id="edit-label-chips-container" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                                <div class="chapter-edit-label-chip ${labels.includes('lead') ? 'is-active' : ''}" data-label="lead">Lead</div>
                                <div class="chapter-edit-label-chip ${labels.includes('color') ? 'is-active' : ''}" data-label="color">Color</div>
                                <div class="chapter-edit-label-chip ${labels.includes('debut') ? 'is-active' : ''}" data-label="debut">Debut</div>
                                <div class="chapter-edit-label-chip ${labels.includes('final') ? 'is-active' : ''}" data-label="final">Final</div>
                                <div class="chapter-edit-label-chip ${labels.includes('digital') ? 'is-active' : ''}" data-label="digital">Digital Exclusive</div>
                            </div>
                        </div>

                        <div style="font-weight: bold; font-size: 14px; color: var(--primary); border-bottom: 1px solid var(--border-s); padding-bottom: 6px; margin-top: 12px; margin-bottom: 4px;">
                            Параметри самого розділу
                        </div>

                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Номер розділу *</label>
                                <input type="text" id="edit-chapter-number" value="${escapeHtmlAttribute(this.fullChapterData.chapter_number || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);" required>
                            </div>
                            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Кількість сторінок</label>
                                <input type="number" id="edit-chapter-pages" value="${this.fullChapterData.pages || ''}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                            </div>
                        </div>

                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Назва оригінальна (name)</label>
                            <input type="text" id="edit-chapter-name" value="${escapeHtmlAttribute(this.fullChapterData.name || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                        </div>

                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Назва англійська (name_en)</label>
                            <input type="text" id="edit-chapter-name-en" value="${escapeHtmlAttribute(this.fullChapterData.name_en || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                        </div>

                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Назва нативна / японська (name_native)</label>
                            <input type="text" id="edit-chapter-name-native" value="${escapeHtmlAttribute(this.fullChapterData.name_native || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                        </div>

                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 13px; font-weight: 600; color: var(--text-main);">Назва українська (name_uk)</label>
                            <input type="text" id="edit-chapter-name-uk" value="${escapeHtmlAttribute(this.fullChapterData.name_uk || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-input); color: var(--text);">
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 16px;">
                            <button id="cancel-edit-chapter" class="btn-admin btn-admin--secondary" style="flex: 1; justify-content: center; height: 42px; margin-bottom: 0;">Скасувати</button>
                            <button id="submit-edit-chapter" class="btn-admin btn-admin--primary" style="flex: 1; justify-content: center; height: 42px; margin-bottom: 0;">Зберегти зміни</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('chapter-editor-overlay');

        // Bind label chips toggle
        this.modal.querySelectorAll('.chapter-edit-label-chip').forEach(chip => {
            chip.onclick = () => {
                chip.classList.toggle('is-active');
            };
        });

        // Bind close events
        this.modal.querySelector('#chapter-editor-close').onclick = () => this.close();
        this.modal.querySelector('#cancel-edit-chapter').onclick = () => this.close();
        this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };

        this._keydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'Enter') {
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                this.submitSave();
            }
        };
        document.addEventListener('keydown', this._keydownHandler);

        // Bind submit
        this.modal.querySelector('#submit-edit-chapter').onclick = () => this.submitSave();
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        document.removeEventListener('keydown', this._keydownHandler);
    }

    async submitSave() {
        const orderNumVal = this.modal.querySelector('#edit-link-order').value.trim();
        const labelChips = this.modal.querySelectorAll('#edit-label-chips-container .chapter-edit-label-chip.is-active');
        
        const chNumber = this.modal.querySelector('#edit-chapter-number').value.trim();
        const chPages = this.modal.querySelector('#edit-chapter-pages').value.trim();
        const chName = this.modal.querySelector('#edit-chapter-name').value.trim();
        const chNameEn = this.modal.querySelector('#edit-chapter-name-en').value.trim();
        const chNameNative = this.modal.querySelector('#edit-chapter-name-native').value.trim();
        const chNameUk = this.modal.querySelector('#edit-chapter-name-uk').value.trim();

        if (!chNumber) {
            alert('Будь ласка, вкажіть номер розділу');
            return;
        }

        const label = labelChips.length > 0 
            ? Array.from(labelChips).map(c => c.getAttribute('data-label')).join(',') 
            : null;

        const orderNum = orderNumVal ? Number(orderNumVal) : null;

        const submitBtn = this.modal.querySelector('#submit-edit-chapter');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Збереження...';

        try {
            // 1. Update the chapter details
            await API.put(`/manga-chapters/${this.chapterId}`, {
                name: chName || null,
                name_en: chNameEn || null,
                name_native: chNameNative || null,
                name_uk: chNameUk || null,
                chapter_number: chNumber,
                pages: chPages ? Number(chPages) : null,
                release_date: this.fullChapterData.release_date,
                image: this.fullChapterData.image,
                synopsis: this.fullChapterData.synopsis
            });

            // 2. Update the issue link (order_num, label)
            await API.put(`/magazines/issues/${this.issueId}/chapters/${this.chapterId}`, {
                order_num: orderNum,
                label: label
            });

            if (this.onSuccess) {
                await this.onSuccess();
            }
            this.close();
        } catch (e) {
            alert('Помилка збереження: ' + e.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Зберегти зміни';
        }
    }
}
