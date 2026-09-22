from fastapi import FastAPI, UploadFile, File
# pyrefly: ignore [missing-import]
from face import verify_face

import tempfile
import os

app = FastAPI(title="SIH Face Verification Service")


@app.get("/")
def root():
    return {"service": "SIH Face Verification", "status": "ONLINE"}


@app.post("/face-verify")
async def face_verify(
    document: UploadFile = File(...),
    liveCapture: UploadFile | None = File(None)
):
    doc_filename = document.filename or ""
    _, doc_suffix = os.path.splitext(doc_filename)

    with tempfile.NamedTemporaryFile(delete=False, suffix=doc_suffix) as doc_temp:
        doc_temp.write(await document.read())
        doc_path = doc_temp.name

    live_path = None
    if liveCapture is not None:
        live_filename = liveCapture.filename or ""
        _, live_suffix = os.path.splitext(live_filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=live_suffix) as live_temp:
            live_temp.write(await liveCapture.read())
            live_path = live_temp.name

    try:
        return verify_face(doc_path, live_path)
    finally:
        os.remove(doc_path)
        if live_path:
            os.remove(live_path)