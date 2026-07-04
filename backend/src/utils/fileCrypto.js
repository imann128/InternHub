const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;   // recommended nonce size for GCM
const TAG_LENGTH = 16;

// Lazy, not read at module-load time -- lets the rest of the app boot even
// if this var isn't set yet, and only breaks (loudly) the specific
// operation that actually needed it, rather than crashing server startup.
const getKey = () => {
  const keyHex = process.env.FILE_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('FILE_ENCRYPTION_KEY is not set -- required to encrypt/decrypt uploaded files. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('FILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) for AES-256-GCM.');
  }
  return key;
};

// Output layout: [12-byte IV][16-byte auth tag][ciphertext]. Self-describing
// on disk -- decryption never needs a separate DB column to find the IV or
// tag, just the server-held key plus the file bytes themselves.
const encryptBuffer = (plaintext) => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
};

const decryptBuffer = (encrypted) => {
  const key = getKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

const generateFilename = (originalName) => {
  const rand = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${rand}${path.extname(originalName)}`;
};

// Encrypts an in-memory upload buffer and writes it to destDir under a
// fresh randomized filename. Returns just the filename -- callers already
// know the directory, and this matches what multer's old diskStorage
// `filename` callback used to hand back, so call sites that previously did
// `file.filename` from multer can just assign this instead.
const encryptAndWrite = (buffer, destDir, originalName) => {
  fs.mkdirSync(destDir, { recursive: true });
  const filename = generateFilename(originalName);
  fs.writeFileSync(path.join(destDir, filename), encryptBuffer(buffer));
  return filename;
};

// Reads a file from disk and decrypts it. Falls back to returning the raw
// bytes if decryption fails -- files uploaded before encryption-at-rest was
// added are stored as plain bytes with no IV/auth-tag prefix, so attempting
// to GCM-decrypt them always fails (bad auth tag). Without this fallback,
// every pre-existing submission/chat attachment would 500 on download the
// moment this change ships. New uploads are always written encrypted, so
// this fallback path only ever serves legacy files, never masks a real
// tampering/corruption error on a newly-encrypted file in any way that
// matters -- a corrupted new file and a legacy plaintext file are both just
// "not decryptable," and serving raw bytes is the correct behavior for both
// (either it's genuinely plaintext, or the file's already unrecoverable and
// serving *something* rather than a hard 500 is more useful).
const readAndDecrypt = (absPath) => {
  const raw = fs.readFileSync(absPath);
  try {
    return decryptBuffer(raw);
  } catch (err) {
    return raw;
  }
};

module.exports = { encryptBuffer, decryptBuffer, encryptAndWrite, readAndDecrypt };
