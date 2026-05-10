/**
 * Alias for teams that prefer the name checkRole(roleSlug...)
 * @example router.post('/x', attachAdmin, checkRole('super_admin'), handler)
 */
const { requireRole } = require("./requireRole");

function checkRole(...slugs) {
  return requireRole(...slugs);
}

module.exports = { checkRole };
