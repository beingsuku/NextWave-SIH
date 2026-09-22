const fs = require("fs");
const path = require("path");

const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL ||
  "http://localhost:5002/face-verify";

const TIMEOUT_MS =
  Number(process.env.FACE_SERVICE_TIMEOUT_MS || 30000);

function unavailableResult(signal, detail) {
  return {
    similarityScore: null,
    imageQualityScore: null,
    faceDetectedDocument: false,
    faceDetectedLive: false,
    signal,
    landmarksMatched: null,
    poseAlignment: "Unknown",
    lightingQuality: "Unknown",
    engine: "face_recognition",
    detail
  };
}

async function verifyFace(documentPath, verificationPath) {
  // No live capture submitted: same honest result as before, no service call.
  if (!verificationPath) {
    return unavailableResult(
      "NOT_AVAILABLE",
      "No live capture was submitted."
    );
  }

  try {
    const form = new FormData();

    // The filename (with extension) matters: the Python side uses it
    // to pick the temp file suffix.
    form.append(
      "document",
      new Blob([await fs.promises.readFile(documentPath)]),
      path.basename(documentPath)
    );

    form.append(
      "liveCapture",
      new Blob([await fs.promises.readFile(verificationPath)]),
      path.basename(verificationPath)
    );

    const response = await fetch(FACE_SERVICE_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "FACE SERVICE ERROR:",
        response.status,
        body
      );
      return unavailableResult(
        "ERROR",
        `Face service returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    return {
      ...result,
      engine: "face_recognition"
    };
  } catch (error) {
    console.error("FACE SERVICE UNREACHABLE:", error.message);
    return unavailableResult(
      "ERROR",
      "Face service could not be reached."
    );
  }
}

module.exports = {
  verifyFace
};