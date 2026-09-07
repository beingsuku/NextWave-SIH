import cv2

image = cv2.imread("person.jpg")

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

faces = face_cascade.detectMultiScale(
    gray,
    scaleFactor=1.1,
    minNeighbors=5
)

print("Number of faces detected:", len(faces))

for i, (x, y, w, h) in enumerate(faces):

    face = image[y:y+h, x:x+w]

    filename = f"face_{i+1}.jpg"

    cv2.imwrite(filename, face)

    print("Saved:", filename)

    cv2.imshow("Detected Face", face)

cv2.waitKey(0)
cv2.destroyAllWindows()