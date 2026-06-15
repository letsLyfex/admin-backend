const Role = require("../models/Role");
const Admin = require("../models/Admin");
const Permission = require("../models/Permission");
const { recordActivity } = require("./activityLogService");
const { AppError } = require("../utils/AppError");
const { ALL_KEYS } = require("./bootstrapService");

function permissionsToKeys(permissions = {}) {
  const keys = [];
  for (const [screen, actions] of Object.entries(permissions)) {
    for (const [action, enabled] of Object.entries(actions)) {
      if (enabled === true) {
        keys.push(`${screen}.${action}`); // e.g. "payments.view", "payments.edit"
      }
    }
  }
  return keys;
}

function keysToPermissions(permissionKeys = []) {
  const permissions = {};
  for (const key of permissionKeys) {
    const [screen, action] = key.split(".");
    if (!screen || !action) continue;
    if (!permissions[screen]) permissions[screen] = {};
    permissions[screen][action] = true;
  }
  return permissions;
}

async function listPermissions() {
  return Permission.find().sort({ group: 1, key: 1 }).lean();
}

async function listRoles() {
  const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();
  return roles.map((r) => ({
    ...r,
    permissions: keysToPermissions(r.permissionKeys ?? []),
  }));
}
function validateSlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(s)) {
    throw new AppError(400, "Invalid slug (lowercase letters, numbers, underscore)");
  }
  return s;
}

async function createRole({ name, slug, permissionKeys, description }, actorId, ip, ua) {
  const s = validateSlug(slug);
  const n = String(name || "").trim();
  if (!n) throw new AppError(400, "name is required");
  const keys = Array.isArray(permissionKeys) ? permissionKeys.map(String) : [];
  const invalid = keys.filter((k) => !ALL_KEYS.includes(k));
  if (invalid.length) {
    throw new AppError(400, `Unknown permissions: ${invalid.join(", ")}`);
  }

  const exists = await Role.findOne({ slug: s });
  if (exists) throw new AppError(409, "Role slug already exists");

  const role = await Role.create({
    name: n,
    slug: s,
    permissionKeys: keys,
    description: String(description || "").trim(),
    isSystem: false,
    isActive: true,
  });

  await recordActivity({
    adminId: actorId,
    action: "role_create",
    targetType: "role",
    targetId: String(role._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
    meta: { slug: role.slug },
  });

  return role;
}

async function updateRole(roleId, { name, permissionKeys, isActive, description }, actorId, ip, ua) {
  const role = await Role.findById(roleId);
  if (!role) throw new AppError(404, "Role not found");

  if (typeof name === "string" && name.trim()) role.name = name.trim();

  if (Array.isArray(permissionKeys)) {
    if (role.isSystem) {
      throw new AppError(400, "Built-in roles cannot change permissionKeys via API");
    }
    const invalid = permissionKeys.map(String).filter((k) => !ALL_KEYS.includes(k));
    if (invalid.length) {
      throw new AppError(400, `Unknown permissions: ${invalid.join(", ")}`);
    }
    role.permissionKeys = permissionKeys.map(String);
  }

  if (typeof description === "string") role.description = description.trim();

  if (typeof isActive === "boolean") {
    role.isActive = isActive;
  }

  await role.save();

  await recordActivity({
    adminId: actorId,
    action: "role_update",
    targetType: "role",
    targetId: String(role._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return role;
}

async function deleteRole(roleId, actorId, ip, ua) {
  const role = await Role.findById(roleId);
  if (!role) throw new AppError(404, "Role not found");
  if (role.isSystem) throw new AppError(400, "Cannot delete built-in roles");

  const inUse = await Admin.countDocuments({ roleId: role._id });
  if (inUse) throw new AppError(400, "Role is assigned to admins; reassign before delete");

  await Role.deleteOne({ _id: roleId });

  await recordActivity({
    adminId: actorId,
    action: "role_delete",
    targetType: "role",
    targetId: String(roleId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
    meta: { slug: role.slug },
  });

  return { ok: true };
}

module.exports = {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
};
