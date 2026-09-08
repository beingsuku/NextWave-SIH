from fastapi import FastAPI, UploadFile, File

from ocr import run_ocr
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
    file: UploadFile = File(...)
):
    suffix = os.path.splitext(
        file.filename
    )[1]

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    ) as temp:

        temp.write(
            await file.read()
        )

        path = temp.name

    try:
        return run_ocr(path)

    finally:
        os.remove(path)


@app.post("/forensics")
async def forensics(
    file: UploadFile = File(...)
):
    suffix = os.path.splitext(
        file.filename
    )[1]

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