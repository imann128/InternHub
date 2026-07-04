// middleware/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'submissions');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Memory storage, not disk -- files are encrypted (AES-256-GCM) before ever
// touching disk, which means multer can't write them directly the way
// diskStorage did. The controller reads `file.buffer` and calls
// fileCrypto.encryptAndWrite() itself once it knows the org-scoped
// destination directory.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    const err = new Error(`"${file.originalname}" is not an allowed file type.`);
    // Explicit 400 so errorHandler.js treats this as a safe, operational
    // message to show the client instead of masking it behind a generic
    // "Internal Server Error" in production.
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 5 },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_MIME, MAX_SIZE };
