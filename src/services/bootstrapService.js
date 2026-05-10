const bcrypt = require("bcrypt");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const Admin = require("../models/Admin");
const { ROLE_SLUGS } = require("../models/Role");

const DEFAULT_PERMISSIONS = [
  { key: "admins.manage", description: "Create/update/delete admins", group: "admins" },
  { key: "admins.read", description: "List and view admins", group: "admins" },
  { key: "roles.manage", description: "CRUD roles & assign permissions", group: "rbac" },
  { key: "roles.read", description: "View roles", group: "rbac" },
  { key: "users.read", description: "List/search users", group: "users" },
  { key: "users.write", description: "Edit user profile fields", group: "users" },
  { key: "users.block", description: "Block users", group: "users" },
  { key: "users.suspend", description: "Suspend users", group: "users" },
  { key: "users.delete", description: "Soft-delete users", group: "users" },
  {
    key: "users.verify_contributor",
    description: "Verify contributor / set contributor flags",
    group: "users",
  },
  { key: "analytics.users", description: "User analytics", group: "analytics" },
  {
    key: "analytics.discussions",
    description: "Discussion analytics",
    group: "analytics",
  },
  { key: "discussions.read", description: "View discussion rooms", group: "discussions" },
  {
    key: "discussions.moderate",
    description: "Moderate discussion content & flags",
    group: "discussions",
  },
  { key: "discussions.delete", description: "Remove discussion rooms", group: "discussions" },
  { key: "discussions.pin", description: "Pin / feature rooms", group: "discussions" },
  { key: "activity.read", description: "View admin activity logs", group: "audit" },
];

const ALL_KEYS = DEFAULT_PERMISSIONS.map((p) => p.key);

function roleMatrix() {
  return {
    super_admin: ALL_KEYS,
    admin: ALL_KEYS.filter((k) => k !== "roles.manage" && k !== "admins.manage"),
    moderator: [
      "discussions.read",
      "discussions.moderate",
      "discussions.delete",
      "discussions.pin",
      "activity.read",
      "users.read",
    ],
    analytics_manager: [
      "analytics.users",
      "analytics.discussions",
      "users.read",
      "discussions.read",
      "activity.read",
    ],
    support_manager: [
      "users.read",
      "users.write",
      "users.block",
      "users.suspend",
      "activity.read",
    ],
    content_manager: [
      "discussions.read",
      "discussions.pin",
      "discussions.moderate",
      "activity.read",
      "users.read",
    ],
  };
}

async function ensurePermissions() {
  for (const p of DEFAULT_PERMISSIONS) {
    await Permission.updateOne(
      { key: p.key },
      { $setOnInsert: { description: p.description, group: p.group } },
      { upsert: true },
    );
  }
}

async function ensureSystemRoles() {
  const matrix = roleMatrix();
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    moderator: "Moderator",
    analytics_manager: "Analytics Manager",
    support_manager: "Support Manager",
    content_manager: "Content Manager",
  };
  for (const slug of ROLE_SLUGS) {
    const permissionKeys = matrix[slug] || [];
    await Role.updateOne(
      { slug },
      {
        $setOnInsert: {
          name: labels[slug] || slug,
          slug,
          permissionKeys,
          description: `System role: ${slug}`,
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true },
    );
    await Role.updateOne(
      { slug },
      {
        $set: {
          permissionKeys,
        },
      },
    );
  }
}

async function bootstrapFirstAdmin() {
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
  const key = String(process.env.ADMIN_BOOTSTRAP_KEY || "").trim();
  if (!email || !password) return null;
  if ((await Admin.countDocuments()) > 0) return null;
  if (process.env.ADMIN_BOOTSTRAP_KEY && key !== process.env.ADMIN_BOOTSTRAP_KEY) {
    console.warn("[admin] ADMIN_BOOTSTRAP_KEY mismatch — skipping bootstrap");
    return null;
  }

  const superRole = await Role.findOne({ slug: "super_admin" }).lean();
  if (!superRole) throw new Error("Bootstrap failed: super_admin role missing");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({
    email,
    passwordHash,
    fullName: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin",
    roleId: superRole._id,
    isSuspended: false,
  });
  console.log(`[admin] Bootstrapped first super_admin: ${admin.email}`);
  return admin;
}

async function bootstrapAll() {
  await ensurePermissions();
  await ensureSystemRoles();
  await bootstrapFirstAdmin();
}

module.exports = {
  bootstrapAll,
  ensurePermissions,
  ensureSystemRoles,
  DEFAULT_PERMISSIONS,
  ALL_KEYS,
};
