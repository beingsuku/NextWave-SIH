const express = require("express");

const {
  authenticate
} = require("../middleware/auth");

const {
  getReport
} = require("../controllers/report.controller");

const router = express.Router();

router.use(authenticate);

router.get(
  "/:id",
  getReport
);

module.exports = router;