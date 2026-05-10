const { AppError } = require("../utils/AppError");

function requireRole(...slugs) {
  return function requireRoleMw(req, _res, next) {
    try {
      const s = String(req.roleSlug || "");
      if (slugs.some((x) => x === s)) return next();
      throw new AppError(403, "Forbidden", { requiredRoles: slugs });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requireRole };
