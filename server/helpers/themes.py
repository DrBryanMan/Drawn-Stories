"""
Централізований модуль констант системних ID тем.
Використовується для уникнення хардкоду та забезпечення єдиного джерела істини (Single Source of Truth).
"""

# Основні типи видань та формати
THEME_COMPLETE = 13         # Завершена
THEME_MAGAZINE = 35         # Журнал
THEME_MANGA = 36            # Манґа
THEME_COLLECTION = 44       # Збірник
THEME_TRANSLATED = 51       # Перекладене
THEME_MANHUA = 140          # Маньхва
THEME_MANHWA = 141          # Манхва

# Додаткові типи та формати
THEME_ANTHOLOGY = 4         # Антологія
THEME_CANCELLED = 5         # Скасована
THEME_ONGOING = 9           # Тривала
THEME_MINI_SERIES = 41      # Міні-серія
THEME_UNFINISHED = 46       # Незакінчене
THEME_MAXI_SERIES = 50      # Максі-серія
THEME_EVENT = 53            # Подія
THEME_MISSING_ISSUES = 54   # Пропущені випуски
THEME_ONE_SHOT = 55         # Ваншот
THEME_PRINT_ONLY = 57       # Лише друковане
THEME_DIGITAL_ONLY = 65     # Лише в цифрі
THEME_GRAPHIC_NOVEL = 67    # Графічна новела
THEME_REPRINTED = 71        # Репрінт
THEME_RELEASING = 72        # Виходить
THEME_PUBLISHING = 73       # Видається
THEME_MANGA_SERIES = 74     # Манґа серія
THEME_DOUJIN = 142          # Доджінші
THEME_OMNIBUS = 143         # Омнібус
THEME_TPB = 144             # ТПБ
THEME_SINGLES = 145         # Сінґли
THEME_WEST_MANGA = 146      # Вест-манґа
THEME_EURO_MANGA = 147      # Євро-манґа

# Групи тем
ASIAN_COMICS_THEME_IDS = (THEME_MANGA, THEME_MANHUA, THEME_MANHWA)
