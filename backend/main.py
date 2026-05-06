from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch
import csv
import os
from datetime import datetime

app = FastAPI(title="PurifAI Backend")

# Allow the Chrome extension to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "ProtectAI/deberta-v3-base-prompt-injection-v2"

print("Loading DeBERTa model... (first run downloads ~500MB of weights)")

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

print("Model loaded successfully! Ready to scan.")


class ScanRequest(BaseModel):
    text: str


@app.post("/api/scan")
async def scan_text(request: ScanRequest):
    try:
        result = classifier(request.text)
        # Returns e.g. [{'label': 'INJECTION', 'score': 0.9987}]
        prediction = result[0]
        is_safe = (prediction['label'] == 'SAFE')

        return {
            "text": request.text,
            "is_safe": is_safe,
            "label": prediction['label'],
            "confidence": prediction['score']
        }
    except Exception as e:
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

