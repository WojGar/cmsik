/** Helpers for reading/writing the settings table and other small utils. */
const crypto = require('crypto');
const db = require('../config/database');

const settingsCache = { ts: 0, ttlMs: 1000, data: {} };

function loadAll() {
  const now = Date.now();
  if (now - settingsCache.ts < settingsCache.ttlMs) return settingsCache.data;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  settingsCache.data = {};
  rows.forEach(r => settingsCache.data[r.key] = r.value);
  settingsCache.ts = now;
  return settingsCache.data;
}

function get(key, fallback = null) {
  const all = loadAll();
  return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback;
}

function set(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  settingsCache.ts = 0; // invalidate
}

function setMany(pairs) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const tx = db.transaction((rows) => rows.forEach(([k, v]) => stmt.run(k, v)));
  tx(pairs);
  settingsCache.ts = 0;
}

function all() { return { ...loadAll() }; }

/** Random url-safe token + its SHA-256 hash (store only the hash). */
function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash  = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Format an ISO/datetime string to a short, human friendly Polish date. */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Escape HTML to safely render user-supplied text in EJS. */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  get, set, setMany, all,
  generateToken, hashToken,
  formatDate, escapeHtml,
};
