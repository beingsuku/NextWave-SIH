const express = require("express");

const upload =
  require("../middleware/upload");

const {
  authenticate
} = require("../middleware/auth");

const {
  createScreening,
  completeLiveVerification,
  getScreenings,
  getScreening
} = require("../controllers/screening.controller");

const router = express.Router();

router.use(authenticate);

// Phase 1: document analysis
router.post(
  "/",
  upload.single("document"),
  createScreening
);

// Phase 2: live capture, face match, risk scoring, decision
router.post(
  "/:id/live-capture",
  upload.single("liveCapture"),
  completeLiveVerification
);

router.get(
  "/",
  getScreenings
);

router.get(
  "/:id",
  getScreening
);

module.exports = router;