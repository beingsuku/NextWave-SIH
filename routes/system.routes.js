const express = require("express");

const {
  health
} = require("../controllers/system.controller");

const router = express.Router();

router.get(
  "/health",
  health
);

module.exports = router;