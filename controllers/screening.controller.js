const crypto = require("crypto");
const fs = require("fs");

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

async function removeFileQuietly(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not delete file:", filePath, error.message);
    }
  }
}

/*
  PHASE 1 — document analysis (pipeline steps 1-5)
  POST /api/screening   (multipart: document, documentType)

  Runs OCR, MRZ and forensics, saves them, then leaves the screening
  waiting for the live capture. No risk score yet: the face is part of it.
*/
async function createScreening(req, res) {
  const documentFile = req.file;
  let screening = null;

  try {
    const t0 = Date.now();                                   
    const lap = (label) =>                                   
      console.log(`[timing] ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`); 
    if (!documentFile) {
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
      await removeFileQuietly(documentFile.path);

      return res.status(400).json({
        success: false,
        message: "Invalid document type"
      });
    }

    const screeningId =
      generateScreeningId();

    const fileHash =
      await sha256File(documentFile.path);

    /*
      STEP 1
      Create database record
    */

    screening =
      await prisma.screening.create({
        data: {
          screeningId,

          officerId: req.user.id,

          documentType,

          status: "PROCESSING",

          document: {
            create: {
              originalName:
                documentFile.originalname,

              storedName:
                documentFile.filename,

              path:
                documentFile.path,

              mimeType:
                documentFile.mimetype,

              size:
                documentFile.size,

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
    lap("hash+db+audit");
    /*
      STEP 2
      OCR
    */


    const ocr =
      await runOCR(
        documentFile.path,
        documentType
      );
    lap("ocr");     

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
        documentFile.path
      );
    lap("forensics");  
    /*
      STEP 5
      Save document-analysis results
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

        documentNumberChecksumValid:
          ocr.documentNumberChecksumValid,

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

        meanELA:
          forensic.meanELA,

        maxELA:
          forensic.maxELA,

        metadataChecked:
          forensic.metadataChecked,

        signals:
          forensic.signals
      }
    });

    const analysed =
      await prisma.screening.update({
        where: {
          id: screening.id
        },

        data: {
          status: "AWAITING_LIVE_CAPTURE"
        },

        include: {
          document: true,
          ocrResult: true,
          mrzResult: true,
          forensicResult: true
        }
      });
    lap("saved");   
    return res.status(201).json({
      success: true,

      data: analysed
    });

  } catch (error) {
    console.error(
      "SCREENING ERROR:",
      error
    );

    if (screening) {
      try {
        await prisma.screening.update({
          where: { id: screening.id },
          data: { status: "FAILED" }
        });
      } catch (updateError) {
        console.error(
          "Could not mark screening as FAILED:",
          updateError.message
        );
      }
    }

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

/*
  PHASE 2 — live verification, risk scoring, decision (steps 6-9)
  POST /api/screening/:id/live-capture
  multipart: liveCapture (image)  — or skipLiveCapture=true with no photo
*/
async function completeLiveVerification(req, res) {
  const liveFile = req.file;
  let committed = false;

  const reject = async (status, message) => {
    await removeFileQuietly(liveFile?.path);

    return res.status(status).json({
      success: false,
      message
    });
  };

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
          document: true,
          ocrResult: true,
          mrzResult: true,
          forensicResult: true
        }
      });

    if (!screening) {
      return reject(404, "Screening not found");
    }

    if (screening.officerId !== req.user.id) {
      return reject(403, "This screening belongs to another officer");
    }

    if (screening.status !== "AWAITING_LIVE_CAPTURE") {
      return reject(
        409,
        "This screening is not waiting for a live capture"
      );
    }

    const skipRequested =
      String(req.body?.skipLiveCapture) === "true";

    if (!liveFile && !skipRequested) {
      return reject(
        400,
        "A live capture photo is required (or send skipLiveCapture=true to continue without face verification)"
      );
    }

    /*
      STEP 6 + 7
      Face detection and comparison
    */

    const face =
      await verifyFace(
        screening.document.path,
        liveFile?.path ?? null
      );

    // A bad live photo, or the face service being down, can be retried.
    // If the DOCUMENT photo has no face, retaking will not help, so that
    // case is finalized below instead.
    const canRetry =
      Boolean(liveFile) &&
      (
        face.signal === "ERROR" ||
        (
          face.signal === "NO_FACE_DETECTED" &&
          face.faceDetectedDocument === true
        )
      );

    if (canRetry) {
      await removeFileQuietly(liveFile.path);

      return res.status(200).json({
        success: true,
        retryable: true,
        message:
          face.signal === "ERROR"
            ? "Face verification could not run. Check that the face service is running on port 5002, then try again."
            : "No face was detected in the live photo. Retake it facing the camera in good light.",
        data: {
          signal: face.signal,
          faceDetectedDocument: face.faceDetectedDocument,
          faceDetectedLive: face.faceDetectedLive
        }
      });
    }

    /*
      STEP 8
      Risk — every input is rebuilt from what phase 1 saved
    */

    const ocr = screening.ocrResult;
    const mrz = screening.mrzResult;
    const forensic = screening.forensicResult;

    const mrzPresent =
      Boolean(ocr?.mrzLine1 && ocr?.mrzLine2);

    const risk = calculateRisk({
      tamperingScore: forensic?.riskScore ?? null,
      faceSimilarity: face.similarityScore ?? null,
      faceSignal: face.signal ?? null,
      mrzValid: mrzPresent ? (mrz?.valid ?? null) : null,
      documentType: screening.documentType,
      ocrConfidence: ocr?.confidence ?? null
    });

    /*
      STEP 9
      Final decision
    */

    let recommendation = "CLEAR";

    if (risk.riskLevel === "HIGH") {
      recommendation = "MANUAL_REVIEW";
    } else if (
      risk.riskLevel === "MEDIUM" ||
      risk.riskLevel === "INSUFFICIENT_DATA"
    ) {
      recommendation = "SECONDARY_CHECK";
    }

    // Retention: the live photo is deleted only on a clean pass.
    const keepLivePhoto =
      Boolean(liveFile) &&
      !(face.signal === "MATCH" && recommendation === "CLEAR");

    const finalScreening =
      await prisma.$transaction(async (tx) => {
        await tx.faceVerification.create({
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
              face.lightingQuality,

            ...(keepLivePhoto
              ? {
                  liveStoredName: liveFile.filename,
                  livePath: liveFile.path,
                  liveMimeType: liveFile.mimetype,
                  liveSize: liveFile.size
                }
              : {})
          }
        });

        await tx.riskAssessment.create({
          data: {
            screeningId: screening.id,
            overallScore: risk.overallScore,
            riskLevel: risk.riskLevel,
            tamperingScore: forensic?.riskScore ?? null,
            faceScore: face.similarityScore ?? null,
            mrzScore: mrzPresent ? (mrz?.valid ? 100 : 0) : null,
            validityScore: ocr?.confidence ?? null,
            contributors: risk.contributors,
            explanation: risk.explanation
          }
        });

        return tx.screening.update({
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
      });

    committed = true;

    if (liveFile && !keepLivePhoto) {
      await removeFileQuietly(liveFile.path);
    }

    await createAudit({
      officerId: req.user.id,
      screeningId: screening.id,
      action: "SCREENING_COMPLETED",
      details: {
        riskScore:
          risk.overallScore,

        riskLevel:
          risk.riskLevel,

        recommendation,

        faceSignal:
          face.signal,

        liveCapture:
          !liveFile
            ? "SKIPPED"
            : keepLivePhoto
              ? "RETAINED"
              : "DISCARDED"
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(200).json({
      success: true,

      data: finalScreening
    });

  } catch (error) {
    console.error(
      "LIVE VERIFICATION ERROR:",
      error
    );

    if (liveFile && !committed) {
      await removeFileQuietly(liveFile.path);
    }

    res.status(500).json({
      success: false,
      message: "Live verification failed",
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
  completeLiveVerification,
  getScreenings,
  getScreening
};