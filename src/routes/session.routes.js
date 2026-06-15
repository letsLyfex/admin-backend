const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const c = require("../controllers/sessionController");

router.use(attachAdmin);

//  WATCH ROUTES 
router.get(
  "/watch",
  requirePermission("sessions.view"),
  asyncHandler(c.listWatchSessions)
);
router.get(
  "/watch/stats",
  requirePermission("sessions.view"),
  asyncHandler(c.watchStats)
);
router.get(
  "/watch/:id",
  requirePermission("sessions.view"),
  asyncHandler(c.getWatchSession)
);
router.patch(
  "/watch/:id",
  requirePermission("sessions.edit"),
  asyncHandler(c.updateWatchSession)
);
router.delete(
  "/watch/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deleteWatchSession)
);
router.post(
  "/watch/:id/ban/:userId",
  requirePermission("sessions.edit"),
  asyncHandler(c.banFromWatch)
);
router.delete(
  "/watch/:id/ban/:userId",
  requirePermission("sessions.edit"),
  asyncHandler(c.unbanFromWatch)
);

//  LIVE ROUTES 
router.get(
  "/live",
  requirePermission("sessions.view"),
  asyncHandler(c.listLiveSessions)
);
router.get(
  "/live/stats",
  requirePermission("sessions.view"),
  asyncHandler(c.liveStats)
);
router.get(
  "/live/:id",
  requirePermission("sessions.view"),
  asyncHandler(c.getLiveSession)
);
router.patch(
  "/live/:id",
  requirePermission("sessions.edit"),
  asyncHandler(c.updateLiveSession)
);
router.delete(
  "/live/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deleteLiveSession)
);
router.post(
  "/live/:id/ban/:userId",
  requirePermission("sessions.edit"),
  asyncHandler(c.banFromLive)
);
router.delete(
  "/live/:id/ban/:userId",
  requirePermission("sessions.edit"),
  asyncHandler(c.unbanFromLive)
);

//  PAUSE ROUTES 
router.get(
  "/pause",
  requirePermission("sessions.view"),
  asyncHandler(c.listPauseSessions)
);
router.get(
  "/pause/stats",
  requirePermission("sessions.view"),
  asyncHandler(c.pauseStats)
);
router.get(
  "/pause/:id",
  requirePermission("sessions.view"),
  asyncHandler(c.getPauseSession)
);
router.patch(
  "/pause/:id",
  requirePermission("sessions.edit"),
  asyncHandler(c.updatePauseSession)
);
router.delete(
  "/pause/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deletePauseSession)
);

module.exports = router;