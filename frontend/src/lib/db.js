// frontend/lib/db.js
// MySQL2 connection pool – server-side only

import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "pharmachain_bcd",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;

// ─── Schema (run once via: node frontend/lib/db-init.js) ─────────────────────
/*
CREATE TABLE IF NOT EXISTS locations (
  id          VARCHAR(64) PRIMARY KEY,          -- locationId (same as on-chain)
  name        VARCHAR(255) NOT NULL,
  type        ENUM('FACTORY','DISTRIBUTION_CENTER','SORTING_CENTER') NOT NULL,
  address     TEXT NOT NULL,
  latitude    DECIMAL(10,8) NOT NULL,
  longitude   DECIMAL(11,8) NOT NULL,
  manufacturer_id VARCHAR(64) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_images (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id      VARCHAR(128) NOT NULL,
  status_step   TINYINT NOT NULL,              -- 0=CREATED,1=SHIPPED etc.
  image_path    VARCHAR(512) NOT NULL,          -- local path or S3 key
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (batch_id)
);

CREATE TABLE IF NOT EXISTS batch_off_chain (
  batch_id      VARCHAR(128) PRIMARY KEY,
  medicine_id   VARCHAR(64) NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  hospital_id   VARCHAR(64) NOT NULL,
  manufacturer_id VARCHAR(64) NOT NULL,
  expiry_date   DATETIME NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
*/
