const bcrypt = require("bcrypt");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const Admin = require("../models/Admin");
const { ROLE_SLUGS } = require("../models/Role");



const DEFAULT_PERMISSIONS = [
  // Dashboard
  { key: "dashboard.view",    description: "View dashboard",           group: "dashboard"     },

  // Users
  { key: "users.view",        description: "List/search users",        group: "users"         },
  { key: "users.details",     description: "View user detail",         group: "users"         },
  { key: "users.edit",        description: "Edit user profile",        group: "users"         },
  { key: "users.create",      description: "Create users",             group: "users"         },
  { key: "users.delete",      description: "Delete users",             group: "users"         },
  { key: "users.block",       description: "Block/unblock users",      group: "users"         },

  // Sessions
  { key: "sessions.view",     description: "View sessions",            group: "sessions"      },
  { key: "sessions.details",  description: "View session detail",      group: "sessions"      },
  { key: "sessions.delete",   description: "Delete sessions",          group: "sessions"      },
  // Discussions
  { key: "discussions.view",  description: "View discussions",         group: "discussions"   },
  { key: "discussions.details",description: "View discussion detail",   group: "discussions"   },
  { key: "discussions.delete",description: "Delete discussions",       group: "discussions"   },

  // Referrals
  { key: "referrals.view",    description: "View referrals",           group: "referrals"     },
  { key: "referrals.details", description: "View referral detail",     group: "referrals"     },

  // Payments
  { key: "payments.view",     description: "View payments",            group: "payments"      },
  { key: "payments.details",  description: "View payment detail",      group: "payments"      },
  { key: "payments.edit",     description: "Edit payment records",     group: "payments"      },
  { key: "payments.create",   description: "Create payment records",   group: "payments"      },
  { key: "payments.delete",   description: "Delete payment records",   group: "payments"      },
  { key: "payments.block",    description: "Block payment methods",    group: "payments"      },

  // Analytics
  { key: "analytics.view",    description: "View analytics",           group: "analytics"     },
  { key: "analytics.details", description: "View analytics detail",    group: "analytics"     },

  // Roles & Permissions
  { key: "roles.view",        description: "View roles",               group: "rbac"          },
  { key: "roles.details",     description: "View role detail",         group: "rbac"          },
  { key: "roles.edit",        description: "Edit roles",               group: "rbac"          },
  { key: "roles.create",      description: "Create roles",             group: "rbac"          },
  { key: "roles.assign",      description: "Assign roles to admins",   group: "rbac"          },
  { key: "roles.delete",      description: "Delete roles",             group: "rbac"          },
  { key: "roles.block",       description: "Deactivate roles",         group: "rbac"          },

  // Activity Logs
  { key: "activity_logs.view",    description: "View activity logs",   group: "audit"         },
  { key: "activity_logs.details", description: "View log detail",      group: "audit"         },

  // Admin Accounts
  { key: "admin_accounts.view",   description: "View admin accounts",  group: "admins"        },
  { key: "admin_accounts.details",description: "View admin detail",    group: "admins"        },
  { key: "admin_accounts.edit",   description: "Edit admin accounts",  group: "admins"        },
  { key: "admin_accounts.create", description: "Create admin accounts",group: "admins"        },
  { key: "admin_accounts.assign", description: "Assign roles to admins",group: "admins"       },
  { key: "admin_accounts.delete", description: "Delete admin accounts",group: "admins"        },
  { key: "admin_accounts.block",  description: "Suspend admin accounts",group: "admins"       },
];

const ALL_KEYS = DEFAULT_PERMISSIONS.map((p) => p.key);

//  System role permission matrix 
// super_admin gets everything. Other system roles get sensible subsets.

function roleMatrix() {
  return {
    super_admin: ALL_KEYS,

    admin: ALL_KEYS.filter(
      (k) => !k.startsWith("roles.") && !k.startsWith("admin_accounts.")
    ),

    moderator: [
      "dashboard.view",
      "sessions.view",    "sessions.details",
      "users.view",       "users.details",
      "activity_logs.view",
    ],

    analytics_manager: [
      "dashboard.view",
      "analytics.view",  "analytics.details",
      "users.view",      "users.details",
      "activity_logs.view",
    ],

    support_manager: [
      "dashboard.view",
      "users.view", "users.details", "users.edit", "users.block",
      "activity_logs.view",
    ],

    content_manager: [
      "dashboard.view",
       "analytics.view",  "analytics.details",
      "sessions.view",    "sessions.details",
      "activity_logs.view",
    ],
  };
}

//  Bootstrap functions 

async function ensurePermissions() {
  for (const p of DEFAULT_PERMISSIONS) {
    await Permission.updateOne(
      { key: p.key },
      { $setOnInsert: { description: p.description, group: p.group } },
      { upsert: true }
    );
  }
}

async function ensureSystemRoles() {
  const matrix = roleMatrix();
  const labels = {
    super_admin:       "Super Admin",
    admin:             "Admin",
    moderator:         "Moderator",
    analytics_manager: "Analytics Manager",
    support_manager:   "Support Manager",
    content_manager:   "Content Manager",
  };
  for (const slug of ROLE_SLUGS) {
    const permissionKeys = matrix[slug] || [];
    await Role.updateOne(
      { slug },
      {
        $setOnInsert: {
          name:           labels[slug] || slug,
          slug,
          permissionKeys,
          description:    `System role: ${slug}`,
          isSystem:       true,
          isActive:       true,
        },
      },
      { upsert: true }
    );
    await Role.updateOne({ slug }, { $set: { permissionKeys } });
  }
}

async function bootstrapFirstAdmin() {
  const email    = String(process.env.ADMIN_BOOTSTRAP_EMAIL    || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
  const key      = String(process.env.ADMIN_BOOTSTRAP_KEY      || "").trim();
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
    fullName:    process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin",
    roleId:      superRole._id,
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