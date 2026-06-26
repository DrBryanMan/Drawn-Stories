import re
import time
import cloudscraper
from bs4 import BeautifulSoup
from fastapi import HTTPException
import sqlite3

# ── Cloudscraper instance creator ────────────────────
def create_scraper_instance():
    return cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
        delay=10
    )

def fetch_page(scraper, url, log_callback, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = scraper.get(url, timeout=30)
            if response.status_code == 200:
                return response.text
            log_callback(f"Помилка: статус {response.status_code} для {url}")
        except Exception as e:
            log_callback(f"Помилка завантаження (спроба {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(3)
    return None

# ── Link parsing helpers ─────────────────────────────
def extract_cv_id_from_href(href):
    match = re.search(r'/\d+-(\d+)/?$', href)
    return int(match.group(1)) if match else None

def extract_cv_slug_from_href(href):
    href = href.strip("/")
    parts = href.split("/")
    if len(parts) >= 1:
        return parts[0]
    return ""

def parse_simple_block(block):
    items = []
    for li in block.find_all('li'):
        a = li.find('a')
        if not a:
            continue
        href = a.get('href', '')
        cv_id = extract_cv_id_from_href(href)
        if cv_id:
            items.append({
                'cv_id': cv_id,
                'name': a.get_text(strip=True),
                'cv_slug': extract_cv_slug_from_href(href)
            })
    return items

def parse_creators_block(block):
    persons = []
    for li in block.find_all('li'):
        a = li.find('a')
        if not a:
            continue
        href = a.get('href', '')
        cv_id = extract_cv_id_from_href(href)
        if not cv_id:
            continue

        li_text = li.get_text(separator=' ', strip=True)
        a_text = a.get_text(strip=True)

        role_text = li_text.replace(a_text, '').strip().strip(',').strip()
        roles = [r.strip() for r in role_text.split(',') if r.strip()]
        if not roles:
            roles = ['unknown']

        persons.append({
            'cv_id': cv_id,
            'name': a_text,
            'cv_slug': extract_cv_slug_from_href(href),
            'roles': roles
        })
    return persons

def parse_issue_html(html):
    if not html:
        return None
    soup = BeautifulSoup(html, 'html.parser')
    result = {
        'characters': [],
        'teams': [],
        'locations': [],
        'concepts': [],
        'objects': [],
        'creators': []
    }
    BLOCK_MAP = {
        'Characters': 'characters',
        'Teams':      'teams',
        'Locations':  'locations',
        'Concepts':   'concepts',
        'Objects':    'objects',
        'Creators':   'creators',
    }
    blocks = soup.find_all('div', class_='wiki-details-object')
    for block in blocks:
        h3 = block.find('h3')
        if not h3:
            continue
        title = h3.get_text(strip=True)
        key = BLOCK_MAP.get(title)
        if not key:
            continue
        ul = block.find('ul', class_='wiki-relation')
        if not ul:
            continue
        if key == 'creators':
            result['creators'] = parse_creators_block(ul)
        else:
            result[key] = parse_simple_block(ul)
    
    total = sum(len(v) for v in result.values())
    return result if total > 0 else None

# ── Database entity helpers ──────────────────────────
def get_or_create_entity(db, table_name, cv_id, name, cv_slug):
    row = db.get_one(f"SELECT id FROM {table_name} WHERE cv_id = ?", [cv_id])
    if row:
        return row['id']
    
    db.execute(
        f"INSERT INTO {table_name} (cv_id, name, cv_slug) VALUES (?, ?, ?)",
        [cv_id, name, cv_slug]
    )
    new_row = db.get_one(f"SELECT id FROM {table_name} WHERE cv_id = ?", [cv_id])
    return new_row['id']

# ── Scraper services ─────────────────────────────────
def scrape_issue_appearances_logic(db, scraper, issue_id, log_callback):
    # 1. Get issue from DB
    issue = db.get_one("SELECT cv_id, cv_slug, name, issue_number FROM issues WHERE id = ?", [issue_id])
    if not issue:
        log_callback(f"Помилка: Випуск з ID {issue_id} не знайдено в БД.")
        return False

    cv_id = issue['cv_id']
    slug = issue['cv_slug'] or ''
    disp_name = f"#{issue['issue_number']} {issue['name'] or ''}".strip()
    
    log_callback(f"Початок скрапінгу для випуску {disp_name} (ID: {issue_id}, CV ID: {cv_id})")
    
    # 2. Build URL
    if slug:
        url = f"https://comicvine.gamespot.com/{slug}/4000-{cv_id}/"
    else:
        url = f"https://comicvine.gamespot.com/issue/4000-{cv_id}/"
        
    log_callback(f"Запит сторінки: {url}")
    
    # 3. Fetch page
    html = fetch_page(scraper, url, log_callback)
    if not html:
        log_callback("Помилка: Не вдалося завантажити сторінку з Comic Vine.")
        return False
        
    # 4. Parse html
    appearances = parse_issue_html(html)
    if not appearances:
        log_callback("Попередження: Появ на сторінці не знайдено.")
        # Clean up existing relations since there are none now
        db.execute("DELETE FROM issue_characters WHERE issue_id = ?", [issue_id])
        db.execute("DELETE FROM issue_persons WHERE issue_id = ?", [issue_id])
        db.execute("DELETE FROM issue_teams WHERE issue_id = ?", [issue_id])
        db.execute("DELETE FROM issue_locations WHERE issue_id = ?", [issue_id])
        db.execute("DELETE FROM issue_concepts WHERE issue_id = ?", [issue_id])
        db.execute("DELETE FROM issue_objects WHERE issue_id = ?", [issue_id])
        return True

    # 5. Process and insert each type
    totals = {}
    
    # Characters
    db.execute("DELETE FROM issue_characters WHERE issue_id = ?", [issue_id])
    added_chars = 0
    for char in appearances['characters']:
        try:
            char_id = get_or_create_entity(db, 'characters', char['cv_id'], char['name'], char['cv_slug'])
            db.execute("INSERT OR IGNORE INTO issue_characters (issue_id, character_id, story_num) VALUES (?, ?, 0)", [issue_id, char_id])
            added_chars += 1
        except Exception as e:
            log_callback(f"Помилка збереження персонажа {char['name']}: {e}")
    totals['characters'] = added_chars

    # Creators (persons)
    db.execute("DELETE FROM issue_persons WHERE issue_id = ?", [issue_id])
    added_persons = 0
    for creator in appearances['creators']:
        try:
            person_id = get_or_create_entity(db, 'persons', creator['cv_id'], creator['name'], creator['cv_slug'])
            for role in creator['roles']:
                db.execute("INSERT OR IGNORE INTO issue_persons (issue_id, person_id, role) VALUES (?, ?, ?)", [issue_id, person_id, role])
                added_persons += 1
        except Exception as e:
            log_callback(f"Помилка збереження творця {creator['name']}: {e}")
    totals['creators'] = added_persons

    # Teams
    db.execute("DELETE FROM issue_teams WHERE issue_id = ?", [issue_id])
    added_teams = 0
    for team in appearances['teams']:
        try:
            team_id = get_or_create_entity(db, 'teams', team['cv_id'], team['name'], team['cv_slug'])
            db.execute("INSERT OR IGNORE INTO issue_teams (issue_id, team_id, story_num) VALUES (?, ?, 0)", [issue_id, team_id])
            added_teams += 1
        except Exception as e:
            log_callback(f"Помилка збереження команди {team['name']}: {e}")
    totals['teams'] = added_teams

    # Locations
    db.execute("DELETE FROM issue_locations WHERE issue_id = ?", [issue_id])
    added_locations = 0
    for loc in appearances['locations']:
        try:
            loc_id = get_or_create_entity(db, 'locations', loc['cv_id'], loc['name'], loc['cv_slug'])
            db.execute("INSERT OR IGNORE INTO issue_locations (issue_id, location_id, story_num) VALUES (?, ?, 0)", [issue_id, loc_id])
            added_locations += 1
        except Exception as e:
            log_callback(f"Помилка збереження локації {loc['name']}: {e}")
    totals['locations'] = added_locations

    # Concepts
    db.execute("DELETE FROM issue_concepts WHERE issue_id = ?", [issue_id])
    added_concepts = 0
    for conc in appearances['concepts']:
        try:
            conc_id = get_or_create_entity(db, 'concepts', conc['cv_id'], conc['name'], conc['cv_slug'])
            db.execute("INSERT OR IGNORE INTO issue_concepts (issue_id, concept_id, story_num) VALUES (?, ?, 0)", [issue_id, conc_id])
            added_concepts += 1
        except Exception as e:
            log_callback(f"Помилка збереження концепту {conc['name']}: {e}")
    totals['concepts'] = added_concepts

    # Objects
    db.execute("DELETE FROM issue_objects WHERE issue_id = ?", [issue_id])
    added_objects = 0
    for obj in appearances['objects']:
        try:
            obj_id = get_or_create_entity(db, 'objects', obj['cv_id'], obj['name'], obj['cv_slug'])
            db.execute("INSERT OR IGNORE INTO issue_objects (issue_id, object_id, story_num) VALUES (?, ?, 0)", [issue_id, obj_id])
            added_objects += 1
        except Exception as e:
            log_callback(f"Помилка збереження об'єкта {obj['name']}: {e}")
    totals['objects'] = added_objects

    log_callback(f"Успішно збережено: персонажів: {totals['characters']}, творців (ролей): {totals['creators']}, команд: {totals['teams']}, локацій: {totals['locations']}, концептів: {totals['concepts']}, об'єктів: {totals['objects']}")
    return True

def scrape_volume_appearances_logic(db, scraper, volume_id, log_callback):
    # 1. Get volume details
    vol = db.get_one("SELECT name, name_uk FROM volumes WHERE id = ?", [volume_id])
    if not vol:
        log_callback(f"Помилка: Том з ID {volume_id} не знайдено.")
        return False
        
    vol_name = vol['name_uk'] or vol['name']
    log_callback(f"Початок скрапінгу появ для тому '{vol_name}' (ID: {volume_id})")
    
    # 2. Get all issues of the volume
    issues = db.get_all(
        "SELECT id, issue_number, name FROM issues WHERE volume_id = ? ORDER BY CAST(issue_number AS REAL) ASC, issue_number ASC",
        [volume_id]
    )
    
    if not issues:
        log_callback("Попередження: У цьому томі немає випусків для обробки.")
        return True
        
    log_callback(f"Знайдено випусків для обробки: {len(issues)}")
    log_callback("----------------------------------------")
    
    success_count = 0
    for idx, issue in enumerate(issues, 1):
        disp_name = f"#{issue['issue_number']} {issue['name'] or ''}".strip()
        log_callback(f"[{idx}/{len(issues)}] Обробка випуску {disp_name}...")
        
        # Run issue scrape logic
        res = scrape_issue_appearances_logic(db, scraper, issue['id'], log_callback)
        if res:
            success_count += 1
            
        log_callback("----------------------------------------")
        
        # Delay to avoid rate-limiting
        if idx < len(issues):
            time.sleep(2.0)
            
    log_callback(f"Завершено обробку тому! Успішно оброблено випусків: {success_count} з {len(issues)}.")
    return True
