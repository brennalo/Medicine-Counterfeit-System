// frontend/lib/db-init.js
// Run with: node frontend/lib/db-init.js
// Creates all required MySQL tables

require("dotenv").config({ path: "../../.env.local" });
const mysql = require("mysql2/promise");

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pharmachain",
    multipleStatements: true,
  });

  const schema = `
    CREATE TABLE IF NOT EXISTS locations (
      id               VARCHAR(64) PRIMARY KEY,
      name             VARCHAR(255) NOT NULL,
      type             ENUM('FACTORY','DISTRIBUTION_CENTER','SORTING_CENTER') NOT NULL,
      address          TEXT NOT NULL,
      latitude         DECIMAL(10,8) NOT NULL,
      longitude        DECIMAL(11,8) NOT NULL,
      manufacturer_id  VARCHAR(64) NOT NULL,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batch_images (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      batch_id      VARCHAR(128) NOT NULL,
      status_step   TINYINT NOT NULL,
      image_path    VARCHAR(512) NOT NULL,
      uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_batch (batch_id)
    );

    CREATE TABLE IF NOT EXISTS batch_off_chain (
      batch_id        VARCHAR(128) PRIMARY KEY,
      medicine_id     VARCHAR(64) NOT NULL,
      medicine_name   VARCHAR(255) NOT NULL,
      hospital_id     VARCHAR(64) NOT NULL,
      manufacturer_id VARCHAR(64) NOT NULL,
      expiry_date     DATETIME NOT NULL,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await conn.query(schema);
  console.log("✅ Database schema initialised.");
  await conn.end();
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});
