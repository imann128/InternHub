const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const AdminModel = require('../models/adminModel');
const InternModel = require('../models/internModel');
const emailService = require('../services/emailService');

const signup = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, email, password, signup_key, organization_name } = req.body;

    if (signup_key !== process.env.ADMIN_SIGNUP_KEY) {
      return res.status(403).json({ success: false, message: 'Invalid signup key. Contact your system administrator.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Email is globally unique across all orgs (see design decision — no
    // per-org uniqueness, no workspace picker at login).
    const exists = await AdminModel.findByEmail(email);
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    await client.query('BEGIN');

    const orgResult = await client.query(
      `INSERT INTO organizations (name) VALUES ($1) RETURNING *`,
      [organization_name || `${name}'s Organization`]
    );
    const organization = orgResult.rows[0];

    const hashed = await bcrypt.hash(password, 10);
    const adminResult = await client.query(
      `INSERT INTO admins (name, email, password, organization_id)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, organization_id, created_at`,
      [name, email, hashed, organization.id]
    );
    const admin = adminResult.rows[0];

    await client.query('COMMIT');

    await emailService.sendAdminWelcome({ name: admin.name, email: admin.email }).catch(() => {});

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin', organization_id: admin.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ success: true, data: { admin, token } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await AdminModel.verifyPassword(password, admin.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin', organization_id: admin.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        admin: { id: admin.id, name: admin.name, email: admin.email, organization_id: admin.organization_id },
        token,
      },
    });
  } catch (err) { next(err); }
};

const me = async (req, res) => {
  res.json({ success: true, data: req.admin });
};

const internLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const intern = await InternModel.findByEmail(email);
    if (!intern || !intern.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, intern.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: intern.id, email: intern.email, role: 'intern', organization_id: intern.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        intern: { id: intern.id, name: intern.name, email: intern.email, department: intern.department, organization_id: intern.organization_id },
        token,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { signup, login, me, internLogin };