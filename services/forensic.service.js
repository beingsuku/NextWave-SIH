const fs = require("fs");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

async function runForensics(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "document.jpg");

    const response = await fetch(`${AI_SERVICE_URL}/forensics`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`AI service responded with status ${response.status}`);
    }

    const result = await response.json();

    return {
      riskScore: result.riskScore ?? null,
      suspiciousRegions: result.suspiciousRegions ?? null,
      signals: result.signals ?? null,
      meanELA: result.meanELA ?? null,
      maxELA: result.maxELA ?? null,
      metadataChecked: result.metadataChecked ?? false,
      engine: result.engine ?? "ela+metadata-v1"
    };

  } catch (error) {
    console.error("Forensics service call failed:", error.message);

    return {
      riskScore: null,
      suspiciousRegions: null,
      signals: null,
      meanELA: null,
      maxELA: null,
      metadataChecked: false,
      engine: "error"
    };
  }
}

module.exports = {
  runForensics
};