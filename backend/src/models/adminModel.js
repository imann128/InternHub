const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const AdminModel = {
    // Global lookup by design — email is unique across all orgs, and this is
    // how login/signup resolve which org a user belongs to before any
    // organization_id is known. Do not scope this one.
    findByEmail: async (email) => {
        const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
        return result.rows[0];
    },

    count: async (organizationId) => {
        const result = await pool.query(
            'SELECT COUNT(*) FROM admins WHERE organization_id = $1',
            [organizationId]
        );
        return parseInt(result.rows[0].count);
    },

    // Note: authController.signup does its own raw insert inside a DB
    // transaction (organizations + admins together) instead of calling this,
    // since this uses the shared pool, not a transaction-scoped client. This
    // is here for any other call site that creates an admin into an
    // already-existing organization.
    create: async (organizationId, { name, email, password }) => {
        const hashed = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO admins (name, email, password, organization_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, organization_id, created_at',
            [name.trim(), email.toLowerCase().trim(), hashed, organizationId]
        );
        return result.rows[0];
    },

    verifyPassword: async (plain, hashed) => {
        return bcrypt.compare(plain, hashed);
    },

    getAll: async (organizationId) => {
        const result = await pool.query(
            'SELECT id, name, email FROM admins WHERE organization_id = $1',
            [organizationId]
        );
        return result.rows;
    },

    getById: async (organizationId, id) => {
        const result = await pool.query(
            'SELECT id, name, email, organization_id, created_at FROM admins WHERE id = $1 AND organization_id = $2',
            [id, organizationId]
        );
        return result.rows[0];
    },
};

module.exports = AdminModel;