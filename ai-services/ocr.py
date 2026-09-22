import re
from paddleocr import PaddleOCR

_ocr_engine = None


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(
            text_detection_model_name="PP-OCRv6_small_det",
            text_recognition_model_name="PP-OCRv6_small_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            lang="en",
            enable_mkldnn=False
        )
    return _ocr_engine


# ---------------------------------------------------------------------------
# Verhoeff checksum — used by Aadhaar numbers. This is a real, deterministic
# validation signal: if the checksum fails, the number is either an OCR
# misread OR a fabricated/tampered number. Either way it's worth surfacing
# to the risk engine as a distinct field ("documentNumberChecksumValid").
# ---------------------------------------------------------------------------
_VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5], [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7], [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3], [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
]
_VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4], [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7], [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
]


def verhoeff_is_valid(number_str: str) -> bool:
    """Validates a numeric string (e.g. Aadhaar's 12 digits) against the
    Verhoeff checksum algorithm. Returns False for anything non-numeric."""
    digits = number_str.replace(" ", "")
    if not digits.isdigit():
        return False
    c = 0
    for i, item in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(item)]]
    return c == 0


# ---------------------------------------------------------------------------
# Per-document-type extractors. Each takes raw OCR text and returns a dict
# of fields. Keeping these separate (instead of one giant sequential regex
# block) is what makes adding a 3rd/4th document type later a 20-line diff
# instead of a rewrite.
# ---------------------------------------------------------------------------

def _extract_voter_id(raw_text: str) -> dict:
    fields = {}

    match = re.search(r"\b[A-Z]{3}\d{7}\b", raw_text)
    if match:
        fields["documentNumber"] = match.group()

    match = re.search(r"Name:\s*([A-Za-z][A-Za-z .]*)", raw_text)
    if match:
        fields["fullName"] = match.group(1).strip()

    match = re.search(r"Father'?s Name:\s*([A-Za-z][A-Za-z .]*)", raw_text)
    if match:
        fields["fatherName"] = match.group(1).strip()

    if re.search(r"\bMale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Male"
    elif re.search(r"\bFemale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Female"

    match = re.search(r"\b(\d{2}-\d{2}-\d{4})\b", raw_text)
    if match:
        fields["dateOfBirth"] = match.group(1)

    fields["issuingAuthority"] = "Election Commission of India"
    fields["nationality"] = "India"
    fields["documentType"] = "VOTER_ID"

    return fields


def _extract_aadhaar(raw_text: str) -> dict:
    fields = {}

    # Aadhaar number: printed as "XXXX XXXX XXXX" (spaces are the norm on
    # the physical card). We capture with optional spaces, then normalize.
    match = re.search(r"\b(\d{4}\s?\d{4}\s?\d{4})\b", raw_text)
    if match:
        raw_number = match.group(1)
        normalized = raw_number.replace(" ", "")
        fields["documentNumber"] = normalized
        fields["documentNumberChecksumValid"] = verhoeff_is_valid(normalized)

    match = re.search(r"([A-Za-z][A-Za-z .]{2,})\n.{0,30}(DOB|Year of Birth)", raw_text)
    if match:
        fields["fullName"] = match.group(1).strip()

    if re.search(r"\bMale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Male"
    elif re.search(r"\bFemale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Female"

    # Aadhaar prints DOB as DD/MM/YYYY (note: slashes, not hyphens — this is
    # also a useful disambiguator from Voter ID's dd-mm-yyyy format).
    match = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", raw_text)
    if match:
        fields["dateOfBirth"] = match.group(1)
    else:
        match = re.search(r"Year of Birth:?\s*(\d{4})", raw_text, re.IGNORECASE)
        if match:
            fields["yearOfBirth"] = match.group(1)

    fields["issuingAuthority"] = "Unique Identification Authority of India"
    fields["nationality"] = "India"
    # Output label matches the Node/Prisma DocumentType enum value
    # ("NATIONAL_ID"), not the internal dispatch key ("AADHAAR") used
    # above — keeps the OCR response consistent with what the rest of
    # the pipeline (risk engine contributor notes, etc.) already expects.
    fields["documentType"] = "NATIONAL_ID"

    return fields


# The rest of the system (Node/Prisma DocumentType enum) uses "NATIONAL_ID"
# as the canonical label for Aadhaar. Map known aliases to the internal
# extractor key here, in one place, instead of scattering string checks.
_HINT_ALIASES = {
    "NATIONAL_ID": "AADHAAR",
    "AADHAAR": "AADHAAR",
    "VOTER_ID": "VOTER_ID",
}


def _detect_document_type(raw_text: str, hint: str | None = None) -> str:
    """hint = documentType passed explicitly from the Node backend.
    IMPORTANT: an unrecognized hint is NOT trusted blindly — it falls
    through to keyword detection instead of failing outright. A caller
    sending a hint we don't know about is not evidence the document is
    actually unsupported; the raw text might still tell us what it is."""
    if hint:
        resolved = _HINT_ALIASES.get(hint.upper())
        if resolved:
            return resolved
        # unrecognized hint — don't trust it, fall through to keyword detection

    if re.search(r"ELECTION COMMISSION OF INDIA", raw_text, re.IGNORECASE):
        return "VOTER_ID"
    if re.search(r"UNIQUE IDENTIFICATION AUTHORITY", raw_text, re.IGNORECASE) or \
       re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text):
        return "AADHAAR"
    return "UNKNOWN"


_EXTRACTORS = {
    "VOTER_ID": _extract_voter_id,
    "AADHAAR": _extract_aadhaar,
}


def extract_fields(raw_text: str, document_type_hint: str | None = None) -> dict:
    doc_type = _detect_document_type(raw_text, document_type_hint)
    extractor = _EXTRACTORS.get(doc_type)

    if extractor is None:
        # Unknown document type: don't silently return {} — that produces a
        # false "ok" screening result downstream. Surface it explicitly.
        return {"documentType": "UNKNOWN", "extractionStatus": "unsupported_document_type"}

    return extractor(raw_text)


def run_ocr(file_path: str, document_type_hint: str | None = None):
    engine = get_ocr_engine()
    result = engine.predict(file_path)

    all_texts = []
    all_scores = []

    for res in result:
        all_texts.extend(res.get("rec_texts", []))
        all_scores.extend(res.get("rec_scores", []))

    raw_text = "\n".join(all_texts)
    avg_confidence = (sum(all_scores) / len(all_scores)) if all_scores else 0

    output = {
        "confidence": round(float(avg_confidence), 4),
        "rawText": raw_text,
        "engine": "paddleocr",
    }

    output.update(extract_fields(raw_text, document_type_hint))

    return output