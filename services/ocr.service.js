const fs = require("fs");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

async function runOCR(filePath, documentType) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "document.jpg");

    const response = await fetch(`${AI_SERVICE_URL}/ocr`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`AI service responded with status ${response.status}`);
    }

    const result = await response.json();

    return {
      confidence: result.confidence ?? 0,
      fullName: result.fullName ?? null,
      documentNumber: result.documentNumber ?? null,
      nationality: result.nationality ?? null,
      dateOfBirth: result.dateOfBirth ?? null,
      dateOfExpiry: result.dateOfExpiry ?? null,
      gender: result.gender ?? null,
      issuingAuthority: result.issuingAuthority ?? null,
      mrzLine1: result.mrzLine1 ?? null,
      mrzLine2: result.mrzLine2 ?? null,
      rawText: result.rawText ?? "",
      engine: result.engine ?? "paddleocr",
      documentType
    };

  } catch (error) {
    console.error("OCR service call failed:", error.message);

    // Fail gracefully so one dead AI service doesn't crash the whole screening
    return {
      confidence: 0,
      fullName: null,
      documentNumber: null,
      nationality: null,
      dateOfBirth: null,
      dateOfExpiry: null,
      gender: null,
      issuingAuthority: null,
      mrzLine1: null,
      mrzLine2: null,
      rawText: "",
      engine: "error",
      documentType
    };
  }
}

module.exports = {
  runOCR
};