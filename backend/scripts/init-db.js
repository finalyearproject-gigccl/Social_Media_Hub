const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { query } = require("../config/database");

async function initializeDatabase() {
  try {
    logger.info("Initializing database...");

    // Read the schema file
    const schemaPath = path.join(__dirname, "..", "config", "schema.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf8");

    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        logger.debug("Executing:", statement.substring(0, 50) + "...");
        await query(statement);
      }
    }

    logger.info("✅ Database initialized successfully!");
  } catch (error) {
    logger.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
