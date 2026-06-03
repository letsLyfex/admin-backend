const svc = require("../services/sessionService");
const { getClientIp } = require("../utils/requestHelpers");
const { AppError } = require("../utils/AppError");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

//  WATCH 
exports.listWatchSessions = async (req, res) => {
  res.json(await svc.listWatchSessions(req.query));
};

exports.getWatchSession = async (req, res) => {
  res.json(await svc.getWatchSessionById(req.params.id));
};

exports.updateWatchSession = async (req, res) => {
  res.json(await svc.updateWatchSession(req.params.id, req.body));
};

exports.deleteWatchSession = async (req, res) => {
  res.json(await svc.deleteWatchSession(req.params.id, ...ctx(req)));
};

exports.banFromWatch = async (req, res) => {
  res.json(
    await svc.banUserFromWatchSession(
      req.params.id,
      req.params.userId,
      ...ctx(req)
    )
  );
};

exports.unbanFromWatch = async (req, res) => {
  res.json(
    await svc.unbanUserFromWatchSession(
      req.params.id,
      req.params.userId,
      ...ctx(req)
    )
  );
};

exports.watchStats = async (req, res) => {
  res.json(await svc.getWatchSessionStats());
};

//  LIVE 
exports.listLiveSessions = async (req, res) => {
  res.json(await svc.listLiveSessions(req.query));
};

exports.getLiveSession = async (req, res) => {
  res.json(await svc.getLiveSessionById(req.params.id));
};

exports.updateLiveSession = async (req, res) => {
  res.json(await svc.updateLiveSession(req.params.id, req.body));
};

exports.deleteLiveSession = async (req, res) => {
  res.json(await svc.deleteLiveSession(req.params.id, ...ctx(req)));
};

exports.banFromLive = async (req, res) => {
  res.json(
    await svc.banUserFromLiveSession(
      req.params.id,
      req.params.userId,
      ...ctx(req)
    )
  );
};

exports.unbanFromLive = async (req, res) => {
  res.json(
    await svc.unbanUserFromLiveSession(
      req.params.id,
      req.params.userId,
      ...ctx(req)
    )
  );
};

exports.liveStats = async (req, res) => {
  res.json(await svc.getLiveSessionStats());
};

//  PAUSE 
exports.listPauseSessions = async (req, res) => {
  res.json(await svc.listPauseSessions(req.query));
};

exports.getPauseSession = async (req, res) => {
  res.json(await svc.getPauseSessionById(req.params.id));
};

exports.updatePauseSession = async (req, res) => {
  res.json(await svc.updatePauseSession(req.params.id, req.body));
};

exports.deletePauseSession = async (req, res) => {
  res.json(await svc.deletePauseSession(req.params.id, ...ctx(req)));
};

exports.pauseStats = async (req, res) => {
  res.json(await svc.getPauseSessionStats());
};