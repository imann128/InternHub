const pool = require('./config/db');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/authMiddleware');
const csrfProtection = require('./middleware/csrfMiddleware');
const cron = require('node-cron');
const AttendanceModel = require('./models/attendanceModel');
const AdminModel = require('./models/adminModel');
const OrganizationModel = require('./models/organizationModel');
const emailService = require('./services/emailService');
const TaskModel = require('./models/taskModel');
const InternModel = require('./models/internModel');
const slackService = require('./services/slackService');
const { cleanupSoftDeletedInternFiles } = require('./services/retentionService');

const app = express();

// Behind a reverse proxy (nginx on the EC2 box) in production -- needed so
// req.ip / req.secure reflect the real client, not the proxy hop, which the
// `secure` cookie flag and rate limiting both depend on being accurate.
app.set('trust proxy', 1);

// Security headers (also disables X-Powered-By, sets a restrictive CSP by default).
app.use(helmet());

// credentials: true is required for the browser to send/receive the
// HttpOnly auth cookies cross-origin (frontend and backend are different
// origins -- CRA dev server vs API, or separate subdomains in production).
// origin must be an explicit allowlist, not '*', once credentials are on.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(cookieParser());

// Body size caps -- blunts payload-based DoS. No route in this app currently
// needs a raw/unparsed body (no inbound Slack webhook exists here), so this
// sits ahead of everything safely.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// HTTP Parameter Pollution guard -- collapses ?a=1&a=2 duplicate query keys
// instead of letting downstream code silently receive an array where it
// expected a string.
app.use(hpp());

// Global rate limit -- blunt volume control, independent of any per-account
// login-attempt tracking (that's a separate, not-yet-added mechanism).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter limit specifically on auth endpoints (login/signup) -- these are
// the highest-value target for brute-force/credential-stuffing traffic.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

// AI endpoints call out to Groq, which costs money per request -- a tighter
// limit than the general API traffic cap, independent of it, so a chatty
// user (or a bug that loops) can't run up an unbounded bill.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests, please slow down.' },
});

// CSRF double-submit check, applied globally to every mutating request.
// Exempt only the handful of entry points a client can legitimately call
// before it has ever received a csrf_token cookie -- everything else
// (including /refresh and /logout) runs after at least one successful
// login/signup, so the cookie is guaranteed to already exist by then.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/signup', '/api/auth/intern/login']);
app.use((req, res, next) => {
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();
  return csrfProtection(req, res, next);
});

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));

app.use('/api/interns', authMiddleware, require('./routes/internRoutes'));
app.use('/api/intern', require('./routes/internPortalRoutes'));
app.use('/api/tasks', authMiddleware, require('./routes/taskRoutes'));
app.use('/api/attendance', authMiddleware, require('./routes/attendanceRoutes'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboardRoutes'));

app.use('/api/chat', authMiddleware, require('./routes/chatRoutes'));
app.use('/api/submissions', authMiddleware, require('./routes/submissionRoutes'));
app.use('/api/locations', authMiddleware, require('./routes/locationRoutes'));
app.use('/api/organizations', authMiddleware, require('./routes/organizationRoutes'));
app.use('/api/ai', authMiddleware, aiLimiter, require('./routes/aiRoutes'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/test-email', async (req, res) => {
    const emailService = require('./services/emailService');
    try {
        await emailService.sendAdminWelcome({ name: 'Test', email: process.env.GMAIL_USER });
        res.json({ success: true, message: 'Email sent' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Cron jobs aren't behind authMiddleware (there's no HTTP request to hang a
// scoped client off), but they still touch RLS-protected tables per
// organization -- each per-org iteration below is wrapped in its own scoped
// client so `pool.query(...)` inside AttendanceModel/etc. sees that org's
// rows, same as it would during a real request. See config/db.js.
const withOrgScope = async (organizationId, fn) => {
    const client = await pool.getScopedClient(organizationId);
    try {
        return await pool.runScoped(client, fn);
    } finally {
        await pool.releaseScopedClient(client);
    }
};

// Every Monday at 8:00 AM -- send weekly attendance report, per organization
cron.schedule('0 8 * * 1', async () => {
    try {
        const now = new Date();
        const day = now.getDay();
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - (day === 0 ? 13 : day + 6));
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);

        const week_start = lastMonday.toISOString().slice(0, 10);
        const week_end = lastSunday.toISOString().slice(0, 10);

        const organizations = await OrganizationModel.getAll();
        for (const org of organizations) {
            await withOrgScope(org.id, async () => {
                const rows = await AttendanceModel.getWeeklySummary(org.id, {});
                const admins = await AdminModel.getAll(org.id);

                for (const admin of admins) {
                    await emailService.sendWeeklyReport({
                        admin_email: admin.email,
                        admin_name: admin.name,
                        week_start,
                        week_end,
                        rows,
                    }).catch(() => { });
                }
            });
        }
        console.log('Weekly report sent');
    } catch (err) {
        console.error('Cron error:', err.message);
    }
});

// Weekly Slack digest, per organization
cron.schedule('0 8 * * 1', async () => {
    try {
        const now = new Date();
        const day = now.getDay();
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - (day === 0 ? 13 : day + 6));
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        const week_start = lastMonday.toISOString().slice(0, 10);
        const week_end = lastSunday.toISOString().slice(0, 10);

        const organizations = await OrganizationModel.getAll();
        for (const org of organizations) {
            await withOrgScope(org.id, async () => {
                const rows = await AttendanceModel.getWeeklySummary(org.id, {});
                await slackService.notifyWeeklyDigest(org, { week_start, week_end, rows }).catch(() => { });
            });
        }
    } catch (err) { console.error('Slack weekly digest error:', err.message); }
});

// Deadline alerts -- every day at 9AM, per organization
cron.schedule('0 9 * * *', async () => {
    try {
        const organizations = await OrganizationModel.getAll();
        for (const org of organizations) {
            await withOrgScope(org.id, async () => {
                const result = await pool.query(`
                  SELECT t.id, t.title, t.due_date, i.name as intern_name
                  FROM tasks t
                  JOIN interns i ON t.intern_id = i.id
                  WHERE t.status = 'pending'
                    AND t.due_date IS NOT NULL
                    AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
                    AND t.organization_id = $1
                `, [org.id]);
                for (const task of result.rows) {
                    const daysLeft = Math.ceil((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                    await slackService.notifyDeadlineAlert(org, {
                        intern_name: task.intern_name,
                        task_title: task.title,
                        due_date: task.due_date,
                        days_left: daysLeft,
                    }).catch(() => { });
                }
            });
        }
    } catch (err) { console.error('Deadline alert error:', err.message); }
});

// Daily at 3am -- off-peak, since this does disk I/O across every
// organization. Deletes submission files and chat attachments belonging to
// interns soft-deleted for longer than FILE_RETENTION_DAYS (default 45).
// See services/retentionService.js for exactly what is and isn't deleted.
cron.schedule('0 3 * * *', async () => {
    try {
        const removed = await cleanupSoftDeletedInternFiles();
        if (removed > 0) console.log(`Retention cleanup: removed ${removed} file(s) from soft-deleted interns`);
    } catch (err) { console.error('Retention cleanup error:', err.message); }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
