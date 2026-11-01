/**
 * Initialise the database: ensure schema, create a default admin user,
 * seed the home page components, default menu, and default settings.
 *
 * Run with:  npm run init-db
 */
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');
const path = require('path');
const fs = require('fs');

// Force re-create schema from scratch if --reset is passed.
const reset = process.argv.includes('--reset');
if (reset) {
  console.warn('[seed] --reset: dropping all tables and re-seeding.');
  const tables = ['menu_items','settings','subscribers','messages','posts','components','pages','password_resets','users'];
  tables.forEach(t => db.exec(`DROP TABLE IF EXISTS ${t};`));
  const sql = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
  db.exec(sql);
}

// ---------- 1. Default admin user -------------------------
const ADMIN_EMAIL = 'admin@cmsik.local';
const ADMIN_PASS  = 'admin123';
let admin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!admin) {
  const hash = bcrypt.hashSync(ADMIN_PASS, 10);
  db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?,?,?)'
  ).run(ADMIN_EMAIL, hash, 'Administrator');
  admin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  console.log(`[seed] admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
} else {
  console.log('[seed] admin user already exists');
}

// ---------- 2. Home page ----------------------------------
let home = db.prepare('SELECT id FROM pages WHERE is_home = 1').get();
if (!home) {
  db.prepare(
    'INSERT INTO pages (title, slug, status, is_home, published_at) VALUES (?,?,?,?,datetime(\'now\'))'
  ).run('Home', 'home', 'published', 1);
  home = db.prepare('SELECT id FROM pages WHERE is_home = 1').get();
}
const homeId = home.id;

// ---------- 3. Home page components -----------------------
const components = [
  // --- Home hero section ---
  { block_type: 'hero', key: 'home_title',        label: 'Explore the world with', text: 'TraveLand',           position: 1 },
  { block_type: 'hero', key: 'home_subtitle',     label: '',                          text: 'Discover amazing places at exclusive deals. We make every journey meaningful.', position: 2 },
  { block_type: 'hero', key: 'home_button_text',  label: '',                          text: 'Get Started', position: 3 },
  { block_type: 'hero', key: 'home_button_link',  label: '',                          text: '#services',  position: 4 },
  { block_type: 'hero', key: 'home_image',        label: '',                          text: '', image_url: 'traveland/assets/images/hero-area.jpg', position: 5 },

  // --- About section heading ---
  { block_type: 'section_heading', key: 'about_eyebrow', label: 'About Us', text: '', position: 1 },
  { block_type: 'section_heading', key: 'about_title',   label: '', text: 'We make every journey <span>meaningful</span>', position: 2 },
  { block_type: 'about',           key: 'about_text_1',  label: '', text: 'TraveLand is a team of curious travellers who believe the best trips feel personal. We combine local knowledge, thoughtful planning and flexible support to help you discover more.', position: 3 },
  { block_type: 'about',           key: 'about_text_2',  label: '', text: 'From a first weekend away to a once-in-a-lifetime adventure, we take care of the details so you can focus on the moments that matter.', position: 4 },
  { block_type: 'about',           key: 'about_button_text', label: '', text: 'Explore packages', position: 5 },
  { block_type: 'about',           key: 'about_button_link', label: '', text: '#services', position: 6 },
  { block_type: 'about',           key: 'about_image',   label: '', text: '', image_url: 'traveland/assets/images/about_image.jpg', position: 7 },

  // --- About counters (4) ---
  { block_type: 'counter', key: 'counter_1', label: '534',  text: 'Trips completed', position: 1 },
  { block_type: 'counter', key: 'counter_2', label: '424',  text: 'Happy clients',   position: 2 },
  { block_type: 'counter', key: 'counter_3', label: '35',   text: 'Countries visited', position: 3 },
  { block_type: 'counter', key: 'counter_4', label: '15',   text: 'Travel experts',  position: 4 },

  // --- Services section heading + 3 tiles ---
  { block_type: 'section_heading', key: 'services_eyebrow', label: 'Services', text: '', position: 1 },
  { block_type: 'section_heading', key: 'services_title',   label: '', text: 'How we plan your <span>journey</span>', position: 2 },
  { block_type: 'service_tile', key: 'service_1', icon: 'lni lni-guide',         label: 'Tour guide',   text: 'Friendly local guides who show you the side of the city most travellers never see.', position: 1 },
  { block_type: 'service_tile', key: 'service_2', icon: 'lni lni-calendar',      label: 'Booking',      text: 'Flexible bookings for flights, hotels and experiences — change your mind without losing the plan.', position: 2 },
  { block_type: 'service_tile', key: 'service_3', icon: 'lni lni-briefcase',     label: 'Trip planning',text: 'A clear framework built around the moments that matter most to you.', position: 3 },

  // --- Blog section heading ---
  { block_type: 'section_heading', key: 'blog_eyebrow', label: 'Recent Blog Post', text: '', position: 1 },
  { block_type: 'section_heading', key: 'blog_title',   label: '', text: 'Stories from the <span>road</span>', position: 2 },

  // --- Contact section heading ---
  { block_type: 'section_heading', key: 'contact_eyebrow', label: 'Get in Touch', text: '', position: 1 },
  { block_type: 'section_heading', key: 'contact_title',   label: '', text: 'Plan your <span>next trip</span>', position: 2 },
  { block_type: 'section_heading', key: 'contact_text',    label: '', text: 'Tell us where you would like to go and we will help you build the perfect plan.', position: 3 },

  // --- Footer blocks ---
  { block_type: 'footer_block', key: 'footer_about', label: '', text: 'Thoughtful travel planning for curious people.', position: 1 },

  // =========================================================
  // Landing page components (about / services / blog / contact)
  // Stored against the home page (section_id = homeId) so they are
  // grouped under a single known id; the key prefix identifies the LP.
  // =========================================================

  // --- About LP ---
  { block_type: 'lp_hero',     key: 'about_lp_hero_title',       label: '', text: 'About TraveLand', position: 1 },
  { block_type: 'lp_hero',     key: 'about_lp_hero_subtitle',    label: '', text: 'We make every journey meaningful.', position: 2 },
  { block_type: 'lp_section',  key: 'about_lp_intro_title',      label: '', text: 'We are a team of curious travellers', position: 3 },
  { block_type: 'lp_section',  key: 'about_lp_intro_text',       label: '', text: 'TraveLand started in 2015 with a single idea: that travel should feel personal. Today we are a small team of planners, guides and writers who believe the best trips are the ones that match the way you actually want to travel. We combine local knowledge with thoughtful logistics and a friendly, flexible approach.\n\nWhether you are planning a weekend city break, a once-in-a-lifetime adventure, or a slow month somewhere new, we help you build a journey that feels like yours.', position: 4 },
  { block_type: 'lp_section',  key: 'about_lp_intro_image',      label: '', text: '', image_url: 'traveland/assets/images/about_image.jpg', position: 5 },
  { block_type: 'lp_section',  key: 'about_lp_team_text',        label: '', text: 'Our team brings together 12 people working across 3 countries — planners, local guides and writers who share a love of slow, thoughtful travel.', position: 6 },

  // --- About LP: Values (dynamic list, block_type=value) ---
  { block_type: 'value', key: 'value_1', icon: 'lni lni-heart',     label: 'Personal, not packaged', text: 'No two travellers are alike. Every plan we build starts with a conversation about you.', position: 10 },
  { block_type: 'value', key: 'value_2', icon: 'lni lni-leaf',      label: 'Slow when it counts',    text: 'We design trips that leave room for the unplanned moments — often the most memorable.', position: 20 },
  { block_type: 'value', key: 'value_3', icon: 'lni lni-handshake', label: 'Local partners',         text: 'We work with local guides and family-run hotels wherever we can. Your trip supports the places you visit.', position: 30 },

  // --- Services LP ---
  { block_type: 'lp_hero',     key: 'services_lp_hero_title',    label: '', text: 'Our services', position: 1 },
  { block_type: 'lp_hero',     key: 'services_lp_hero_subtitle', label: '', text: 'Everything you need to plan, book and enjoy your next trip.', position: 2 },
  { block_type: 'lp_section',  key: 'services_lp_intro',         label: '', text: 'We offer a focused set of services rather than a long menu. Each one is built around how people actually travel — and how they want to feel while they do it.', position: 3 },
  { block_type: 'lp_section',  key: 'services_lp_process_title', label: '', text: 'How we work together', position: 4 },

  // --- Services LP: Service items (dynamic list, block_type=service_full) ---
  { block_type: 'service_full', key: 'service_full_1', icon: 'lni lni-guide',     label: 'Tour guide',          text: 'Friendly local guides who show you the side of the city most travellers never see. Half-day or full-day options, available in English, Spanish and Polish.', image_url: 'traveland/assets/images/blog-1.jpg', position: 10 },
  { block_type: 'service_full', key: 'service_full_2', icon: 'lni lni-calendar',  label: 'Booking',             text: 'Flexible bookings for flights, hotels and experiences. Change your mind without losing the plan — we hold the framework and you hold the freedom.', image_url: 'traveland/assets/images/blog-2.jpg', position: 20 },
  { block_type: 'service_full', key: 'service_full_3', icon: 'lni lni-briefcase', label: 'Trip planning',       text: 'A clear framework built around the moments that matter most to you. From the first idea to the last night home, every detail is matched to how you want to travel.', image_url: 'traveland/assets/images/blog-3.jpg', position: 30 },
  { block_type: 'service_full', key: 'service_full_4', icon: 'lni lni-map',       label: 'Custom itineraries',  text: 'Bespoke day-by-day itineraries with maps, recommendations and offline access. Built around your pace, your interests and your budget.', image_url: '', position: 40 },

  // --- Services LP: Process steps (dynamic list, block_type=process_step) ---
  // Number is derived from position at render time (1, 2, 3...).
  { block_type: 'process_step', key: 'process_step_1', label: 'Tell us your idea',  text: 'A short call or email about where, when and how you want to travel. No pressure, no commitment.', position: 10 },
  { block_type: 'process_step', key: 'process_step_2', label: 'We build a plan',    text: 'Within a few days you receive a custom itinerary with options, prices and alternatives.', position: 20 },
  { block_type: 'process_step', key: 'process_step_3', label: 'You approve & book', text: 'Adjust anything you like. Once you are happy, we handle the bookings and confirmations.', position: 30 },
  { block_type: 'process_step', key: 'process_step_4', label: 'You travel',         text: 'Enjoy the trip. We stay reachable throughout for last-minute changes or local advice.', position: 40 },

  // --- Blog LP ---
  { block_type: 'lp_hero',     key: 'blog_lp_hero_title',        label: '', text: 'Stories from the road', position: 1 },
  { block_type: 'lp_hero',     key: 'blog_lp_hero_subtitle',     label: '', text: 'Travel notes, planning tips and field reports from the TraveLand team.', position: 2 },

  // --- Contact LP ---
  { block_type: 'lp_hero',     key: 'contact_lp_hero_title',     label: '', text: 'Get in touch', position: 1 },
  { block_type: 'lp_hero',     key: 'contact_lp_hero_subtitle',  label: '', text: 'Tell us where you would like to go and we will help you build the perfect plan.', position: 2 },
];

const compStmt = db.prepare(`
  INSERT INTO components (section_id, block_type, key, label, text, icon, image_url, link, position, is_visible)
  VALUES (?,?,?,?,?,?,?,?,?,1)
`);
const existingComp = db.prepare('SELECT COUNT(*) AS c FROM components WHERE section_id = ?').get(homeId);
if (existingComp.c === 0) {
  const tx = db.transaction((rows) => rows.forEach(r => compStmt.run(homeId, r.block_type, r.key, r.label, r.text, r.icon || null, r.image_url || null, r.link || null, r.position)));
  tx(components);
  console.log(`[seed] inserted ${components.length} home components`);
} else {
  console.log(`[seed] components already present (${existingComp.c})`);
}

// ---------- 4. Default menu items -------------------------
const menu = [
  { label: 'Home',     target_section: 'home',     position: 1 },
  { label: 'About',    target_section: 'about',    position: 2 },
  { label: 'Services', target_section: 'services', position: 3 },
  { label: 'Blog',     target_section: 'blog',     position: 4 },
  { label: 'Contact',  target_section: 'contact',  position: 5 },
];
const menuCount = db.prepare('SELECT COUNT(*) AS c FROM menu_items').get();
if (menuCount.c === 0) {
  const stmt = db.prepare('INSERT INTO menu_items (label, target_section, position, is_visible) VALUES (?,?,?,1)');
  const tx = db.transaction((rows) => rows.forEach(r => stmt.run(r.label, r.target_section, r.position)));
  tx(menu);
  console.log(`[seed] inserted ${menu.length} menu items`);
} else {
  console.log(`[seed] menu already present (${menuCount.c})`);
}

// ---------- 5. Default settings ---------------------------
const settings = [
  ['site_name',       'TraveLand'],
  ['site_tagline',    'Tour & Travel Agency'],
  ['logo_url',        'traveland/assets/images/logo.svg'],
  ['logo_alt_url',    'traveland/assets/images/logo-2.svg'],
  ['footer_text',     'Thoughtful travel planning for curious people.'],
  ['footer_copyright','Design and code by UIdeck (MIT). Distributed by ThemeWagon.'],
  ['social_facebook', 'https://facebook.com/'],
  ['social_twitter',  'https://twitter.com/'],
  ['social_instagram','https://instagram.com/'],
  ['social_youtube',  'https://youtube.com/'],
  ['accent_color',    '#EEC41E'],
  ['admin_email',     ADMIN_EMAIL],
  ['posts_per_home',  '3'],
  // Contact LP info (formerly in contact_info table)
  ['contact_address',       'ul. Floriańska 12, 31-019 Kraków, Poland'],
  ['contact_phone',         '+48 12 345 67 89'],
  ['contact_email',         'hello@traveland.example'],
  ['contact_hours_week',    'Pon — Pt: 9:00 — 18:00'],
  ['contact_hours_weekend', 'Sob: 10:00 — 14:00'],
  ['contact_map_embed_url', 'https://www.openstreetmap.org/export/embed.html?bbox=19.9384%2C50.0638%2C19.9484%2C50.0688&layer=mapnik&marker=50.0663%2C19.9434'],
];
const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
const txSet = db.transaction((rows) => rows.forEach(r => setStmt.run(r[0], r[1])));
txSet(settings);
console.log(`[seed] settings ensured (${settings.length})`);

// ---------- 6. A few example posts ------------------------
const postsCount = db.prepare("SELECT COUNT(*) AS c FROM posts").get();
if (postsCount.c === 0) {
  const postStmt = db.prepare(`
    INSERT INTO posts (title, author, published_at, image, body, status)
    VALUES (?,?,datetime('now'),?,?,'published')
  `);
  const sample = [
    {
      title: 'How to plan a trip that feels like you',
      author: 'Marta Kowalska',
      image: 'traveland/assets/images/blog-1.jpg',
      body: 'The best itineraries start with a feeling, not a list of landmarks. Before you choose flights or hotels, think about how you want the trip to feel: energising, restorative, curious or full of food.\n\nBuild around the moments. Choose two or three experiences that matter most and give them space. A little unplanned time often becomes the most memorable part of a journey.\n\nLeave room to change your mind. Good planning gives you confidence without taking away spontaneity. We recommend a clear framework, flexible bookings and local advice when you arrive.'
    },
    {
      title: 'Five small towns worth a detour',
      author: 'Jan Nowak',
      image: 'traveland/assets/images/blog-2.jpg',
      body: 'Some of the most rewarding stops are the ones you almost skipped. Here are five small towns where the pace of life invites you to slow down and notice the details — the bakery on the corner, the painted shutters, the local market that opens only on Sundays.\n\nEach town pairs well with a bigger city nearby, so you can build a route that mixes the famous with the quietly wonderful.'
    },
    {
      title: 'Packing light without giving up comfort',
      author: 'Marta Kowalska',
      image: 'traveland/assets/images/blog-3.jpg',
      body: 'A small, well-chosen bag beats a heavy one almost every time. Start with the things you cannot replace — passport, medication, one good pair of shoes — and then ask of every extra item whether it earns its place.\n\nThe trick is layers: a thin base layer, a warm mid-layer and a weatherproof shell cover almost any climate. Pack two pairs of socks fewer than you think you need and one more shirt than you think you need.'
    },
  ];
  const txP = db.transaction((rows) => rows.forEach(r => postStmt.run(r.title, r.author, r.image, r.body)));
  txP(sample);
  console.log(`[seed] inserted ${sample.length} sample posts`);
} else {
  console.log(`[seed] posts already present (${postsCount.c})`);
}

// ---------- 7. Static pages (Privacy Policy) --------------
const spCount = db.prepare('SELECT COUNT(*) AS c FROM static_pages').get();
if (spCount.c === 0) {
  db.prepare(`INSERT INTO static_pages (title, slug, body, is_visible) VALUES (?,?,?,1)`).run(
    'Privacy Policy',
    'privacy-policy',
    'This is a sample privacy policy page. Replace this text with your real policy in the admin panel under "Strony statyczne".\n\nWe collect only the information you submit through the contact and newsletter forms: your name, email, phone number and message. We use it solely to respond to your enquiry and never share it with third parties without your consent.\n\nYou can request access to, correction of, or deletion of your personal data at any time by writing to the email address listed on the Contact page.'
  );
  console.log('[seed] inserted 1 static page (privacy-policy)');
} else {
  console.log(`[seed] static_pages already present (${spCount.c})`);
}

console.log('\n[seed] done.');
console.log('Default admin login:');
console.log(`  email:    ${ADMIN_EMAIL}`);
console.log(`  password: ${ADMIN_PASS}`);
