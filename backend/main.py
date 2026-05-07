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
    allow_methods=["*"],
    allow_headers=["*"],
)

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

        scan_result = {
            "text": request.text,
            "is_safe": is_safe,
            "label": prediction['label'],
            "confidence": prediction['score']
        }

        # Log to in-memory scan history for dashboard
        import time
        scan_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "time": datetime.now().strftime("%H:%M:%S"),
            "text": request.text[:200],
            "label": prediction['label'],
            "confidence": prediction['score'],
            "is_safe": is_safe,
            "source": "extension-scan",
        }
        scan_log.appendleft(scan_entry)
        scan_metrics["scanned"] += 1
        if not is_safe:
            scan_metrics["blocked"] += 1
        logger.info(f"Scan logged. Total scanned: {scan_metrics['scanned']}, blocked: {scan_metrics['blocked']}")

        return scan_result
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        return {"error": "Inference failed", "exception": str(e)}


# ──────────────────────────────────────────────────────────────
#  In-memory scan log for dashboard
# ──────────────────────────────────────────────────────────────
from collections import deque
import uuid

scan_log = deque(maxlen=100)  # keep last 100 scans
scan_metrics = {"scanned": 0, "blocked": 0}

@app.get("/")
def read_root():
    return {"status": "PurifAI Backend is running"}

@app.get("/api/traffic")
async def traffic_scans(since: float = 0):
    """Return scans newer than `since` (unix timestamp in seconds).
    The dashboard polls this every few seconds.
    Uses >= comparison to ensure boundary scans are not missed;
    the frontend deduplicates by scan ID."""
    results = [s for s in scan_log if s["timestamp"] >= since]
    return {
        "scans": list(results),
        "metrics": scan_metrics,
    }

@app.get("/api/metrics")
async def get_metrics():
    return scan_metrics


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
