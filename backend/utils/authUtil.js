const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";
const SALT_ROUNDS = 12;

// Hash password
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Create new user
async function createUser(userData) {
  const { name, email, password, role = "user", interests = [] } = userData;

  // Hash password
  const hashedPassword = await hashPassword(password);

  const result = await query(
    "INSERT INTO users (name, email, password, role, interests) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, name, email, role, interests, created_at",
    [name, email, hashedPassword, role, interests],
  );

  return result.rows[0];
}

// Find user by email
async function findUserByEmail(email) {
  const result = await query(
    "SELECT user_id, name, email, password, role, avatar_url, interests, created_at FROM users WHERE email = $1",
    [email],
  );

  return result.rows[0] || null;
}

// Find user by ID
async function findUserById(userId) {
  const result = await query(
    "SELECT user_id, name, email, role, avatar_url, interests, created_at FROM users WHERE user_id = $1",
    [userId],
  );

  return result.rows[0] || null;
}

// Authenticate user (login)
async function authenticateUser(email, password) {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.password);

  if (!isValidPassword) {
    return null;
  }

  // Remove password from user object
  const { password: _, ...userWithoutPassword } = user;

  return userWithoutPassword;
}

// Update user interests
async function updateUserInterests(userId, interests) {
  const result = await query(
    "UPDATE users SET interests = $1 WHERE user_id = $2 RETURNING user_id, name, email, role, interests, created_at",
    [interests, userId],
  );

  return result.rows[0] || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  createUser,
  findUserByEmail,
  findUserById,
  authenticateUser,
  updateUserInterests,
};
