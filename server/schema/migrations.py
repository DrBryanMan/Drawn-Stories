# server/schema/migrations.py — виконується при ЗАВАНТАЖЕННІ існуючої бази.
# Кожна міграція ідемпотентна: повторний запуск не зламає нічого.
# Нові міграції додавати в кінець списку MIGRATIONS.

MIGRATIONS = []

def migration(migration_id):
    def decorator(fn):
        MIGRATIONS.append((migration_id, fn))
        return fn
    return decorator


def ensure_migrations_table(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
            id         TEXT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def is_applied(conn, migration_id):
    return conn.execute(
        "SELECT 1 FROM _migrations WHERE id = %s",
        [migration_id],
    ).fetchone() is not None


def mark_applied(conn, migration_id):
    conn.execute("INSERT INTO _migrations (id) VALUES (%s)", [migration_id])


# ── M001: поле lang у volumes ────────────────────────────────────────────
@migration("M001_volumes_lang")
def m001_volumes_lang(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN lang TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M002: таблиця personnel ──────────────────────────────────────────────
@migration("M002_personnel")
def m002_personnel(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS personnel (
        id         SERIAL PRIMARY KEY,
        name       TEXT    NOT NULL,
        bio        TEXT,
        cv_img     TEXT,
        cv_id      INTEGER UNIQUE,
        cv_slug    TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel(name)")

# ── M003: таблиці events та event_items ──────────────────────────────────
@migration("M003_events")
def m003_events(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id          SERIAL PRIMARY KEY,
        name        TEXT    NOT NULL,
        description TEXT,
        cv_img      TEXT,
        start_year  INTEGER,
        end_year    INTEGER,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_name ON events(name)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS event_items (
        id         SERIAL PRIMARY KEY,
        event_id   INTEGER NOT NULL,
        item_id    INTEGER NOT NULL,
        item_type  TEXT    NOT NULL CHECK(item_type IN ('issue','collection')),
        order_num  INTEGER NOT NULL DEFAULT 0,
        importance TEXT    DEFAULT 'main' CHECK(importance IN ('main','tie-in','prologue','epilogue')),
        UNIQUE(event_id, item_id, item_type),
        FOREIGN KEY (event_id) REFERENCES events(id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id)")

# ── M004: поле name_uk у volumes ─────────────────────────────────────────
@migration("M004_volumes_name_uk")
def m004_volumes_name_uk(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN name_uk TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M005: volumes — прибираємо themes, додаємо індекс ────────────────────
@migration("M005_volumes_publisher_cleanup")
def m005_volumes_publisher_cleanup(conn):
    try:
        conn.execute("ALTER TABLE volumes DROP COLUMN themes")
    except Exception:
        # SQLite drop column might fail on older versions or if already dropped, ignore
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_publisher ON volumes(publisher)")

# ── M006: collections — додаємо покращення ────────────────────────────────
@migration("M006_collections_improvements")
def m006_collections_improvements(conn):
    for col in ["issue_number", "isbn", "cover_date", "release_date"]:
        try:
            conn.execute(f"ALTER TABLE collections ADD COLUMN {col} TEXT")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_publisher ON collections(publisher)")

# ── M007: issues — додаємо поле description ──────────────────────────────
@migration("M007_issues_description")
def m007_issues_description(conn):
    try:
        conn.execute("ALTER TABLE issues ADD COLUMN description TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M008: нові таблиці ───────────────────────────────────────────────────
@migration("M008_new_tables")
def m008_new_tables(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS character_aliases (
        id           SERIAL PRIMARY KEY,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        alias        TEXT    NOT NULL
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_character_aliases_character_id ON character_aliases(character_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_character_aliases_alias ON character_aliases(alias)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_characters (
        id           SERIAL PRIMARY KEY,
        issue_id     INTEGER NOT NULL REFERENCES issues(id)     ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        role         TEXT    DEFAULT 'hero' CHECK(role IN ('hero','villain','supporting','cameo')),
        UNIQUE(issue_id, character_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_characters_issue_id     ON issue_characters(issue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_characters_character_id ON issue_characters(character_id)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_personnel (
        id           SERIAL PRIMARY KEY,
        issue_id     INTEGER NOT NULL REFERENCES issues(id)    ON DELETE CASCADE,
        personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
        role         TEXT    NOT NULL,
        UNIQUE(issue_id, personnel_id, role)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_personnel_issue_id     ON issue_personnel(issue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_personnel_personnel_id ON issue_personnel(personnel_id)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS reading_order_collections (
        id               SERIAL PRIMARY KEY,
        reading_order_id INTEGER NOT NULL REFERENCES reading_orders(id) ON DELETE CASCADE,
        collection_id    INTEGER NOT NULL REFERENCES collections(id)    ON DELETE CASCADE,
        order_num        INTEGER NOT NULL DEFAULT 0,
        UNIQUE(reading_order_id, collection_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ro_collections_order         ON reading_order_collections(reading_order_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ro_collections_collection_id ON reading_order_collections(collection_id)")

# ── M009: collection_issues — додаємо order_num ───────────────────────────
@migration("M009_collection_issues_order")
def m009_collection_issues_order(conn):
    try:
        conn.execute("ALTER TABLE collection_issues ADD COLUMN order_num INTEGER NOT NULL DEFAULT 0")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M010: reading_order_issues — додаємо issue_cv_id ─────────────────────
@migration("M010_roi_issue_cv_id")
def m010_roi_issue_cv_id(conn):
    try:
        conn.execute("ALTER TABLE reading_order_issues ADD COLUMN issue_cv_id INTEGER")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    conn.execute("""
        UPDATE reading_order_issues
        SET issue_cv_id = (
          SELECT cv_id FROM issues WHERE issues.id = reading_order_issues.issue_id
        )
        WHERE issue_cv_id IS NULL
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_roi_issue_cv_id ON reading_order_issues(issue_cv_id)")

# ── M011: themes — додаємо type ──────────────────────────────────────────
@migration("M011_themes_type")
def m011_themes_type(conn):
    try:
        conn.execute("ALTER TABLE themes ADD COLUMN type TEXT NOT NULL DEFAULT 'theme' CHECK(type IN ('genre', 'theme'))")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise
    conn.execute("CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(type)")

# ── M012: volume_translations + volume_magazines ──────────────────────────
@migration("M012_volume_relations")
def m012_volume_relations(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_translations (
        id        SERIAL PRIMARY KEY,
        parent_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        child_id  INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vtrans_parent ON volume_translations(parent_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vtrans_child  ON volume_translations(child_id)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_magazines (
        id          SERIAL PRIMARY KEY,
        magazine_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        child_id    INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE(magazine_id, child_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vmag_magazine ON volume_magazines(magazine_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vmag_child    ON volume_magazines(child_id)")

# ── M013: volumes — додаємо поле description ────────────────────────────
@migration("M013_volumes_description")
def m013_volumes_description(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN description TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M014: volume_relations — хронологія та зв'язки ───────────────────────
@migration("M014_volume_relations")
def m014_volume_relations(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_relations (
        id          SERIAL PRIMARY KEY,
        from_vol_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        to_vol_id   INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        rel_type    TEXT    NOT NULL CHECK(rel_type IN ('continuation','sequel','prequel','spinoff','related')),
        order_num   INTEGER NOT NULL DEFAULT 0,
        UNIQUE(from_vol_id, to_vol_id, rel_type)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vrel_from ON volume_relations(from_vol_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vrel_to   ON volume_relations(to_vol_id)")

# ── M015: manga volumes support ──────────────────────────────────────────
@migration("M015_manga_volumes")
def m015_manga_volumes(conn):
    for col, col_type in [("hikka_slug", "TEXT"), ("mal_id", "INTEGER")]:
        try:
            conn.execute(f"ALTER TABLE volumes ADD COLUMN {col} {col_type}")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise

    try:
        conn.execute("ALTER TABLE issues ADD COLUMN ds_vol_id INTEGER REFERENCES volumes(id) ON DELETE SET NULL")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_hikka_slug ON volumes(hikka_slug)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_mal_id     ON volumes(mal_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_ds_vol_id   ON issues(ds_vol_id)")

# ── M016: volume_themes — додаємо volume_id ──────────────────────────────
@migration("M016_volume_themes_volume_id")
def m016_volume_themes_volume_id(conn):
    try:
        conn.execute("ALTER TABLE volume_themes ADD COLUMN volume_id INTEGER REFERENCES volumes(id) ON DELETE CASCADE")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    conn.execute("""
        UPDATE volume_themes
        SET volume_id = (
          SELECT v.id FROM volumes v WHERE v.cv_id = volume_themes.cv_vol_id
        )
        WHERE volume_id IS NULL
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_volume_id ON volume_themes(volume_id)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_vthemes_volume_theme ON volume_themes(volume_id, theme_id)")

# ── M017: volume_themes — перестворення таблиці ──────────────────────────
@migration("M017_volume_themes_recreate")
def m017_volume_themes_recreate(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS _vt_backup AS SELECT * FROM volume_themes")
    conn.execute("DROP TABLE IF EXISTS volume_themes")
    conn.execute("""
        CREATE TABLE volume_themes (
          id         SERIAL PRIMARY KEY,
          cv_vol_id  INTEGER,
          volume_id  INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
          theme_id   INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
          UNIQUE(volume_id, theme_id)
        )
    """)
    conn.execute("""
        INSERT INTO volume_themes (id, cv_vol_id, volume_id, theme_id)
        SELECT id, cv_vol_id, volume_id, theme_id FROM _vt_backup
    """)
    conn.execute("DROP TABLE IF EXISTS _vt_backup")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_volume_id    ON volume_themes(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_theme_id     ON volume_themes(theme_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_cv_vol_id    ON volume_themes(cv_vol_id)")

# ── M018: volumes — додаємо hikka_img ────────────────────────────────────
@migration("M018_volumes_hikka_img")
def m018_volumes_hikka_img(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN hikka_img TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M019: collection_issues — додаємо chapter_title ──────────────────────
@migration("M019_collection_issues_chapter_title")
def m019_collection_issues_chapter_title(conn):
    try:
        conn.execute("ALTER TABLE collection_issues ADD COLUMN chapter_title TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    conn.execute("""
        UPDATE collection_issues
        SET chapter_title = (
          SELECT i.name FROM issues i WHERE i.id = collection_issues.issue_id
        )
        WHERE chapter_title IS NULL
    """)

# ── M020: issue_reprints — зв'язок оригінал → репринт ────────────────────
@migration("M020_issue_reprints")
def m020_issue_reprints(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_reprints (
        id          SERIAL PRIMARY KEY,
        original_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        reprint_id  INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        UNIQUE(original_id, reprint_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_original ON issue_reprints(original_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_reprint  ON issue_reprints(reprint_id)")

# ── M021: issue_stories — окремі історії в синглі ───────────────────────
@migration("M021_issue_stories")
def m021_issue_stories(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_stories (
        id             SERIAL PRIMARY KEY,
        issue_id       INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        name_original  TEXT,
        name_ua        TEXT,
        plot           TEXT,
        order_num      INTEGER NOT NULL DEFAULT 0
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_stories_issue_id ON issue_stories(issue_id)")

# ── M022: issue_reprints — додаємо story_id ──────────────────────────────
@migration("M022_issue_reprints_story_id")
def m022_issue_reprints_story_id(conn):
    try:
        conn.execute("ALTER TABLE issue_reprints ADD COLUMN story_id INTEGER REFERENCES issue_stories(id) ON DELETE SET NULL")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M023: issues — додаємо plot ──────────────────────────────────────────
@migration("M023_issues_plot")
def m023_issues_plot(conn):
    try:
        conn.execute("ALTER TABLE issues ADD COLUMN plot TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M024: issue_reprints — перестворення з UNIQUE ────────────────────────
@migration("M024_issue_reprints_unique_with_story")
def m024_issue_reprints_unique_with_story(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS issue_reprints_new (
        id          SERIAL PRIMARY KEY,
        original_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        reprint_id  INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        story_id    INTEGER REFERENCES issue_stories(id) ON DELETE SET NULL,
        UNIQUE(original_id, reprint_id, story_id)
    )""")
    conn.execute("""
        INSERT INTO issue_reprints_new (id, original_id, reprint_id, story_id)
        SELECT id, original_id, reprint_id, story_id FROM issue_reprints
    """)
    conn.execute("DROP TABLE issue_reprints")
    conn.execute("ALTER TABLE issue_reprints_new RENAME TO issue_reprints")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_original ON issue_reprints(original_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reprints_reprint  ON issue_reprints(reprint_id)")

# ── M025: volume_translations — додаємо rel_type ─────────────────────────
@migration("M025_volume_translations_type")
def m025_volume_translations_type(conn):
    try:
        conn.execute("ALTER TABLE volume_translations ADD COLUMN rel_type TEXT NOT NULL DEFAULT 'translation' CHECK(rel_type IN ('translation','source','original'))")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    conn.execute("""
        UPDATE volume_translations
        SET rel_type = 'original'
        WHERE parent_id IN (
          SELECT v.id FROM volumes v
          WHERE v.hikka_slug IS NOT NULL
            OR v.mal_id IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = 36
            )
        )
    """)

    conn.execute("""
        UPDATE volume_translations
        SET rel_type = 'source'
        WHERE rel_type = 'translation'
          AND parent_id IN (
            SELECT vp.id FROM volumes vp
            JOIN volume_translations vt2 ON vt2.parent_id = vp.id
            JOIN volumes vc ON vc.id = vt2.child_id
            WHERE (vp.lang IS NULL OR vp.lang != 'ja')
              AND (vp.lang = vc.lang OR vc.lang IS NULL OR vp.lang IS NULL)
          )
    """)

# ── M026: volumes — додаємо site_link ────────────────────────────────────
@migration("M026_volumes_site_link")
def m026_volumes_site_link(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN site_link TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M027: issues — додаємо site_link ─────────────────────────────────────
@migration("M027_issues_site_link")
def m027_issues_site_link(conn):
    try:
        conn.execute("ALTER TABLE issues ADD COLUMN site_link TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M028: collections — додаємо site_link ────────────────────────────────
@migration("M028_collections_site_link")
def m028_collections_site_link(conn):
    try:
        conn.execute("ALTER TABLE collections ADD COLUMN site_link TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M029: collections — додаємо volume_id ────────────────────────────────
@migration("M029_collections_volume_id")
def m029_collections_volume_id(conn):
    try:
        conn.execute("ALTER TABLE collections ADD COLUMN volume_id INTEGER REFERENCES volumes(id) ON DELETE SET NULL")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_volume_id ON collections(volume_id)")

# ── M030: volume_themes — складений індекс ────────────────────────────────
@migration("M030_vthemes_theme_vol")
def m030_vthemes_theme_vol(conn):
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vthemes_theme_vol ON volume_themes(theme_id, volume_id)")

# ── M031: issues & collections — сторінки ───────────────────────────────
@migration("M031_pages")
def m031_pages(conn):
    for tbl in ["issues", "collections"]:
        try:
            conn.execute(f"ALTER TABLE {tbl} ADD COLUMN pages TEXT")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise

# ── M032: volumes — cover_img ────────────────────────────────────────────
@migration("M032_volumes_cover_img")
def m032_volumes_cover_img(conn):
    try:
        conn.execute("ALTER TABLE volumes ADD COLUMN cover_img TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

# ── M033: users — таблиця користувачів ──────────────────────────────────
@migration("M033_users_table")
def m033_users_table(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id               SERIAL PRIMARY KEY,
        username         TEXT    NOT NULL UNIQUE,
        password_hash    TEXT    NOT NULL,
        role             TEXT    DEFAULT 'viewer',
        last_login_at    TIMESTAMP,
        last_activity_at TIMESTAMP,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

# ── M034: user_readlists — списки читання томи ───────────────────────────
@migration("M034_user_readlists")
def m034_user_readlists(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_readlists (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        list_name  TEXT    NOT NULL,
        volume_id  INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, list_name, volume_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_readlists_user      ON user_readlists(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_readlists_user_list ON user_readlists(user_id, list_name)")

# ── M035: user_favorites — обране ────────────────────────────────────────
@migration("M035_user_favorites")
def m035_user_favorites(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_favorites (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        content_type TEXT    NOT NULL CHECK(content_type IN ('volume','issue','personnel','character')),
        content_id   INTEGER NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_type, content_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user         ON user_favorites(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user_type    ON user_favorites(user_id, content_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_favorites_content      ON user_favorites(content_type, content_id)")

# ── M036: додаткові індекси ──────────────────────────────────────────────
@migration("M036_additional_indexes")
def m036_additional_indexes(conn):
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_name_uk    ON volumes(name_uk)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_lang       ON volumes(lang)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_start_year ON volumes(start_year)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_pages       ON issues(pages)")

# ── M037: індекси на created_at ──────────────────────────────────────────
@migration("M037_created_at_indexes")
def m037_created_at_indexes(conn):
    conn.execute("CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at)")

# ── M038: user_collections — списки збірників ────────────────────────────
@migration("M038_user_collections")
def m038_user_collections(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_collections (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
        list_name     TEXT    NOT NULL,
        collection_id INTEGER NOT NULL REFERENCES collections(id)  ON DELETE CASCADE,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, list_name, collection_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_user_collections_user      ON user_collections(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_user_collections_user_list ON user_collections(user_id, list_name)")

# ── M039: очищення дублікатів ────────────────────────────────────────────
@migration("M039_cleanup_duplicate_issue_collections")
def m039_cleanup_duplicate_issue_collections(conn):
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_cv_id ON collections(cv_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_cv_id ON issues(cv_id)")

    conn.execute("DROP TABLE IF EXISTS _duplicate_issue_collections")
    conn.execute(
        """
        CREATE TEMP TABLE _duplicate_issue_collections AS
        SELECT i.id AS issue_id,
               MIN(c.id) AS collection_id
        FROM issues i
        JOIN collections c ON c.cv_id = i.cv_id
        WHERE i.cv_id IS NOT NULL
        GROUP BY i.id
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dup_issue_id ON _duplicate_issue_collections(issue_id)")

    conn.execute(
        """
        INSERT INTO reading_order_collections (reading_order_id, collection_id, order_num) SELECT roi.reading_order_id, d.collection_id, roi.order_num
        FROM reading_order_issues roi
        JOIN _duplicate_issue_collections d ON d.issue_id = roi.issue_id ON CONFLICT DO NOTHING
        """
    )
    conn.execute(
        """
        DELETE FROM reading_order_issues
        WHERE issue_id IN (SELECT issue_id FROM _duplicate_issue_collections)
        """
    )
    conn.execute(
        """
        UPDATE characters
        SET first_appearance = NULL
        WHERE first_appearance IN (SELECT issue_id FROM _duplicate_issue_collections)
        """
    )
    conn.execute(
        """
        DELETE FROM collection_issues
        WHERE issue_id IN (SELECT issue_id FROM _duplicate_issue_collections)
        """
    )
    conn.execute(
        """
        DELETE FROM issues
        WHERE id IN (SELECT issue_id FROM _duplicate_issue_collections)
        """
    )
    conn.execute("DROP TABLE IF EXISTS _duplicate_issue_collections")


# ── M040: rename ds_vol_id to volume_id in issues ────────────────────────
@migration("M040_rename_ds_vol_id")
def m040_rename_ds_vol_id(conn):
    try:
        conn.execute("ALTER TABLE issues RENAME COLUMN ds_vol_id TO volume_id")
    except Exception as e:
        if "no such column" not in str(e) and "duplicate column" not in str(e) and "already exists" not in str(e):
            raise
    conn.execute("DROP INDEX IF EXISTS idx_issues_ds_vol_id")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_volume_id ON issues(volume_id)")


# ── M041: remove NOT NULL constraint from cv_id in publishers ────────────
@migration("M041_publishers_nullable_cv_id")
def m041_publishers_nullable_cv_id(conn):
    try:
        conn.execute("ALTER TABLE publishers ALTER COLUMN cv_id DROP NOT NULL")
    except Exception as e:
        if "does not exist" not in str(e):
            raise
# ── M042: add missing indexes and fix collation ─────────────────────────
@migration("M042_missing_indexes")
def m042_missing_indexes(conn):
    # 1. idx_characters_cv_id
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_cv_id ON characters(cv_id)")
    
    # 2. idx_characters_name with
    conn.execute("DROP INDEX IF EXISTS idx_characters_name")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name)")
    
    # 3. idx_collections_cv_vol_id
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collections_cv_vol_id ON collections(cv_vol_id)")
    
# ── M043: rename user_readlists and create user_issues_readlist ──────────
@migration("M043_readlists_rename_and_create")
def m043_readlists_rename_and_create(conn):
    # 1. Rename user_readlists to user_volumes_readlist if exists
    table_exists = conn.execute("SELECT 1 FROM information_schema.tables WHERE table_name ='user_readlists'").fetchone()
    if table_exists:
        conn.execute("ALTER TABLE user_readlists RENAME TO user_volumes_readlist")
    
    # 2. Create user_issues_readlist table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_issues_readlist (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        list_name  TEXT    NOT NULL,
        issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, list_name, issue_id)
    )""")
    
    # 3. Create indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_readlist_user ON user_issues_readlist(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_readlist_issue ON user_issues_readlist(issue_id)")


# ── M044: rename user_collections and create user_issues_collection ──────
@migration("M044_collections_rename_and_create")
def m044_collections_rename_and_create(conn):
    # 1. Rename user_collections to user_volumes_collection if exists
    table_exists = conn.execute("SELECT 1 FROM information_schema.tables WHERE table_name ='user_collections'").fetchone()
    if table_exists:
        conn.execute("ALTER TABLE user_collections RENAME TO user_volumes_collection")
        
    # 2. Create user_issues_collection table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_issues_collection (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        status     TEXT    DEFAULT 'get',
        barter     BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, issue_id)
    )""")
    
    # 3. Create indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_collection_user ON user_issues_collection(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_collection_issue ON user_issues_collection(issue_id)")


# ── M045: appearances schema migration ───────────────────────────────────
@migration("M045_appearances_schema_migration")
def m045_appearances_schema_migration(conn):
    # Disable foreign keys during table restructuring
    try:
        conn.execute("SET session_replication_role = 'replica'")
    except Exception:
        pass
    try:
        # 1. Create missing target tables for teams, locations, objects
        conn.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id         SERIAL PRIMARY KEY,
            cv_id      INTEGER UNIQUE,
            name       TEXT NOT NULL,
            cv_slug    TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name)")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id         SERIAL PRIMARY KEY,
            cv_id      INTEGER UNIQUE,
            name       TEXT NOT NULL,
            cv_slug    TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name)")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS objects (
            id         SERIAL PRIMARY KEY,
            cv_id      INTEGER UNIQUE,
            name       TEXT NOT NULL,
            cv_slug    TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_objects_name ON objects(name)")

        # 2. Insert missing base records to prevent foreign key constraint violations
        # (This populates the core entity tables for any existing CV IDs in relation tables)
        
        # Check if table exists before querying
        def table_exists(name):
            return conn.execute("SELECT 1 FROM information_schema.tables WHERE table_name =%s", [name]).fetchone() is not None

        if table_exists("issue_characters"):
            conn.execute("""
            INSERT INTO characters (cv_id, name)
            SELECT DISTINCT character_cv_id, 'Unknown Character ' || character_cv_id
            FROM issue_characters
            WHERE character_cv_id IS NOT NULL AND character_cv_id NOT IN (SELECT cv_id FROM characters)
            """)

        if table_exists("issue_persons"):
            conn.execute("""
            INSERT INTO persons (cv_id, name)
            SELECT DISTINCT person_cv_id, 'Unknown Person ' || person_cv_id
            FROM issue_persons
            WHERE person_cv_id IS NOT NULL AND person_cv_id NOT IN (SELECT cv_id FROM persons)
            """)

        if table_exists("issue_teams"):
            conn.execute("""
            INSERT INTO teams (cv_id, name)
            SELECT DISTINCT team_cv_id, 'Unknown Team ' || team_cv_id
            FROM issue_teams
            WHERE team_cv_id IS NOT NULL AND team_cv_id NOT IN (SELECT cv_id FROM teams)
            """)

        if table_exists("issue_locations"):
            conn.execute("""
            INSERT INTO locations (cv_id, name)
            SELECT DISTINCT location_cv_id, 'Unknown Location ' || location_cv_id
            FROM issue_locations
            WHERE location_cv_id IS NOT NULL AND location_cv_id NOT IN (SELECT cv_id FROM locations)
            """)

        if table_exists("issue_concepts"):
            conn.execute("""
            INSERT INTO concepts (cv_id, name)
            SELECT DISTINCT concept_cv_id, 'Unknown Concept ' || concept_cv_id
            FROM issue_concepts
            WHERE concept_cv_id IS NOT NULL AND concept_cv_id NOT IN (SELECT cv_id FROM concepts)
            """)

        if table_exists("issue_objects"):
            conn.execute("""
            INSERT INTO objects (cv_id, name)
            SELECT DISTINCT object_cv_id, 'Unknown Object ' || object_cv_id
            FROM issue_objects
            WHERE object_cv_id IS NOT NULL AND object_cv_id NOT IN (SELECT cv_id FROM objects)
            """)

        # Ensure all existing issues in relations exist in the issues table
        all_relation_tables = ["issue_characters", "issue_persons", "issue_teams", "issue_locations", "issue_concepts", "issue_objects"]
        existing_rel_tables = [t for t in all_relation_tables if table_exists(t)]
        if existing_rel_tables:
            union_query = " UNION ".join([f"SELECT issue_cv_id FROM {t}" for t in existing_rel_tables])
            conn.execute(f"""
            INSERT INTO issues (cv_id, name)
            SELECT DISTINCT issue_cv_id, 'Unknown Issue ' || issue_cv_id
            FROM ({union_query})
            WHERE issue_cv_id IS NOT NULL AND issue_cv_id NOT IN (SELECT cv_id FROM issues)
            """)

        # 3. Create new tables with correct internal ID columns and foreign keys
        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_characters_new (
            id           SERIAL PRIMARY KEY,
            issue_id     INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, character_id)
        )""")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_persons_new (
            id         SERIAL PRIMARY KEY,
            issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            person_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            role       TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, person_id, role)
        )""")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_teams_new (
            id         SERIAL PRIMARY KEY,
            issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, team_id)
        )""")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_locations_new (
            id          SERIAL PRIMARY KEY,
            issue_id    INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, location_id)
        )""")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_concepts_new (
            id         SERIAL PRIMARY KEY,
            issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, concept_id)
        )""")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_objects_new (
            id         SERIAL PRIMARY KEY,
            issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            object_id  INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(issue_id, object_id)
        )""")

        # 4. Migrating existing data into new tables
        if table_exists("issue_characters"):
            conn.execute("""
            INSERT INTO issue_characters_new (issue_id, character_id, created_at) SELECT i.id, c.id, ic.created_at
            FROM issue_characters ic
            JOIN issues i ON ic.issue_cv_id = i.cv_id
            JOIN characters c ON ic.character_cv_id = c.cv_id ON CONFLICT DO NOTHING
            """)

        if table_exists("issue_persons"):
            conn.execute("""
            INSERT INTO issue_persons_new (issue_id, person_id, role, created_at) SELECT i.id, p.id, ip.role, ip.created_at
            FROM issue_persons ip
            JOIN issues i ON ip.issue_cv_id = i.cv_id
            JOIN persons p ON ip.person_cv_id = p.cv_id ON CONFLICT DO NOTHING
            """)

        if table_exists("issue_teams"):
            conn.execute("""
            INSERT INTO issue_teams_new (issue_id, team_id, created_at) SELECT i.id, t.id, it.created_at
            FROM issue_teams it
            JOIN issues i ON it.issue_cv_id = i.cv_id
            JOIN teams t ON it.team_cv_id = t.cv_id ON CONFLICT DO NOTHING
            """)

        if table_exists("issue_locations"):
            conn.execute("""
            INSERT INTO issue_locations_new (issue_id, location_id, created_at) SELECT i.id, l.id, il.created_at
            FROM issue_locations il
            JOIN issues i ON il.issue_cv_id = i.cv_id
            JOIN locations l ON il.location_cv_id = l.cv_id ON CONFLICT DO NOTHING
            """)

        if table_exists("issue_concepts"):
            conn.execute("""
            INSERT INTO issue_concepts_new (issue_id, concept_id, created_at) SELECT i.id, c.id, ic.created_at
            FROM issue_concepts ic
            JOIN issues i ON ic.issue_cv_id = i.cv_id
            JOIN concepts c ON ic.concept_cv_id = c.cv_id ON CONFLICT DO NOTHING
            """)

        if table_exists("issue_objects"):
            conn.execute("""
            INSERT INTO issue_objects_new (issue_id, object_id, created_at) SELECT i.id, o.id, io.created_at
            FROM issue_objects io
            JOIN issues i ON io.issue_cv_id = i.cv_id
            JOIN objects o ON io.object_cv_id = o.cv_id ON CONFLICT DO NOTHING
            """)

        # 5. Drop old tables
        for t in all_relation_tables:
            conn.execute(f"DROP TABLE IF EXISTS {t}")

        # 6. Rename new tables to final names
        conn.execute("ALTER TABLE issue_characters_new RENAME TO issue_characters")
        conn.execute("ALTER TABLE issue_persons_new RENAME TO issue_persons")
        conn.execute("ALTER TABLE issue_teams_new RENAME TO issue_teams")
        conn.execute("ALTER TABLE issue_locations_new RENAME TO issue_locations")
        conn.execute("ALTER TABLE issue_concepts_new RENAME TO issue_concepts")
        conn.execute("ALTER TABLE issue_objects_new RENAME TO issue_objects")

        # 7. Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_char_issue ON issue_characters(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_char_char ON issue_characters(character_id)")
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_pers_issue ON issue_persons(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_pers_pers ON issue_persons(person_id)")
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_team_issue ON issue_teams(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_team_team ON issue_teams(team_id)")
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_loc_issue ON issue_locations(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_loc_loc ON issue_locations(location_id)")
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_conc_issue ON issue_concepts(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_conc_conc ON issue_concepts(concept_id)")
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_obj_issue ON issue_objects(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_obj_obj ON issue_objects(object_id)")

        conn.commit()
    finally:
        try:
            conn.execute("SET session_replication_role = 'origin'")
        except Exception:
            pass


# ── M046: add story_foreign_name to issue_reprints ───────────────────────
@migration("M046_reprints_story_foreign_name")
def m046_reprints_story_foreign_name(conn):
    try:
        conn.execute("ALTER TABLE issue_reprints ADD COLUMN story_foreign_name TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise


# ── M047: rebuild issue_reprints to remove FOREIGN KEY on story_id ─────────
@migration("M047_reprints_fk_rebuild")
def m047_reprints_fk_rebuild(conn):
    # ТЗ вимагає зберігати в story_id порядковий номер історії (0, 1, 2...),
    # через що зовнішній ключ на таблицю issue_stories(id) призводить до IntegrityError.
    # Перебудовуємо таблицю без цього зовнішнього ключа.
    try:
        conn.execute("SET session_replication_role = 'replica'")
    except Exception:
        pass
    try:
        # transaction handled by conn
        pass
        
        # 1. Створюємо нову таблицю без зовнішнього ключа для story_id
        conn.execute("""
        CREATE TABLE IF NOT EXISTS issue_reprints_new (
            id                 SERIAL PRIMARY KEY,
            original_id        INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            reprint_id         INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            story_id           INTEGER, -- Тепер це просто порядковий номер історії
            story_foreign_name TEXT,
            UNIQUE(original_id, reprint_id, story_id)
        )""")
        
        # 2. Переносимо наявні дані
        conn.execute("""
        INSERT OR IGNORE INTO issue_reprints_new (id, original_id, reprint_id, story_id, story_foreign_name)
        SELECT id, original_id, reprint_id, story_id, story_foreign_name
        FROM issue_reprints
        """)
        
        # 3. Видаляємо стару таблицю і перейменовуємо нову
        conn.execute("DROP TABLE IF EXISTS issue_reprints")
        conn.execute("ALTER TABLE issue_reprints_new RENAME TO issue_reprints")
        
        conn.commit()
    except Exception as error:
        conn.rollback()
        print(f"\033[91m[БД] Помилка в M047_reprints_fk_rebuild: {error}\033[0m")
        raise error
    finally:
        try:
            conn.execute("SET session_replication_role = 'origin'")
        except Exception:
            pass


# ── M048: characters updates & issue_characters team_id ─────────────────
@migration("M048_characters_updates")
def m048_characters_updates(conn):
    # 1. Add team_id to issue_characters
    try:
        conn.execute("ALTER TABLE issue_characters ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise
    
    # 2. Add name_uk to characters
    try:
        conn.execute("ALTER TABLE characters ADD COLUMN name_uk TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    # 3. Add creators to characters
    try:
        conn.execute("ALTER TABLE characters ADD COLUMN creators TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise# ── M049: real_name_uk for characters & name_uk for other entities ──────
@migration("M049_appearances_name_uk")
def m049_appearances_name_uk(conn):
    # 1. Add real_name_uk to characters
    try:
        conn.execute("ALTER TABLE characters ADD COLUMN real_name_uk TEXT")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise

    # 2. Add name_uk to teams, locations, concepts, objects
    tables = ["teams", "locations", "concepts", "objects"]
    for tbl in tables:
        try:
            conn.execute(f"ALTER TABLE {tbl} ADD COLUMN name_uk TEXT")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise


# ── M050: portrait and costume images for characters ─────────────────────
@migration("M050_characters_images")
def m050_characters_images(conn):
    columns = ["portret_img", "costume_img", "portret_costume_img"]
    for col in columns:
        try:
            conn.execute(f"ALTER TABLE characters ADD COLUMN {col} TEXT")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise


# ── M051: manga_magazines, magazine_issues, and magazine_issue_chapters ──
@migration("M051_manga_magazines")
def m051_manga_magazines(conn):
    # 1. Create manga_magazines table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS manga_magazines (
        id          SERIAL PRIMARY KEY,
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
    conn.execute("CREATE INDEX IF NOT EXISTS idx_manga_magazines_name ON manga_magazines(name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_manga_magazines_cv ON manga_magazines(cv_id)")

    # 2. Create magazine_issues table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS magazine_issues (
        id           SERIAL PRIMARY KEY,
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
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mag_issues_magazine ON magazine_issues(magazine_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mag_issues_cv ON magazine_issues(cv_id)")

    # 3. Create magazine_issue_chapters table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS magazine_issue_chapters (
        id                SERIAL PRIMARY KEY,
        magazine_issue_id INTEGER NOT NULL REFERENCES magazine_issues(id) ON DELETE CASCADE,
        manga_id          INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        manga_chapter_id  INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        order_num         INTEGER NOT NULL DEFAULT 0,
        label             TEXT CHECK(label IN ('lead', 'color', 'debut', 'final')),
        UNIQUE(magazine_issue_id, manga_chapter_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mic_mag_issue ON magazine_issue_chapters(magazine_issue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mic_manga ON magazine_issue_chapters(manga_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mic_chapter ON magazine_issue_chapters(manga_chapter_id)")

    # 4. Migrate existing manga magazines (volumes with theme 35 AND 36)
    # We select volumes that are connected to both theme 35 (Magazine) and 36 (Manga)
    # We select volumes that are connected to both theme 35 (Magazine) and 36 (Manga)
    # Cursor executes in raw connection, so RowFactory is not row by default. Let's use indices.
    # Select statement order:
    # 0: id, 1: cv_id, 2: cv_slug, 3: hikka_slug, 4: mal_id, 5: locg_id, 6: locg_slug,
    # 7: cv_img, 8: hikka_img, 9: cover_img, 10: name, 11: name_uk, 12: name_en, 13: name_native,
    # 14: synonyms, 15: publisher, 16: lang, 17: start_year
    magazines_to_migrate = conn.execute("""
        SELECT DISTINCT v.id, v.cv_id, v.cv_slug, v.cv_img, v.name, v.name_native, v.publisher, v.start_year FROM volumes v
        JOIN volume_themes vt1 ON v.id = vt1.volume_id
        JOIN volume_themes vt2 ON v.id = vt2.volume_id
        WHERE vt1.theme_id = 35 AND vt2.theme_id = 36
    """).fetchall()

    for mag in magazines_to_migrate:
        mag_id, cv_id, cv_slug, cv_img, name, name_native, publisher, start_year = mag
        # Check if already migrated
        existing = conn.execute("SELECT id FROM manga_magazines WHERE cv_id = %s OR name = %s", [cv_id, name]).fetchone()
        if existing:
            continue
        
        # Insert into manga_magazines
        cursor = conn.execute("""
            INSERT INTO manga_magazines (
                cv_id, cv_slug, image, name, name_native, publisher, start_year
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, [
            cv_id, cv_slug, cv_img, name, name_native, publisher, start_year
        ])
        new_mag_id = cursor.lastrowid

        # Migrate issues of this volume into magazine_issues
        # Selected columns: 0: id, 1: cv_id, 2: cv_slug, 3: cv_img, 4: release_date, 5: cover_date, 6: issue_number, 7: name, 8: pages
        issues_to_migrate = conn.execute("SELECT id, cv_id, cv_slug, cv_img, release_date, cover_date, issue_number, name, pages FROM issues WHERE volume_id = %s", [mag_id]).fetchall()
        for iss in issues_to_migrate:
            iss_id, iss_cv_id, iss_cv_slug, iss_cv_img, iss_release_date, iss_cover_date, iss_issue_number, iss_name, iss_pages = iss
            # Check if issue already exists in magazine_issues
            existing_iss = conn.execute("SELECT id FROM magazine_issues WHERE cv_id = %s", [iss_cv_id]).fetchone()
            if existing_iss:
                new_iss_id = existing_iss[0]
            else:
                cursor_iss = conn.execute("""
                    INSERT INTO magazine_issues (
                        cv_id, cv_slug, image, release_date, cover_date, issue_number, name, magazine_id, pages
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, [
                    iss_cv_id, iss_cv_slug, iss_cv_img, iss_release_date, iss_cover_date, iss_issue_number, iss_name, new_mag_id, iss_pages
                ])
                new_iss_id = cursor_iss.lastrowid

            # We can also migrate any links if they exist, but let's check magazine_chapters and volume_magazines
            # Select column indices for magazine_chapters: 0: id, 1: mag_issue_id, 2: issue_id, 3: sort_order
            chapters = conn.execute("SELECT id, mag_issue_id, issue_id, sort_order FROM magazine_chapters WHERE mag_issue_id = %s", [iss_id]).fetchall()
            for ch in chapters:
                ch_id, ch_mag_issue_id, ch_issue_id, ch_sort_order = ch
        # Find the volume / issue (manga / chapter)
                ch_issue = conn.execute("SELECT volume_id FROM issues WHERE id = %s", [ch_issue_id]).fetchone()
                if ch_issue and ch_issue[0]:
                    conn.execute("""
                        INSERT INTO magazine_issue_chapters (
                            magazine_issue_id, manga_id, manga_chapter_id, order_num
                        ) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING
                    """, [new_iss_id, ch_issue[0], ch_issue_id, ch_sort_order])


# ── M052: rebuild volume_magazines table ─────────────────────────────────
@migration("M052_rebuild_volume_magazines")
def m052_rebuild_volume_magazines(conn):
    try:
        conn.execute("SET session_replication_role = 'replica'")
    except Exception:
        pass
    try:
        # transaction handled by conn
        pass

        # 1. Create temporary table with new structure
        conn.execute("""
        CREATE TABLE IF NOT EXISTS volume_magazines_new (
            id          SERIAL PRIMARY KEY,
            magazine_id INTEGER NOT NULL REFERENCES manga_magazines(id) ON DELETE CASCADE,
            volume_id    INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
            UNIQUE(magazine_id, volume_id)
        )""")

        # 2. Migrate existing relations
        # We select relationships from old volume_magazines
        # Select order: 0: id, 1: magazine_id (old vol id), 2: child_id (manga vol id)
        relations = conn.execute("SELECT id, magazine_id, child_id FROM volume_magazines").fetchall()
        for rel in relations:
            rel_id, old_mag_vol_id, child_vol_id = rel
            
            # Find the new magazine_id (manga_magazines.id) by checking the name of the old magazine volume
            mag_vol_name = conn.execute("SELECT name FROM volumes WHERE id = %s", [old_mag_vol_id]).fetchone()
            if mag_vol_name and mag_vol_name[0]:
                new_mag = conn.execute("SELECT id FROM manga_magazines WHERE name = %s", [mag_vol_name[0]]).fetchone()
                if new_mag:
                    # Insert relation using new magazine_id and rename child_id to volume_id
                    conn.execute("""
                        INSERT INTO volume_magazines_new (magazine_id, volume_id) VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, [new_mag[0], child_vol_id])

        # 3. Drop old table and rename new table
        conn.execute("DROP TABLE IF EXISTS volume_magazines")
        conn.execute("ALTER TABLE volume_magazines_new RENAME TO volume_magazines")

        conn.commit()
    except Exception as error:
        conn.rollback()
        print(f"\033[91m[БД] Помилка в M052_rebuild_volume_magazines: {error}\033[0m")
        raise error
    finally:
        try:
            conn.execute("SET session_replication_role = 'origin'")
        except Exception:
            pass


# ── M053: таблиця manga_chapters ─────────────────────────────────────────
@migration("M053_manga_chapters")
def m053_manga_chapters(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS manga_chapters (
        id             SERIAL PRIMARY KEY,
        name           TEXT,
        name_native    TEXT,
        name_en        TEXT,
        name_uk        TEXT,
        image          TEXT,
        volume_id      INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
        chapter_number TEXT,
        release_date   TEXT,
        synopsis       TEXT,
        pages          INTEGER,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_manga_chapters_volume ON manga_chapters(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_manga_chapters_num ON manga_chapters(chapter_number)")


# ── M054: міграція випусків манґи у manga_chapters ────────────────────────
@migration("M054_migrate_manga_issues_to_chapters")
def m054_migrate_manga_issues_to_chapters(conn):
    # 1. Створення таблиці появ персонажів у розділах манґи
    conn.execute("""
    CREATE TABLE IF NOT EXISTS manga_chapter_characters (
        id           SERIAL PRIMARY KEY,
        chapter_id   INTEGER NOT NULL REFERENCES manga_chapters(id) ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        role         TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chapter_id, character_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mc_char_chapter ON manga_chapter_characters(chapter_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mc_char_character ON manga_chapter_characters(character_id)")

    # 3. Вибираємо всі випуски для цих томів
    issues = conn.execute("""
        SELECT * FROM issues 
        WHERE volume_id IN (
            SELECT DISTINCT v.id FROM volumes v
            LEFT JOIN volume_magazines vm ON v.id = vm.volume_id
            WHERE v.mal_id IS NOT NULL OR vm.id IS NOT NULL
        )
    """).fetchall()

    # Отримуємо назви колонок, щоб працювати як з dict
    col_names = [description[0] for description in conn.execute(f"SELECT * FROM issues LIMIT 1").description]
    
    for row in issues:
        issue = dict(zip(col_names, row))
        issue_id = issue["id"]
        
        # Вставляємо у manga_chapters
        cursor = conn.execute("""
            INSERT INTO manga_chapters (
                name, name_uk, image, volume_id,
                chapter_number, release_date, synopsis, pages
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            issue.get("name"),
            issue.get("name_uk"),
            issue.get("cv_img"),
            issue.get("volume_id"),
            issue.get("issue_number"),
            issue.get("release_date") or issue.get("cover_date"),
            issue.get("description"),
            issue.get("pages")
        ])
        
        new_chapter_id = cursor.lastrowid
        
        # Копіюємо появи персонажів
        conn.execute("""
            INSERT INTO manga_chapter_characters (chapter_id, character_id, role) SELECT %s, character_id, role FROM issue_characters WHERE issue_id = %s ON CONFLICT DO NOTHING
        """, [new_chapter_id, issue_id])
        
        # Видаляємо старий випуск
        conn.execute("DELETE FROM issues WHERE id = %s", [issue_id])


# ── M055: оновлення схеми collection_issues з підтримкою manga_chapter_id ──
@migration("M055_upgrade_collection_issues_schema")
def m055_upgrade_collection_issues_schema(conn):
    # 1. Створюємо нову таблицю
    conn.execute("""
    CREATE TABLE collection_issues_new (
        collection_id    INTEGER NOT NULL,
        issue_id         INTEGER NULL,
        manga_chapter_id INTEGER NULL,
        order_num        INTEGER NOT NULL DEFAULT 0,
        chapter_title    TEXT NULL,
        PRIMARY KEY (collection_id, order_num),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (manga_chapter_id) REFERENCES manga_chapters(id) ON DELETE CASCADE,
        CHECK (
            (issue_id IS NOT NULL AND manga_chapter_id IS NULL) OR
            (issue_id IS NULL AND manga_chapter_id IS NOT NULL)
        )
    )""")

    # 2. Копіюємо дані зі старої таблиці (всі існуючі зв'язки вважаємо зв'язками з issues,
    # але оскільки деякі з них після M054 вже були видалені з issues або мігровані,
    # нам треба перевірити, чи це був розділ манги)
    # Знайдемо, які томи є мангою, щоб у разі збігу перенести issue_id у manga_chapter_id.
    # Але оскільки в M054 ми вже перенесли випуски в manga_chapters,
    # нові ID у manga_chapters можуть відрізнятися від старих issue_id.
    # Проте, ми можемо перевірити, чи існують такі розділи в manga_chapters.
    
    rows = conn.execute("SELECT collection_id, issue_id, order_num, chapter_title FROM collection_issues").fetchall()
    for row in rows:
        col_id, old_issue_id, order, title = row
        
        # Перевіримо, чи це розділ манги (шукаємо відповідний розділ за id у manga_chapters)
        is_manga = conn.execute("SELECT 1 FROM manga_chapters WHERE id = %s", [old_issue_id]).fetchone() is not None
        
        if is_manga:
            conn.execute("""
                INSERT INTO collection_issues_new (collection_id, issue_id, manga_chapter_id, order_num, chapter_title) VALUES (%s, NULL, %s, %s, %s) ON CONFLICT DO NOTHING
            """, [col_id, old_issue_id, order, title])
        else:
            # Перевіримо, чи взагалі існує такий issue
            issue_exists = conn.execute("SELECT 1 FROM issues WHERE id = %s", [old_issue_id]).fetchone() is not None
            if issue_exists:
                conn.execute("""
                    INSERT INTO collection_issues_new (collection_id, issue_id, manga_chapter_id, order_num, chapter_title) VALUES (%s, %s, NULL, %s, %s) ON CONFLICT DO NOTHING
                """, [col_id, old_issue_id, order, title])
            else:
                # Якщо ніде немає, але це збірник манги, можемо спробувати пов'язати з manga_chapters
                # на випадок, якщо ID співпав
                conn.execute("""
                    INSERT INTO collection_issues_new (collection_id, issue_id, manga_chapter_id, order_num, chapter_title) VALUES (%s, %s, NULL, %s, %s) ON CONFLICT DO NOTHING
                """, [col_id, old_issue_id, order, title])

    # 3. Видаляємо стару таблицю
    conn.execute("DROP TABLE collection_issues")

    # 4. Перейменовуємо нову таблицю
    conn.execute("ALTER TABLE collection_issues_new RENAME TO collection_issues")

    # 5. Створюємо індекси для швидкодії
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_issues_collection ON collection_issues(collection_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_issues_issue ON collection_issues(issue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection_issues_manga ON collection_issues(manga_chapter_id)")


# ── M056: персонал та появи на рівні томів ──────────────────────────────
@migration("M056_volume_staff_and_characters")
def m056_volume_staff_and_characters(conn):
    try:
        conn.execute("ALTER TABLE characters ALTER COLUMN cv_id DROP NOT NULL")
    except Exception:
        pass
        
    for col, col_type in [("mal_id", "INTEGER UNIQUE"), ("hikka_slug", "TEXT")]:
        try:
            conn.execute(f"ALTER TABLE characters ADD COLUMN {col} {col_type}")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise

    # 6. Створюємо таблицю volume_characters
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_characters (
        id SERIAL PRIMARY KEY,
        volume_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        role TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(volume_id, character_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vol_char_volume ON volume_characters(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vol_char_character ON volume_characters(character_id)")
    
    # 7. Створюємо таблицю volume_persons
    conn.execute("""
    CREATE TABLE IF NOT EXISTS volume_persons (
        id SERIAL PRIMARY KEY,
        volume_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(volume_id, person_id, role)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vol_pers_volume ON volume_persons(volume_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vol_pers_person ON volume_persons(person_id)")
# ── M057: таблиця edit_requests ──────────────────────────────────────────
@migration("M057_edit_requests")
def m057_edit_requests(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS edit_requests (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        patch_data TEXT NOT NULL,
        comment TEXT,
        moderator_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        moderated_at TIMESTAMP,
        moderator_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(moderator_id) REFERENCES users(id) ON DELETE SET NULL
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_edit_req_entity ON edit_requests(entity_type, entity_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_edit_req_status ON edit_requests(status)")

# ── M058: таблиця user_preferences ───────────────────────────────────────
@migration("M058_user_preferences")
def m058_user_preferences(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id    INTEGER PRIMARY KEY,
        site_lang  TEXT DEFAULT 'uk',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")


# ── M059: таблиця оцінок та поле issues_count ─────────────────────────────
@migration("M059_ratings_and_readlist_count")
def m059_ratings_and_readlist_count(conn):
    # Додаємо таблицю оцінок
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_ratings (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('volume', 'issue', 'manga_chapter')),
        entity_id   INTEGER NOT NULL,
        rating      INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, entity_type, entity_id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_user_ratings_entity ON user_ratings(entity_type, entity_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_user_ratings_user ON user_ratings(user_id)")

    # Додаємо поле issues_count у таблицю user_volumes_readlist
    # (Примітка: в SQLite ALTER TABLE додасть поле, якщо воно не існує)
    try:
        conn.execute("ALTER TABLE user_volumes_readlist ADD COLUMN issues_count INTEGER DEFAULT NULL")
    except Exception as e:
        if "duplicate column" not in str(e) and "already exists" not in str(e):
            raise



# ── M060: синхронізація статусів томів на основі статусів їх випусків ──
@migration("M060_sync_volume_statuses_from_issues")
def m060_sync_volume_statuses_from_issues(conn):
    # Отримуємо унікальні пари (user_id, volume_id) з випусків користувачів
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT uir.user_id, i.volume_id 
        FROM user_issues_readlist uir
        JOIN issues i ON uir.issue_id = i.id
        WHERE i.volume_id IS NOT NULL
    """)
    pairs = cur.fetchall()
    
    for row in pairs:
        user_id = row["user_id"]
        volume_id = row["volume_id"]
        
        # Визначаємо статуси випусків цього тома
        cur.execute("""
            SELECT uir.list_name, COUNT(uir.id) as count
            FROM user_issues_readlist uir
            JOIN issues i ON uir.issue_id = i.id
            WHERE uir.user_id = %s AND i.volume_id = %s
            GROUP BY uir.list_name
        """, [user_id, volume_id])
        status_counts = {r["list_name"]: r["count"] for r in cur.fetchall()}
        
        if not status_counts:
            continue
            
        # Логіка визначення статусу:
        # 1. Якщо хоч один випуск має статус "Reading" (Читаю) -> том отримує "Reading"
        # 2. Якщо всі випуски мають статус "Completed" (Прочитано) -> том отримує "Completed"
        # 3. Якщо всі інші випуски мають статус "Planned" (Заплановано) -> том отримує "Planned"
        # 4. Якщо комбінація (наприклад, частина Completed, частина Planned) -> том отримує "Reading" (оскільки процес читання тома триває)
        
        target_status = "Planned"
        if "Reading" in status_counts or (len(status_counts) > 1):
            target_status = "Reading"
        elif "Completed" in status_counts and len(status_counts) == 1:
            # Отримуємо загальну кількість випусків тома
            cur.execute("SELECT COUNT(*) as total_issues FROM issues WHERE volume_id = %s", [volume_id])
            total_row = cur.fetchone()
            total_issues = total_row["total_issues"] if total_row else 0
            completed_count = status_counts.get("Completed", 0)
            
            if total_issues > 0 and completed_count >= total_issues:
                target_status = "Completed"
            else:
                target_status = "Reading"
        elif "Planned" in status_counts and len(status_counts) == 1:
            target_status = "Planned"
            
        # Перевіряємо, чи є вже запис у user_volumes_readlist
        cur.execute("""
            SELECT list_name FROM user_volumes_readlist 
            WHERE user_id = %s AND volume_id = %s
        """, [user_id, volume_id])
        existing = cur.fetchone()
        
        if existing:
            cur.execute("""
                UPDATE user_volumes_readlist SET list_name = %s 
                WHERE user_id = %s AND volume_id = %s
            """, [target_status, user_id, volume_id])
        else:
            cur.execute("""
                INSERT INTO user_volumes_readlist (user_id, list_name, volume_id) 
                VALUES (%s, %s, %s)
            """, [user_id, target_status, volume_id])
    cur.close()


# ── M061: score та level у users ─────────────────────────────────────────
@migration("M061_users_score_level")
def m061_users_score_level(conn):
    for col, definition in [("score", "INTEGER NOT NULL DEFAULT 0"), ("level", "SMALLINT NOT NULL DEFAULT 1")]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
        except Exception as e:
            if "duplicate column" not in str(e) and "already exists" not in str(e):
                raise


# ── M062: таблиця score_history ──────────────────────────────────────────
@migration("M062_score_history")
def m062_score_history(conn):
    conn.execute("""
    CREATE TABLE IF NOT EXISTS score_history (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta       INTEGER NOT NULL,
        reason      TEXT    NOT NULL,
        edit_id     INTEGER REFERENCES edit_requests(id) ON DELETE SET NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_score_history_edit ON score_history(edit_id)")


def apply_migrations(conn):
    ensure_migrations_table(conn)

    applied = []
    for migration_id, migration_fn in MIGRATIONS:
        if is_applied(conn, migration_id):
            continue

        try:
            migration_fn(conn)
            mark_applied(conn, migration_id)
            applied.append(migration_id)
        except Exception as error:
            # Ignore column already exists errors
            err_msg = str(error)
            if "duplicate column" in err_msg or "already exists" in err_msg:
                mark_applied(conn, migration_id)
            else:
                print(f"\033[91m[БД] Помилка міграції {migration_id}: {error}\033[0m")
                raise error

    conn.commit()
    if applied:
        print(f"\033[92m[БД] Застосовано міграції бази даних: {', '.join(applied)}\033[0m")
    else:
        print("\033[90m[БД] Міграції бази даних не потребують оновлення (актуальні)\033[0m")
