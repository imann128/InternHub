# Multi-Tenancy & Organizations

← [Home](Home.md)

This is the page that matters most for understanding how one deployment safely serves many companies at once.

## What an "organization" is

An `organizations` row is the tenant boundary. Every piece of data that isn't a raw auth credential — interns, tasks, attendance, submissions, locations, chat messages, audit logs — carries an `organization_id` foreign key. There is no shared pool of data between organizations; two organizations on the same deployment are, from a data-access standpoint, running on separate systems that happen to share a database and a server process.

```sql
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slack_bot_token VARCHAR(255),
  slack_channel_id VARCHAR(100),
  slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  admin_invite_code VARCHAR(64) UNIQUE,
  groq_api_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Two ways to become an admin

Signup (`POST /api/auth/signup`, handled in `backend/src/controllers/authController.js`) supports two mutually exclusive paths:

### 1. Create a new organization (the default)

You provide the global `signup_key`, which must match the server's `ADMIN_SIGNUP_KEY` environment variable. This is a single shared secret the deploying company controls — anyone who has it can spin up a brand-new, empty organization and become its first admin.

```
signup_key = <ADMIN_SIGNUP_KEY>
organization_name = "Acme Corp"   // optional, defaults to "<your name>'s Organization"
```

This is the only way a *new* organization ever gets created. There's no "browse existing organizations" step — it's intentionally a closed door unless you hold the key.

### 2. Join an existing organization as a second admin (invite code)

An existing admin generates an invite code from their **Settings** page (`frontend/src/pages/Settings.jsx` → `POST /api/organizations/invite-code/regenerate`). That code is a random 10-character string stored on their `organizations` row. Anyone who signs up with that code instead of the signup key joins *that same organization* as a second admin — no new organization is created:

```
invite_code = <code the admin shared with you>
```

```js
// backend/src/controllers/authController.js, signup()
let organization = null;
if (invite_code) {
  organization = await OrganizationModel.findByInviteCode(invite_code);
  if (!organization) return 403; // invalid/expired code
} else if (signup_key !== process.env.ADMIN_SIGNUP_KEY) {
  return 403;
}
// ...if no organization was found via invite code, create a brand-new one
```

An invite code is **reusable until regenerated** — it's not single-use. Regenerating (the same button, clicked again) immediately invalidates the old code; anyone still holding it can no longer use it. There is currently no expiry timer — a generated code is valid indefinitely until an admin explicitly regenerates it.

Both signup paths converge on the same result: a row in `admins` with an `organization_id`, and a login session. From that point on, there is no functional difference between an admin who created the organization and one who joined it via invite code — both have full admin rights within that organization. (There's no separate "owner" vs. "admin" tier today.)

The frontend surfaces this as a toggle on the signup page (`frontend/src/pages/Signup.jsx`): **"New organization"** vs. **"Join with invite code."**

## No workspace picker at login

Login (`POST /api/auth/login`) only takes an email and password — never an organization. This works because **admin and intern email addresses are globally unique across the entire deployment**, not per-organization (`AdminModel.findByEmail`, `InternModel.findByEmail` search across all orgs). A person's `organization_id` is resolved server-side from whichever account that email belongs to, then baked into their JWT (`signAccessToken({ id, role, organizationId })`). The frontend never asks "which company do you work for" — it can't, because the account itself already knows.

One consequence: the same email can't be an admin in two different organizations. If you need to help run two separate companies' instances, you need two separate email addresses.

## How every query stays tenant-scoped

Every model function takes `organizationId` as a mandatory, explicit first argument:

```js
// backend/src/models/taskModel.js
getAll: async (organizationId, { status, intern_id, priority, page, limit }) => { ... }
getById: async (organizationId, id) => { ... }
update: async (organizationId, id, { ... }) => { ... }
```

Every `WHERE` clause includes `AND organization_id = $1` (or a join through a table that itself is filtered by it). There's no default, no "current org" global variable, no way to accidentally omit it — the function signature forces the caller to supply it, and the caller only ever has one to supply: `req.user.organization_id`, which came from the verified JWT, not from anything the client can influence via a request body or query string.

This is why cross-tenant access attempts return **404, not 403** (see [Security](Security.md)) — the query for "task 47 in organization 3" simply returns zero rows if task 47 actually belongs to organization 8. The API can't distinguish "doesn't exist" from "exists but isn't yours," which is the point: a 403 would confirm the resource exists somewhere.

## Per-organization configuration

Two features are configured per-organization rather than globally, both managed from the admin **Settings** page:

- **Slack integration** — `slack_bot_token`, `slack_channel_id`, `slack_enabled` columns on `organizations`. (Currently set directly in the database; there's no UI for this yet — `OrganizationModel.updateSlackConfig` exists but isn't wired to a route.)
- **AI assistant key** — `groq_api_key` column on `organizations`. If an org sets its own Groq key, the AI assistant and "Enhance with AI" feature use it (and that org is billed on its own Groq account). If not, they fall back to the server-wide `GROQ_API_KEY` environment variable. If *neither* is set, AI features are hidden in the UI rather than shown and failing — see `GET /api/ai/status`.

```js
// backend/src/controllers/aiController.js
const resolveClient = async (organizationId) => {
  const org = await OrganizationModel.getById(organizationId);
  const apiKey = org?.groq_api_key || process.env.GROQ_API_KEY;
  if (!apiKey) return null; // → 503, and the frontend hides the feature
  return new Groq({ apiKey });
};
```

## Verifying isolation yourself

1. Sign up admin A with the signup key, creating "Org A."
2. Sign up admin B with a *different* signup key attempt or the same key but no invite code — creates a separate "Org B."
3. Add an intern and a task under Org A. Note the task's ID from the URL or network tab.
4. Log in as admin B and try to load that same task ID directly (e.g. hit the task detail route or API endpoint with Org A's task ID). It should return 404, not the task's data and not a 403.
5. Generate an invite code as admin A (Settings page), then sign up a third admin, admin C, using that code. Admin C should now see Org A's interns/tasks/dashboard — confirming the invite path joins the *same* org rather than creating a new one.
