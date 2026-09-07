const express = require("express");

const {
  authenticate
} = require("../middleware/auth");

const {
  getKPIs,
  getRiskDistribution
} = require("../controllers/analytics.controller");

const router = express.Router();

router.use(authenticate);

router.get(
  "/kpis",
  getKPIs
);

router.get(
  "/risk-distribution",
  getRiskDistribution
);

module.exports = router;