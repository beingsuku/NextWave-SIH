import cv2
import numpy as np
from insightface.app import FaceAnalysis

# Load InsightFace model
app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"]
)

app.prepare(ctx_id=0, det_size=(640, 640))

def check_blur(image):

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Calculate image sharpness
    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()

    return sharpness


def get_face_embedding(image_path):

    image = cv2.imread(image_path)

    if image is None:
        print("Could not read:", image_path)
        return None

sharpness = check_blur(image)

print(image_path, "-> Sharpness:", round(sharpness, 2))
faces = app.get(image)
print(image_path, "-> Faces detected:", len(faces))

if len(faces) == 0:
    print("No face detected.")
    return None
    if len(faces) > 1:
        print("Multiple faces detected.")
        return None

    return faces[0].embedding


# Get embeddings
document_embedding = get_face_embedding("document.jpg")
person_embedding = get_face_embedding("person.jpg")


# Face verification
if document_embedding is not None and person_embedding is not None:

    similarity = np.dot(
        document_embedding,
        person_embedding
    ) / (
        np.linalg.norm(document_embedding)
        * np.linalg.norm(person_embedding)
    )

    # Prototype thresholds
    match_threshold = 0.25
    mismatch_threshold = 0.10

    if similarity >= match_threshold:
        result = "MATCH"

    elif similarity < mismatch_threshold:
        result = "MISMATCH"

    else:
        result = "INCONCLUSIVE"

    print("--------------------------------")
    print("FACE VERIFICATION")
    print("--------------------------------")
    print(f"Similarity score: {similarity:.4f}")
    print(f"Match threshold: {match_threshold}")
    print(f"Mismatch threshold: {mismatch_threshold}")
    print("Result:", result)

else:

    print("--------------------------------")
    print("FACE VERIFICATION")
    print("--------------------------------")
    print("Result: INCONCLUSIVE")