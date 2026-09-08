"""
check_real_models.py
=====================
Run this from inside your "document scanning" project folder:

    python check_real_models.py

It tells you, honestly, which heavy ML dependencies actually import
and work on this machine -- no silent fallbacks, no guessing.
"""
import sys
import warnings
import os

warnings.filterwarnings("ignore")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

print("Python:", sys.version)
print("Executable:", sys.executable)
print("-" * 60)

def check(name, test_fn):
    try:
        test_fn()
        print(f"[OK]      {name}")
    except Exception as e:
        print(f"[MISSING] {name} -> {type(e).__name__}: {e}")

def check_torch():
    import torch
    print(f"          torch version: {torch.__version__}")

def check_onnx():
    import onnxruntime
    print(f"          onnxruntime version: {onnxruntime.__version__}")

def check_paddle():
    import paddle
    print(f"          paddle version: {paddle.__version__}")

def check_paddleocr():
    from paddleocr import PaddleOCR
    print("          PaddleOCR class importable")

def check_insightface():
    from insightface.app import FaceAnalysis
    print("          InsightFace importable")
    app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("          InsightFace model loaded successfully (this is the real test)")

def check_transformers():
    import transformers
    print(f"          transformers version: {transformers.__version__}")

def check_cv2():
    import cv2
    print(f"          opencv version: {cv2.__version__}")

check("opencv-python-headless", check_cv2)
check("torch", check_torch)
check("onnxruntime", check_onnx)
check("transformers", check_transformers)
check("paddlepaddle", check_paddle)
check("paddleocr", check_paddleocr)
check("insightface (real model load)", check_insightface)

print("-" * 60)
print("If insightface or paddleocr show [MISSING] above, that is exactly")
print("why your pipeline output was all 'fallback' -- fix those two first,")
print("they matter the most for face matching and text extraction.")