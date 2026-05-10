const { AppError } = require("../utils/AppError");

/**
 * Express factory: require ANY of the listed permission keys (unless super_admin).
 */
function requirePermission(...keys) {
  return function requirePermissionMw(req, _res, next) {
    try {
      if (req.roleSlug === "super_admin") return next();
      for (const k of keys) {
        if (req.permissionKeys?.has(k)) return next();
      }
      throw new AppError(403, "Forbidden", { required: keys });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requirePermission };
