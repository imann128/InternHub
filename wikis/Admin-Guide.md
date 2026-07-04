# Admin Guide

← [Home](Home.md)

Everything below is scoped to the admin's own organization — an admin never sees or affects another organization's data (see [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md)).

## Dashboard (`/dashboard`)

- Total interns, total tasks, completed/pending task counts.
- Department distribution and task-status distribution charts.
- Recent activity feed (task assignments, new interns, attendance marks).
- Intern performance table and "Intern of the Week" (scored on task completion rate + hours worked this week).
- Soft-deleted interns are excluded from every count and list here — their historical data stays in the database for audit purposes, it just doesn't appear as if they're still active.

## Interns (`/interns`)

- Add an intern (name, email, department, joining date) — they're emailed their login credentials automatically.
- Edit or soft-delete an intern (soft delete preserves their task/attendance/submission history; it doesn't remove rows).
- Toggle active/inactive status; filter by department or status; search by name.
- Assign an intern to a physical location (needed before they can check in — see **Locations** below).
- Open an intern's full profile: stats, task completion progress, weekly hours, attendance rate, recent attendance, and all assigned tasks.

## Tasks (`/tasks`)

- Assign a task to one or multiple interns at once — title, description, priority (low/medium/high), optional due date.
- **"Enhance with AI"** generates a fuller task description from just a title (hidden automatically if no Groq key is configured — see [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md#per-organization-configuration)).
- Filter by status or priority; mark done or reopen; edit details; delete (soft delete).
- Add notes/comments on a task — the intern gets an email notification.
- Overdue tasks are highlighted; a daily Slack alert also fires for tasks due within 3 days (if Slack is configured).

## Attendance (`/attendance`)

- **Daily tab** — mark interns present/absent, or manually check them in/out with timestamps.
- **Weekly tab** — total hours, days present/absent, progress against a 40-hour target per intern.
- Filter by date or intern; export to CSV.
- Interns normally self-check-in from the intern portal (GPS + face verification) — see [Intern Guide](Intern-Guide.md#checking-in--out) — but an admin can also mark attendance manually here.

## Locations (`/locations`)

- Add a named location (latitude/longitude, radius in meters). This is the geofence an intern's check-in is validated against.
- Assign interns to a location from the **Manage interns** panel — an intern with no assigned location can't check in.
- Deactivate/reactivate a location without deleting it (soft delete).

## Submissions

- Review what interns submit against their assigned tasks: approve, reject, or request revisions, with an optional score and feedback.

## Chat (`/chat`)

- One conversation per intern, plus an org-wide announcement channel.
- Attach files — encrypted at rest on the server (see [Security](Security.md#encryption-at-rest)).
- The conversation list excludes soft-deleted interns.

## Settings (`/settings`)

Two things live here, both organization-wide (not personal-account settings):

### Invite a co-admin

Generates a shareable invite code. Anyone who signs up with that code joins **your organization** as a second admin, instead of creating a new one. Regenerating the code immediately invalidates the old one. Full mechanics in [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md#2-join-an-existing-organization-as-a-second-admin-invite-code).

### AI assistant (Groq API key)

- If the server has a shared `GROQ_API_KEY` configured, AI features (portal chatbot + "Enhance with AI") work out of the box for every organization on that deployment.
- An admin can instead add their own Groq key here — from that point, their organization's AI usage is billed to their own Groq account, not the shared one. Removing it falls back to the shared key (if any).
- If neither key exists, AI features are hidden in the UI rather than shown and failing on click.

## AI portal assistant

A chat bubble (bottom-right, when AI is available) answers questions about how to use the portal — it has a description of every admin feature baked into its system prompt (`backend/src/controllers/aiController.js`), but it doesn't take actions on your behalf; it's informational only. It only ever talks to Groq through the backend — no API key is ever exposed to the browser.
