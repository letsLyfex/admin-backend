class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode || 500;
    this.details = details;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
