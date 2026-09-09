import re
from paddleocr import PaddleOCR

_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            lang="en",
            enable_mkldnn=False
        )
    return _ocr_engine


def extract_fields(raw_text: str):
    fields = {}

    # Document number: 3 letters + 7 digits (Indian EPIC/Voter ID format)
    match = re.search(r"\b[A-Z]{3}\d{7}\b", raw_text)
    if match:
        fields["documentNumber"] = match.group()

    # Full name (English line only, ignores Devanagari line above it)
    match = re.search(r"Name:\s*([A-Za-z][A-Za-z .]*)", raw_text)
    if match:
        fields["fullName"] = match.group(1).strip()

    # Father's name
    match = re.search(r"Father'?s Name:\s*([A-Za-z][A-Za-z .]*)", raw_text)
    if match:
        fields["fatherName"] = match.group(1).strip()

    # Gender
    if re.search(r"\bMale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Male"
    elif re.search(r"\bFemale\b", raw_text, re.IGNORECASE):
        fields["gender"] = "Female"

    # Date of birth: dd-mm-yyyy
    match = re.search(r"\b(\d{2}-\d{2}-\d{4})\b", raw_text)
    if match:
        fields["dateOfBirth"] = match.group(1)

    # Issuing authority + nationality (detected from known document headers)
    if re.search(r"ELECTION COMMISSION OF INDIA", raw_text, re.IGNORECASE):
        fields["issuingAuthority"] = "Election Commission of India"
        fields["nationality"] = "India"
        fields["documentType"] = "VOTER_ID"

    return fields


def run_ocr(file_path: str):
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

    output.update(extract_fields(raw_text))

    return output