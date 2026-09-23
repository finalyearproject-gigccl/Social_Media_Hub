const express = require("express");
const cors = require("cors");
require("dotenv").config();

const logger = require("./utils/logger");
const { query } = require("./config/database");
const { authenticateRequest } = require("./middleware/authMiddleware");
const { triggerAnalyticsSync } = require("./jobs/analyticsScheduler");

// Import routes
const authRoutes = require("./routes/auth");
const metaRoutes = require("./routes/meta");
const youtubeRoutes = require("./routes/youtube");
const discordRoutes = require("./routes/discord");
const apiRoutes = require("./routes/api");
const trendingRoutes = require("./routes/trending");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/auth/meta", metaRoutes);
app.use("/auth/youtube", youtubeRoutes);
app.use("/auth/discord", discordRoutes);
app.use("/api", authenticateRequest, apiRoutes);
app.use("/api", authenticateRequest, trendingRoutes);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Test database connection
    const data = await query("SELECT * FROM users");
    const users = data.rows;
    res.json({
      status: "OK",
      database: "connected",
      timestamp: new Date().toISOString(),
      users,
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      database: "disconnected",
      error: error.message,
    });
  }
});

// Manual trigger endpoint for analytics sync (admin only)
app.post("/api/admin/sync-analytics", authenticateRequest, async (req, res) => {
  try {
    logger.info("Manual analytics sync triggered by user");
    const results = await triggerAnalyticsSync();
    res.json({
      message: "Analytics sync completed",
      results,
    });
  } catch (error) {
    logger.error("Error during manual sync:", error);
    res.status(500).json({
      error: "Failed to sync analytics",
      details: error.message,
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.warn(
    `Make sure to set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in .env file`,
  );
});
