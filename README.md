# Bharat Border Intelligence
### Assistant for Indian Border Migration

Smart India Hackathon 2026 · Problem Statement SIH26188

AI-Based Fake Identity & Document Screening System
Theme: Blockchain & Cyber Security · Team: NextWave

---

## What it does

Bharat Border Intelligence is an offline, document-type-aware ID verification
system for border checkpoints. It screens Aadhaar, Voter ID, Nepal's Nagrikta,
and Bhutan's CID — formats that don't share a common structure and mostly
lack a machine-readable zone — and gives the officer a risk level with the
reasons behind it, not just a pass/fail.

**Core idea:** a document is only scored on the checks it was designed to
support. A Nagrikta or CID isn't penalised for missing an MRZ, because it
was never meant to have one. Generic verifiers that assume one format tend
to false-flag exactly these documents.

## Status legend

Every feature below is tagged:
- ✅ **Prototype** — built and runnable today
- 🚧 **Planned** — designed, not yet implemented

## Features

| Feature | Status |
|---|---|
| Document upload + type selection | ✅ Prototype |
| OCR + field extraction (PaddleOCR PP-OCRv6) | ✅ Prototype |
| Document-type-aware field validation | ✅ Prototype |
| Photo tamper detection (ELA + EXIF) | ✅ Prototype |
| Live face capture vs. ID photo match (InsightFace) | ✅ Prototype |
| Type-aware weighted risk scoring | ✅ Prototype |
| Officer dashboard with explained decision | ✅ Prototype |
| QR signature verification (Aadhaar Secure QR, Bhutan 4th-gen CID) | 🚧 Planned |
| Hash-chained audit log | 🚧 Planned |
| Pixel-level tamper mask (FFDN) | 🚧 Planned |
| Liveness / anti-spoofing | 🚧 Planned |
| Authority database / watchlist check | 🚧 Planned |

**Design principle:** forensic signals escalate a case to an officer. They
are never the verdict.

## Tech stack

- **Frontend:** React
- **Backend:** Node.js + Express, JWT-based officer authentication
- **Database:** PostgreSQL + Prisma ORM
- **AI service** (`ai-services/`, port 5001): Python 3.11 + FastAPI, PaddleOCR PP-OCRv6, ELA/EXIF forensics
- **Face service** (`face-service/`, port 5002): Python + InsightFace, run as a separate service
- Fully offline — no external API calls at runtime

## Architecture
   Officer UI (React)
           │
Backend API (Node/Express + Prisma) ── PostgreSQL
           │
      ┌────┴────┐
AI service     Face service
:5001          :5002
(OCR, ELA,  (InsightFace match)
EXIF, risk               
engine)

## Team
NextWave — Smart India Hackathon 2026
