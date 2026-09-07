function calculateRisk({
  tamperingScore = 0,
  faceScore = 0,
  mrzScore = 0,
  validityScore = 0
}) {
  const score =
    tamperingScore * 0.45 +
    faceScore * 0.35 +
    mrzScore * 0.15 +
    validityScore * 0.05;

  let riskLevel;

  if (score >= 70) {
    riskLevel = "HIGH";
  } else if (score >= 40) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  const explanation = [];

  if (tamperingScore >= 70) {
    explanation.push(
      "Potential document anomaly detected"
    );
  }

  if (faceScore < 50) {
    explanation.push(
      "Face verification confidence is low"
    );
  }

  if (mrzScore < 70) {
    explanation.push(
      "MRZ validation requires review"
    );
  }

  if (explanation.length === 0) {
    explanation.push(
      "No major prototype risk signals detected"
    );
  }

  return {
    overallScore: Number(score.toFixed(2)),
    riskLevel,

    contributors: [
      {
        category: "Tampering Signal",
        percentage: tamperingScore,
        weight: 0.45
      },
      {
        category: "Face Verification",
        percentage: faceScore,
        weight: 0.35
      },
      {
        category: "MRZ Validation",
        percentage: mrzScore,
        weight: 0.15
      },
      {
        category: "Document Validity",
        percentage: validityScore,
        weight: 0.05
      }
    ],

    explanation
  };
}

module.exports = {
  calculateRisk
};