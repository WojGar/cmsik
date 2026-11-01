/**
 * SQLite connection (better-sqlite3, synchronous, fast).
 * The DB file lives in /data/cmsik.sqlite (auto-created on first run).
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'cmsik.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Run schema.sql once if the users table does not exist yet. */
function ensureSchema() {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  ).get();
  if (!row) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    db.exec(sql);
    console.log('[db] schema created');
  } else {
    // Idempotent re-run of CREATE TABLE IF NOT EXISTS — safe for upgrades.
    // We re-execute schema.sql (every statement uses IF NOT EXISTS) so new
    // tables added in later versions are created automatically.
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    db.exec(sql);
  }
}

ensureSchema();

module.exports = db;
