def verify_face(
    document_path: str,
    verification_path: str | None
):
    """
    Prototype face verification interface.

    Connect your approved face model here.
    """

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