-- One-off backfill for accounts that predate multi-org support (e.g. rows
-- created by seed.js, or any admin/intern signed up before organization_id
-- existed). Without this, authMiddleware/refresh reject these accounts
-- forever with "Session expired" / "Account no longer active", because both
-- treat a NULL organization_id as unrecoverable and there is no self-healing
-- path -- login itself doesn't validate organization_id, so it's the only
-- place this gets caught.
--
-- Strategy: give every NULL-org admin their own organization (named after
-- them), then move any interns/tasks/etc. that don't yet have an
-- organization_id into their first admin's org. Adjust if you actually want
-- a single shared org instead of one-per-admin.

DO $$
DECLARE
  r RECORD;
  new_org_id INTEGER;
BEGIN
  FOR r IN SELECT id, name FROM admins WHERE organization_id IS NULL LOOP
    INSERT INTO organizations (name) VALUES (r.name || '''s Organization')
      RETURNING id INTO new_org_id;
    UPDATE admins SET organization_id = new_org_id WHERE id = r.id;
  END LOOP;
END $$;

-- Fold any org-less interns/tasks/etc. into the first admin's org (adjust if
-- you have a real multi-org setup already).
UPDATE interns SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE tasks SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE attendance SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE submissions SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE locations SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE submission_files SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE chat_messages SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE task_comments SET organization_id = (SELECT organization_id FROM admins ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
