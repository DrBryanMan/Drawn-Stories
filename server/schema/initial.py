# server/schema/initial.py — повна схема БД, виконується ТІЛЬКИ при створенні нової бази

def apply_initial_schema(conn):
    # ── Таблиці ──────────────────────────────────────────────────────────────

    conn.execute("""
    CREATE TABLE IF NOT EXISTS volumes (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id           INTEGER,
        cv_slug         NUMERIC,
        hikka_slug      TEXT,
        mal_id          INTEGER,
        locg_id         INTEGER,
        locg_slug       TEXT,
        image           TEXT,
        cover_img       TEXT,
        name            TEXT NOT NULL,
        name_uk         TEXT,
        name_en         TEXT,
        name_native     TEXT,
        synonyms        TEXT,
        publisher       INTEGER,
        lang            TEXT,
        start_year      INTEGER,
        synopsis        TEXT,
        synopsis_ua     TEXT,
        description     TEXT,
        site_link       TEXT,
        mal_score       INTEGER,
        mal_scored_by   INTEGER,
        hikka_score     REAL,
        hikka_scored_by INTEGER,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS publishers (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id        INTEGER UNIQUE,
        cv_slug      TEXT,
        image        TEXT,
        name         TEXT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        aliases      TEXT,
        founded_date TEXT,
        website      TEXT,
        address      TEXT,
        place        TEXT,
        country      TEXT,
        status       TEXT,
        work_type    TEXT
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issues (
        id             INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,
        cv_id          INTEGER,
        cv_slug        TEXT,
        name           TEXT,
        image          TEXT,
        cv_vol_id      INTEGER,
        issue_number   TEXT,
        cover_date     TEXT,
        release_date   TEXT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description    TEXT,
        volume_id      INTEGER REFERENCES volumes(id) ON DELETE SET NULL,
        plot           TEXT,
        site_link      TEXT,
        pages          TEXT
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS characters (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id             INTEGER NOT NULL UNIQUE,
        name              TEXT NOT NULL,
        real_name         TEXT,
        cv_slug           TEXT,
        image             TEXT,
        aliases           TEXT,
        birth             TEXT,
        death             TEXT,
        gender            INTEGER,
        origin            TEXT,
        first_appearance  INTEGER,
        publisher         INTEGER,
        essence           TEXT,
        earth             TEXT,
        franchise         TEXT,
        date_last_updated TEXT,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (first_appearance) REFERENCES issues (id),
        FOREIGN KEY (publisher) REFERENCES publishers (id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS themes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id      INTEGER UNIQUE,
        name       TEXT NOT NULL,
        ua_name    INTEGER,
        type       TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_themes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_vol_id  INTEGER,
        volume_id  INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
        theme_id   INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
        UNIQUE(volume_id, theme_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS collections (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id        INTEGER,
        cv_slug      TEXT,
        cv_vol_id    INTEGER,
        image        TEXT,
        volume_id    INTEGER,
        publisher    INTEGER,
        issue_number TEXT,
        isbn         TEXT,
        cover_date   TEXT,
        release_date TEXT,
        name         TEXT,
        synopsis     TEXT,
        synopsis_ua  TEXT,
        description  TEXT,
        pages        TEXT,
        site_link    TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        contents     TEXT,
        FOREIGN KEY(volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS collection_issues (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        issue_id      INTEGER NOT NULL,
        order_num     INTEGER NOT NULL DEFAULT 0,
        chapter_title TEXT,
        FOREIGN KEY (collection_id) REFERENCES collections(id),
        FOREIGN KEY (issue_id) REFERENCES issues(id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS collection_themes (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        theme_id      INTEGER NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id),
        FOREIGN KEY (theme_id) REFERENCES themes(id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS series (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        description TEXT,
        cv_img      TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS series_volumes (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id INTEGER NOT NULL,
        volume_id INTEGER NOT NULL,
        UNIQUE(series_id, volume_id),
        FOREIGN KEY (series_id) REFERENCES series(id),
        FOREIGN KEY (volume_id) REFERENCES volumes(id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS series_collections (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id     INTEGER NOT NULL,
        collection_id INTEGER NOT NULL,
        UNIQUE(series_id, collection_id),
        FOREIGN KEY (series_id) REFERENCES series(id),
        FOREIGN KEY (collection_id) REFERENCES collections(id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS reading_orders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        description TEXT,
        cv_img      TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS reading_order_issues (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_order_id INTEGER NOT NULL,
        issue_id         INTEGER NOT NULL,
        order_num        INTEGER NOT NULL DEFAULT 0,
        issue_cv_id      INTEGER,
        UNIQUE(reading_order_id, issue_id),
        FOREIGN KEY (reading_order_id) REFERENCES reading_orders(id),
        FOREIGN KEY (issue_id) REFERENCES issues(id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        description TEXT,
        cv_img      TEXT,
        start_year  INTEGER,
        end_year    INTEGER,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS event_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id   INTEGER NOT NULL,
        item_id    INTEGER NOT NULL,
        item_type  TEXT NOT NULL CHECK(item_type IN ('issue','collection')),
        order_num  INTEGER NOT NULL DEFAULT 0,
        importance TEXT DEFAULT 'main' CHECK(importance IN ('main','tie-in','prologue','epilogue')),
        UNIQUE(event_id, item_id, item_type),
        FOREIGN KEY (event_id) REFERENCES events(id)
    )""")

    # Переклади: parent = оригінальний том, child = перекладений том
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_translations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id  INTEGER NOT NULL,
        parent_id INTEGER NOT NULL,
        rel_type  TEXT NOT NULL DEFAULT 'translation' CHECK(rel_type IN ('translation', 'source', 'original')),
        UNIQUE(parent_id, child_id),
        FOREIGN KEY(child_id) REFERENCES volumes(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_id) REFERENCES volumes(id) ON DELETE CASCADE
    )""")

    # Журнали: magazine_id = батьківський журнал манґи, volume_id = дочірній том манґи
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_magazines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        magazine_id INTEGER NOT NULL REFERENCES manga_magazines(id) ON DELETE CASCADE,
        volume_id    INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE(magazine_id, volume_id)
    )""")

    # Журнали манґи (нова таблиця)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS manga_magazines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id       INTEGER UNIQUE,
        cv_slug     TEXT,
        image       TEXT,
        name        TEXT NOT NULL,
        name_native TEXT,
        publisher   INTEGER,
        label       TEXT,
        start_year  INTEGER,
        format      TEXT,
        demographic TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (publisher) REFERENCES publishers(id) ON DELETE SET NULL
    )""")

    # Випуски журналів манґи (нова таблиця)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS magazine_issues (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id        INTEGER UNIQUE,
        cv_slug      TEXT,
        image        TEXT,
        release_date TEXT,
        cover_date   TEXT,
        issue_number TEXT,
        name         TEXT,
        magazine_id  INTEGER NOT NULL REFERENCES manga_magazines(id) ON DELETE CASCADE,
        pages        TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    # Зв'язки випусків журналів манґи з розділами манґи (нова таблиця)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS magazine_issue_chapters (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        magazine_issue_id INTEGER NOT NULL REFERENCES magazine_issues(id) ON DELETE CASCADE,
        manga_id          INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        manga_chapter_id  INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        order_num         INTEGER NOT NULL DEFAULT 0,
        label             TEXT CHECK(label IN ('lead', 'color', 'debut', 'final')),
        UNIQUE(magazine_issue_id, manga_chapter_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS magazine_chapters (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        mag_issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        issue_id     INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        page_type    TEXT CHECK(page_type IN ('color','cover','combined')),
        UNIQUE(mag_issue_id, issue_id)
    )""")

    # Користувачі
    conn.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        nickname      TEXT,
        password_hash TEXT NOT NULL,
        role          TEXT DEFAULT 'viewer',
        last_login    TIMESTAMP,
        last_activity TIMESTAMP,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    # Списки читання (томи)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_readlists (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        list_name  TEXT NOT NULL,
        volume_id  INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, list_name, volume_id)
    )""")

    # Списки читання (збірники)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_collections (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        collection_id INTEGER NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status        TEXT DEFAULT 'get',
        barter        BOOLEAN DEFAULT 0,
        UNIQUE(user_id, collection_id),
        FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # Обрані
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_favorites (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_type TEXT NOT NULL CHECK(content_type IN ('volume','issue','personnel','character')),
        content_id   INTEGER NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_type, content_id)
    )""")

    # Персонажі та концепції парсера
    conn.execute("""
    CREATE TABLE IF NOT EXISTS persons (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id      INTEGER NOT NULL UNIQUE,
        name       TEXT NOT NULL,
        cv_slug    TEXT,
        image      TEXT,
        aliases    TEXT,
        birth      TEXT,
        death      TEXT,
        country    TEXT,
        gender     INTEGER,
        hometown   TEXT,
        website    TEXT,
        occupation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS concepts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cv_id      INTEGER NOT NULL UNIQUE,
        name       TEXT NOT NULL,
        cv_slug    TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS character_aliases (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        alias        TEXT NOT NULL
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_relations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        from_vol_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        to_vol_id   INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        rel_type    TEXT NOT NULL CHECK(rel_type IN ('continuation','sequel','prequel','spinoff','related')),
        order_num   INTEGER NOT NULL DEFAULT 0,
        UNIQUE(from_vol_id, to_vol_id, rel_type)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_stories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id      INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        name_original TEXT,
        name_ua       TEXT,
        plot          TEXT,
        order_num     INTEGER NOT NULL DEFAULT 0
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_reprints (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        original_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        reprint_id  INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        story_id    INTEGER REFERENCES issue_stories(id) ON DELETE SET NULL,
        UNIQUE(original_id, reprint_id, story_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS reading_order_collections (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_order_id INTEGER NOT NULL REFERENCES reading_orders(id) ON DELETE CASCADE,
        collection_id    INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        order_num        INTEGER NOT NULL DEFAULT 0,
        UNIQUE(reading_order_id, collection_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_teams (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id INTEGER NOT NULL,
        team_cv_id  INTEGER NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, team_cv_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_locations (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id    INTEGER NOT NULL,
        location_cv_id INTEGER NOT NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, location_cv_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_concepts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id   INTEGER NOT NULL,
        concept_cv_id INTEGER NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, concept_cv_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_objects (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id  INTEGER NOT NULL,
        object_cv_id INTEGER NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, object_cv_id)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_persons (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id  INTEGER NOT NULL,
        person_cv_id INTEGER NOT NULL,
        role         TEXT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, person_cv_id, role)
    )""")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_characters (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_cv_id     INTEGER NOT NULL,
        character_cv_id INTEGER NOT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(issue_cv_id, character_cv_id)
    )""")

    # ── Індекси ──────────────────────────────────────────────────────────────

    # volumes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_cv_id ON volumes(cv_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name COLLATE NOCASE)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_cv_slug ON volumes(cv_slug)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_name_uk ON volumes(name_uk COLLATE NOCASE)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_lang ON volumes(lang)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_start_year ON volumes(start_year)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_hikka_slug ON volumes(hikka_slug)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_mal_id ON volumes(mal_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_publisher ON volumes(publisher)")

    # issues
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_cv_id ON issues(cv_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_cv_slug ON issues(cv_slug)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_name ON issues(name COLLATE NOCASE)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_cv_vol_id ON issues(cv_vol_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_volume_id ON issues(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_issue_number ON issues(issue_number)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_cover_date ON issues(cover_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_release_date ON issues(release_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_pages ON issues(pages)")

    # characters
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_cv_id ON characters(cv_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name COLLATE NOCASE)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_first_appearance ON characters(first_appearance)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_publisher ON characters(publisher)")

    # themes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name COLLATE NOCASE)")

    # volume_themes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_cv_vol_id ON volume_themes(cv_vol_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_theme_id ON volume_themes(theme_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_volume_id ON volume_themes(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_theme_vol ON volume_themes(theme_id, volume_id)")

    # collections
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_cv_vol_id ON collections(cv_vol_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_cv_id ON collections(cv_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name COLLATE NOCASE)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_release_date ON collections(release_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_volume_id ON collections(volume_id)")

    # collection_issues
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_issues_collection_id ON collection_issues(collection_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_issues_issue_id ON collection_issues(issue_id)")

    # collection_themes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_themes_collection_id ON collection_themes(collection_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_themes_theme_id ON collection_themes(theme_id)")

    # series
    conn.execute("CREATE INDEX IF NOT EXISTS idx_series_name ON series(name COLLATE NOCASE)")

    # series_volumes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_series_volumes_series_id ON series_volumes(series_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_series_volumes_volume_id ON series_volumes(volume_id)")

    # series_collections
    conn.execute("CREATE INDEX IF NOT EXISTS idx_series_collections_series ON series_collections(series_id)")

    # reading_order_issues
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ro_issues_order ON reading_order_issues(reading_order_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_roi_issue_cv_id ON reading_order_issues(issue_cv_id)")

    # events
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_name ON events(name COLLATE NOCASE)")

    # event_items
    conn.execute("CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id)")

    # volume_translations
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vtrans_parent ON volume_translations(parent_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vtrans_child ON volume_translations(child_id)")

    # volume_magazines
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vmag_magazine ON volume_magazines(magazine_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vmag_child ON volume_magazines(child_id)")

    # magazine_chapters
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mc_mag_issue ON magazine_chapters(mag_issue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mc_issue ON magazine_chapters(issue_id)")

    # user_readlists
    conn.execute("CREATE INDEX IF NOT EXISTS idx_readlists_user ON user_readlists(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_readlists_user_list ON user_readlists(user_id, list_name)")

    # user_collections
    conn.execute("CREATE INDEX IF NOT EXISTS idx_user_collections_user ON user_collections(user_id)")

    # user_favorites
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON user_favorites(user_id, content_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_content ON user_favorites(content_type, content_id)")

    # publishers
    conn.execute("CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name)")

    # character_aliases
    conn.execute("CREATE INDEX IF NOT EXISTS idx_character_aliases_character_id ON character_aliases(character_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_character_aliases_alias ON character_aliases(alias COLLATE NOCASE)")

    # reading_order_collections
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ro_collections_order ON reading_order_collections(reading_order_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ro_collections_collection_id ON reading_order_collections(collection_id)")

    # volume_relations
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vrel_from ON volume_relations(from_vol_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vrel_to ON volume_relations(to_vol_id)")

    # issue_stories
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_stories_issue_id ON issue_stories(issue_id)")

    # issue_reprints
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_original ON issue_reprints(original_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_reprint ON issue_reprints(reprint_id)")

    # persons
    conn.execute("CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name)")
