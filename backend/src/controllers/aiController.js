// AI features (assistant chat + task description enhancement) used to call
// Groq directly from the browser using REACT_APP_GROQ_API_KEY. Any
// REACT_APP_* variable gets bundled into the built JS and shipped to every
// visitor -- that key was readable by anyone who opened dev tools on the
// deployed site, regardless of gitignore/auth. Routing through the backend
// means the key only ever lives in server-side env vars, and every call is
// gated behind the same authMiddleware/adminOnly checks as everything else.
const Groq = require('groq-sdk');
const OrganizationModel = require('../models/organizationModel');

const MODEL = 'llama-3.3-70b-versatile';

// Not every org configures its own Groq key, and the server may or may not
// have a global GROQ_API_KEY -- resolve per-request instead of building one
// client at module load, so a missing key degrades to a clean error instead
// of crashing the process on boot. Precedence: org's own key first (so an
// org that pays for its own usage isn't billed against the shared server
// key), falling back to the server-wide key if the org hasn't set one.
const resolveClient = async (organizationId) => {
  const org = await OrganizationModel.getById(organizationId);
  const apiKey = org?.groq_api_key || process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
};

const AI_UNAVAILABLE = {
  success: false,
  message: "AI assistant isn't configured yet. An admin can add a Groq API key from Settings.",
};

// Caps how much conversation history is forwarded per request -- bounds
// cost/latency and prevents a client from replaying an ever-growing payload
// (each call is otherwise billed per input token).
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

const ADMIN_SYSTEM = `You are a helpful assistant for the Intern Management Portal — an admin dashboard.
You help the admin understand and use every feature of the portal. Be concise, friendly, and specific.

Here is everything the admin can do:

DASHBOARD: View total interns, tasks, completed/pending counts. See department distribution chart, task status chart, recent activity feed, and intern performance table.

INTERNS: Add new interns (name, email, department, joining date). Edit or delete interns. View intern profile (tasks, attendance, progress). Search by name. Filter by department or status (active/inactive). Toggle intern active/inactive status. Click View to open full profile.

INTERN PROFILE: Shows intern's stats, task completion progress bar, weekly hours progress, attendance rate, recent attendance records, and all assigned tasks.

TASKS: Assign tasks to one or multiple interns at once. Each task has title, description, priority (low/medium/high), due date. AI can enhance task description using Groq. Filter tasks by status or priority. Mark task done or reopen. Edit task details. Delete task. Add notes/comments on a task — intern gets email notification. Overdue tasks are highlighted in red with ⚠.

ATTENDANCE: Daily tab — mark interns present/absent, check in and check out with timestamps. Weekly tab — see total hours, days present/absent, 40hr target progress bar. Filter by date or intern. Export attendance to CSV.

EMAILS: System sends emails automatically for — new intern welcome + login credentials, task assigned, task overdue, task comment/note, weekly attendance report every Monday 8AM.

INTERN PORTAL: Interns log in at /intern/login using credentials emailed to them. They can view their dashboard, tasks (with supervisor notes), and attendance history. They can mark tasks as complete themselves.

Always answer based on this portal. If asked something unrelated, politely redirect.`;

const INTERN_SYSTEM = `You are a helpful assistant for the Intern Portal.
You help interns understand and use their portal. Be friendly, encouraging, and concise.

Here is everything an intern can do:

LOGIN: Go to /intern/login. Use the email and password sent to you when you were added by your admin.

DASHBOARD: See your total tasks, completed tasks, pending tasks, attendance rate, progress bars for task completion, weekly hours, and attendance. Also shows your 5 most recent tasks.

TASKS: See all tasks assigned to you. Each task shows title, description, priority (color-coded), due date, status, and supervisor notes/comments. You can mark pending tasks as done by clicking Mark Done. Overdue tasks are highlighted with ⚠.

ATTENDANCE: See your full attendance history — date, status (present/absent), check-in time, check-out time, and total hours worked.

EMAILS: You receive emails when — you are added to the portal (with login credentials), a task is assigned to you, a task is overdue, your supervisor adds a note on your task.

Always answer based on this intern portal. If asked something unrelated, politely redirect.`;

const TASK_ENHANCE_SYSTEM = 'You are a task manager assistant. Generate a clear, professional, and detailed task description for an intern. Keep it 3 to 5 sentences. No bullet points. Plain paragraph only.';

const chat = async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const groq = await resolveClient(req.user.organization_id);
    if (!groq) return res.status(503).json(AI_UNAVAILABLE);

    // Only forward role+content, truncated -- never trust/forward anything
    // else a client might stuff into a message object, and never forward an
    // unbounded string.
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, MAX_MESSAGE_LENGTH),
    }));

    const isAdmin = req.user.role === 'admin';
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: isAdmin ? ADMIN_SYSTEM : INTERN_SYSTEM },
        ...trimmed,
      ],
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '';
    res.json({ success: true, data: { reply } });
  } catch (err) { next(err); }
};

const enhanceTaskDescription = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const groq = await resolveClient(req.user.organization_id);
    if (!groq) return res.status(503).json(AI_UNAVAILABLE);

    const safeTitle = String(title).slice(0, 200);
    const safeDescription = String(description || '').slice(0, 1000);
    const context = safeDescription.trim()
      ? `Task title: "${safeTitle}". Admin's notes: "${safeDescription}".`
      : `Task title: "${safeTitle}".`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: TASK_ENHANCE_SYSTEM },
        { role: 'user', content: `${context} Generate a detailed description for this task.` },
      ],
      max_tokens: 200,
    });

    const enhanced = completion.choices[0]?.message?.content?.trim() || '';
    res.json({ success: true, data: { description: enhanced } });
  } catch (err) { next(err); }
};

// Lets the frontend decide whether to show the AI chat bubble / Enhance
// button at all, rather than showing them and then failing on every click.
const getStatus = async (req, res, next) => {
  try {
    const org = await OrganizationModel.getById(req.user.organization_id);
    const available = !!(org?.groq_api_key || process.env.GROQ_API_KEY);
    res.json({ success: true, data: { available } });
  } catch (err) { next(err); }
};

module.exports = { chat, enhanceTaskDescription, getStatus };
