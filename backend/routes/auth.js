const express = require("express");
const logger = require("../utils/logger");
const {
  authenticateUser,
  createUser,
  updateUserInterests,
  verifyToken,
} = require("../utils/authUtil");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    logger.info(`Login attempt for email: ${email}`);
    const user = await authenticateUser(email, password);

    if (!user) {
      logger.warn(`Failed login attempt for email: ${email}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    logger.info(`Login successful for email: ${email}`);

    const token = require("../utils/authUtil").generateToken(user);

    res.json({
      user,
      token,
      message: "Login successful",
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const newUser = await createUser({ name, email, password });
    const token = require("../utils/authUtil").generateToken(newUser);

    res.status(201).json({
      user: newUser,
      token,
      message: "Registration successful",
    });
  } catch (error) {
    logger.error("Registration error:", error);

    if (error.code === "23505") {
      // PostgreSQL unique violation
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/interests - Update user interests
router.post("/interests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { interests } = req.body;

    if (!interests || !Array.isArray(interests)) {
      return res.status(400).json({ error: "Interests array is required" });
    }

    logger.info(`Updating interests for user: ${decoded.userId}`);

    const updatedUser = await updateUserInterests(decoded.userId, interests);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    logger.info(`Interests updated successfully for user: ${decoded.userId}`);

    res.json({
      user: userWithoutPassword,
      message: "Interests updated successfully",
    });
  } catch (error) {
    logger.error("Update interests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
