const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const OrganizationModel = require('../models/organizationModel');
const { UPLOAD_DIR } = require('../middleware/fileUpload');

const CHAT_UPLOAD_DIR = path.join(__dirname, '..', '..', 'chat-uploads');
const DEFAULT_RETENTION_DAYS = 45;

// Deletes on-disk submission files and chat attachments belonging to
// interns that have been soft-deleted for more than FILE_RETENTION_DAYS.
// The intern/task/submission/chat-message ROWS are deliberately kept (so
// task history and the audit trail survive a departed intern) -- only the
// actual file content and its DB references are removed, since that's the
// sensitive data with no reason to persist indefinitely once the intern is
// gone and the retention window has passed.
const cleanupSoftDeletedInternFiles = async () => {
  const retentionDays = parseInt(process.env.FILE_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS;
  const organizations = await OrganizationModel.getAll();
  let filesRemoved = 0;

  for (const org of organizations) {
    const { rows: interns } = await pool.query(
      `SELECT id FROM interns
       WHERE organization_id = $1 AND deleted_at IS NOT NULL
         AND deleted_at < NOW() - make_interval(days => $2)`,
      [org.id, retentionDays]
    );

    for (const intern of interns) {
      // --- Submission files ---
      const { rows: files } = await pool.query(
        `SELECT f.id, f.storage_key FROM submission_files f
         JOIN submissions s ON s.id = f.submission_id
         WHERE s.intern_id = $1 AND s.organization_id = $2`,
        [intern.id, org.id]
      );
      for (const file of files) {
        const safeName = String(file.storage_key || '').replace(/^\/+/, '');
        const abs = path.resolve(UPLOAD_DIR, safeName);
        // Same path-traversal guard used everywhere else this directory is
        // touched (submissionController.downloadFile) -- storage_key is
        // server-generated, not user input, but there's no cost to keeping
        // the check consistent everywhere the directory is read from.
        if (abs.startsWith(path.resolve(UPLOAD_DIR) + path.sep) && fs.existsSync(abs)) {
          fs.unlinkSync(abs);
          filesRemoved++;
        }
      }
      if (files.length) {
        await pool.query('DELETE FROM submission_files WHERE id = ANY($1::int[])', [files.map(f => f.id)]);
      }

      // --- Chat attachments ---
      const { rows: messages } = await pool.query(
        `SELECT id, file_url FROM chat_messages
         WHERE intern_id = $1 AND organization_id = $2 AND file_url IS NOT NULL`,
        [intern.id, org.id]
      );
      for (const msg of messages) {
        const filename = path.basename(msg.file_url);
        const orgChatDir = path.join(CHAT_UPLOAD_DIR, String(org.id));
        const abs = path.resolve(orgChatDir, filename);
        if (abs.startsWith(path.resolve(orgChatDir) + path.sep) && fs.existsSync(abs)) {
          fs.unlinkSync(abs);
          filesRemoved++;
        }
      }
      if (messages.length) {
        // Message text/timestamp survive -- only the attachment reference
        // is stripped, matching the "keep the row, drop the file" policy
        // used for submissions above.
        await pool.query(
          `UPDATE chat_messages SET file_url = NULL, file_name = NULL, file_type = NULL WHERE id = ANY($1::int[])`,
          [messages.map(m => m.id)]
        );
      }
    }
  }

  return filesRemoved;
};

module.exports = { cleanupSoftDeletedInternFiles, DEFAULT_RETENTION_DAYS };
