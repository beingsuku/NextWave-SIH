async function runForensics(filePath) {
  /*
    Prototype implementation.

    Later connect this to OpenCV / ML models.
  */

  return {
    riskScore: 0,

    suspiciousRegions: 0,

    signals: [],

    engine: "prototype"
  };
}

module.exports = {
  runForensics
};