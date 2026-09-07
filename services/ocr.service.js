async function runOCR(filePath, documentType) {
  /*
    Replace this function later with:
    PaddleOCR / Tesseract / another approved OCR service.
  */

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

    engine: "prototype",
    documentType
  };
}

module.exports = {
  runOCR
};