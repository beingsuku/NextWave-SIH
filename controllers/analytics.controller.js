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

    // Calculate actual average screening duration for completed screenings
    const recentCompleted = await prisma.screening.findMany({
      where: {
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      },
      take: 100,
      orderBy: { completedAt: "desc" }
    });

    let averageScreeningTimeSec = 0;
    if (recentCompleted.length > 0) {
      const totalSeconds = recentCompleted.reduce((acc, curr) => {
        const diffSec = (new Date(curr.completedAt).getTime() - new Date(curr.startedAt).getTime()) / 1000;
        return acc + Math.max(diffSec, 0);
      }, 0);
      averageScreeningTimeSec = Number((totalSeconds / recentCompleted.length).toFixed(1));
    }

    res.json({
      success: true,

      data: {
        totalScreenings: total,
        lowRisk: low,
        mediumRisk: medium,
        highRisk: high,
        manualReview,

        averageScreeningTimeSec
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