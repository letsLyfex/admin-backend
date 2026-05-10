/**
 * Alias for requirePermission.
 * @example checkPermission('users.read', 'analytics.users')
 */
const { requirePermission } = require("./requirePermission");

function checkPermission(...keys) {
  return requirePermission(...keys);
}

module.exports = { checkPermission };
