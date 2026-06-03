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
  requirePermission("sessions.read"),
  asyncHandler(c.listWatchSessions)
);
router.get(
  "/watch/stats",
  requirePermission("sessions.read"),
  asyncHandler(c.watchStats)
);
router.get(
  "/watch/:id",
  requirePermission("sessions.read"),
  asyncHandler(c.getWatchSession)
);
router.patch(
  "/watch/:id",
  requirePermission("sessions.manage"),
  asyncHandler(c.updateWatchSession)
);
router.delete(
  "/watch/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deleteWatchSession)
);
router.post(
  "/watch/:id/ban/:userId",
  requirePermission("sessions.manage"),
  asyncHandler(c.banFromWatch)
);
router.delete(
  "/watch/:id/ban/:userId",
  requirePermission("sessions.manage"),
  asyncHandler(c.unbanFromWatch)
);

//  LIVE ROUTES 
router.get(
  "/live",
  requirePermission("sessions.read"),
  asyncHandler(c.listLiveSessions)
);
router.get(
  "/live/stats",
  requirePermission("sessions.read"),
  asyncHandler(c.liveStats)
);
router.get(
  "/live/:id",
  requirePermission("sessions.read"),
  asyncHandler(c.getLiveSession)
);
router.patch(
  "/live/:id",
  requirePermission("sessions.manage"),
  asyncHandler(c.updateLiveSession)
);
router.delete(
  "/live/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deleteLiveSession)
);
router.post(
  "/live/:id/ban/:userId",
  requirePermission("sessions.manage"),
  asyncHandler(c.banFromLive)
);
router.delete(
  "/live/:id/ban/:userId",
  requirePermission("sessions.manage"),
  asyncHandler(c.unbanFromLive)
);

//  PAUSE ROUTES 
router.get(
  "/pause",
  requirePermission("sessions.read"),
  asyncHandler(c.listPauseSessions)
);
router.get(
  "/pause/stats",
  requirePermission("sessions.read"),
  asyncHandler(c.pauseStats)
);
router.get(
  "/pause/:id",
  requirePermission("sessions.read"),
  asyncHandler(c.getPauseSession)
);
router.patch(
  "/pause/:id",
  requirePermission("sessions.manage"),
  asyncHandler(c.updatePauseSession)
);
router.delete(
  "/pause/:id",
  requirePermission("sessions.delete"),
  asyncHandler(c.deletePauseSession)
);

module.exports = router;