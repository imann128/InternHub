# InternHub Wiki

InternHub (this repo, `Interns-Portal`) is a multi-tenant internship management platform: geofenced + face-verified attendance, task assignment and review, an AI assistant, real-time chat, and Slack/email notifications — with tenant isolation, optimistic concurrency, and audit logging built into the schema.

This wiki goes deeper than the [README](../README.md) on how the system actually works day to day. Start here, then jump to whichever page matches what you're trying to understand.

## Pages

- **[Architecture](Architecture.md)** — how a request flows through the system, the tech stack, the folder layout, and the scheduled background jobs.
- **[Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md)** — what an "organization" is, the two ways to become an admin (new org vs. invite code), how every query stays tenant-scoped, and how to verify isolation yourself.
- **[Admin Guide](Admin-Guide.md)** — everything an admin can do: interns, tasks, attendance, locations, chat, dashboard, and the Settings page (invite codes + AI key).
- **[Intern Guide](Intern-Guide.md)** — everything an intern can do: check-in/out, tasks, attendance history, chat, settings.
- **[Security](Security.md)** — auth model, CSRF, DB role separation, encryption at rest, retention policy, audit logging, rate limiting.
- **[Setup & Deployment](Setup-and-Deployment.md)** — environment variables, running migrations, DB role separation runbook, running the app locally.

## The one-paragraph version

Every organization that signs up gets a fully isolated workspace on the same deployment. An **admin** manages interns, assigns tasks, reviews submissions, tracks attendance, and configures the organization. An **intern** is added by an admin (they don't self-register), checks in/out from a phone with GPS + face verification, works through assigned tasks, and chats with the team. All of it is scoped by `organization_id` at the database layer, so two organizations sharing the same deployment never see each other's data — not even by guessing a resource ID.

## Where things live in the code

| Concept | Where |
|---|---|
| Organization model, invite codes, per-org AI key | `backend/src/models/organizationModel.js`, `backend/src/controllers/organizationController.js` |
| Signup (new org vs. invite-code join) | `backend/src/controllers/authController.js` (`signup`) |
| Every org-scoped table | `backend/src/config/migrate.js` |
| Tenant-scoped CRUD | `backend/src/models/*.js` — every function takes `organizationId` as its first argument |
| Admin dashboard UI | `frontend/src/pages/*.jsx` |
| Intern portal UI | `frontend/src/pages/intern/*.jsx` |
