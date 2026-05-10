const { AppError } = require("../utils/AppError");

function requireBodyFields(body, keys) {
  const b = body || {};
  for (const k of keys) {
    if (b[k] === undefined || b[k] === null || b[k] === "") {
      throw new AppError(400, `${k} is required`);
    }
  }
}

module.exports = { requireBodyFields };
