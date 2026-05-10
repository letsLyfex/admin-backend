const mongoose = require("mongoose");
const { mainModel } = require("../utils/mainBackendPath");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");
const DiscussionReport = require("../models/DiscussionReport");

function discussionRoomModel() {
  return mainModel("DiscussionRoom");
}
function meetingMessageModel() {
  return mainModel("MeetingMessage");
}
function userSchedulePinModel() {
  return mainModel("UserSchedulePin");
}

async function tryDeleteLiveKitRoom(roomId) {
  try {
    const path = require("path");
    const { getMainBackendRoot } = require("../utils/mainBackendPath");
    const root = getMainBackendRoot();
    const { deleteRoomIfEmpty } = require(path.join(root, "src", "utils", "livekitClient"));
    await deleteRoomIfEmpty(String(roomId));
  } catch {
    // Admin API must not fail if LiveKit helper is unavailable in this deploy layout.
  }
}

async function listRooms(query) {
  const DiscussionRoom = discussionRoomModel();
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (String(query.q || "").trim()) {
    const esc = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { topic: new RegExp(esc, "i") },
      { roomId: new RegExp(esc, "i") },
      { category: new RegExp(esc, "i") },
    ];
  }
  if (query.isLive === "true") filter.isLive = true;
  if (query.isLive === "false") filter.isLive = false;

  const [items, total] = await Promise.all([
    DiscussionRoom.find(filter)
      .sort({ isPinned: -1, isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("hostId", "fullName email")
      .lean(),
    DiscussionRoom.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getRoomByAnyId(id) {
  const DiscussionRoom = discussionRoomModel();
  if (mongoose.isValidObjectId(id)) {
    const byMongo = await DiscussionRoom.findById(id).populate("hostId", "fullName email").lean();
    if (byMongo) return byMongo;
  }
  return DiscussionRoom.findOne({ roomId: String(id) }).populate("hostId", "fullName email").lean();
}

async function deleteRoom(id, actorId, ip, ua) {
  const DiscussionRoom = discussionRoomModel();
  const MeetingMessage = meetingMessageModel();
  const UserSchedulePin = userSchedulePinModel();

  const room =
    (mongoose.isValidObjectId(id) && (await DiscussionRoom.findById(id))) ||
    (await DiscussionRoom.findOne({ roomId: String(id) }));
  if (!room) throw new AppError(404, "Room not found");
  const roomId = room.roomId;

  await DiscussionRoom.deleteOne({ _id: room._id });
  await UserSchedulePin.deleteMany({ roomId, roomType: "discussion" });
  await MeetingMessage.deleteMany({ roomId, roomType: "discussion" });
  void tryDeleteLiveKitRoom(roomId);

  await recordActivity({
    adminId: actorId,
    action: "discussion_room_delete",
    targetType: "discussion_room",
    targetId: roomId,
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return { ok: true, roomId };
}

async function setPin(id, pinned, actorId, ip, ua) {
  const DiscussionRoom = discussionRoomModel();
  const room =
    (mongoose.isValidObjectId(id) && (await DiscussionRoom.findById(id))) ||
    (await DiscussionRoom.findOne({ roomId: String(id) }));
  if (!room) throw new AppError(404, "Room not found");
  room.isPinned = Boolean(pinned);
  await room.save();

  await recordActivity({
    adminId: actorId,
    action: pinned ? "discussion_room_pin" : "discussion_room_unpin",
    targetType: "discussion_room",
    targetId: room.roomId,
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return room.toObject();
}

async function setFeatured(id, featured, actorId, ip, ua) {
  const DiscussionRoom = discussionRoomModel();
  const room =
    (mongoose.isValidObjectId(id) && (await DiscussionRoom.findById(id))) ||
    (await DiscussionRoom.findOne({ roomId: String(id) }));
  if (!room) throw new AppError(404, "Room not found");
  room.isFeatured = Boolean(featured);
  await room.save();

  await recordActivity({
    adminId: actorId,
    action: featured ? "discussion_room_feature" : "discussion_room_unfeature",
    targetType: "discussion_room",
    targetId: room.roomId,
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return room.toObject();
}

async function listReports(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = String(query.status);
  const [items, total] = await Promise.all([
    DiscussionReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DiscussionReport.countDocuments(filter),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

async function updateReportStatus(reportId, { status, adminNote }, actorId, ip, ua) {
  const r = await DiscussionReport.findById(reportId);
  if (!r) throw new AppError(404, "Report not found");
  if (status) r.status = status;
  if (adminNote != null) r.adminNote = String(adminNote).slice(0, 1000);
  r.handledByAdminId = actorId;
  await r.save();

  await recordActivity({
    adminId: actorId,
    action: "discussion_report_update",
    targetType: "discussion_report",
    targetId: String(r._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  return r.toObject();
}

module.exports = {
  listRooms,
  getRoomByAnyId,
  deleteRoom,
  setPin,
  setFeatured,
  listReports,
  updateReportStatus,
};
