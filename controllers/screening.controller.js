const crypto = require("crypto");

const {
  prisma
} = require("../config/db");

const generateScreeningId =
  require("../utils/screening-id");

const {
  runOCR
} = require("../services/ocr.service");

const {
  validateMRZ
} = require("../services/mrz.service");

const {
  runForensics
} = require("../services/forensic.service");

const {
  verifyFace
} = require("../services/face.service");

const {
  calculateRisk
} = require("../services/risk.service");

const {
  createAudit
} = require("../services/audit.service");

async function sha256File(filePath) {
  const fs = require("fs");

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");

    const stream = fs.createReadStream(filePath);

    stream.on("data", data => hash.update(data));

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", reject);
  });
}

async function createScreening(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document file is required"
      });
    }

    const {
      documentType
    } = req.body;

    const validTypes = [
      "PASSPORT",
      "VISA",
      "NATIONAL_ID",
      "DRIVING_LICENCE",
      "TRAVEL_PERMIT"
    ];

    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type"
      });
    }

    const screeningId =
      generateScreeningId();

    const fileHash =
      await sha256File(req.file.path);

    /*
      STEP 1
      Create database record
    */

    const screening =
      await prisma.screening.create({
        data: {
          screeningId,

          officerId: req.user.id,

          documentType,

          status: "PROCESSING",

          document: {
            create: {
              originalName:
                req.file.originalname,

              storedName:
                req.file.filename,

              path:
                req.file.path,

              mimeType:
                req.file.mimetype,

              size:
                req.file.size,

              sha256:
                fileHash
            }
          }
        }
      });

    await createAudit({
      officerId: req.user.id,
      screeningId: screening.id,
      action: "SCREENING_CREATED",
      details: {
        screeningId
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    /*
      STEP 2
      OCR
    */

    const ocr =
      await runOCR(
        req.file.path,
        documentType
      );

    /*
      STEP 3
      MRZ
    */

    const mrz =
      validateMRZ(
        ocr.mrzLine1,
        ocr.mrzLine2
      );

    /*
      STEP 4
      Forensics
    */

    const forensic =
      await runForensics(
        req.file.path
      );

    /*
      STEP 5
      Face

      If no second image exists,
      prototype returns unavailable.
    */

    const face =
      await verifyFace(
        req.file.path,
        null
      );

    /*
      STEP 6
      Risk

      Prototype face value when unavailable = 0.
    */

    const risk =
      calculateRisk({
        tamperingScore:
          forensic.riskScore || 0,

        faceScore:
          face.similarityScore || 0,

        mrzScore:
          mrz.valid ? 100 : 0,

        validityScore:
          ocr.confidence || 0
      });

    let recommendation =
      "CLEAR";

    if (risk.riskLevel === "HIGH") {
      recommendation = "MANUAL_REVIEW";
    } else if (
      risk.riskLevel === "MEDIUM"
    ) {
      recommendation = "SECONDARY_CHECK";
    }

    /*
      STEP 7
      Save ALL results
    */

    await prisma.oCRResult.create({
      data: {
        screeningId: screening.id,

        confidence:
          ocr.confidence,

        fullName:
          ocr.fullName,

        documentNumber:
          ocr.documentNumber,

        nationality:
          ocr.nationality,

        dateOfBirth:
          ocr.dateOfBirth,

        dateOfExpiry:
          ocr.dateOfExpiry,

        gender:
          ocr.gender,

        issuingAuthority:
          ocr.issuingAuthority,

        mrzLine1:
          ocr.mrzLine1,

        mrzLine2:
          ocr.mrzLine2,

        rawText:
          ocr.rawText
      }
    });

    await prisma.mRZResult.create({
      data: {
        screeningId: screening.id,

        valid:
          mrz.valid,

        passportChecksum:
          mrz.passportChecksum,

        birthDateChecksum:
          mrz.birthDateChecksum,

        expiryChecksum:
          mrz.expiryChecksum,

        consistency:
          mrz.consistency,

        details:
          mrz.details
      }
    });

    await prisma.forensicResult.create({
      data: {
        screeningId: screening.id,

        riskScore:
          forensic.riskScore,

        suspiciousRegions:
          forensic.suspiciousRegions,

        signals:
          forensic.signals
      }
    });

    await prisma.faceVerification.create({
      data: {
        screeningId: screening.id,

        similarityScore:
          face.similarityScore,

        imageQualityScore:
          face.imageQualityScore,

        faceDetectedDocument:
          face.faceDetectedDocument,

        faceDetectedLive:
          face.faceDetectedLive,

        signal:
          face.signal,

        landmarksMatched:
          face.landmarksMatched,

        poseAlignment:
          face.poseAlignment,

        lightingQuality:
          face.lightingQuality
      }
    });

    await prisma.riskAssessment.create({
      data: {
        screeningId: screening.id,

        overallScore:
          risk.overallScore,

        riskLevel:
          risk.riskLevel,

        tamperingScore:
          forensic.riskScore,

        faceScore:
          face.similarityScore || 0,

        mrzScore:
          mrz.valid ? 100 : 0,

        validityScore:
          ocr.confidence || 0,

        contributors:
          risk.contributors,

        explanation:
          risk.explanation
      }
    });

    /*
      STEP 8
      Update main screening
    */

    const finalScreening =
      await prisma.screening.update({
        where: {
          id: screening.id
        },

        data: {
          status:
            risk.riskLevel === "HIGH"
              ? "MANUAL_REVIEW"
              : "COMPLETED",

          riskScore:
            risk.overallScore,

          riskLevel:
            risk.riskLevel,

          recommendation,

          recommendationDetails:
            risk.explanation.join(". "),

          completedAt:
            new Date()
        },

        include: {
          document: true,
          ocrResult: true,
          mrzResult: true,
          forensicResult: true,
          faceVerification: true,
          riskAssessment: true,
          officer: {
            select: { officerId: true, name: true, checkpoint: true }
          }
        }
      });

    await createAudit({
      officerId: req.user.id,
      screeningId: screening.id,
      action: "SCREENING_COMPLETED",
      details: {
        riskScore:
          risk.overallScore,

        riskLevel:
          risk.riskLevel,

        recommendation
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(201).json({
      success: true,

      data: finalScreening
    });

  } catch (error) {
    console.error(
      "SCREENING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Screening failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
}

async function getScreenings(req, res) {
  try {
    const {
      riskLevel,
      status,
      documentType,
      limit = 50,
      page = 1
    } = req.query;

    const where = {};

    if (riskLevel) {
      where.riskLevel =
        riskLevel.toUpperCase();
    }

    if (status) {
      where.status =
        status.toUpperCase();
    }

    if (documentType) {
      where.documentType =
        documentType.toUpperCase();
    }

    const take =
      Math.min(Number(limit), 100);

    const skip =
      (Number(page) - 1) * take;

    const [
      data,
      total
    ] = await Promise.all([
      prisma.screening.findMany({
        where,

        orderBy: {
          createdAt: "desc"
        },

        skip,
        take,

        include: {
          officer: {
            select: {
              officerId: true,
              name: true
            }
          },

          riskAssessment: true
        }
      }),

      prisma.screening.count({
        where
      })
    ]);

    res.json({
      success: true,

      data,

      pagination: {
        page: Number(page),
        limit: take,
        total,
        pages:
          Math.ceil(total / take)
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve screenings"
    });
  }
}

async function getScreening(req, res) {
  try {
    const screening =
      await prisma.screening.findUnique({
        where: {
          screeningId:
            req.params.id
        },

        include: {
          officer: {
            select: {
              officerId: true,
              name: true,
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
          auditLogs: {
            orderBy: {
              createdAt: "asc"
            }
          }
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
      data: screening
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve screening"
    });
  }
}

module.exports = {
  createScreening,
  getScreenings,
  getScreening
};