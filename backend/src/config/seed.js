require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const seed = async () => {
  try {
    // --- Admin ---
    const adminPasswordHash = await bcrypt.hash('Admin123!', 12);
    await pool.query(
      `INSERT INTO admins (name, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password`,
      ['Admin', 'admin@example.com', adminPasswordHash]
    );

    // --- Intern ---
    const internPasswordHash = await bcrypt.hash('Intern123!', 12);
    await pool.query(
      `INSERT INTO interns (name, email, department, joining_date, password, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password`,
      ['Aisha', 'aisha@example.com', 'Engineering', '2026-01-01', internPasswordHash]
    );

    console.log('Seed successful');
    console.log('  Admin  -> admin@example.com / Admin123!');
    console.log('  Intern -> aisha@example.com / Intern123!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
};

seed();
