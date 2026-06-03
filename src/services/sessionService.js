const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

//  WATCH SESSIONS 

async function listWatchSessions(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (String(query.q || "").trim()) {
    const esc = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: new RegExp(esc, "i") },
      { roomId: new RegExp(esc, "i") },
      { category: new RegExp(esc, "i") },
    ];
  }

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.isLive !== undefined) filter.isLive = query.isLive === "true";
  if (query.isAutomated !== undefined)
    filter.isAutomated = query.isAutomated === "true";
  if (query.source) filter.source = query.source;

  const [items, total] = await Promise.all([
    WatchSession.find(filter)
      .populate("hostId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WatchSession.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getWatchSessionById(id) {
  const session = mongoose.isValidObjectId(id)
    ? await WatchSession.findById(id)
        .populate("hostId", "fullName email")
        .populate("participants", "fullName email")
        .populate("bannedUserIds", "fullName email")
        .lean()
    : await WatchSession.findOne({ roomId: id })
        .populate("hostId", "fullName email")
        .lean();

  if (!session) throw new AppError(404, "Watch session not found");
  return session;
}

async function updateWatchSession(id, updates) {
  const forbidden = ["_id", "__v", "roomId", "createdAt"];
  forbidden.forEach((k) => delete updates[k]);

  const session = mongoose.isValidObjectId(id)
    ? await WatchSession.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean()
    : await WatchSession.findOneAndUpdate(
        { roomId: id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

  if (!session) throw new AppError(404, "Watch session not found");
  return session;
}

async function deleteWatchSession(id, actorId, ip, ua) {
  const session = mongoose.isValidObjectId(id)
    ? await WatchSession.findByIdAndDelete(id).lean()
    : await WatchSession.findOneAndDelete({ roomId: id }).lean();

  if (!session) throw new AppError(404, "Watch session not found");

  await recordActivity({
    adminId: actorId,
    action: "watch_session_delete",
    targetType: "watch_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return { ok: true, roomId: session.roomId };
}

async function banUserFromWatchSession(id, userId, actorId, ip, ua) {
  const session = await WatchSession.findByIdAndUpdate(
    id,
    {
      $addToSet: { bannedUserIds: userId },
      $pull: { participants: userId },
    },
    { new: true }
  ).lean();

  if (!session) throw new AppError(404, "Watch session not found");

  await recordActivity({
    adminId: actorId,
    action: "watch_session_ban_user",
    targetType: "watch_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return session;
}

async function unbanUserFromWatchSession(id, userId, actorId, ip, ua) {
  const session = await WatchSession.findByIdAndUpdate(
    id,
    { $pull: { bannedUserIds: userId } },
    { new: true }
  ).lean();

  if (!session) throw new AppError(404, "Watch session not found");

  await recordActivity({
    adminId: actorId,
    action: "watch_session_unban_user",
    targetType: "watch_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return session;
}

async function getWatchSessionStats() {
  const [total, live, ended, scheduled, automated] = await Promise.all([
    WatchSession.countDocuments(),
    WatchSession.countDocuments({ isLive: true }),
    WatchSession.countDocuments({ status: "ended" }),
    WatchSession.countDocuments({ status: "scheduled" }),
    WatchSession.countDocuments({ isAutomated: true }),
  ]);
  return { total, live, ended, scheduled, automated };
}

// ─── LIVE SESSIONS (LEARN) ────────────────────────────────────

async function listLiveSessions(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (String(query.q || "").trim()) {
    const esc = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: new RegExp(esc, "i") },
      { roomId: new RegExp(esc, "i") },
      { subject: new RegExp(esc, "i") },
    ];
  }

  if (query.sessionType) filter.sessionType = query.sessionType; // "learn" or "watch"
  if (query.status) filter.status = query.status;
  if (query.isLive !== undefined) filter.isLive = query.isLive === "true";
  if (query.isAutomated !== undefined)
    filter.isAutomated = query.isAutomated === "true";
  if (query.visibility) filter.visibility = query.visibility;

  const [items, total] = await Promise.all([
    LiveSession.find(filter)
      .populate("hostId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LiveSession.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getLiveSessionById(id) {
  const session = mongoose.isValidObjectId(id)
    ? await LiveSession.findById(id)
        .populate("hostId", "fullName email")
        .populate("participants", "fullName email")
        .populate("bannedUserIds", "fullName email")
        .lean()
    : await LiveSession.findOne({ roomId: id })
        .populate("hostId", "fullName email")
        .lean();

  if (!session) throw new AppError(404, "Live session not found");
  return session;
}

async function updateLiveSession(id, updates) {
  const forbidden = ["_id", "__v", "roomId", "createdAt"];
  forbidden.forEach((k) => delete updates[k]);

  const session = mongoose.isValidObjectId(id)
    ? await LiveSession.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean()
    : await LiveSession.findOneAndUpdate(
        { roomId: id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

  if (!session) throw new AppError(404, "Live session not found");
  return session;
}

async function deleteLiveSession(id, actorId, ip, ua) {
  const session = mongoose.isValidObjectId(id)
    ? await LiveSession.findByIdAndDelete(id).lean()
    : await LiveSession.findOneAndDelete({ roomId: id }).lean();

  if (!session) throw new AppError(404, "Live session not found");

  await recordActivity({
    adminId: actorId,
    action: "live_session_delete",
    targetType: "live_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return { ok: true, roomId: session.roomId };
}

async function banUserFromLiveSession(id, userId, actorId, ip, ua) {
  const session = await LiveSession.findByIdAndUpdate(
    id,
    {
      $addToSet: { bannedUserIds: userId },
      $pull: { participants: userId },
    },
    { new: true }
  ).lean();

  if (!session) throw new AppError(404, "Live session not found");

  await recordActivity({
    adminId: actorId,
    action: "live_session_ban_user",
    targetType: "live_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return session;
}

async function unbanUserFromLiveSession(id, userId, actorId, ip, ua) {
  const session = await LiveSession.findByIdAndUpdate(
    id,
    { $pull: { bannedUserIds: userId } },
    { new: true }
  ).lean();

  if (!session) throw new AppError(404, "Live session not found");

  await recordActivity({
    adminId: actorId,
    action: "live_session_unban_user",
    targetType: "live_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return session;
}

async function getLiveSessionStats() {
  const [total, live, ended, scheduled, learn, watch] = await Promise.all([
    LiveSession.countDocuments(),
    LiveSession.countDocuments({ isLive: true }),
    LiveSession.countDocuments({ status: "ended" }),
    LiveSession.countDocuments({ status: "scheduled" }),
    LiveSession.countDocuments({ sessionType: "learn" }),
    LiveSession.countDocuments({ sessionType: "watch" }),
  ]);
  return { total, live, ended, scheduled, byType: { learn, watch } };
}

// ─── PAUSE SESSIONS ───────────────────────────────────────────

async function listPauseSessions(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (String(query.q || "").trim()) {
    const esc = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: new RegExp(esc, "i") },
      { roomId: new RegExp(esc, "i") },
    ];
  }

  if (query.vibeTag) filter.vibeTag = query.vibeTag;
  if (query.isLive !== undefined) filter.isLive = query.isLive === "true";
  if (query.isInstantHangout !== undefined)
    filter.isInstantHangout = query.isInstantHangout === "true";

  const [items, total] = await Promise.all([
    PauseContent.find(filter)
      .populate("creatorId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PauseContent.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getPauseSessionById(id) {
  const session = mongoose.isValidObjectId(id)
    ? await PauseContent.findById(id)
        .populate("creatorId", "fullName email")
        .populate("participantIds", "fullName email")
        .lean()
    : await PauseContent.findOne({ roomId: id })
        .populate("creatorId", "fullName email")
        .lean();

  if (!session) throw new AppError(404, "Pause session not found");
  return session;
}

async function updatePauseSession(id, updates) {
  const forbidden = ["_id", "__v", "roomId", "createdAt"];
  forbidden.forEach((k) => delete updates[k]);

  const session = mongoose.isValidObjectId(id)
    ? await PauseContent.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean()
    : await PauseContent.findOneAndUpdate(
        { roomId: id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

  if (!session) throw new AppError(404, "Pause session not found");
  return session;
}

async function deletePauseSession(id, actorId, ip, ua) {
  const session = mongoose.isValidObjectId(id)
    ? await PauseContent.findByIdAndDelete(id).lean()
    : await PauseContent.findOneAndDelete({ roomId: id }).lean();

  if (!session) throw new AppError(404, "Pause session not found");

  await recordActivity({
    adminId: actorId,
    action: "pause_session_delete",
    targetType: "pause_session",
    targetId: String(session.roomId),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return { ok: true, roomId: session.roomId };
}

async function getPauseSessionStats() {
  const [total, live, instant] = await Promise.all([
    PauseContent.countDocuments(),
    PauseContent.countDocuments({ isLive: true }),
    PauseContent.countDocuments({ isInstantHangout: true }),
  ]);
  return { total, live, instant };
}

module.exports = {
  // Watch
  listWatchSessions,
  getWatchSessionById,
  updateWatchSession,
  deleteWatchSession,
  banUserFromWatchSession,
  unbanUserFromWatchSession,
  getWatchSessionStats,
  // Live
  listLiveSessions,
  getLiveSessionById,
  updateLiveSession,
  deleteLiveSession,
  banUserFromLiveSession,
  unbanUserFromLiveSession,
  getLiveSessionStats,
  // Pause
  listPauseSessions,
  getPauseSessionById,
  updatePauseSession,
  deletePauseSession,
  getPauseSessionStats,
};