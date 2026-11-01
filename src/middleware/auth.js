/**
 * Authentication helpers.
 * - requireAuth: redirects to /admin/login if not logged in
 * - redirectIfAuth: opposite, used for the login screen
 */
const db = require('../config/database');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    // Attach the user object for templates.
    if (!req.user) {
      req.user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
    }
    res.locals.currentUser = req.user;
    return next();
  }
  return res.redirect('/admin/login');
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.userId) return res.redirect('/admin');
  return next();
}

module.exports = { requireAuth, redirectIfAuth };
