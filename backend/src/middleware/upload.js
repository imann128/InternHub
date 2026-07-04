// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../chat-uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Memory storage, not disk -- see fileUpload.js for why (files are
// encrypted with fileCrypto.encryptAndWrite() before being written).
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|xlsx|xls|ppt|pptx|zip/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) return cb(null, true);
    // Explicit 400 so errorHandler.js treats this as a safe, operational
    // message to show the client instead of masking it behind a generic
    // "Internal Server Error" in production.
    const err = new Error('File type not allowed');
    err.status = 400;
    cb(err);
  },
});

module.exports = upload;
