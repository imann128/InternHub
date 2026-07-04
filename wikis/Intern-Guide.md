# Intern Guide

← [Home](Home.md)

Interns don't self-register — an admin adds you from the dashboard, and you receive your login credentials by email. Log in at `/intern/login`.

## One-time setup: face verification

Before you can check in for the first time, you'll be asked to verify your identity (`/intern/verify-identity`): the portal captures a face descriptor via your camera (`face-api.js`, run entirely in your browser) and stores it against your account. This is a one-time enrollment — from then on, every check-in compares your live face against this stored descriptor.

You'll also be asked to accept a consent notice before any biometric or location data is collected, with the specific policy version you accepted recorded against your account.

## Checking in / out

Attendance requires **two things to line up**, not just one:

1. **Location (GPS geofence)** — your admin assigns you to a physical location with a center point and radius. Your check-in is rejected if you're outside that radius (`backend/src/utils/geo.js`, haversine distance).
2. **Face match** — your camera captures your face at check-in time and it's compared against your enrolled descriptor (`backend/src/utils/faceMatch.js`).

Both must pass. This means neither GPS spoofing alone nor someone else holding your phone is enough to fake attendance for you. If you don't have a location assigned yet, checking in will tell you to contact your admin.

There's also a mobile-optimized check-in page (`/intern/mobile-checkin`) for exactly this flow on a phone.

## Dashboard

Your total tasks, completed/pending counts, attendance rate, progress bars (task completion, weekly hours, attendance), and your 5 most recent tasks.

## Tasks (`/intern/tasks`)

- See everything assigned to you: title, description, priority, due date, status, and any notes your admin added.
- Mark a pending task as done yourself.
- Overdue tasks are visually flagged.

## Attendance (`/intern/attendance`)

Your full history — date, status, check-in/check-out times, and total hours worked per day.

## Chat (`/intern/chat`)

A private conversation with your admin(s), plus any organization-wide announcements. You can attach files (encrypted at rest server-side).

## Settings (`/intern/settings`)

- Update your profile (name, email, department).
- Toggle dark mode, email notifications, and chat sounds.
- Re-verify your face enrollment if needed.
- Change your password.

## AI assistant

If your organization has AI features enabled, a chat bubble answers questions about how to use the intern portal — it's informational only and doesn't take actions for you.

## What happens if you're removed

If an admin removes you, your account is **soft-deleted**, not erased: you can no longer log in or check in, but your historical tasks, attendance, and submissions are preserved in the system for the organization's records. You'll also stop appearing in dashboards, active lists, and the chat list — you're just no longer treated as "currently active."
