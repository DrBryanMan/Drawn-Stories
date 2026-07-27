"""
server/helpers/scores.py
Хелпер для нарахування балів за правки та визначення рівня користувача.
"""

from __future__ import annotations
from typing import Any

# ─── Рівні ────────────────────────────────────────────────────────────────────
# Кожен запис: (мін. балів включно, назва рівня)
LEVELS: list[tuple[int, str]] = [
    (0,    "Новачок"),
    (50,   "Учень"),
    (150,  "Редактор"),
    (350,  "Досвідчений"),
    (700,  "Провідний"),
    (1200, "Експерт"),
    (2000, "Майстер"),
    (3500, "Гросмейстер"),
]


def get_level_for_score(score: int) -> int:
    """Повертає номер рівня (1-based) для заданої кількості балів."""
    level = 1
    for idx, (threshold, _) in enumerate(LEVELS, start=1):
        if score >= threshold:
            level = idx
    return level


def get_level_title(level: int) -> str:
    """Повертає назву рівня за його номером."""
    idx = max(1, min(level, len(LEVELS))) - 1
    return LEVELS[idx][1]


# ─── Підрахунок балів за правку ───────────────────────────────────────────────

def _count_meaningful_words(text: str) -> int:
    """Кількість слів довжиною > 2 символи."""
    return sum(1 for word in text.split() if len(word) > 2)


def _is_local_webp(value: str | None) -> bool:
    """Перевіряє, чи значення — локальний шлях/URL до webp-файлу (не http)."""
    if not value:
        return False
    lower = value.lower()
    return lower.endswith(".webp") and not lower.startswith("http")


def calculate_edit_score(
    before: dict[str, Any],
    after: dict[str, Any],
    themes_before: list[int],
    themes_after: list[int],
) -> tuple[int, list[str]]:
    """
    Порівнює стан «до» та «після» правки та повертає:
      - загальну кількість балів (int, може бути 0)
      - список рядкових описів нарахувань (для рядка reason)

    Правила:
      • Заповнення порожнього поля   → +5 б.
      • Зміна існуючого поля         → +2 б.
      • Зображення/банер webp (локально)  → +10 б. (замість 5/2 за поле)
      • lang                          → +2 б.
      • publisher                     → +5 б. (лише якщо поле було порожнє)
                                               або +2 б. (якщо змінили)
      • themes — кожна нова тема      → +2 б.
      • synopsis_ua / synopsis:
          - новий синопсис → кількість слів > 2 символи, поділена на 2
          - змінений синопсис → залежно від % змін (1-20%: +2 б., 21-30%: +5 б., 31-60%: +10 б., 61-100%: +20 б.)
    """
    total = 0
    parts: list[str] = []

    # Поля-зображення (image = cover, banner)
    IMAGE_FIELDS = {"image", "banner"}
    # Поля з особливою вартістю
    SYNOPSIS_FIELDS = {"synopsis_ua", "synopsis"}
    SKIP_FIELDS = {"themes", "theme_ids"} | SYNOPSIS_FIELDS | IMAGE_FIELDS

    # ── 1. Звичайні поля ──────────────────────────────────────────────────────
    for field, new_val in after.items():
        if field in SKIP_FIELDS:
            continue
        if new_val is None or new_val == "":
            continue

        old_val = before.get(field)
        is_empty_before = old_val is None or old_val == ""

        if field == "lang":
            pts = 2
            label = "мову видання"
        elif field == "publisher":
            pts = 5 if is_empty_before else 2
            label = "видавництво"
        else:
            pts = 5 if is_empty_before else 2
            label = field

        if old_val == new_val:
            continue  # значення не змінилось

        total += pts
        action = "додано" if is_empty_before else "змінено"
        parts.append(f"{action} {label} (+{pts} б.)")

    # ── 2. Зображення / банер ─────────────────────────────────────────────────
    for field in IMAGE_FIELDS:
        new_val = after.get(field)
        if not new_val:
            continue
        old_val = before.get(field)
        if old_val == new_val:
            continue

        is_empty_before = not old_val
        is_webp = _is_local_webp(new_val)

        if is_webp:
            pts = 10
            label_type = "webp"
        else:
            pts = 5 if is_empty_before else 2
            label_type = "посилання"

        total += pts
        action = "додано" if is_empty_before else "змінено"
        label = "обкладинку" if field == "image" else "банер"
        parts.append(f"{action} {label} ({label_type}, +{pts} б.)")

    # ── 3. Синопсис ───────────────────────────────────────────────────────────
    for field in SYNOPSIS_FIELDS:
        new_val = after.get(field)
        if not new_val:
            continue
        old_val = before.get(field)
        if old_val == new_val:
            continue

        if old_val:
            # Редагування існуючого синопсису — перевіряємо відсоток змін
            import difflib
            matcher = difflib.SequenceMatcher(None, str(old_val), str(new_val))
            similarity = matcher.ratio()  # 1.0 = однакові, 0.0 = повністю різні
            diff_ratio = 1.0 - similarity  # Частка зміненого тексту (0.0 .. 1.0)
            diff_percent = int(diff_ratio * 100)

            if diff_ratio > 0.60:
                pts = 20
            elif diff_ratio > 0.30:
                pts = 10
            elif diff_ratio > 0.20:
                pts = 5
            else:
                pts = 2

            parts.append(f"відредаговано синопсис ({diff_percent}% змін, +{pts} б.)")
        else:
            # Новий синопсис — підраховуємо слова
            words = _count_meaningful_words(str(new_val))
            pts = max(1, words // 2)
            parts.append(f"додано синопсис ({words} сл., +{pts} б.)")

        total += pts

    # ── 4. Теми ───────────────────────────────────────────────────────────────
    added_themes = set(themes_after) - set(themes_before)
    if added_themes:
        pts = len(added_themes) * 2
        total += pts
        parts.append(f"додано тем: {len(added_themes)} шт. (+{pts} б.)")

    return total, parts


def build_reason_string(
    entity_type: str,
    entity_id: int,
    parts: list[str],
    total: int,
    action: str = "Схвалено",
) -> str:
    """Формує рядок reason для запису в score_history."""
    details = ", ".join(parts) if parts else "без деталей"
    label = "тому" if entity_type == "volume" else entity_type
    return f"{action} правку {label} #{entity_id}: {details} (всього +{total} б.)"
