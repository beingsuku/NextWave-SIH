const fs = require("fs");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

async function runOCR(filePath, documentType) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "document.jpg");

    // BUGFIX: documentType was accepted as a param but never sent to the
    // Flask service, forcing Python to guess the type via keyword search
    // after OCR ran. Sending it explicitly lets the extractor dispatch
    // directly and removes an entire class of misclassification failures
    // once more than one document type is supported.
    if (documentType) {
      formData.append("documentType", documentType);
    }

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
      documentNumberChecksumValid: result.documentNumberChecksumValid ?? null,
      nationality: result.nationality ?? null,
      dateOfBirth: result.dateOfBirth ?? null,
      dateOfExpiry: result.dateOfExpiry ?? null,
      gender: result.gender ?? null,
      issuingAuthority: result.issuingAuthority ?? null,
      mrzLine1: result.mrzLine1 ?? null,
      mrzLine2: result.mrzLine2 ?? null,
      rawText: result.rawText ?? "",
      engine: result.engine ?? "paddleocr",
      // Trust what the pipeline actually detected/extracted over the
      // caller's original guess — if Python's dispatcher marked it
      // UNKNOWN, don't silently relabel it back to the requested type.
      documentType: result.documentType ?? documentType,
      extractionStatus: result.extractionStatus ?? "ok"
    };

  } catch (error) {
    console.error("OCR service call failed:", error.message);

    // Fail gracefully so one dead AI service doesn't crash the whole screening
    return {
      confidence: 0,
      fullName: null,
      documentNumber: null,
      documentNumberChecksumValid: null,
      nationality: null,
      dateOfBirth: null,
      dateOfExpiry: null,
      gender: null,
      issuingAuthority: null,
      mrzLine1: null,
      mrzLine2: null,
      rawText: "",
      engine: "error",
      documentType,
      extractionStatus: "service_error"
    };
  }
}

module.exports = {
  runOCR
};