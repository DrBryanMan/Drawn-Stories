import sqlite3
import os
from typing import List, Optional, Any

# Resolve path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "../Drawn Stories Parser/comicsdb.db")

# Fallback to local comics.db if the remote one doesn't exist
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(BASE_DIR, "comics.db")

class Database:
    def __init__(self, path: str):
        self.path = path
        self.conn = None

    def connect(self):
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrency
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA foreign_keys = ON")
        
        # Add custom functions if needed (like ULOWER in Admin project)
        self.conn.create_function("ULOWER", 1, lambda s: s.lower() if s else None)

    def close(self):
        if self.conn:
            self.conn.close()

    def get_all(self, sql: str, params: List[Any] = []) -> List[dict]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]

    def get_one(self, sql: str, params: List[Any] = []) -> Optional[dict]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None

    def execute(self, sql: str, params: List[Any] = []):
        self.conn.execute(sql, params)
        self.conn.commit()

db_instance = Database(DB_PATH)

def init_db():
    db_instance.connect()

def close_db():
    db_instance.close()

def get_db():
    return db_instance
