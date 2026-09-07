import cv2
from insightface.app import FaceAnalysis

# Create face analysis model
app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"]
)

app.prepare(ctx_id=0, det_size=(640, 640))

# Read image
image = cv2.imread("person.jpg")

# Detect faces
faces = app.get(image)

print("Number of faces detected:", len(faces))
print("Embedding length:", len(faces[0].embedding))

# Draw boxes
for face in faces:
    x1, y1, x2, y2 = face.bbox.astype(int)

    cv2.rectangle(
        image,
        (x1, y1),
        (x2, y2),
        (0, 255, 0),
        2
    )

cv2.imshow("Face Detection", image)

cv2.waitKey(0)
cv2.destroyAllWindows()