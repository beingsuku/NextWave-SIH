const express = require("express");

const upload =
  require("../middleware/upload");

const {
  authenticate
} = require("../middleware/auth");

const {
  createScreening,
  getScreenings,
  getScreening
} = require("../controllers/screening.controller");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  upload.single("document"),
  createScreening
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