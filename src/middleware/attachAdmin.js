const { verifyAccessFromHeader } = require("../services/adminAuthService");

/**
 * Loads the admin + role from Bearer access token and attaches permission metadata.
 */
async function attachAdmin(req, res, next) {
  try {
    const admin = await verifyAccessFromHeader(req.headers.authorization);
    const role = admin.roleId;
    const slug = role?.slug ? String(role.slug) : "";
    const keys = new Set(
      Array.isArray(role?.permissionKeys) ? role.permissionKeys.map(String) : [],
    );
    req.admin = admin;
    req.adminId = String(admin._id);
    req.roleSlug = slug;
    req.permissionKeys = keys;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachAdmin };
