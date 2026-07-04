-- Targeted ownership reassignment for adopting role separation on a
-- database that already has real tables in it (as opposed to a brand new,
-- empty database where `roles.sql` alone is enough).
--
-- `REASSIGN OWNED BY postgres TO interns_owner` looks like the obvious way
-- to do this, but fails with:
--   "cannot reassign ownership of objects owned by role postgres because
--    they are required by the database system"
-- because it tries to move *everything* the bootstrap superuser owns,
-- including cluster-level objects Postgres refuses to hand off. We don't
-- need that -- only the actual application tables (and their sequences,
-- and any functions migrate.js will later try to CREATE OR REPLACE, which
-- requires ownership) need to move to interns_owner.
--
-- Run once, as postgres (or whichever role currently owns your tables):
--   psql -U postgres -d <your_db> -f reassign_ownership.sql

-- Since Postgres 15, only the schema owner (or a superuser) has CREATE on a
-- schema by default -- PUBLIC no longer gets it automatically. Without this,
-- interns_owner can ALTER the tables it now owns but can't run CREATE
-- TABLE/CREATE INDEX against the schema itself, which migrate.js needs.
ALTER SCHEMA public OWNER TO interns_owner;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO interns_owner', r.tablename);
  END LOOP;

  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO interns_owner', r.sequencename);
  END LOOP;

  -- Covers bump_version() (see migrate.js) -- migrate.js does
  -- `CREATE OR REPLACE FUNCTION bump_version()`, which requires the role
  -- running it to already own the existing function, not just have DDL
  -- rights in general.
  FOR r IN
    SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO interns_owner', r.name, r.args);
  END LOOP;
END
$$;
