import psycopg2
from psycopg2.extras import RealDictCursor
import os
from typing import List, Optional, Any
from dotenv import load_dotenv

# Завантажуємо змінні оточення з .env файлу
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class PostgresCursorWrapper:
    def __init__(self, cur, connection_wrapper=None):
        self.cur = cur
        self.connection_wrapper = connection_wrapper

    def execute(self, sql: str, params: Any = None):
        try:
            self.cur.execute(sql, params)
        except Exception as e:
            try:
                self.cur.connection.rollback()
            except Exception:
                pass
            raise e
        return self

    def fetchone(self):
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
