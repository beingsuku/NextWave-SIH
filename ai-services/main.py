import time
from fastapi import FastAPI, UploadFile, File, Form

# pyrefly: ignore [missing-import]
from ocr import run_ocr
# pyrefly: ignore [missing-import]
from forensics import run_forensics
import tempfile
import os

app = FastAPI(
    title="SIH AI Service"
)


@app.get("/")
def root():
    return {
        "service": "SIH AI",
        "status": "ONLINE"
    }


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    documentType: str | None = Form(None)
):
    filename = file.filename or ""
    _, suffix = os.path.splitext(filename)

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    ) as temp:

        temp.write(
            await file.read()
        )

        path = temp.name

    t = time.time()
    try:
        result = run_ocr(path, document_type_hint=documentType)
        print(f"[timing] /ocr took {time.time()-t:.1f}s", flush=True)
        return result
    finally:
        os.remove(path)


@app.post("/forensics")
async def forensics(
    file: UploadFile = File(...)
):
    filename = file.filename or ""
    _, suffix = os.path.splitext(filename)

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    ) as temp:

        temp.write(
            await file.read()
        )

        path = temp.name

    try:
        return run_forensics(path)

    finally:
        os.remove(path)

