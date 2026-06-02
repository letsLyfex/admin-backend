const mongoose = require("mongoose");

/** Built-in slugs seeded on first boot; custom roles may use any unique slug. */
const ROLE_SLUGS = [
  "super_admin",
  "admin",
  "moderator",
  "analytics_manager",
  "support_manager",
  "content_manager",
];

/**
 * Roles bundle permission keys. System roles (isSystem) cannot be deleted.
 * Index slug unique.
 */
const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z][a-z0-9_]{1,48}$/,
    },
    permissionKeys: [{ type: String, trim: true }],
    description: { type: String, default: "", maxlength: 500 },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roleSchema.index({ isActive: 1, slug: 1 });

module.exports = mongoose.models.Role || mongoose.model("Role", roleSchema);
module.exports.ROLE_SLUGS = ROLE_SLUGS;
