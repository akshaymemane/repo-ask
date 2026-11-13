"""Append-only migration registry and transactional runner."""
from dataclasses import dataclass
import hashlib
from .storage_files import private_backup
from .errors import SchemaTooNew, MigrationChecksumMismatch, MigrationFailed

@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    statements: tuple[str, ...]

    @property
    def checksum(self):
        return hashlib.sha256("\n;\n".join(self.statements).encode()).hexdigest()

MIGRATIONS = (Migration(1, "foundation", ("CREATE TABLE jobs (\n  id                 TEXT PRIMARY KEY,\n  kind               TEXT NOT NULL CHECK (length(kind) BETWEEN 2 AND 64),\n  state              TEXT NOT NULL CHECK (state IN\n                       ('queued','leased','succeeded','failed','cancelled','needs_reconciliation')),\n  effect             TEXT NOT NULL CHECK (effect IN ('safe','external')),\n  priority           INTEGER NOT NULL DEFAULT 0,\n  payload            TEXT NOT NULL,            -- canonical JSON object, <= 16384 bytes, no secrets\n  idempotency_key    TEXT UNIQUE,\n  attempts           INTEGER NOT NULL DEFAULT 0,\n  max_attempts       INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),\n  run_after          INTEGER NOT NULL,\n  lease_owner        TEXT,\n  lease_token        TEXT,\n  lease_expires_at   INTEGER,\n  cancel_requested   INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0,1)),\n  checkpoint         TEXT,                     -- JSON object or NULL, <= 16384 bytes\n  result             TEXT,                     -- JSON object or NULL, <= 16384 bytes\n  last_error_code    TEXT,\n  last_error_message TEXT CHECK (last_error_message IS NULL OR length(last_error_message) <= 500),\n  created_at         INTEGER NOT NULL,\n  updated_at         INTEGER NOT NULL,\n  finished_at        INTEGER,\n  CHECK ((state = 'leased') = (lease_token IS NOT NULL AND lease_owner IS NOT NULL\n                               AND lease_expires_at IS NOT NULL))\n)", 'CREATE INDEX jobs_claim ON jobs (state, run_after, priority)', 'CREATE INDEX jobs_lease ON jobs (state, lease_expires_at)', "CREATE TABLE secret_refs (\n  id          TEXT PRIMARY KEY,\n  backend     TEXT NOT NULL,\n  purpose     TEXT NOT NULL CHECK (purpose IN ('provider_api_key','github_app_private_key','github_token')),\n  label       TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 100),\n  created_at  INTEGER NOT NULL,\n  revoked_at  INTEGER\n)")),)
from .service_schema import GITHUB_SQL, PROVIDER_SQL
MIGRATIONS += (Migration(2, "github_catalog", GITHUB_SQL), Migration(3, "provider_profiles", PROVIDER_SQL))
LATEST_VERSION = MIGRATIONS[-1].version


def apply_migrations(conn, *, db_path, clock):
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)")
    recorded = dict(conn.execute("SELECT version, checksum FROM schema_migrations"))
    if any(v > LATEST_VERSION for v in recorded):
        raise SchemaTooNew("Database schema is newer than this application.")
    registry = {m.version: m for m in MIGRATIONS}
    if any(v not in registry or registry[v].checksum != checksum for v, checksum in recorded.items()):
        raise MigrationChecksumMismatch("Migration checksum does not match.")
    pending = [m for m in MIGRATIONS if m.version not in recorded]
    if pending and recorded and db_path is not None:
        target = db_path.parent / "backups" / f"opendevin.pre-v{pending[0].version}.sqlite3"
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        private_backup(conn, target)
    for migration in pending:
        try:
            conn.execute("BEGIN IMMEDIATE")
            for statement in migration.statements:
                conn.execute(statement)
            conn.execute("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)",
                         (migration.version, migration.name, migration.checksum, clock()))
            conn.execute(f"PRAGMA user_version = {migration.version}")
            conn.execute("COMMIT")
        except Exception:
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            raise MigrationFailed("Database migration failed.") from None
    return max(recorded.keys() | {m.version for m in pending}, default=0)
