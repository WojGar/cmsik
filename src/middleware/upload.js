/** Multer storage for image uploads (logo, post images). */
const path  = require('path');
const fs    = require('fs');
const multer = require('multer');
const config = require('../config/app');

if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true, mode: 0o755 });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    const safe = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, safe);
  },
});

function fileFilter(req, file, cb) {
  const ok = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype);
  cb(ok ? null : new Error('Only image files are allowed'), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxUploadMB * 1024 * 1024 },
});

module.exports = upload;
