"""Serialized SQLite access with explicit persistence."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3
from threading import RLock
from .clock import now_ms
from .errors import StorageBusy, PlatformError
from .migrations import apply_migrations

DB_FILENAME = "opendevin.sqlite3"


class Store:
    @classmethod
    def open(cls, data_dir, *, clock=now_ms):
        self = cls()
        self.lock = RLock()
        self.persistent = data_dir is not None
        path = None
        try:
            if data_dir is not None:
                directory = Path(data_dir)
                directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                path = directory / DB_FILENAME
            self.conn = sqlite3.connect(str(path) if path else ":memory:", isolation_level=None, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            if path:
                path.chmod(0o600)
            for pragma in ("foreign_keys=ON", "busy_timeout=5000", "journal_mode=WAL", "synchronous=FULL"):
                self.conn.execute("PRAGMA " + pragma)
            apply_migrations(self.conn, db_path=path, clock=clock)
            return self
        except Exception as exc:
            if hasattr(self, "conn"):
                self.conn.close()
            if isinstance(exc, PlatformError):
                raise
            if isinstance(exc, sqlite3.OperationalError) and "locked" in str(exc):
                raise StorageBusy("Storage is busy.") from None
            raise PlatformError("Unable to open platform storage.") from None

    @contextmanager
    def read(self):
        with self.lock:
            try:
                yield self.conn
            except sqlite3.OperationalError as exc:
                if "locked" in str(exc) or "busy" in str(exc):
                    raise StorageBusy("Storage is busy.") from None
                raise

    @contextmanager
    def transaction(self):
        with self.read() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn
                conn.execute("COMMIT")
            except BaseException:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                raise

    def schema_version(self):
        with self.read() as conn:
            return conn.execute("SELECT coalesce(max(version), 0) FROM schema_migrations").fetchone()[0]

    def size_bytes(self):
        with self.read() as conn:
            return conn.execute("PRAGMA page_count").fetchone()[0] * conn.execute("PRAGMA page_size").fetchone()[0] if self.persistent else 0

    def backup_to(self, target):
        with self.read() as conn:
            try:
                with sqlite3.connect(target) as backup:
                    conn.backup(backup)
                Path(target).chmod(0o600)
            except (OSError, sqlite3.Error):
                raise PlatformError("Storage backup failed.") from None

    def close(self):
        with self.lock:
            self.conn.close()
