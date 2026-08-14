import re
import time
import os
import json
import cloudscraper
from bs4 import BeautifulSoup
from fastapi import HTTPException

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
    row = db.get_one(f"SELECT id FROM {table_name} WHERE cv_id = %s", [cv_id])
    if row:
        return row['id']
    
    db.execute(
        f"INSERT INTO {table_name} (cv_id, name, cv_slug) VALUES (%s, %s, %s)",
        [cv_id, name, cv_slug]
    )
    new_row = db.get_one(f"SELECT id FROM {table_name} WHERE cv_id = %s", [cv_id])
    return new_row['id']


# ── HTML parser helpers ──────────────────────────────
def extract_image_path(image_url):
    if not image_url:
        return None
    match = re.search(r'/(?:uploads/|a/uploads/)?(?:[a-zA-Z0-9_]+/)?(\d+/\d+/[^/\s?#]+(?:\.(?:jpg|jpeg|png|gif|webp))?)', image_url)
    if match:
        return f"/{match.group(1)}"
    match2 = re.search(r'(\d+/\d+/[^/\s?#]+)', image_url)
    return f"/{match2.group(1)}" if match2 else image_url


def parse_gender(gender_str):
    if not gender_str:
        return None
    g = gender_str.strip().lower()
    if g in ("male", "чоловіча"):
        return 1
    if g in ("female", "жіноча"):
        return 2
    return 0


def parse_character_html(html, cv_id, default_name="", default_slug=""):
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    
    img_el = soup.select_one(".wiki-hdr .wiki-boxart img")
    img_src = img_el.get("src") if img_el else None
    image_path = extract_image_path(img_src)

    table = soup.select_one("aside.secondary-content .wiki-details .table, aside.secondary-content table, .wiki-details table")
    fields = {}
    links_map = {}
    
    if table:
        for row in table.find_all("tr"):
            th = row.find(["th", "td", "span"], class_=lambda c: c and ("field-label" in c or "label" in c)) or row.find("th")
            td = row.find("td")
            if not th or not td:
                continue
            th_text = th.get_text(strip=True).lower()
            display_el = td.find(class_=lambda c: c and "wiki-item-display" in c) or td
            val_text = display_el.get_text("\n", strip=True)
            fields[th_text] = val_text
            
            links = []
            for a in td.find_all("a"):
                href = a.get("href", "")
                if href:
                    links.append({"text": a.get_text(strip=True), "href": href})
            links_map[th_text] = links

    name = fields.get("super name") or fields.get("name") or default_name
    real_name = fields.get("real name") or None
    
    raw_aliases = fields.get("aliases", "")
    aliases_list = [line.strip() for line in raw_aliases.split("\n") if line.strip() and line.strip().lower() != "none"]
    aliases_json = json.dumps(aliases_list, ensure_ascii=False) if aliases_list else None

    gender = parse_gender(fields.get("gender"))
    origin = fields.get("character type") or None

    birth = fields.get("birthday") or fields.get("birth")
    if birth and birth.strip().lower() in ("n/a", "none", ""):
        birth = None

    pub_cv_id = None
    pub_name = None
    pub_links = links_map.get("publisher", [])
    if pub_links:
        m = re.search(r'/4010-(\d+)/?$', pub_links[0]["href"])
        if m:
            pub_cv_id = int(m.group(1))
            pub_name = pub_links[0]["text"]

    first_app_cv_id = None
    fa_links = links_map.get("first appearance", [])
    if fa_links:
        m = re.search(r'/4000-(\d+)/?$', fa_links[0]["href"])
        if m:
            first_app_cv_id = int(m.group(1))

    return {
        "cv_id": cv_id,
        "name": name,
        "real_name": real_name,
        "cv_slug": default_slug,
        "image": image_path,
        "aliases": aliases_json,
        "gender": gender,
        "origin": origin,
        "birth": birth,
        "publisher_cv_id": pub_cv_id,
        "publisher_name": pub_name,
        "first_app_cv_id": first_app_cv_id
    }


def parse_person_html(html, cv_id, default_name="", default_slug=""):
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    
    img_el = soup.select_one(".wiki-hdr .wiki-boxart img")
    img_src = img_el.get("src") if img_el else None
    image_path = extract_image_path(img_src)

    table = soup.select_one("aside.secondary-content .wiki-details .table, aside.secondary-content table, .wiki-details table")
    fields = {}
    links_map = {}
    
    if table:
        for row in table.find_all("tr"):
            th = row.find(["th", "td", "span"], class_=lambda c: c and ("field-label" in c or "label" in c)) or row.find("th")
            td = row.find("td")
            if not th or not td:
                continue
            th_text = th.get_text(strip=True).lower()
            display_el = td.find(class_=lambda c: c and "wiki-item-display" in c) or td
            val_text = display_el.get_text("\n", strip=True)
            fields[th_text] = val_text
            
            links = []
            for a in td.find_all("a"):
                href = a.get("href", "")
                if href:
                    links.append({"text": a.get_text(strip=True), "href": href})
            links_map[th_text] = links

    name = fields.get("name") or default_name
    gender = parse_gender(fields.get("gender"))

    birth = fields.get("birth")
    if birth and birth.strip().lower() in ("n/a", "none", ""):
        birth = None
    death = fields.get("death")
    if death and death.strip().lower() in ("n/a", "none", ""):
        death = None

    hometown = fields.get("town") or fields.get("hometown") or None
    if hometown and hometown.strip().lower() in ("n/a", "none", ""):
        hometown = None

    country = fields.get("country") or None
    if country and country.strip().lower() in ("n/a", "none", ""):
        country = None

    website = fields.get("website") or None
    web_links = links_map.get("website", [])
    if web_links and web_links[0]["href"]:
        website = web_links[0]["href"]
    if website and website.strip().lower() in ("n/a", "none", "", "http://", "https://"):
        website = None

    raw_aliases = fields.get("aliases", "")
    aliases_list = [line.strip() for line in raw_aliases.split("\n") if line.strip() and line.strip().lower() != "none"]
    aliases_json = json.dumps(aliases_list, ensure_ascii=False) if aliases_list else None

    return {
        "cv_id": cv_id,
        "name": name,
        "cv_slug": default_slug,
        "image": image_path,
        "aliases": aliases_json,
        "gender": gender,
        "birth": birth,
        "death": death,
        "hometown": hometown,
        "country": country,
        "website": website
    }


def get_or_create_character(db, scraper, cv_id, default_name, default_cv_slug, log_callback):
    row = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
    if row:
        return row['id']

    log_callback(f"Персонажа '{default_name}' (CV ID: {cv_id}) немає в базі. Скрапінг сторінки ComicVine...")
    slug = default_cv_slug or 'character'
    url = f"https://comicvine.gamespot.com/{slug}/4005-{cv_id}/"

    try:
        html = fetch_page(scraper, url, log_callback, max_retries=2)
        char_data = parse_character_html(html, cv_id, default_name, default_cv_slug) if html else None

        if char_data:
            # 1. Resolve publisher
            publisher_id = None
            if char_data["publisher_cv_id"]:
                pub_cv_id = char_data["publisher_cv_id"]
                pub_name = char_data["publisher_name"] or "Unknown Publisher"
                pub_row = db.get_one("SELECT id FROM publishers WHERE cv_id = %s", [pub_cv_id])
                if pub_row:
                    publisher_id = pub_row["id"]
                else:
                    db.execute("INSERT INTO publishers (cv_id, name) VALUES (%s, %s)", [pub_cv_id, pub_name])
                    new_pub = db.get_one("SELECT id FROM publishers WHERE cv_id = %s", [pub_cv_id])
                    publisher_id = new_pub["id"] if new_pub else None

            # 2. Resolve first appearance (пошук issues.id за cv_id випуску)
            first_app_id = None
            if char_data["first_app_cv_id"]:
                fa_cv_id = char_data["first_app_cv_id"]
                iss_row = db.get_one("SELECT id FROM issues WHERE cv_id = %s", [fa_cv_id])
                if iss_row:
                    first_app_id = iss_row["id"]

            db.execute(
                """
                INSERT INTO characters (
                    cv_id, name, real_name, cv_slug, image, aliases, birth, gender, origin, first_appearance, publisher
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    cv_id,
                    char_data["name"],
                    char_data["real_name"],
                    char_data["cv_slug"],
                    char_data["image"],
                    char_data["aliases"],
                    char_data["birth"],
                    char_data["gender"],
                    char_data["origin"],
                    first_app_id,
                    publisher_id
                ]
            )
            new_char = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
            log_callback(f"Персонажа '{char_data['name']}' успішно зіскраплено та додано в БД!")
            return new_char["id"]
    except Exception as e:
        log_callback(f"Помилка скрапінгу персонажа {default_name}: {e}")

    # Fallback
    db.execute(
        "INSERT INTO characters (cv_id, name, cv_slug) VALUES (%s, %s, %s)",
        [cv_id, default_name, default_cv_slug]
    )
    new_char = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
    return new_char["id"]


def get_or_create_person(db, scraper, cv_id, default_name, default_cv_slug, log_callback):
    row = db.get_one("SELECT id FROM persons WHERE cv_id = %s", [cv_id])
    if row:
        return row['id']

    log_callback(f"Творця '{default_name}' (CV ID: {cv_id}) немає в базі. Скрапінг сторінки ComicVine...")
    slug = default_cv_slug or 'person'
    url = f"https://comicvine.gamespot.com/{slug}/4040-{cv_id}/"

    try:
        html = fetch_page(scraper, url, log_callback, max_retries=2)
        person_data = parse_person_html(html, cv_id, default_name, default_cv_slug) if html else None

        if person_data:
            db.execute(
                """
                INSERT INTO persons (
                    cv_id, name, cv_slug, image, aliases, gender, birth, death, hometown, country, website
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    cv_id,
                    person_data["name"],
                    person_data["cv_slug"],
                    person_data["image"],
                    person_data["aliases"],
                    person_data["gender"],
                    person_data["birth"],
                    person_data["death"],
                    person_data["hometown"],
                    person_data["country"],
                    person_data["website"]
                ]
            )
            new_person = db.get_one("SELECT id FROM persons WHERE cv_id = %s", [cv_id])
            log_callback(f"Творця '{person_data['name']}' успішно зіскраплено та додано в БД!")
            return new_person["id"]
    except Exception as e:
        log_callback(f"Помилка скрапінгу творця {default_name}: {e}")

    # Fallback
    db.execute(
        "INSERT INTO persons (cv_id, name, cv_slug) VALUES (%s, %s, %s)",
        [cv_id, default_name, default_cv_slug]
    )
    new_person = db.get_one("SELECT id FROM persons WHERE cv_id = %s", [cv_id])
    return new_person["id"]


# ── Scraper services ─────────────────────────────────
def scrape_issue_appearances_logic(db, scraper, issue_id, log_callback):
    # 1. Get issue from DB
    issue = db.get_one("SELECT id, volume_id, cv_id, cv_slug, name, issue_number FROM issues WHERE id = %s", [issue_id])
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
        db.execute("DELETE FROM issue_characters WHERE issue_id = %s", [issue_id])
        db.execute("DELETE FROM issue_persons WHERE issue_id = %s", [issue_id])
        db.execute("DELETE FROM issue_teams WHERE issue_id = %s", [issue_id])
        db.execute("DELETE FROM issue_locations WHERE issue_id = %s", [issue_id])
        db.execute("DELETE FROM issue_concepts WHERE issue_id = %s", [issue_id])
        db.execute("DELETE FROM issue_objects WHERE issue_id = %s", [issue_id])
        return True

    # 5. Process and insert each type
    totals = {}
    
    # Characters
    db.execute("DELETE FROM issue_characters WHERE issue_id = %s", [issue_id])
    added_chars = 0
    volume_id = issue.get('volume_id')
    for char in appearances['characters']:
        try:
            char_id = get_or_create_character(db, scraper, char['cv_id'], char['name'], char['cv_slug'], log_callback)
            db.execute("INSERT INTO issue_characters (issue_id, character_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, char_id])
            if volume_id:
                db.execute(
                    "INSERT INTO volume_characters (volume_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [volume_id, char_id, 'minor']
                )
            added_chars += 1
        except Exception as e:
            log_callback(f"Помилка збереження персонажа {char['name']}: {e}")
    totals['characters'] = added_chars

    # Creators (persons)
    db.execute("DELETE FROM issue_persons WHERE issue_id = %s", [issue_id])
    added_persons = 0
    for creator in appearances['creators']:
        try:
            person_id = get_or_create_person(db, scraper, creator['cv_id'], creator['name'], creator['cv_slug'], log_callback)
            for role in creator['roles']:
                db.execute("INSERT INTO issue_persons (issue_id, person_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING", [issue_id, person_id, role])
                added_persons += 1
        except Exception as e:
            log_callback(f"Помилка збереження творця {creator['name']}: {e}")
    totals['creators'] = added_persons

    # Teams
    db.execute("DELETE FROM issue_teams WHERE issue_id = %s", [issue_id])
    added_teams = 0
    for team in appearances['teams']:
        try:
            team_id = get_or_create_entity(db, 'teams', team['cv_id'], team['name'], team['cv_slug'])
            db.execute("INSERT INTO issue_teams (issue_id, team_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, team_id])
            added_teams += 1
        except Exception as e:
            log_callback(f"Помилка збереження команди {team['name']}: {e}")
    totals['teams'] = added_teams

    # Locations
    db.execute("DELETE FROM issue_locations WHERE issue_id = %s", [issue_id])
    added_locations = 0
    for loc in appearances['locations']:
        try:
            loc_id = get_or_create_entity(db, 'locations', loc['cv_id'], loc['name'], loc['cv_slug'])
            db.execute("INSERT INTO issue_locations (issue_id, location_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, loc_id])
            added_locations += 1
        except Exception as e:
            log_callback(f"Помилка збереження локації {loc['name']}: {e}")
    totals['locations'] = added_locations

    # Concepts
    db.execute("DELETE FROM issue_concepts WHERE issue_id = %s", [issue_id])
    added_concepts = 0
    for conc in appearances['concepts']:
        try:
            conc_id = get_or_create_entity(db, 'concepts', conc['cv_id'], conc['name'], conc['cv_slug'])
            db.execute("INSERT INTO issue_concepts (issue_id, concept_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, conc_id])
            added_concepts += 1
        except Exception as e:
            log_callback(f"Помилка збереження концепту {conc['name']}: {e}")
    totals['concepts'] = added_concepts

    # Objects
    db.execute("DELETE FROM issue_objects WHERE issue_id = %s", [issue_id])
    added_objects = 0
    for obj in appearances['objects']:
        try:
            obj_id = get_or_create_entity(db, 'objects', obj['cv_id'], obj['name'], obj['cv_slug'])
            db.execute("INSERT INTO issue_objects (issue_id, object_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, obj_id])
            added_objects += 1
        except Exception as e:
            log_callback(f"Помилка збереження об'єкта {obj['name']}: {e}")
    totals['objects'] = added_objects

    log_callback(f"Успішно збережено: персонажів: {totals['characters']}, творців (ролей): {totals['creators']}, команд: {totals['teams']}, локацій: {totals['locations']}, концептів: {totals['concepts']}, об'єктів: {totals['objects']}")
    return True

def scrape_volume_appearances_logic(db, scraper, volume_id, log_callback):
    # 1. Get volume details
    vol = db.get_one("SELECT name, name_uk FROM volumes WHERE id = %s", [volume_id])
    if not vol:
        log_callback(f"Помилка: Том з ID {volume_id} не знайдено.")
        return False
        
    vol_name = vol['name_uk'] or vol['name']
    log_callback(f"Початок скрапінгу появ для тому '{vol_name}' (ID: {volume_id})")
    
    # 2. Get all issues of the volume
    issues = db.get_all(
        "SELECT id, issue_number, name FROM issues WHERE volume_id = %s ORDER BY CAST(issue_number AS REAL) ASC, issue_number ASC",
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


def scrape_manga_characters_logic(db, volume_id, log_callback):
    import urllib.request
    import urllib.error
    import json
    import time

    # 1. Отримуємо дані тому
    vol = db.get_one("SELECT name, name_uk, mal_id FROM volumes WHERE id = %s", [volume_id])
    if not vol:
        log_callback(f"Помилка: Том з ID {volume_id} не знайдено.")
        return False

    mal_id = vol.get("mal_id")
    vol_name = vol['name_uk'] or vol['name']
    
    if not mal_id:
        log_callback(f"Помилка: У тому '{vol_name}' відсутній MAL ID.")
        return False

    log_callback(f"Початок парсингу персонажів для тому '{vol_name}' (ID: {volume_id}, MAL ID: {mal_id})")
    
    url = f"https://api.jikan.moe/v4/manga/{mal_id}/characters"
    log_callback(f"Запит до API Jikan: {url}")
    
    # 2. Виконуємо HTTP запит
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            if response.status == 200:
                res_data = json.loads(response.read().decode('utf-8'))
            else:
                log_callback(f"Помилка: Неочікувана відповідь сервера (Код: {response.status})")
                return False
    except urllib.error.HTTPError as he:
        log_callback(f"Помилка HTTP під час запиту до Jikan: {he.code} {he.reason}")
        if he.code == 429:
            log_callback("Спробуйте пізніше (Jikan API обмеження запитів).")
        return False
    except Exception as e:
        log_callback(f"Помилка мережі/з'єднання: {e}")
        return False

    characters_list = res_data.get("data", [])
    if not characters_list:
        log_callback("Попередження: Не знайдено персонажів для цієї манґи в MAL.")
        db.conn.execute("DELETE FROM volume_characters WHERE volume_id = %s", [volume_id])
        db.conn.commit()
        return True

    log_callback(f"Отримано персонажів з API: {len(characters_list)}")
    
    try:
        db.conn.execute("BEGIN TRANSACTION")
        
        # Видаляємо існуючі зв'язки для цього тому
        db.conn.execute("DELETE FROM volume_characters WHERE volume_id = %s", [volume_id])
        
        added_count = 0
        
        for item in characters_list:
            char_data = item.get("character")
            if not char_data:
                continue
                
            mal_char_id = char_data.get("mal_id")
            char_name = char_data.get("name")
            
            if not mal_char_id or not char_name:
                continue
                
            # Очищуємо ім'я від коми (Lastname, Firstname -> Lastname Firstname)
            if char_name and "," in char_name:
                char_name = char_name.replace(",", "").strip()
                
            # Отримуємо роль та нормалізуємо
            raw_role = item.get("role") or "Supporting"
            role = "main" if raw_role.lower() == "main" else "supporting"
            
            # Отримуємо зображення (webp переважно)
            images = char_data.get("images") or {}
            webp_url = images.get("webp", {}).get("image_url")
            jpg_url = images.get("jpg", {}).get("image_url")
            image_url = webp_url or jpg_url
            
            # Робимо запит до Hikka API по mal_id
            hikka_slug = None
            name_native = None
            name_uk = None
            
            HIKKA_CHARACTER_API_URL = ""
            if HIKKA_CHARACTER_API_URL and mal_char_id:
                try:
                    import urllib.request
                    import json
                    hikka_url = f"{HIKKA_CHARACTER_API_URL}/{mal_char_id}"
                    req_hikka = urllib.request.Request(
                        hikka_url,
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    with urllib.request.urlopen(req_hikka, timeout=5) as resp_hikka:
                        if resp_hikka.status == 200:
                            h_data = json.loads(resp_hikka.read().decode('utf-8'))
                            hikka_slug = h_data.get("hikka_slug") or h_data.get("slug")
                            name_native = h_data.get("name_ja") or h_data.get("name_native")
                            name_uk = h_data.get("name_ua") or h_data.get("name_uk")
                except Exception as ex:
                    log_callback(f"Помилка запиту до Hikka API для MAL ID {mal_char_id}: {ex}")

            # Шукаємо персонажа в БД
            char_row = db.get_one("SELECT id, name FROM characters WHERE mal_id = %s LIMIT 1", [mal_char_id])
            
            if char_row:
                char_db_id = char_row["id"]
                db_name = char_row["name"]
                
                updates = []
                params = []
                
                # Перевіряємо кому в імені вже наявного персонажа
                cleaned_db_name = db_name
                if db_name and "," in db_name:
                    cleaned_db_name = db_name.replace(",", "").strip()
                    
                if cleaned_db_name != db_name:
                    updates.append("name = ?")
                    params.append(cleaned_db_name)
                elif char_name != db_name:
                    updates.append("name = ?")
                    params.append(char_name)
                    
                if image_url:
                    updates.append("image = ?")
                    params.append(image_url)
                if hikka_slug:
                    updates.append("hikka_slug = ?")
                    params.append(hikka_slug)
                if name_native:
                    updates.append("name_native = ?")
                    params.append(name_native)
                if name_uk:
                    updates.append("name_uk = ?")
                    params.append(name_uk)
                    
                if updates:
                    params.append(char_db_id)
                    db.conn.execute(
                        f"UPDATE characters SET {', '.join(updates)} WHERE id = %s",
                        params
                    )
                    log_callback(f"Оновлено персонажа '{char_name}' в БД (ID: {char_db_id}).")
                else:
                    log_callback(f"Персонаж '{char_name}' вже існує в БД (ID: {char_db_id}). Використовуємо його.")
            else:
                # Створюємо нового персонажа
                cursor = db.conn.execute(
                    """
                    INSERT INTO characters (name, mal_id, image, hikka_slug, name_native, name_uk)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    [char_name, mal_char_id, image_url, hikka_slug, name_native, name_uk]
                )
                char_db_id = cursor.fetchone()["id"]
                log_callback(f"Створено нового персонажа '{char_name}' (MAL ID: {mal_char_id}) в БД (ID: {char_db_id}).")
            
            # Зв'язуємо з томом
            db.conn.execute(
                """
                INSERT INTO volume_characters (volume_id, character_id, role)
                VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
                """,
                [volume_id, char_db_id, role]
            )
            added_count += 1
            
        db.conn.commit()
        log_callback(f"Успішно імпортовано та пов'язано з томом: {added_count} персонажів.")
        return True
        
    except Exception as e:
        db.conn.rollback()
        log_callback(f"Помилка під час транзакції в БД: {e}")
        return False


def scrape_hikka_characters_logic(db, volume_id: int, log_callback) -> bool:
    """
    Парсить персонажів з Hikka API для тому volume_id,
    використовуючи єдину спільну логіку з server.scripts.hikka_characters_parser.
    """
    from server.scripts.hikka_characters_parser import scrape_hikka_characters_for_volume
    return scrape_hikka_characters_for_volume(db, volume_id, log_callback=log_callback)


def scrape_hikka_authors_logic(db, volume_id: int, log_callback) -> bool:
    """
    Парсить авторів з Hikka API для тому volume_id,
    використовуючи єдину спільну логіку з server.scripts.hikka_authors_parser.
    """
    from server.scripts.hikka_authors_parser import scrape_hikka_authors_for_volume
    return scrape_hikka_authors_for_volume(db, volume_id, log_callback=log_callback)


def scrape_character_images_logic(db, scraper, log_callback) -> bool:
    """
    Повторно скрапить зображення персонажів з ComicVine за селектором
    .imgboxart img, .wiki-image img для всіх персонажів з cv_id.
    """
    characters = db.get_all(
        "SELECT id, cv_id, cv_slug, name, image FROM characters WHERE cv_id IS NOT NULL ORDER BY id"
    )
    total = len(characters)
    if total == 0:
        log_callback("Не знайдено персонажів з ComicVine ID в базі даних.")
        return True

    log_callback(f"[SYSTEM] Початок оновлення зображень: знайдено {total} персонажів з ComicVine ID...")

    updated_count = 0
    unchanged_count = 0
    not_found_count = 0
    error_count = 0

    for idx, char in enumerate(characters, 1):
        char_id = char["id"]
        cv_id = char["cv_id"]
        cv_slug = char["cv_slug"] or "character"
        char_name = char["name"] or f"Character #{char_id}"
        current_img = char["image"]

        url = f"https://comicvine.gamespot.com/{cv_slug}/4005-{cv_id}/"
        log_callback(f"[{idx}/{total}] Скрапінг '{char_name}' (CV ID: {cv_id})...")

        try:
            html = fetch_page(scraper, url, log_callback, max_retries=2)
            if not html:
                log_callback(f"  [x] Не вдалося завантажити сторінку для '{char_name}'")
                error_count += 1
                time.sleep(1.0)
                continue

            soup = BeautifulSoup(html, "html.parser")
            img_el = soup.select_one(".imgboxart img, .wiki-image img")
            if not img_el:
                log_callback(f"  [-] Зображення (.imgboxart img, .wiki-image img) не знайдено для '{char_name}'")
                not_found_count += 1
                time.sleep(1.0)
                continue

            img_src = img_el.get("src")
            new_image_path = extract_image_path(img_src)

            if not new_image_path:
                log_callback(f"  [-] Не вдалося розпізнати шлях зображення з '{img_src}'")
                not_found_count += 1
                time.sleep(1.0)
                continue

            if new_image_path != current_img:
                db.execute(
                    "UPDATE characters SET image = %s WHERE id = %s",
                    [new_image_path, char_id]
                )
                log_callback(f"  [+] Оновлено зображення: {new_image_path}")
                updated_count += 1
            else:
                log_callback(f"  [~] Зображення актуальне (без змін)")
                unchanged_count += 1

            time.sleep(1.2)

        except Exception as e:
            log_callback(f"  [x] Помилка під час скрапінгу '{char_name}': {e}")
            error_count += 1
            time.sleep(1.0)

    log_callback(
        f"[DONE] Завершено! Оновлено: {updated_count}, без змін: {unchanged_count}, "
        f"не знайдено: {not_found_count}, помилок: {error_count}."
    )
    return True

