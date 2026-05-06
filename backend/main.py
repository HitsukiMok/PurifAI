<<<<<<< HEAD
"""
AgentShield Backend — Main Application Entry Point
Initializes FastAPI, registers routers, and configures middleware.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import chat, user
from core.config import settings


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before the server accepts requests."""
    print(f"🛡  AgentShield API starting — env: {settings.ENVIRONMENT}")
    yield
    print("AgentShield API shutting down.")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AgentShield API",
    description="AI agent security monitoring — indirect prompt injection detection.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
=======
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch
import csv
import os
from datetime import datetime

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("purifai-backend")

app = FastAPI(title="PurifAI Backend")

# Allow the Chrome extension to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
>>>>>>> 7f3827170d79bfe81bc096700b5471b426f9cc1e
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(chat.router, prefix="/api/chat", tags=["Chat / AI"])
app.include_router(user.router, prefix="/api/user", tags=["User"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}
=======
MODEL_ID = "ProtectAI/deberta-v3-base-prompt-injection-v2"

# Lazy-loaded model
classifier = None

def get_classifier():
    global classifier
    if classifier is None:
        logger.info(f"Loading DeBERTa model '{MODEL_ID}' into memory... This may take a minute!")
        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            classifier = pipeline(
                "text-classification",
                model=model,
                tokenizer=tokenizer,
                truncation=True,
                max_length=512,
                device=torch.device("cuda" if torch.cuda.is_available() else "cpu"),
            )
            logger.info("✅ Model loaded successfully!")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise e
    return classifier

class ScanRequest(BaseModel):
    text: str

@app.post("/api/scan")
async def scan_text(request: ScanRequest):
    logger.info(f"Received scan request. Length: {len(request.text)} chars")
    try:
        model_pipeline = get_classifier()
        result = model_pipeline(request.text)
        prediction = result[0]
        is_safe = (prediction['label'] == 'SAFE')
        
        logger.info(f"Scan complete. Result: {prediction['label']} ({prediction['score']:.4f})")

        return {
            "text": request.text,
            "is_safe": is_safe,
            "label": prediction['label'],
            "confidence": prediction['score']
        }
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        return {"error": "Inference failed", "exception": str(e)}


@app.get("/")
def read_root():
    return {"status": "PurifAI Backend is running"}


# ──────────────────────────────────────────────────────────────
#  PHASE 2: Data Flywheel — CSV Logger for Edge Cases
# ──────────────────────────────────────────────────────────────

CSV_FILE = "edge_cases.csv"

# Create the CSV file with headers if it doesn't exist yet
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "text", "model_label", "model_confidence", "user_corrected_label"])


class FeedbackRequest(BaseModel):
    text: str                    # The original text that was scanned
    model_label: str             # What the AI predicted (SAFE or INJECTION)
    model_confidence: float      # How confident the AI was (0.0 - 1.0)
    user_corrected_label: str    # What the user says it SHOULD be (SAFE or INJECTION)


@app.post("/api/feedback")
async def log_feedback(feedback: FeedbackRequest):
    """
    Called when a user clicks "Report Mistake" in the Chrome extension.
    Appends the edge case to edge_cases.csv for future fine-tuning.
    """
    try:
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().isoformat(),
                feedback.text,
                feedback.model_label,
                feedback.model_confidence,
                feedback.user_corrected_label,
            ])

        return {
            "status": "feedback_logged",
            "message": "Thank you! This helps improve the model."
        }
    except Exception as e:
        return {"error": "Failed to log feedback", "exception": str(e)}


@app.get("/api/feedback/stats")
async def feedback_stats():
    """Quick stats endpoint to see how many edge cases have been collected."""
    if not os.path.exists(CSV_FILE):
        return {"total_reports": 0}

    with open(CSV_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        count = sum(1 for _ in reader)

    return {"total_reports": count, "csv_file": CSV_FILE}

>>>>>>> 7f3827170d79bfe81bc096700b5471b426f9cc1e
