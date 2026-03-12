// frontend/lib/db.js
// MySQL2 connection pool – server-side only

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'pharmachain_bcd',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
