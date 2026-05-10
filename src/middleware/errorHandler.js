const { AppError } = require("../utils/AppError");

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  console.error("[admin] unhandled error", err);
  return res.status(500).json({ message: "Internal server error" });
}

module.exports = { errorHandler };
