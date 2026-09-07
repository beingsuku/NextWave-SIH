const {
  prisma
} = require("../config/db");

async function getKPIs(req, res) {
  try {
    const [
      total,
      low,
      medium,
      high,
      manualReview
    ] = await Promise.all([
      prisma.screening.count(),

      prisma.screening.count({
        where: {
          riskLevel: "LOW"
        }
      }),

      prisma.screening.count({
        where: {
          riskLevel: "MEDIUM"
        }
      }),

      prisma.screening.count({
        where: {
          riskLevel: "HIGH"
        }
      }),

      prisma.screening.count({
        where: {
          status: "MANUAL_REVIEW"
        }
      })
    ]);

    res.json({
      success: true,

      data: {
        totalScreenings: total,
        lowRisk: low,
        mediumRisk: medium,
        highRisk: high,
        manualReview,

        averageScreeningTimeSec: 0
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Analytics unavailable"
    });
  }
}

async function getRiskDistribution(req, res) {
  try {
    const data =
      await prisma.screening.groupBy({
        by: ["riskLevel"],

        _count: {
          _all: true
        }
      });

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load risk distribution"
    });
  }
}

module.exports = {
  getKPIs,
  getRiskDistribution
};