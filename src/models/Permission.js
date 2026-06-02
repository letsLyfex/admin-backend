const mongoose = require("mongoose");

/**
 * Canonical permission keys referenced by Role.permissionKeys.
 * Index { key: 1 } unique for CRUD lookups.
 */
const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    description: { type: String, default: "", maxlength: 500 },
    group: { type: String, default: "general", trim: true, maxlength: 64 },
  },
  { timestamps: true },
);

permissionSchema.index({ group: 1, key: 1 });

module.exports = mongoose.models.Permission || mongoose.model("Permission", permissionSchema);
