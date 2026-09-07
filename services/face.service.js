async function verifyFace(
  documentPath,
  verificationPath
) {
  /*
    Prototype implementation.

    Later connect:
    InsightFace / ArcFace / approved face model.
  */

  return {
    similarityScore: null,

    imageQualityScore: null,

    faceDetectedDocument: false,

    faceDetectedLive: false,

    signal: "NOT_AVAILABLE",

    landmarksMatched: null,

    poseAlignment: "Unknown",

    lightingQuality: "Unknown",

    engine: "prototype"
  };
}

module.exports = {
  verifyFace
};