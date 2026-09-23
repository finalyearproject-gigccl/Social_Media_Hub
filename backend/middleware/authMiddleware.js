const { verifyToken } = require("../utils/authUtil");
const logger = require("../utils/logger");

// Authentication middleware
function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  // logger.info(
  //   `Authenticating request for user ID: ${decoded ? decoded.userId : "unknown"}`,
  // );

  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = decoded;
  next();
}

module.exports = {
  authenticateRequest,
};
