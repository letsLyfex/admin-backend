const svc = require("../services/discussionAdminService");
const { getClientIp } = require("../utils/requestHelpers");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

exports.listRooms = async (req, res) => {
  res.json(await svc.listRooms(req.query));
};

exports.getRoom = async (req, res) => {
  const { AppError } = require("../utils/AppError");
  const room = await svc.getRoomByAnyId(req.params.id);
  if (!room) throw new AppError(404, "Room not found");
  res.json(room);
};

exports.deleteRoom = async (req, res) => {
  res.json(await svc.deleteRoom(req.params.id, ...ctx(req)));
};

exports.pin = async (req, res) => {
  const { pinned } = req.body || {};
  res.json(await svc.setPin(req.params.id, Boolean(pinned), ...ctx(req)));
};

exports.feature = async (req, res) => {
  const { featured } = req.body || {};
  res.json(await svc.setFeatured(req.params.id, Boolean(featured), ...ctx(req)));
};

exports.listReports = async (req, res) => {
  res.json(await svc.listReports(req.query));
};

exports.patchReport = async (req, res) => {
  const { status, adminNote } = req.body || {};
  res.json(await svc.updateReportStatus(req.params.reportId, { status, adminNote }, ...ctx(req)));
};
