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

# ── API character parser helpers ─────────────────────
API_KEY = os.environ.get("CV_API_KEY", "99b8aaa60addd5a3a119afbb1c57625e4c808c26")

def extract_image_path(image_url):
    if not image_url:
        return None
    match = re.search(r'(\d+/\d+/[^/\s]+(?:\.(?:jpg|jpeg|png|gif|webp))?)', image_url)
    return f"/{match.group(1)}" if match else None

def extract_slug(site_url, cv_prefix):
    if not site_url:
        return None
    match = re.search(rf'/([^/]+)/{cv_prefix}-\d+/?$', site_url)
    return match.group(1) if match else None

def normalize_aliases(raw):
    if not raw:
        return None
    if isinstance(raw, list):
        lines = [str(x).strip() for x in raw if x]
    else:
        lines = [line.strip() for line in str(raw).replace("\r", "").split("\n") if line.strip()]
    return json.dumps(lines, ensure_ascii=False) if lines else None

def get_or_create_character(db, scraper, cv_id, default_name, default_cv_slug, log_callback):
    row = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
    if row:
        return row['id']
        
    log_callback(f"Персонажа '{default_name}' (CV ID: {cv_id}) немає в базі. Запит до ComicVine API...")
    url = f"https://comicvine.gamespot.com/api/character/4005-{cv_id}/"
    params = {
        "api_key": API_KEY,
        "format": "json",
        "field_list": "id,name,real_name,site_detail_url,image,aliases,birth,death,gender,origin,first_appeared_in_issue,publisher"
    }
    
    try:
        response = scraper.get(url, params=params, timeout=20)
        if response.status_code == 200:
            data = response.json()
            if data.get("status_code") == 1 and data.get("results"):
                res = data["results"]
                
                char_name = res.get("name") or default_name
                real_name = res.get("real_name")
                cv_slug = extract_slug(res.get("site_detail_url"), "4005") or default_cv_slug
                image_path = extract_image_path(res.get("image", {}).get("original_url")) if res.get("image") else None
                aliases = normalize_aliases(res.get("aliases"))
                birth = res.get("birth")
                death = res.get("death")
                gender = res.get("gender")
                origin = res.get("origin", {}).get("name") if res.get("origin") else None
                
                # Resolve publisher
                publisher_id = None
                pub_data = res.get("publisher")
                if pub_data and pub_data.get("id"):
                    pub_cv_id = pub_data["id"]
                    pub_name = pub_data.get("name")
                    pub_row = db.get_one("SELECT id FROM publishers WHERE cv_id = %s", [pub_cv_id])
                    if pub_row:
                        publisher_id = pub_row["id"]
                    else:
                        db.execute("INSERT INTO publishers (cv_id, name) VALUES (%s, %s)", [pub_cv_id, pub_name])
                        new_pub = db.get_one("SELECT id FROM publishers WHERE cv_id = %s", [pub_cv_id])
                        publisher_id = new_pub["id"]
                        log_callback(f"Створено видавництво для персонажа: {pub_name} (CV ID: {pub_cv_id})")
                
                # Resolve first appearance
                first_app_id = None
                first_app_data = res.get("first_appeared_in_issue")
                if first_app_data and first_app_data.get("id"):
                    fa_cv_id = first_app_data["id"]
                    issue_row = db.get_one("SELECT id FROM issues WHERE cv_id = %s", [fa_cv_id])
                    if issue_row:
                        first_app_id = issue_row["id"]
                
                db.execute(
                    """
                    INSERT INTO characters (
                        cv_id, name, real_name, cv_slug, image, aliases, birth, death, gender, origin, first_appearance, publisher
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        cv_id, char_name, real_name, cv_slug, image_path, aliases, birth, death, gender, origin, first_app_id, publisher_id
                    ]
                )
                
                new_char = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
                log_callback(f"Персонажа {char_name} успішно імпортовано з ComicVine API!")
                return new_char["id"]
            else:
                log_callback(f"Попередження: ComicVine API повернув статус {data.get('status_code')} або результати порожні.")
        else:
            log_callback(f"Попередження: Не вдалося отримати дані з ComicVine API. Статус-код: {response.status_code}")
    except Exception as api_err:
        log_callback(f"Помилка при запиті до API ComicVine для персонажа: {api_err}")
        
    # Fallback
    log_callback(f"Створюємо персонажа {default_name} за спрощеною схемою...")
    db.execute(
        "INSERT INTO characters (cv_id, name, cv_slug) VALUES (%s, %s, %s)",
        [cv_id, default_name, default_cv_slug]
    )
    new_char = db.get_one("SELECT id FROM characters WHERE cv_id = %s", [cv_id])
    return new_char["id"]

# ── Scraper services ─────────────────────────────────
def scrape_issue_appearances_logic(db, scraper, issue_id, log_callback):
    # 1. Get issue from DB
    issue = db.get_one("SELECT cv_id, cv_slug, name, issue_number FROM issues WHERE id = %s", [issue_id])
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
    for char in appearances['characters']:
        try:
            char_id = get_or_create_character(db, scraper, char['cv_id'], char['name'], char['cv_slug'], log_callback)
            db.execute("INSERT INTO issue_characters (issue_id, character_id, story_num) VALUES (%s, %s, 0) ON CONFLICT DO NOTHING", [issue_id, char_id])
            added_chars += 1
        except Exception as e:
            log_callback(f"Помилка збереження персонажа {char['name']}: {e}")
    totals['characters'] = added_chars

    # Creators (persons)
    db.execute("DELETE FROM issue_persons WHERE issue_id = %s", [issue_id])
    added_persons = 0
    for creator in appearances['creators']:
        try:
            person_id = get_or_create_entity(db, 'persons', creator['cv_id'], creator['name'], creator['cv_slug'])
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