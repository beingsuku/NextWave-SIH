def calculate_risk(
    tampering_score: float,
    face_score: float,
    mrz_score: float,
    validity_score: float
):
    score = (
        tampering_score * 0.45 +
        face_score * 0.35 +
        mrz_score * 0.15 +
        validity_score * 0.05
    )

    if score >= 70:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "overallScore": round(score, 2),
        "riskLevel": level
    }