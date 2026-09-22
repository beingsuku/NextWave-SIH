import io
import numpy as np
from PIL import Image, ImageChops, ExifTags


SUSPICIOUS_SOFTWARE_KEYWORDS = [
    "photoshop", "gimp", "snapseed", "picsart", "lightroom",
    "affinity", "canva", "pixlr", "fotor"
]


def check_editing_software_metadata(image: Image.Image):
    """
    Checks EXIF metadata for the name of photo-editing software.
    This is a WEAK signal, not proof: many legitimate images have no
    EXIF at all (screenshots, WhatsApp compression, scans), and this
    only catches software that leaves a fingerprint.
    """
    try:
        exif_raw = image.getexif()
    except Exception:
        exif_raw = None

    if not exif_raw or len(exif_raw) == 0:
        return {"checked": True, "softwareFound": None, "flag": False,  "hasAnyExif": False}

    exif = {
        ExifTags.TAGS.get(tag_id, tag_id): value
        for tag_id, value in exif_raw.items()
    }

    software = str(exif.get("Software", "")).lower()
    flagged = any(keyword in software for keyword in SUSPICIOUS_SOFTWARE_KEYWORDS)

    return {
        "checked": True,
        "softwareFound": exif.get("Software"),
        "flag": flagged,
        "hasAnyExif": bool(exif_raw) and len(exif_raw) > 0
    }


def error_level_analysis(image: Image.Image, quality: int = 90):
    """
    Error Level Analysis: re-compresses the image at a known JPEG
    quality and diffs it against the original. Regions that were
    edited/pasted in tend to re-compress differently than genuinely
    untouched regions, showing up as brighter patches in the diff.
    """
    rgb_image = image.convert("RGB")

    buffer = io.BytesIO()
    rgb_image.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    recompressed = Image.open(buffer)

    diff = ImageChops.difference(rgb_image, recompressed)
    diff_array = np.array(diff).astype(np.float32)
    ela_map = diff_array.max(axis=2)

    mean_ela = float(ela_map.mean())
    max_ela = float(ela_map.max())
    std_ela = float(ela_map.std())

    grid_size = 8
    h, w = ela_map.shape
    cell_h = max(h // grid_size, 1)
    cell_w = max(w // grid_size, 1)

    threshold = mean_ela + (2 * std_ela)
    suspicious_regions = 0

    for row in range(0, h, cell_h):
        for col in range(0, w, cell_w):
            cell = ela_map[row:row + cell_h, col:col + cell_w]
            if cell.size > 0 and threshold > 0 and float(cell.mean()) > threshold:
                suspicious_regions += 1

    return {
        "meanELA": round(mean_ela, 3),
        "maxELA": round(max_ela, 3),
        "stdELA": round(std_ela, 3),
        "suspiciousRegions": suspicious_regions
    }


def run_forensics(file_path: str):
    try:
        image = Image.open(file_path)
    except Exception as e:
        return {
            "riskScore": None,
            "suspiciousRegions": None,
            "signals": [{"type": "ERROR", "detail": f"Could not open image: {str(e)}"}],
            "engine": "error"
        }

    ela_result = error_level_analysis(image)
    metadata_result = check_editing_software_metadata(image)

    signals = []
    risk_points = 0

    if ela_result["suspiciousRegions"] > 0:
        signals.append({
            "type": "ELA_ANOMALY",
            "detail": f"{ela_result['suspiciousRegions']} region(s) show compression inconsistency above this image's own baseline.",
            "meanELA": ela_result["meanELA"],
            "maxELA": ela_result["maxELA"]
        })
        risk_points += min(70, ela_result["suspiciousRegions"] * 15)
        baseline_risk = min(8, ela_result["meanELA"] / 5)
        risk_points += baseline_risk

    if metadata_result["flag"]:
        metadata_score = 20
        signals.append({
            "type": "EDITING_SOFTWARE_METADATA",
            "detail": f"Image metadata references editing software: {metadata_result['softwareFound']}"
        })
        risk_points += 30
    elif metadata_result["hasAnyExif"]:
        metadata_score = 92
    else:
        metadata_score = 70

    signals.append({
        "type": "METADATA_ASSESSMENT",
        "detail": (
            f"Editing software found in metadata: {metadata_result['softwareFound']}" if metadata_result["flag"]
            else "No suspicious software tag, and camera/scan metadata is present." if metadata_result["hasAnyExif"]
            else "Image has no EXIF metadata at all — authenticity can't be confirmed or ruled out from metadata alone."
        ),
        "score": metadata_score
    })

    return {
        "riskScore": round(min(100, risk_points), 2),
        "suspiciousRegions": ela_result["suspiciousRegions"],
        "signals": signals,
        "meanELA": ela_result["meanELA"],
        "maxELA": ela_result["maxELA"],
        "metadataChecked": metadata_result["checked"],
        "engine": "ela+metadata-v1"
    }