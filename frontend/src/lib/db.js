// frontend/lib/db.js
// MySQL2 connection pool – server-side only

import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host:
    process.env.DB_HOST ??
    (() => {
      throw new Error("DB_HOST not set");
    })(),
  port: parseInt(
    process.env.DB_PORT ??
      (() => {
        throw new Error("DB_PORT not set");
      })(),
  ),
  user:
    process.env.DB_USER ??
    (() => {
      throw new Error("DB_USER not set");
    })(),
  password:
    process.env.DB_PASSWORD ??
    (() => {
      throw new Error("DB_PASSWORD not set");
    })(),
  database:
    process.env.DB_NAME ??
    (() => {
      throw new Error("DB_NAME not set");
    })(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
