import psycopg2
from psycopg2.extras import RealDictCursor
import os
import re
from typing import List, Optional, Any
from dotenv import load_dotenv

# Завантажуємо змінні оточення з .env файлу
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class PostgresCursorWrapper:
    def __init__(self, cur, connection_wrapper=None):
        self.cur = cur
        self.connection_wrapper = connection_wrapper
        self.lastrowid = None
        self._mock_result = None

    def execute(self, sql: str, params: Any = None):
        sql_lower = sql.strip().lower()
        
        # 0. Перехоплення SELECT last_insert_rowid()
        if "last_insert_rowid()" in sql_lower:
            last_id = None
            if self.connection_wrapper is not None:
                last_id = self.connection_wrapper.lastrowid
            self._mock_result = {"id": last_id}
            return self

        # 1. Заміна placeholders ? на %s для psycopg2
        sql = sql.replace('?', '%s')
        
        # 2. Заміна "INSERT OR IGNORE" на "INSERT INTO ... ON CONFLICT DO NOTHING"
        is_insert = sql_lower.startswith("insert")
        
        if is_insert and "insert or ignore" in sql_lower:
            sql = re.sub(r'\binsert\s+or\s+ignore\s+into\b', 'INSERT INTO', sql, flags=re.IGNORECASE)
            sql = sql + " ON CONFLICT DO NOTHING"
            sql_lower = sql.strip().lower()

        # 3. Заміна SQLite CAST(expr AS REAL/FLOAT) на безпечний PostgreSQL-вираз.
        # SQLite повертає 0 для нечислових рядків, PostgreSQL — кидає помилку.
        def _safe_numeric_cast(match):
            expr = match.group(1).strip()
            return (
                f"CASE WHEN ({expr}) ~ '^-?[0-9]+(\\.[0-9]+)?$'"
                f" THEN ({expr})::NUMERIC"
                f" ELSE NULL END"
            )
        sql = re.sub(
            r'\bCAST\s*\(\s*(.+?)\s+AS\s+(?:REAL|FLOAT)\s*\)',
            _safe_numeric_cast,
            sql,
            flags=re.IGNORECASE
        )
        sql_lower = sql.strip().lower()

        # 4. Додаємо RETURNING id для отримання lastrowid
        has_returning = "returning" in sql_lower
        added_returning = False
        if is_insert and not has_returning:
            sql = sql + " RETURNING id"
            added_returning = True

        # 4. Виконуємо запит
        try:
            self.cur.execute(sql, params)
        except Exception as e:
            try:
                self.cur.connection.rollback()
            except Exception:
                pass
            raise e

        # 5. Отримуємо вставлений ID
        if is_insert and added_returning:
            try:
                # Оскільки ми використовуємо RealDictCursor, row - це словник
                row = self.cur.fetchone()
                if row:
                    val = row.get("id") or list(row.values())[0]
                    self.lastrowid = val
                    if self.connection_wrapper is not None:
                        self.connection_wrapper.lastrowid = val
            except Exception:
                self.lastrowid = None
                
        return self

    def fetchone(self):
        if self._mock_result is not None:
            res = self._mock_result
            self._mock_result = None
            return res
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    def fetchmany(self, size=None):
        if size is None:
            return self.cur.fetchmany()
        return self.cur.fetchmany(size)

    def close(self):
        self.cur.close()

    def __iter__(self):
        return iter(self.cur)

    def __getattr__(self, name):
        return getattr(self.cur, name)

class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.lastrowid = None

    def execute(self, sql: str, params: Any = None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def cursor(self, *args, **kwargs):
        kwargs.setdefault('cursor_factory', RealDictCursor)
        raw_cur = self.conn.cursor(*args, **kwargs)
        return PostgresCursorWrapper(raw_cur, connection_wrapper=self)

    def close(self):
        self.conn.close()

    def create_function(self, name, num_params, func):
        # Заглушка для сумісності з SQLite
        pass

    def __getattr__(self, name):
        return getattr(self.conn, name)

class Database:
    def __init__(self):
        self.host = os.getenv("PGHOST")
        self.port = os.getenv("PGPORT")
        self.database = os.getenv("PGDATABASE")
        self.user = os.getenv("PGUSER")
        self.password = os.getenv("PGPASSWORD")
        self.conn = None

    def connect(self):
        raw_conn = psycopg2.connect(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
            password=self.password
        )
        self.conn = PostgresConnectionWrapper(raw_conn)

    def close(self):
        if self.conn:
            self.conn.close()

    def get_all(self, sql: str, params: List[Any] = []) -> List[dict]:
        cur = self.conn.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
        return [dict(row) for row in rows]

    def get_one(self, sql: str, params: List[Any] = []) -> Optional[dict]:
        cur = self.conn.execute(sql, params)
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None

    def execute(self, sql: str, params: List[Any] = []):
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        cur.close()

# Єдиний екземпляр бази даних
db_instance = Database()

def init_db():
    db_instance.connect()
    pass

def close_db():
    db_instance.close()

def get_db():
    return db_instance
