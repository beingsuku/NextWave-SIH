import numpy as np
from PIL import Image
import face_recognition


def _load_rgb_image(path: str):
    with Image.open(path) as img:
        rgb = img.convert("RGB")
        arr = np.array(rgb, dtype=np.uint8)
    return np.ascontiguousarray(arr)


def _distance_to_similarity(distance: float) -> float:
    similarity = (1.0 - distance) * 100
    return max(0.0, min(100.0, similarity))


def verify_face(document_path: str, verification_path: str | None):
    if not verification_path:
        return {
            "similarityScore": None,
            "imageQualityScore": None,
            "faceDetectedDocument": False,
            "faceDetectedLive": False,
            "signal": "NOT_AVAILABLE",
            "landmarksMatched": None,
            "poseAlignment": "Unknown",
            "lightingQuality": "Unknown"
        }

    try:
        doc_image = _load_rgb_image(document_path)
        live_image = _load_rgb_image(verification_path)
    except Exception as e:
        return {
            "similarityScore": None,
            "imageQualityScore": None,
            "faceDetectedDocument": False,
            "faceDetectedLive": False,
            "signal": "ERROR",
            "landmarksMatched": None,
            "poseAlignment": "Unknown",
            "lightingQuality": "Unknown",
            "error": f"Could not read image: {str(e)}"
        }

    doc_encodings = face_recognition.face_encodings(doc_image)
    live_encodings = face_recognition.face_encodings(live_image)

    face_detected_document = len(doc_encodings) > 0
    face_detected_live = len(live_encodings) > 0

    if not face_detected_document or not face_detected_live:
        missing = []
        if not face_detected_document:
            missing.append("document photo")
        if not face_detected_live:
            missing.append("live capture")

        return {
            "similarityScore": None,
            "imageQualityScore": None,
            "faceDetectedDocument": face_detected_document,
            "faceDetectedLive": face_detected_live,
            "signal": "NO_FACE_DETECTED",
            "landmarksMatched": None,
            "poseAlignment": "Unknown",
            "lightingQuality": "Unknown",
            "detail": f"No face could be detected in: {', '.join(missing)}."
        }

    doc_encoding = doc_encodings[0]
    live_encoding = live_encodings[0]

    face_distance = face_recognition.face_distance([doc_encoding], live_encoding)[0]
    similarity_score = round(_distance_to_similarity(float(face_distance)), 2)

    is_match = float(face_distance) <= 0.6

    return {
        "similarityScore": similarity_score,
        "imageQualityScore": None,
        "faceDetectedDocument": True,
        "faceDetectedLive": True,
        "signal": "MATCH" if is_match else "MISMATCH",
        "landmarksMatched": None,
        "poseAlignment": "Unknown",
        "lightingQuality": "Unknown",
        "rawDistance": round(float(face_distance), 4)
    }