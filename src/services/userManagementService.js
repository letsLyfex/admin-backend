const mongoose = require("mongoose");
const { mainModel } = require("../utils/mainBackendPath");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");
const DiscussionReport = require("../models/DiscussionReport");

function getUserModel() {
  return mainModel("User");
}

async function getUserLeanById(id) {
  return getUserModel()
    .findById(id)
    .select("-password -resetOtpHash")
    .lean();
}

function parseIsoDate(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, `Invalid ISO date for ${label}`);
  }
  return d;
}

function notDeletedClause() {
  return { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
}

/**
 * Compose GET /users list filter. Omitting `status` excludes soft-deleted rows.
 */
function buildListFilter(query) {
  const clauses = [];

  const statusRaw = String(query.status || "").trim().toLowerCase();

  if (!statusRaw) {
    clauses.push(notDeletedClause());
  } else if (statusRaw === "active") {
    clauses.push({ isBlocked: false });
    clauses.push({ isSuspended: false });
    clauses.push(notDeletedClause());
  } else if (statusRaw === "blocked") {
    clauses.push({ isBlocked: true });
  } else if (statusRaw === "suspended") {
    clauses.push({ isSuspended: true });
  } else if (statusRaw === "deleted") {
    clauses.push({ deletedAt: { $ne: null } });
  } else {
    throw new AppError(
      400,
      'status must be "active", "blocked", "suspended", or "deleted"',
    );
  }

  if (query.plan && ["VIEW", "TALK", "CONTRIBUTE"].includes(String(query.plan).toUpperCase())) {
    clauses.push({ subscriptionPlan: String(query.plan).toUpperCase() });
  }

  const q = String(query.q || "").trim();
  if (q) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({
      $or: [{ email: new RegExp(esc, "i") }, { fullName: new RegExp(esc, "i") }],
    });
  }

  const country = String(query.country || "").trim();
  if (country) {
    const esc = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ country: new RegExp(`^${esc}$`, "i") });
  }

  const createdRange = {};
  const ja = parseIsoDate(query.joinedAfter, "joinedAfter");
  const jb = parseIsoDate(query.joinedBefore, "joinedBefore");
  if (ja) createdRange.$gte = ja;
  if (jb) createdRange.$lte = jb;
  if (Object.keys(createdRange).length) {
    clauses.push({ createdAt: createdRange });
  }

  const lab = parseIsoDate(query.lastActiveBefore, "lastActiveBefore");
  if (lab) {
    clauses.push({ lastActive: { $lte: lab } });
  }

  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

/** Sum of scheduled session duration (minutes) where user appears in participants (proxy, not telemetry). */
async function sumSessionDurationMinutesForUser(model, userOid, sessionTypeMatch) {
  const match =
    typeof sessionTypeMatch === "function"
      ? sessionTypeMatch(userOid)
      : { participants: userOid };
  const agg = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$duration", 0] } } } },
  ]);
  return Number(agg[0]?.total) || 0;
}

/**
 * Aggregate engagement stats for a single user (shared Mongo DB).
 */
async function getUserStats(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      totalSessionsJoined: 0,
      totalRoomsCreated: 0,
      totalWatchTime: 0,
      reportsReceived: 0,
    };
  }

  const oid = new mongoose.Types.ObjectId(String(userId));
  const DiscussionRoom = mainModel("DiscussionRoom");
  const WatchSession = mainModel("WatchSession");
  const LiveSession = mainModel("LiveSession");

  const [
    totalSessionsJoined,
    totalRoomsCreated,
    watchMinutes,
    liveMinutes,
    reportsReceived,
  ] = await Promise.all([
    DiscussionRoom.countDocuments({ participants: oid }),
    DiscussionRoom.countDocuments({ hostId: oid }),
    sumSessionDurationMinutesForUser(WatchSession, oid, (u) => ({ participants: u })),
    sumSessionDurationMinutesForUser(LiveSession, oid, (u) => ({
      participants: u,
      sessionType: { $in: ["learn", "watch"] },
    })),
    DiscussionReport.countDocuments({ reportedUserId: oid }),
  ]);

  const totalWatchTime = watchMinutes + liveMinutes;

  return {
    totalSessionsJoined,
    totalRoomsCreated,
    totalWatchTime,
    reportsReceived,
  };
}

async function listUsers(query) {
  const UserModel = getUserModel();
  const { page, limit, skip } = getPagination(query);
  const filter = buildListFilter(query);

  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "fullName email country subscriptionPlan isBlocked isSuspended suspendedUntil contributorVerifiedAt contributorBadge contributorBadgeAssignedAt lastActive createdAt updatedAt phone deletedAt",
      )
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getUserById(id) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id).select("-password -resetOtpHash").lean();
  if (!u) throw new AppError(404, "User not found");
  const stats = await getUserStats(id);
  return { ...u, stats };
}

async function blockUser(id, { block, reason }, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u || u.deletedAt) throw new AppError(404, "User not found");
  u.isBlocked = Boolean(block);
  u.blockedReason = block ? String(reason || "").trim().slice(0, 500) : "";
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: block ? "user_block" : "user_unblock",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return u.toObject();
}

async function suspendUser(id, { suspend, until }, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u || u.deletedAt) throw new AppError(404, "User not found");
  u.isSuspended = Boolean(suspend);
  if (suspend && until) {
    const d = new Date(until);
    if (Number.isNaN(d.getTime())) throw new AppError(400, "Invalid until date");
    u.suspendedUntil = d;
  } else if (suspend) {
    u.suspendedUntil = null;
  } else {
    u.suspendedUntil = null;
  }
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: suspend ? "user_suspend" : "user_unsuspend",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
    meta: { until: u.suspendedUntil },
  });
  return u.toObject();
}

async function softDeleteUser(id, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u || u.deletedAt) throw new AppError(404, "User not found");
  u.deletedAt = new Date();
  u.isBlocked = true;
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: "user_delete",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return { ok: true };
}

async function verifyContributor(id, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u || u.deletedAt) throw new AppError(404, "User not found");
  u.subscriptionPlan = "CONTRIBUTE";
  u.contributorVerifiedAt = new Date();
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: "user_verify_contributor",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return u.toObject();
}

async function assignContributorBadge(id, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u || u.deletedAt) throw new AppError(404, "User not found");
  u.contributorBadge = true;
  u.contributorBadgeAssignedAt = new Date();
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: "ASSIGN_BADGE",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  const [stats, fresh] = await Promise.all([getUserStats(id), getUserLeanById(id)]);
  return { ...(fresh || {}), stats };
}

async function resetAccountState(id, actorId, ip, ua) {
  const UserModel = getUserModel();
  const u = await UserModel.findById(id);
  if (!u) throw new AppError(404, "User not found");
  u.isBlocked = false;
  u.isSuspended = false;
  u.suspendedUntil = null;
  u.blockedReason = "";
  await u.save();

  await recordActivity({
    adminId: actorId,
    action: "RESET_ACCOUNT",
    targetType: "user",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  const [stats, fresh] = await Promise.all([getUserStats(id), getUserLeanById(id)]);
  return { ...(fresh || {}), stats };
}

module.exports = {
  listUsers,
  getUserById,
  getUserStats,
  blockUser,
  suspendUser,
  softDeleteUser,
  verifyContributor,
  assignContributorBadge,
  resetAccountState,
};
