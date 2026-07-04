const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const rawPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Tuned for a single small EC2 box serving multiple orgs -- cap concurrent
  // connections so a traffic spike can't exhaust Postgres's own connection
  // limit, and recycle idle ones instead of holding them open forever.
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Fires when an already-checked-out, idle client emits an error in the
// background (e.g. the underlying TCP connection drops). This used to call
// process.exit(-1) -- which meant one flaky connection took the *entire*
// server down for every organization using this app, not just the one
// request that happened to be using that connection. `pg` already removes
// the broken client from the pool and will open a fresh one on the next
// query; there's nothing here that actually requires killing the process.
// Logging (not crashing) is the correct behavior for a shared multi-tenant
// server.
rawPool.on('error', (err) => {
  console.error('Unexpected error on idle DB client:', err.message);
});

// --- Row-Level Security support -------------------------------------------
//
// Every tenant-owned table now has RLS policies that check a session GUC
// (app.current_org_id) against that row's organization_id. This is a
// second, database-enforced layer behind the organization_id filters
// already in every model query -- a query that forgot its filter used to
// silently leak cross-tenant rows; now Postgres itself refuses to return
// anything outside the pinned organization, regardless of what the
// application code does or doesn't check.
//
// IMPORTANT CAVEAT: RLS policies never apply to a table's owner. This only
// provides real protection once the running server connects as a
// *non-owner* role (interns_app, per backend/docs/role_separation.md). If
// DB_USER still owns the tables (the default before adopting role
// separation), Postgres silently skips every policy below for that
// connection -- see Security.md in the wiki.
//
// The tricky part is that every model file in this app calls the shared
// `pool.query(...)` directly, and Postgres session state (the GUC) lives on
// a specific physical connection -- but connections are pulled from a
// shared pool, not owned per-request. Threading a dedicated client through
// every model function's signature would mean touching ~80 functions across
// every model file. Instead, AsyncLocalStorage carries "the current
// request's org-scoped client" implicitly through the whole async call
// chain: authMiddleware checks one out and pins it for the request; every
// `pool.query(...)` call anywhere beneath it (controller, model, nested
// await, doesn't matter) transparently uses that same connection. No model
// file needs to change.
const orgContext = new AsyncLocalStorage();

// Drop-in replacement for `new Pool(...)` as far as every existing model
// file is concerned -- same `.query()` / `.connect()` shape, so no import
// needs to change anywhere. `.query()` transparently prefers the current
// request's RLS-scoped client when one is active; without one (no request
// in flight -- e.g. this module is being required at boot) it falls back to
// the raw, unscoped pool.
const pool = {
  query: (text, params) => {
    const client = orgContext.getStore();
    return (client || rawPool).query(text, params);
  },
  // Unscoped by design -- existing call sites that do their own
  // BEGIN/COMMIT transaction (authController's signup) operate on
  // organizations/admins, neither of which is RLS-protected, so this is
  // safe as-is. Anything that needs a transaction against an RLS-protected
  // table must use getCurrentClient() instead (see locationModel.assignInterns).
  connect: () => rawPool.connect(),
};

// Checks out a dedicated client and pins the given organization to it for
// every query run against it, via a session-level GUC every RLS policy
// checks. Caller MUST release it (releaseScopedClient) when done -- it does
// not return to the pool on its own.
const getScopedClient = async (organizationId) => {
  const client = await rawPool.connect();
  await client.query("SELECT set_config('app.current_org_id', $1, false)", [String(organizationId)]);
  return client;
};

// Resets the GUC before returning the client to the pool -- otherwise the
// next, unrelated request or cron iteration that happens to reuse this
// physical connection would silently inherit the previous organization's
// scope. Safe to call even if the connection is already dead (logout mid-
// request, etc.) -- the reset is best-effort, the release always happens.
const releaseScopedClient = async (client) => {
  try {
    await client.query("SELECT set_config('app.current_org_id', '', false)");
  } catch (err) {
    // Connection may already be broken -- releasing it still matters so the
    // pool doesn't leak a slot, the reset is just a courtesy at that point.
  }
  client.release();
};

// Runs `fn` with `client` pinned as the active org-scoped connection for
// every `pool.query(...)` call made anywhere in its call stack. Used by
// authMiddleware (once per HTTP request) and by the cron jobs in server.js
// / retentionService.js (once per organization, per loop iteration).
const runScoped = (client, fn) => orgContext.run(client, fn);

// Exposes the current request's scoped client directly, for the rare model
// function that needs to run its own multi-statement transaction against an
// RLS-protected table (BEGIN/COMMIT) rather than a single `pool.query()`
// call. Returns undefined outside of a scoped context.
const getCurrentClient = () => orgContext.getStore();

module.exports = pool;
module.exports.getScopedClient = getScopedClient;
module.exports.releaseScopedClient = releaseScopedClient;
module.exports.runScoped = runScoped;
module.exports.getCurrentClient = getCurrentClient;
