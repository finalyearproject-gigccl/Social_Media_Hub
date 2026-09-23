const { Pool } = require("pg");
require("dotenv").config();
const logger = require("../utils/logger");

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "social_media_analytics",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create a pool instance
const pool = new Pool(dbConfig);

// Test database connection
// pool.on("connect", () => {
//   logger.info("Connected to PostgreSQL database");
// });

pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error("Database query error:", err);
    throw err;
  }
};

module.exports = {
  pool,
  query,
};
