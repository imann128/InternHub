const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
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
pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client:', err.message);
});

module.exports = pool;
