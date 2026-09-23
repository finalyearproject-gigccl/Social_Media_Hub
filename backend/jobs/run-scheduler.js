/**
 * Standalone entry point for the Analytics Scheduler Service
 *
 * Run this file to start the scheduler as a separate process:
 *   node jobs/run-scheduler.js
 *
 * Or add to package.json scripts:
 *   "start:scheduler": "node jobs/run-scheduler.js"
 */

require("dotenv").config();
const logger = require("../utils/logger");
const { initializeScheduler } = require("./analyticsScheduler");

// Start the scheduler
logger.info("🚀 Starting Analytics Scheduler Service...");
initializeScheduler();

logger.info("📅 Analytics Scheduler Service initialized");
logger.info("⏰ Scheduler will run on the configured interval");
