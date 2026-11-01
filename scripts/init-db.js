/**
 * Tiny wrapper used by `npm run init-db`.
 * Just re-runs the seed script (which is idempotent).
 */
require('./seed.js');
