/** Application configuration (env-first with sensible defaults). */
// Note: optional dotenv — if you want .env support, install it (`npm i dotenv`)
// and uncomment the next line.
// require('dotenv').config();

module.exports = {
  port:         process.env.PORT || 3000,
  host:         process.env.HOST || '0.0.0.0',
  sessionSecret: process.env.SESSION_SECRET || 'cmsik-dev-secret-change-me',
  uploadDir:    require('path').join(__dirname, '..', '..', 'public', 'uploads'),
  maxUploadMB:  5,
  isProd:       process.env.NODE_ENV === 'production',
};
