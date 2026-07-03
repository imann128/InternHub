const pool = require('./config/db');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/authMiddleware');
const cron = require('node-cron');
const AttendanceModel = require('./models/attendanceModel');
const AdminModel = require('./models/adminModel');
const OrganizationModel = require('./models/organizationModel');
const emailService = require('./services/emailService');
const TaskModel = require('./models/taskModel');
const InternModel = require('./models/internModel');
const slackService = require('./services/slackService');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));

app.use('/api/interns', authMiddleware, require('./routes/internRoutes'));
app.use('/api/intern', require('./routes/internPortalRoutes'));
app.use('/api/tasks', authMiddleware, require('./routes/taskRoutes'));
app.use('/api/attendance', authMiddleware, require('./routes/attendanceRoutes'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboardRoutes'));

app.use('/api/chat', authMiddleware, require('./routes/chatRoutes'));
app.use('/api/submissions', authMiddleware, require('./routes/submissionRoutes'));
app.use('/api/locations', authMiddleware, require('./routes/locationRoutes'));

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

// Every Monday at 8:00 AM — send weekly attendance report, per organization
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
            const rows = await AttendanceModel.getWeeklySummary(org.id, {});
            await slackService.notifyWeeklyDigest(org, { week_start, week_end, rows }).catch(() => { });
        }
    } catch (err) { console.error('Slack weekly digest error:', err.message); }
});

// Deadline alerts — every day at 9AM, per organization
cron.schedule('0 9 * * *', async () => {
    try {
        const organizations = await OrganizationModel.getAll();
        for (const org of organizations) {
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
        }
    } catch (err) { console.error('Deadline alert error:', err.message); }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));