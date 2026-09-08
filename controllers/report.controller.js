const {
  prisma
} = require("../config/db");

async function getReport(req, res) {
  try {
    const screening =
      await prisma.screening.findFirst({
        where: {
          OR: [
            { screeningId: req.params.id },
            { id: req.params.id }
          ]
        },

        include: {
          officer: {
            select: {
              id: true,
              officerId: true,
              name: true,
              email: true,
              role: true,
              checkpoint: true
            }
          },
          document: true,
          ocrResult: true,
          mrzResult: true,
          forensicResult: true,
          faceVerification: true,
          riskAssessment: true,
          auditLogs: true
        }
      });

    if (!screening) {
      return res.status(404).json({
        success: false,
        message: "Screening not found"
      });
    }

    res.json({
      success: true,

      report: {
        reportId:
          `REPORT-${screening.screeningId}`,

        generatedAt:
          new Date(),

        screening
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Report generation failed"
    });
  }
}

module.exports = {
  getReport
};