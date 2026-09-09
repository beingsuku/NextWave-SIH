// Document types that are expected to carry an ICAO MRZ block.
// Voter ID (EPIC), Nepalese Nagrikta, and Bhutanese CID do NOT have an
// MRZ by design — that absence is not a red flag, it's just the document
// format. This distinction is the actual core value of this project.
const MRZ_EXPECTED_DOCUMENT_TYPES = new Set([
  "PASSPORT",
  "VISA"
]);

function calculateRisk({
  tamperingScore = null,   // 0-100, higher = more risk. null = not yet checked.
  faceSimilarity = null,   // 0-100, higher = better match. null = no live photo captured.
  mrzValid = null,         // true / false / null
  documentType = null,     // e.g. "PASSPORT", "NATIONAL_ID"
  ocrConfidence = null      // 0-1 (PaddleOCR's own confidence in the text it read)
}) {
  const signals = [];

  // ---- Tampering (forensics) ----
  if (tamperingScore !== null && tamperingScore !== undefined) {
    signals.push({
      category: "Tampering Signal",
      weight: 0.45,
      riskContribution: tamperingScore,
      available: true
    });
  } else {
    signals.push({
      category: "Tampering Signal",
      weight: 0.45,
      riskContribution: null,
      available: false,
      note: "Forensic tamper detection has not been implemented yet"
    });
  }

  // ---- Face verification ----
  if (faceSimilarity !== null && faceSimilarity !== undefined) {
    signals.push({
      category: "Face Verification",
      weight: 0.35,
      riskContribution: 100 - faceSimilarity, // invert: high similarity = LOW risk
      available: true
    });
  } else {
    signals.push({
      category: "Face Verification",
      weight: 0.35,
      riskContribution: null,
      available: false,
      note: "No live photo was captured for this screening"
    });
  }

  // ---- MRZ ----
  const mrzExpected = MRZ_EXPECTED_DOCUMENT_TYPES.has(
    (documentType || "").toUpperCase()
  );

  if (!mrzExpected) {
    signals.push({
      category: "MRZ Validation",
      weight: 0.15,
      riskContribution: null,
      available: false,
      note: `${documentType || "This document type"} does not use an MRZ block — not applicable`
    });
  } else if (mrzValid === null || mrzValid === undefined) {
    signals.push({
      category: "MRZ Validation",
      weight: 0.15,
      riskContribution: null,
      available: false,
      note: "MRZ could not be read"
    });
  } else {
    signals.push({
      category: "MRZ Validation",
      weight: 0.15,
      riskContribution: mrzValid ? 0 : 100, // invert: valid = LOW risk
      available: true
    });
  }

  // ---- OCR / document validity ----
  if (ocrConfidence !== null && ocrConfidence !== undefined) {
    const confidencePercent = ocrConfidence <= 1 ? ocrConfidence * 100 : ocrConfidence;
    signals.push({
      category: "Document Validity",
      weight: 0.05,
      riskContribution: 100 - confidencePercent, // invert: low confidence = slightly higher risk
      available: true
    });
  } else {
    signals.push({
      category: "Document Validity",
      weight: 0.05,
      riskContribution: null,
      available: false,
      note: "OCR did not return a confidence score"
    });
  }

  // ---- Weighted average over AVAILABLE signals only ----
  const availableSignals = signals.filter(s => s.available);
  const totalAvailableWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0);
  const confidenceCoverage = Math.round(totalAvailableWeight * 100);

  let overallScore = null;
  let riskLevel = "INSUFFICIENT_DATA";

  if (totalAvailableWeight > 0) {
    const weightedSum = availableSignals.reduce(
      (sum, s) => sum + s.riskContribution * s.weight,
      0
    );

    overallScore = Number((weightedSum / totalAvailableWeight).toFixed(2));

    if (overallScore >= 70) {
      riskLevel = "HIGH";
    } else if (overallScore >= 40) {
      riskLevel = "MEDIUM";
    } else {
      riskLevel = "LOW";
    }
  }

  const explanation = [];

  if (confidenceCoverage < 100) {
    explanation.push(
      `Only ${confidenceCoverage}% of the full risk model could be evaluated for this screening — remaining checks are not yet implemented or not applicable to this document type.`
    );
  }

  signals.forEach((s) => {
    if (!s.available) return;
    if (s.category === "Tampering Signal" && s.riskContribution >= 70) {
      explanation.push("Potential document anomaly detected");
    } else if (s.category === "Face Verification" && s.riskContribution >= 50) {
      explanation.push("Face verification confidence is low");
    } else if (s.category === "MRZ Validation" && s.riskContribution >= 70) {
      explanation.push("MRZ validation failed");
    }
  });

  if (explanation.length === 0) {
    explanation.push("No risk signals detected across evaluated checks");
  }

  return {
    overallScore,        // null if nothing could be evaluated at all
    riskLevel,            // "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA"
    confidenceCoverage,   // 0-100: how much of the full risk model actually ran

    contributors: signals.map((s) => ({
      category: s.category,
      weight: s.weight,
      percentage: s.available ? s.riskContribution : null,
      available: s.available,
      note: s.note || null
    })),

    explanation
  };
}

module.exports = {
  calculateRisk
};