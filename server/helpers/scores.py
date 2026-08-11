"""
server/helpers/scores.py
Хелпер для нарахування балів за правки та визначення рівня користувача.
"""

from __future__ import annotations
from typing import Any
import difflib
import json

# ─── Рівні ───────────────────────────────────────────────────────────────────

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


def _is_empty(val: Any) -> bool:
    """Перевіряє, чи значення порожнє (None, '', [], {}, '[]', 'null', тощо)."""
    if val is None:
        return True
    if isinstance(val, (list, tuple, set, dict)):
        return len(val) == 0
    if isinstance(val, str):
        s = val.strip()
        return s == "" or s == "[]" or s == "{}" or s == "null" or s == "None"
    return False


def _extract_list_items(val: Any) -> set:
    """Витягує множину унікальних ідентифікаторів або рядків зі спискового поля чи JSON-рядка."""
    if not val:
        return set()
    if isinstance(val, str):
        try:
            val = json.loads(val)
        except Exception:
            val = [val.strip()]
    if isinstance(val, list):
        items = set()
        for item in val:
            if isinstance(item, dict):
                item_id = item.get("id") or item.get("person_id") or item.get("character_id")
                if item_id:
                    items.add(f"id:{item_id}")
                else:
                    items.add(tuple(sorted((str(k), str(v)) for k, v in item.items() if v not in (None, ""))))
            elif item not in (None, ""):
                items.add(str(item).strip())
        return items
    return {str(val).strip()} if str(val).strip() else set()


def calculate_edit_score(
    before: dict[str, Any],
    after: dict[str, Any],
    themes_before: list[int] | None = None,
    themes_after: list[int] | None = None,
    entity_type: str = "volume",
) -> tuple[int, list[str]]:
    """
    Порівнює стан «до» та «після» правки та повертає:
      - загальну кількість балів (int, може бути 0)
      - список рядкових описів нарахувань (для рядка reason)

    Правила:
      • Заповнення порожнього поля   → +5 б.
      • Зміна існуючого поля         → +2 б.
      • Зображення/банер/фото webp (локально) → +10 б. (замість 5/2 за поле)
      • lang                          → +2 б.
      • publisher                     → +5 б. (лише якщо поле було порожнє) або +2 б.
      • themes — кожна нова тема      → +2 б.
      • synopsis / description / bio:
          - новий текст → кількість слів > 2 символи, поділена на 2
          - змінений текст → залежно від % змін (1-20%: +2 б., 21-30%: +5 б., 31-60%: +10 б., 61-100%: +20 б.)
      • Нові зв'язки (автори, випуски, персонажі, зміст, зв'язані томи) → +2 б. за кожен
      • Нова версія персонажа (persona) → +3 б.
    """
    total = 0
    parts: list[str] = []

    if themes_before is None:
        themes_before = []
    if themes_after is None:
        themes_after = []

    # Поля-зображення
    IMAGE_FIELDS = {"image", "cover_img", "photo", "logo", "banner", "portret_img", "costume_img", "portret_costume_img"}
    # Великі текстові поля
    TEXT_FIELDS = {"synopsis_ua", "synopsis", "description", "bio"}
    # Поля списків / відносин
    LIST_FIELDS = {"staff", "characters", "issues", "volumes", "creators", "related_collections", "contents"}
    
    SKIP_FIELDS = {"themes", "theme_ids", "personas"} | TEXT_FIELDS | IMAGE_FIELDS | LIST_FIELDS

    FIELD_LABELS: dict[str, str] = {
        "name": "оригінальну назву",
        "name_uk": "українську назву",
        "name_en": "англійську назву",
        "name_ro": "транслітеровану назву",
        "name_native": "рідну назву",
        "real_name": "оригінальне справжнє ім'я",
        "real_name_uk": "українське справжнє ім'я",
        "creators": "авторів / творців",
        "franchise": "франшизу",
        "earth": "всесвіт / землю",
        "essence": "сутність / расу",
        "origin": "походження",
        "gender": "стать",
        "start_year": "рік початку",
        "lang": "мову",
        "publisher": "видавництво",
        "site_link": "посилання на джерело",
        "pseudo": "псевдонім",
        "occupation": "професію",
        "birth": "дату народження",
        "birth_place": "місце народження",
        "website": "вебсайт",
        "issue_number": "номер випуску",
        "publication_date": "дату публікації",
        "country": "країну",
        "personas": "альтер-его / версії",
        "aliases": "псевдоніми",
        "image": "головне зображення",
        "cover_img": "банер / обкладинку",
        "cv_img": "обкладинку",
        "portret_img": "портрет",
        "costume_img": "костюм",
        "portret_costume_img": "портрет у костюмі",
        "logo": "логотип",
        "photo": "фото",
        "synopsis": "синопсис",
        "synopsis_ua": "український синопсис",
        "description": "опис",
        "bio": "біографію",
        "staff": "персонал",
        "characters": "персонажів",
        "issues": "випуски",
        "volumes": "томи",
        "related_collections": "пов'язані колекції",
        "contents": "зміст",
    }

    # ── 1. Звичайні текстові та числові поля ────────────────────────────────
    for field, new_val in after.items():
        if field in SKIP_FIELDS:
            continue
        if _is_empty(new_val):
            continue

        old_val = before.get(field)
        is_empty_before = _is_empty(old_val)

        if _is_empty(old_val) and _is_empty(new_val):
            continue

        if old_val == new_val:
            continue

        pts = 5 if is_empty_before else 2
        if field == "lang":
            pts = 2
        elif field == "publisher":
            pts = 5 if is_empty_before else 2

        label = FIELD_LABELS.get(field, field)
        total += pts
        action = "додано" if is_empty_before else "змінено"
        parts.append(f"{action} {label} (+{pts} б.)")

    # ── 2. Зображення / логотипи / банери ──────────────────────────────────
    for field in IMAGE_FIELDS:
        if field not in after:
            continue
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
        label = FIELD_LABELS.get(field, "зображення")
        parts.append(f"{action} {label} ({label_type}, +{pts} б.)")

    # ── 3. Опис / Синопсис / Біографія ───────────────────────────────────────
    for field in TEXT_FIELDS:
        if field not in after:
            continue
        new_val = after.get(field)
        if not new_val:
            continue
        old_val = before.get(field)
        if old_val == new_val:
            continue

        label = FIELD_LABELS.get(field, field)
        if old_val:
            matcher = difflib.SequenceMatcher(None, str(old_val), str(new_val))
            similarity = matcher.ratio()
            diff_ratio = 1.0 - similarity
            diff_percent = int(diff_ratio * 100)

            if diff_ratio > 0.60:
                pts = 20
            elif diff_ratio > 0.30:
                pts = 10
            elif diff_ratio > 0.20:
                pts = 5
            else:
                pts = 2

            parts.append(f"відредаговано {label} ({diff_percent}% змін, +{pts} б.)")
        else:
            words = _count_meaningful_words(str(new_val))
            pts = max(1, words // 2)
            parts.append(f"додано {label} ({words} сл., +{pts} б.)")

        total += pts

    # ── 4. Списки та відношення (автори, персонажі, випуски, зміст тощо) ───
    for field in LIST_FIELDS:
        if field not in after:
            continue
        new_set = _extract_list_items(after.get(field))
        old_set = _extract_list_items(before.get(field))
        
        added = new_set - old_set
        if added:
            pts = len(added) * 2
            total += pts
            if field == "contents":
                parts.append(f"додано зміст: {len(added)} розд. (+{pts} б.)")
            else:
                label = FIELD_LABELS.get(field, field)
                parts.append(f"додано {label}: {len(added)} шт. (+{pts} б.)")

    # ── 5. Теми ───────────────────────────────────────────────────────────────
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
    label_map = {
        "volume": "тому",
        "issue": "випуску",
        "character": "персонажу",
        "person": "персони",
        "publisher": "видавництва",
        "collection": "збірника"
    }
    label = label_map.get(entity_type, entity_type)
    return f"{action} правку {label} #{entity_id}: {details} (всього +{total} б.)"
