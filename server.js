/**
 * CMSik — CMS for a single-page travel-agency website.
 *
 * Tech stack: Node.js, Express, SQLite (better-sqlite3), EJS,
 * Bootstrap 4.5.2 (TraveLand client) + Bootstrap 5 / Tabler (admin).
 *
 * Run:  npm install && npm run init-db && npm start
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express        = require('express');
const session        = require('express-session');
const cookieParser   = require('cookie-parser');
const flash          = require('connect-flash');
const bcrypt         = require('bcryptjs');

const config   = require('./src/config/app');
const db       = require('./src/config/database');
const { requireAuth, redirectIfAuth } = require('./src/middleware/auth');
const upload   = require('./src/middleware/upload');
const H        = require('./src/utils/helpers');

// --- ensure the DB has at least the default admin + seed data ------------
const adminExists = db.prepare('SELECT COUNT(*) AS c FROM users').get();
if (adminExists.c === 0) {
  console.log('[server] no users found — running seed automatically...');
  require('./scripts/seed.js');
}

// --- app setup -----------------------------------------------------------
const app = express();
app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(session({
  name: 'cmsik_sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 1000 * 60 * 60 * 8, // 8h
  },
}));
app.use(flash());

// Make settings + current user available to every EJS template.
app.use((req, res, next) => {
  res.locals.settings = H.all();
  res.locals.flash    = {
    success: req.flash('success'),
    error:   req.flash('error'),
    info:    req.flash('info'),
  };
  res.locals.path     = req.path;
  res.locals.csrf     = req.session.csrfToken || (req.session.csrfToken = crypto.randomBytes(16).toString('hex'));
  if (req.session && req.session.userId && !req.user) {
    req.user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  }
  res.locals.currentUser = req.user || null;
  next();
});

// --- static files --------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// PUBLIC  (TraveLand client)
// =========================================================================

/**
 * Render the single-page TraveLand site from the database:
 *  - home page components grouped by section
 *  - menu items (visible only)
 *  - 3 most recent published posts (the newest highlighted)
 */
app.get('/', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1 LIMIT 1').get();
  if (!home) return res.status(500).send('Home page not configured.');

  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  // Group by key for the template.
  const c = {};
  comps.forEach(row => { c[row.key] = row; });

  const menu = db.prepare('SELECT * FROM menu_items WHERE is_visible = 1 ORDER BY position ASC').all();

  // 3 most recent published posts.
  const posts = db.prepare(
    "SELECT id, title, author, published_at, image, body, status FROM posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3"
  ).all();

  res.render('client/index', {
    title: H.get('site_name', 'TraveLand'),
    c, comps, menu, posts,
    formatDate: H.formatDate,
  });
});

// =========================================================================
// PUBLIC — Landing pages
// =========================================================================

/** Helper: load home-page components grouped by key + raw list. */
function loadComponents() {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1 LIMIT 1').get();
  if (!home) return { c: {}, comps: [] };
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  const c = {};
  comps.forEach(row => { c[row.key] = row; });
  return { c, comps };
}

/** Helper: visible menu items. */
function loadMenu() {
  return db.prepare('SELECT * FROM menu_items WHERE is_visible = 1 ORDER BY position ASC').all();
}

// --- About LP ------------------------------------------------------------
app.get('/about', (req, res) => {
  const { c } = loadComponents();
  const menu  = loadMenu();
  const values = db.prepare("SELECT * FROM components WHERE block_type = 'value' AND is_visible = 1 ORDER BY position ASC, id ASC").all();
  // Reuse home-page counters (single source of truth).
  const counters = ['counter_1','counter_2','counter_3','counter_4'].map(k => c[k]).filter(Boolean);
  res.render('client/about', {
    title: 'About – ' + (H.get('site_name', 'TraveLand')),
    c, menu, values, counters,
    formatDate: H.formatDate,
  });
});

// --- Services LP ---------------------------------------------------------
app.get('/services', (req, res) => {
  const { c } = loadComponents();
  const menu  = loadMenu();
  const services = db.prepare("SELECT * FROM components WHERE block_type = 'service_full' AND is_visible = 1 ORDER BY position ASC, id ASC").all();
  const steps    = db.prepare("SELECT * FROM components WHERE block_type = 'process_step' AND is_visible = 1 ORDER BY position ASC, id ASC").all();
  res.render('client/services', {
    title: 'Services – ' + (H.get('site_name', 'TraveLand')),
    c, menu, services, steps,
  });
});

// --- Blog LP (list with pagination) --------------------------------------
app.get('/blog', (req, res) => {
  const { c } = loadComponents();
  const menu  = loadMenu();
  const PER_PAGE = 9;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PER_PAGE;
  const total = db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status = 'published'").get().c;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const posts = db.prepare(
    "SELECT id, title, author, published_at, image, body FROM posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?"
  ).all(PER_PAGE, offset);
  const recent = db.prepare(
    "SELECT id, title, published_at FROM posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 5"
  ).all();
  res.render('client/blog', {
    title: 'Blog – ' + (H.get('site_name', 'TraveLand')),
    c, menu, posts, recent,
    page, totalPages,
    formatDate: H.formatDate,
  });
});

// --- Single post ---------------------------------------------------------
app.get('/post/:id', (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!post) {
    req.flash('error', 'Wpis nie istnieje lub nie jest opublikowany.');
    return res.redirect('/blog');
  }
  const menu = loadMenu();
  const recent = db.prepare(
    "SELECT id, title, published_at FROM posts WHERE status = 'published' AND id != ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 5"
  ).all(post.id);
  res.render('client/post', {
    title: post.title + ' – ' + (H.get('site_name', 'TraveLand')),
    post, menu, recent,
    formatDate: H.formatDate,
  });
});

// --- Contact LP ----------------------------------------------------------
app.get('/contact', (req, res) => {
  const { c } = loadComponents();
  const menu  = loadMenu();
  const ci = {
    address:       H.get('contact_address',       ''),
    phone:         H.get('contact_phone',         ''),
    email:         H.get('contact_email',         ''),
    hours_week:    H.get('contact_hours_week',    ''),
    hours_weekend: H.get('contact_hours_weekend', ''),
    map_embed_url: H.get('contact_map_embed_url', ''),
  };
  res.render('client/contact', {
    title: 'Contact – ' + (H.get('site_name', 'TraveLand')),
    c, menu, ci,
  });
});

// --- Static pages --------------------------------------------------------
app.get('/p/:slug', (req, res) => {
  const page = db.prepare('SELECT * FROM static_pages WHERE slug = ? AND is_visible = 1').get(req.params.slug);
  if (!page) {
    req.flash('error', 'Strona nie istnieje.');
    return res.redirect('/');
  }
  const menu = loadMenu();
  res.render('client/static-page', {
    title: page.title + ' – ' + (H.get('site_name', 'TraveLand')),
    page, menu,
    formatDate: H.formatDate,
  });
});

// --- contact form submission --------------------------------------------
app.post('/contact', (req, res) => {
  const { name, phone, email, trip, body } = req.body;
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Podaj imię i nazwisko.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Podaj poprawny adres e-mail.');
  if (!body || body.trim().length < 5) errors.push('Wiadomość jest zbyt krótka.');
  // Redirect back to the same page (home #contact or /contact)
  const back = (req.body.source === 'home') ? '/#contact' : '/contact';
  if (errors.length) {
    req.flash('error', errors.join(' '));
    return res.redirect(back);
  }
  db.prepare(
    'INSERT INTO messages (name, phone, email, trip, body, is_read) VALUES (?,?,?,?,?,0)'
  ).run(name.trim(), (phone || '').trim(), email.trim(), (trip || '').trim(), body.trim());
  req.flash('success', 'Dziękujemy! Wiadomość została wysłana.');
  res.redirect(back);
});

// --- newsletter subscription --------------------------------------------
app.post('/newsletter', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  // Redirect back to the same page
  const back = req.body.source === 'home' ? '/#footer' : (req.body.source || '/');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.flash('error', 'Podaj poprawny adres e-mail.');
    return res.redirect(back);
  }
  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
    req.flash('success', 'Zapisano do newslettera!');
  } catch (e) {
    if (String(e).includes('UNIQUE')) req.flash('info', 'Ten adres jest już zapisany.');
    else                              req.flash('error', 'Nie udało się zapisać.');
  }
  res.redirect(back);
});

// =========================================================================
// ADMIN AUTH
// =========================================================================

app.get('/admin/login', redirectIfAuth, (req, res) => {
  res.render('admin/login', { title: 'Logowanie', layout: false, email: '' });
});

app.post('/admin/login', redirectIfAuth, (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('admin/login', {
      title: 'Logowanie', layout: false,
      email, error: 'Nieprawidłowy e-mail lub hasło.',
    });
  }
  req.session.userId = user.id;
  req.session.csrfToken = crypto.randomBytes(16).toString('hex');
  res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// --- password reset (request) -------------------------------------------
app.get('/admin/forgot', redirectIfAuth, (req, res) => {
  res.render('admin/forgot', { title: 'Reset hasła', layout: false, email: '', sent: false });
});

app.post('/admin/forgot', redirectIfAuth, (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always say the same message to avoid account enumeration.
  if (user) {
    const { token, hash } = H.generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)').run(user.id, hash, expires);
    // In this demo we do not actually send email — show the link on screen.
    // To enable real email delivery in production, install nodemailer
    // (`npm i nodemailer`) and call transporter.sendMail(...) here.
    const resetUrl = `${req.protocol}://${req.get('host')}/admin/reset/${token}`;
    req.flash('info', `Link do resetu hasła (demo): ${resetUrl}`);
  } else {
    req.flash('info', 'Jeśli konto istnieje, link do resetu został wygenerowany.');
  }
  res.render('admin/forgot', { title: 'Reset hasła', layout: false, email, sent: true });
});

// --- password reset (consume token) -------------------------------------
app.get('/admin/reset/:token', (req, res) => {
  const tokenHash = H.hashToken(req.params.token);
  const row = db.prepare(`
    SELECT * FROM password_resets
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(tokenHash);
  if (!row) {
    req.flash('error', 'Link jest nieprawidłowy lub wygasł.');
    return res.redirect('/admin/forgot');
  }
  res.render('admin/reset', { title: 'Nowe hasło', layout: false, token: req.params.token });
});

app.post('/admin/reset/:token', (req, res) => {
  const { password, password_confirm } = req.body;
  if (!password || password.length < 6) {
    return res.render('admin/reset', { title: 'Nowe hasło', layout: false, token: req.params.token, error: 'Hasło musi mieć co najmniej 6 znaków.' });
  }
  if (password !== password_confirm) {
    return res.render('admin/reset', { title: 'Nowe hasło', layout: false, token: req.params.token, error: 'Hasła nie są takie same.' });
  }
  const tokenHash = H.hashToken(req.params.token);
  const row = db.prepare(`
    SELECT * FROM password_resets
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(tokenHash);
  if (!row) {
    req.flash('error', 'Link jest nieprawidłowy lub wygasł.');
    return res.redirect('/admin/forgot');
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
  db.prepare('UPDATE password_resets SET used_at = datetime(\'now\') WHERE id = ?').run(row.id);
  req.flash('success', 'Hasło zostało zmienione. Możesz się zalogować.');
  res.redirect('/admin/login');
});

// =========================================================================
// ADMIN PANEL  (everything below requires a session)
// =========================================================================
app.use('/admin', requireAuth);

// --- Dashboard -----------------------------------------------------------
app.get('/admin', (req, res) => {
  const stats = {
    posts:       db.prepare("SELECT COUNT(*) AS c FROM posts").get().c,
    drafts:      db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status = 'draft'").get().c,
    messages:    db.prepare("SELECT COUNT(*) AS c FROM messages WHERE is_read = 0").get().c,
    subscribers: db.prepare("SELECT COUNT(*) AS c FROM subscribers").get().c,
  };
  const recentPosts = db.prepare("SELECT id, title, author, status, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5").all();
  const recentMsgs  = db.prepare("SELECT id, name, email, body, created_at FROM messages ORDER BY created_at DESC LIMIT 5").all();
  res.render('admin/dashboard', { title: 'Pulpit', active: 'dashboard', stats, recentPosts, recentMsgs, formatDate: H.formatDate });
});

// --- Sections editor (Home / About / Services / Blog heading / Contact heading / Footer) ---
app.get('/admin/sections', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1').get();
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  res.render('admin/sections', { title: 'Treść sekcji', active: 'sections', comps });
});

app.post('/admin/sections', (req, res) => {
  const updates = req.body.components || {};
  const stmt = db.prepare('UPDATE components SET label = ?, text = ?, icon = ?, image_url = ?, link = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of Object.keys(updates)) {
      const u = updates[id];
      stmt.run((u.label || '').trim(), (u.text || '').trim(), (u.icon || '').trim() || null, (u.image_url || '').trim() || null, (u.link || '').trim() || null, Number(id));
    }
  });
  tx();
  req.flash('success', 'Zmiany zostały zapisane.');
  res.redirect('/admin/sections');
});

// --- Blog posts ----------------------------------------------------------
app.get('/admin/posts', (req, res) => {
  const posts = db.prepare("SELECT id, title, author, published_at, image, status, updated_at FROM posts ORDER BY updated_at DESC").all();
  res.render('admin/posts', { title: 'Wpisy blogowe', active: 'posts', posts, formatDate: H.formatDate });
});

app.get('/admin/posts/new', (req, res) => {
  res.render('admin/post-edit', { title: 'Nowy wpis', active: 'posts', post: null, errors: [] });
});

app.post('/admin/posts/new', upload.single('image'), (req, res) => {
  const { title, author, published_at, body, status } = req.body;
  const errors = [];
  if (!title || !title.trim()) errors.push('Tytuł jest wymagany.');
  if (!author || !author.trim()) errors.push('Autor jest wymagany.');
  if (!body || !body.trim()) errors.push('Treść jest wymagana.');
  if (errors.length) {
    return res.render('admin/post-edit', { title: 'Nowy wpis', active: 'posts', post: { title, author, published_at, body, status, image: req.file ? 'uploads/' + req.file.filename : '' }, errors });
  }
  const image = req.file ? 'uploads/' + req.file.filename : '';
  const info = db.prepare(
    "INSERT INTO posts (title, author, published_at, image, body, status) VALUES (?,?,?,?,?,?)"
  ).run(title.trim(), author.trim(), published_at || null, image, body.trim(), status === 'published' ? 'published' : 'draft');
  req.flash('success', 'Wpis został utworzony.');
  res.redirect('/admin/posts');
});

app.get('/admin/posts/:id/edit', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) { req.flash('error', 'Wpis nie istnieje.'); return res.redirect('/admin/posts'); }
  res.render('admin/post-edit', { title: 'Edycja wpisu', active: 'posts', post, errors: [] });
});

app.post('/admin/posts/:id/edit', upload.single('image'), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) { req.flash('error', 'Wpis nie istnieje.'); return res.redirect('/admin/posts'); }
  const { title, author, published_at, body, status, remove_image } = req.body;
  const errors = [];
  if (!title || !title.trim()) errors.push('Tytuł jest wymagany.');
  if (!author || !author.trim()) errors.push('Autor jest wymagany.');
  if (!body || !body.trim()) errors.push('Treść jest wymagana.');
  if (errors.length) {
    return res.render('admin/post-edit', { title: 'Edycja wpisu', active: 'posts', post: { ...post, title, author, published_at, body, status }, errors });
  }
  let image = post.image;
  if (req.file) image = 'uploads/' + req.file.filename;
  else if (remove_image === '1') image = '';
  db.prepare(
    "UPDATE posts SET title = ?, author = ?, published_at = ?, image = ?, body = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title.trim(), author.trim(), published_at || null, image, body.trim(), status === 'published' ? 'published' : 'draft', post.id);
  req.flash('success', 'Wpis został zapisany.');
  res.redirect('/admin/posts');
});

app.post('/admin/posts/:id/delete', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  req.flash('success', 'Wpis został usunięty.');
  res.redirect('/admin/posts');
});

// --- Menu ----------------------------------------------------------------
app.get('/admin/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items ORDER BY position ASC').all();
  // Pages the menu can point to.
  const sections = [
    { value: 'home',     label: 'Home (strona główna)' },
    { value: 'about',    label: 'About (landing page)' },
    { value: 'services', label: 'Services (landing page)' },
    { value: 'blog',     label: 'Blog (lista wpisów)' },
    { value: 'contact',  label: 'Contact (landing page)' },
  ];
  res.render('admin/menu', { title: 'Menu nawigacji', active: 'menu', items, sections });
});

app.post('/admin/menu/new', (req, res) => {
  const { label, target_section } = req.body;
  if (!label || !label.trim()) { req.flash('error', 'Nazwa zakładki jest wymagana.'); return res.redirect('/admin/menu'); }
  const max = db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM menu_items').get().m;
  db.prepare('INSERT INTO menu_items (label, target_section, position, is_visible) VALUES (?,?,?,1)').run(label.trim(), target_section || 'home', max + 1);
  req.flash('success', 'Zakładka dodana.');
  res.redirect('/admin/menu');
});

app.post('/admin/menu/:id', (req, res) => {
  const { label, target_section } = req.body;
  if (!label || !label.trim()) { req.flash('error', 'Nazwa zakładki jest wymagana.'); return res.redirect('/admin/menu'); }
  db.prepare('UPDATE menu_items SET label = ?, target_section = ? WHERE id = ?').run(label.trim(), target_section || 'home', req.params.id);
  req.flash('success', 'Zakładka zaktualizowana.');
  res.redirect('/admin/menu');
});

app.post('/admin/menu/:id/toggle', (req, res) => {
  db.prepare('UPDATE menu_items SET is_visible = 1 - is_visible WHERE id = ?').run(req.params.id);
  req.flash('success', 'Widoczność zakładki zmieniona.');
  res.redirect('/admin/menu');
});

app.post('/admin/menu/:id/delete', (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  req.flash('success', 'Zakładka usunięta.');
  res.redirect('/admin/menu');
});

// Drag-and-drop reorder (JSON endpoint called from the menu page).
app.post('/admin/api/menu/reorder', (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number) : [];
  if (!order.length) return res.json({ ok: false, error: 'empty order' });
  const stmt = db.prepare('UPDATE menu_items SET position = ? WHERE id = ?');
  const tx = db.transaction(() => order.forEach((id, i) => stmt.run(i + 1, id)));
  tx();
  res.json({ ok: true });
});

// =========================================================================
// ADMIN — Landing pages editor (About / Services / Blog / Contact)
//         + generic component (tile) CRUD with reordering
//         + Static pages CRUD
// =========================================================================

// Allowed block types for dynamic tiles + their labels.
const TILE_TYPES = {
  value:        { label: 'Wartość (About LP)',         redirect: '/admin/pages/about' },
  service_full: { label: 'Usługa (Services LP)',       redirect: '/admin/pages/services' },
  process_step: { label: 'Krok procesu (Services LP)', redirect: '/admin/pages/services' },
  service_tile: { label: 'Kafelek Services (home)',    redirect: '/admin/sections' },
};
const MAX_TILES = 16;

// --- Pages index (landing pages overview) --------------------------------
app.get('/admin/pages', (req, res) => {
  res.render('admin/pages', { title: 'Strony', active: 'pages' });
});

// --- About LP editor -----------------------------------------------------
app.get('/admin/pages/about', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1').get();
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  const c = {};
  comps.forEach(r => { c[r.key] = r; });
  const values = db.prepare("SELECT * FROM components WHERE block_type = 'value' ORDER BY position ASC, id ASC").all();
  res.render('admin/page-about', { title: 'Strona About', active: 'pages', c, values });
});

app.post('/admin/pages/about', (req, res) => {
  const updates = req.body.components || {};
  const stmt = db.prepare('UPDATE components SET text = ?, image_url = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of Object.keys(updates)) {
      const u = updates[id];
      stmt.run((u.text || '').trim(), (u.image_url || '').trim() || null, Number(id));
    }
  });
  tx();
  req.flash('success', 'Strona About zapisana.');
  res.redirect('/admin/pages/about');
});

// --- Services LP editor --------------------------------------------------
app.get('/admin/pages/services', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1').get();
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  const c = {};
  comps.forEach(r => { c[r.key] = r; });
  const services = db.prepare("SELECT * FROM components WHERE block_type = 'service_full' ORDER BY position ASC, id ASC").all();
  const steps    = db.prepare("SELECT * FROM components WHERE block_type = 'process_step' ORDER BY position ASC, id ASC").all();
  res.render('admin/page-services', { title: 'Strona Services', active: 'pages', c, services, steps });
});

app.post('/admin/pages/services', (req, res) => {
  const updates = req.body.components || {};
  const stmt = db.prepare('UPDATE components SET text = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of Object.keys(updates)) {
      const u = updates[id];
      stmt.run((u.text || '').trim(), Number(id));
    }
  });
  tx();
  req.flash('success', 'Strona Services zapisana.');
  res.redirect('/admin/pages/services');
});

// --- Blog LP editor ------------------------------------------------------
app.get('/admin/pages/blog', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1').get();
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  const c = {};
  comps.forEach(r => { c[r.key] = r; });
  res.render('admin/page-blog', { title: 'Strona Blog', active: 'pages', c });
});

app.post('/admin/pages/blog', (req, res) => {
  const updates = req.body.components || {};
  const stmt = db.prepare('UPDATE components SET text = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of Object.keys(updates)) {
      const u = updates[id];
      stmt.run((u.text || '').trim(), Number(id));
    }
  });
  tx();
  req.flash('success', 'Strona Blog zapisana.');
  res.redirect('/admin/pages/blog');
});

// --- Contact LP editor (contact info now in settings) --------------------
app.get('/admin/pages/contact', (req, res) => {
  const home = db.prepare('SELECT * FROM pages WHERE is_home = 1').get();
  const comps = db.prepare('SELECT * FROM components WHERE section_id = ? ORDER BY position ASC').all(home.id);
  const c = {};
  comps.forEach(r => { c[r.key] = r; });
  const ci = {
    address:       H.get('contact_address',       ''),
    phone:         H.get('contact_phone',         ''),
    email:         H.get('contact_email',         ''),
    hours_week:    H.get('contact_hours_week',    ''),
    hours_weekend: H.get('contact_hours_weekend', ''),
    map_embed_url: H.get('contact_map_embed_url', ''),
  };
  res.render('admin/page-contact', { title: 'Strona Contact', active: 'pages', c, ci });
});

app.post('/admin/pages/contact', (req, res) => {
  const updates = req.body.components || {};
  const stmt = db.prepare('UPDATE components SET text = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of Object.keys(updates)) {
      const u = updates[id];
      stmt.run((u.text || '').trim(), Number(id));
    }
  });
  tx();
  // Contact info lives in settings now.
  const { address, phone, email, hours_week, hours_weekend, map_embed_url } = req.body;
  H.setMany([
    ['contact_address',       address || ''],
    ['contact_phone',         phone || ''],
    ['contact_email',         email || ''],
    ['contact_hours_week',    hours_week || ''],
    ['contact_hours_weekend', hours_weekend || ''],
    ['contact_map_embed_url', map_embed_url || ''],
  ]);
  req.flash('success', 'Strona Contact zapisana.');
  res.redirect('/admin/pages/contact');
});

// =========================================================================
// Generic component (tile) CRUD
//   - POST /admin/components/new        — create new tile of a given block_type
//   - POST /admin/components/:id        — update tile content
//   - POST /admin/components/:id/move   — change position (int)
//   - POST /admin/components/:id/toggle — show/hide
//   - POST /admin/components/:id/delete — delete
// All require a valid block_type (one of TILE_TYPES).
// =========================================================================

// Renumber tiles of a given type so positions are 0, 10, 20, 30... (gaps of 10).
function renumberTiles(blockType) {
  const rows = db.prepare('SELECT id FROM components WHERE block_type = ? ORDER BY position ASC, id ASC').all(blockType);
  const stmt = db.prepare('UPDATE components SET position = ? WHERE id = ?');
  const tx = db.transaction(() => rows.forEach((r, i) => stmt.run(i * 10, r.id)));
  tx();
}

app.post('/admin/components/new', (req, res) => {
  const blockType = req.body.block_type;
  if (!TILE_TYPES[blockType]) { req.flash('error', 'Nieznany typ kafelka.'); return res.redirect('/admin/pages'); }
  // Limit: max 16 tiles per type.
  const count = db.prepare('SELECT COUNT(*) AS c FROM components WHERE block_type = ?').get(blockType).c;
  if (count >= MAX_TILES) { req.flash('error', `Maksymalna liczba kafelków (${MAX_TILES}) osiągnięta.`); return res.redirect(TILE_TYPES[blockType].redirect); }
  const home = db.prepare('SELECT id FROM pages WHERE is_home = 1').get();
  const max  = db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM components WHERE block_type = ?').get(blockType).m;
  // Build a key — blockType + timestamp to keep it unique.
  const key  = `${blockType}_${Date.now()}`;
  const { icon, label, text, image_url, link } = req.body;
  db.prepare(`INSERT INTO components (section_id, block_type, key, label, text, icon, image_url, link, position, is_visible)
              VALUES (?,?,?,?,?,?,?,?,?,1)`)
    .run(home.id, blockType, key, (label || '').trim(), (text || '').trim(), (icon || '').trim() || null, (image_url || '').trim() || null, (link || '').trim() || null, max + 10);
  req.flash('success', 'Kafelek dodany.');
  res.redirect(TILE_TYPES[blockType].redirect);
});

app.post('/admin/components/:id', (req, res) => {
  const comp = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  if (!comp) { req.flash('error', 'Kafelek nie istnieje.'); return res.redirect('/admin/pages'); }
  if (!TILE_TYPES[comp.block_type]) { req.flash('error', 'Ten kafelek nie jest edytowalny stąd.'); return res.redirect('/admin/pages'); }
  const { icon, label, text, image_url, link } = req.body;
  db.prepare(`UPDATE components SET icon = ?, label = ?, text = ?, image_url = ?, link = ?, updated_at = datetime('now') WHERE id = ?`)
    .run((icon || '').trim() || null, (label || '').trim(), (text || '').trim(), (image_url || '').trim() || null, (link || '').trim() || null, comp.id);
  req.flash('success', 'Kafelek zapisany.');
  res.redirect(TILE_TYPES[comp.block_type].redirect);
});

app.post('/admin/components/:id/move', (req, res) => {
  const comp = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  if (!comp) { req.flash('error', 'Kafelek nie istnieje.'); return res.redirect('/admin/pages'); }
  if (!TILE_TYPES[comp.block_type]) { req.flash('error', 'Ten kafelek nie jest edytowalny stąd.'); return res.redirect('/admin/pages'); }
  const direction = req.body.direction; // 'up' or 'down'
  const newPosRaw = parseInt(req.body.position, 10);
  // Manual position entry takes priority; otherwise move by ±5 (half a gap).
  if (!isNaN(newPosRaw)) {
    db.prepare('UPDATE components SET position = ? WHERE id = ?').run(newPosRaw, comp.id);
  } else if (direction === 'up' || direction === 'down') {
    const delta = direction === 'up' ? -5 : +5;
    db.prepare('UPDATE components SET position = position + ? WHERE id = ?').run(delta, comp.id);
  }
  // Renumber so gaps stay at 10.
  renumberTiles(comp.block_type);
  req.flash('success', 'Kolejność zaktualizowana.');
  res.redirect(TILE_TYPES[comp.block_type].redirect);
});

app.post('/admin/components/:id/toggle', (req, res) => {
  const comp = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  if (!comp) { req.flash('error', 'Kafelek nie istnieje.'); return res.redirect('/admin/pages'); }
  if (!TILE_TYPES[comp.block_type]) { req.flash('error', 'Ten kafelek nie jest edytowalny stąd.'); return res.redirect('/admin/pages'); }
  db.prepare('UPDATE components SET is_visible = 1 - is_visible WHERE id = ?').run(comp.id);
  req.flash('success', 'Widoczność kafelka zmieniona.');
  res.redirect(TILE_TYPES[comp.block_type].redirect);
});

app.post('/admin/components/:id/delete', (req, res) => {
  const comp = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  if (!comp) { req.flash('error', 'Kafelek nie istnieje.'); return res.redirect('/admin/pages'); }
  if (!TILE_TYPES[comp.block_type]) { req.flash('error', 'Ten kafelek nie jest edytowalny stąd.'); return res.redirect('/admin/pages'); }
  db.prepare('DELETE FROM components WHERE id = ?').run(comp.id);
  renumberTiles(comp.block_type);
  req.flash('success', 'Kafelek usunięty.');
  res.redirect(TILE_TYPES[comp.block_type].redirect);
});

// --- Static pages CRUD ---------------------------------------------------
app.get('/admin/static-pages', (req, res) => {
  const pages = db.prepare('SELECT * FROM static_pages ORDER BY id ASC').all();
  res.render('admin/static-pages', { title: 'Strony statyczne', active: 'pages', pages, formatDate: H.formatDate });
});

app.get('/admin/static-pages/new', (req, res) => {
  res.render('admin/static-page-edit', { title: 'Nowa strona statyczna', active: 'pages', page: null });
});

app.post('/admin/static-pages/new', (req, res) => {
  const { title, slug, body } = req.body;
  if (!title || !title.trim()) { req.flash('error', 'Tytuł jest wymagany.'); return res.redirect('/admin/static-pages/new'); }
  if (!slug || !slug.trim())   { req.flash('error', 'Slug jest wymagany.');  return res.redirect('/admin/static-pages/new'); }
  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  try {
    db.prepare('INSERT INTO static_pages (title, slug, body, is_visible) VALUES (?,?,?,1)').run(title.trim(), safeSlug, (body || '').trim());
    req.flash('success', 'Strona utworzona.');
    res.redirect('/admin/static-pages');
  } catch (e) {
    req.flash('error', 'Slug musi być unikalny.');
    res.redirect('/admin/static-pages/new');
  }
});

app.get('/admin/static-pages/:id/edit', (req, res) => {
  const page = db.prepare('SELECT * FROM static_pages WHERE id = ?').get(req.params.id);
  if (!page) { req.flash('error', 'Strona nie istnieje.'); return res.redirect('/admin/static-pages'); }
  res.render('admin/static-page-edit', { title: 'Edycja strony', active: 'pages', page });
});

app.post('/admin/static-pages/:id/edit', (req, res) => {
  const { title, slug, body } = req.body;
  if (!title || !title.trim()) { req.flash('error', 'Tytuł jest wymagany.'); return res.redirect('/admin/static-pages/' + req.params.id + '/edit'); }
  const safeSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  try {
    db.prepare("UPDATE static_pages SET title = ?, slug = ?, body = ?, updated_at = datetime('now') WHERE id = ?")
      .run(title.trim(), safeSlug, (body || '').trim(), req.params.id);
    req.flash('success', 'Strona zapisana.');
    res.redirect('/admin/static-pages');
  } catch (e) {
    req.flash('error', 'Slug musi być unikalny.');
    res.redirect('/admin/static-pages/' + req.params.id + '/edit');
  }
});

app.post('/admin/static-pages/:id/toggle', (req, res) => {
  db.prepare('UPDATE static_pages SET is_visible = 1 - is_visible WHERE id = ?').run(req.params.id);
  req.flash('success', 'Widoczność strony zmieniona.');
  res.redirect('/admin/static-pages');
});

app.post('/admin/static-pages/:id/delete', (req, res) => {
  db.prepare('DELETE FROM static_pages WHERE id = ?').run(req.params.id);
  req.flash('success', 'Strona usunięta.');
  res.redirect('/admin/static-pages');
});

// --- Messages ------------------------------------------------------------
app.get('/admin/messages', (req, res) => {
  const messages = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  res.render('admin/messages', { title: 'Wiadomości', active: 'messages', messages, formatDate: H.formatDate });
});

app.post('/admin/messages/:id/read', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  req.flash('success', 'Oznaczono jako przeczytane.');
  res.redirect('/admin/messages');
});

app.post('/admin/messages/:id/delete', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  req.flash('success', 'Wiadomość usunięta.');
  res.redirect('/admin/messages');
});

// --- Newsletter subscribers ----------------------------------------------
app.get('/admin/newsletter', (req, res) => {
  const subs = db.prepare("SELECT * FROM subscribers ORDER BY created_at DESC").all();
  res.render('admin/newsletter', { title: 'Newsletter', active: 'newsletter', subs, formatDate: H.formatDate });
});

app.post('/admin/newsletter/:id/delete', (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id);
  req.flash('success', 'Adres usunięty.');
  res.redirect('/admin/newsletter');
});

// --- Settings ------------------------------------------------------------
app.get('/admin/settings', (req, res) => {
  res.render('admin/settings', { title: 'Ustawienia serwisu', active: 'settings', s: H.all() });
});

app.post('/admin/settings', upload.single('logo'), (req, res) => {
  const { site_name, site_tagline, footer_text, footer_copyright,
          social_facebook, social_twitter, social_instagram, social_youtube,
          accent_color } = req.body;
  const pairs = [
    ['site_name', site_name || ''],
    ['site_tagline', site_tagline || ''],
    ['footer_text', footer_text || ''],
    ['footer_copyright', footer_copyright || ''],
    ['social_facebook', social_facebook || ''],
    ['social_twitter', social_twitter || ''],
    ['social_instagram', social_instagram || ''],
    ['social_youtube', social_youtube || ''],
    ['accent_color', accent_color || '#EEC41E'],
  ];
  if (req.file) pairs.push(['logo_url', 'uploads/' + req.file.filename]);
  H.setMany(pairs);
  req.flash('success', 'Ustawienia zapisane.');
  res.redirect('/admin/settings');
});

// --- Account: change password (in-panel) --------------------------------
app.get('/admin/account', (req, res) => {
  res.render('admin/account', { title: 'Konto', active: 'account' });
});

app.post('/admin/account/password', (req, res) => {
  const { current, password, password_confirm } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(current || '', user.password_hash)) {
    req.flash('error', 'Aktualne hasło jest nieprawidłowe.');
    return res.redirect('/admin/account');
  }
  if (!password || password.length < 6) {
    req.flash('error', 'Nowe hasło musi mieć co najmniej 6 znaków.');
    return res.redirect('/admin/account');
  }
  if (password !== password_confirm) {
    req.flash('error', 'Hasła nie są takie same.');
    return res.redirect('/admin/account');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id);
  req.flash('success', 'Hasło zmienione.');
  res.redirect('/admin/account');
});

// --- 404 -----------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('admin/error', { title: '404', layout: false, status: 404, message: 'Nie znaleziono strony.' });
});

// --- error handler -------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[server] error:', err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', `Plik jest za duży (max ${config.maxUploadMB} MB).`);
    return res.redirect('back');
  }
  res.status(500).render('admin/error', { title: 'Błąd', layout: false, status: 500, message: err.message || 'Wewnętrzny błąd serwera.' });
});

// --- start ---------------------------------------------------------------
if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`[server] CMSik listening on http://${config.host}:${config.port}`);
    console.log(`[server] admin:  http://localhost:${config.port}/admin/login`);
  });
}

module.exports = app;
