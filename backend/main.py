from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch
import csv
import os
import re
import io
import hashlib
import functools
from pypdf import PdfReader
from datetime import datetime
import time

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

MARKETING_REGEX = re.compile(
    r"(unsubscribe|view in browser|manage preferences|opt-out|newsletter|privacy policy|click here to unsubscribe)", 
    re.IGNORECASE
)

HIGH_DANGER_REGEX = re.compile(
    r"(ignore all previous instructions|system override|jailbreak|you are now)",
    re.IGNORECASE
)

@functools.lru_cache(maxsize=500)
def cached_inference(text_hash: str, cleaned_text: str):
    """
    We pass text_hash to ensure LRU cache key uniqueness based on the hash,
    while using the cleaned_text for actual inference.
    """
    model_pipeline = get_classifier()
    result = model_pipeline(cleaned_text)
    return result[0]

class ScanRequest(BaseModel):
    text: str

CLIENT_RATE_LIMITS = {}
FILE_RATE_LIMITS = {}

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_PDF_PAGES = 5

def chunk_text(text, chunk_size=400, overlap=50):
    """Split text into overlapping blocks of ~chunk_size words.
    Overlap prevents missing injections that span chunk boundaries."""
    words = text.split()
    if len(words) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = ' '.join(words[start:end])
        chunks.append(chunk)
        start = end - overlap
    return chunks

@app.post("/api/scan")
async def scan_text(request: ScanRequest, http_request: Request):
    # Rate Limiting: Max 1 scan per 2 seconds per IP
    client_ip = http_request.client.host
    now = time.time()
    last_scan = CLIENT_RATE_LIMITS.get(client_ip, 0)
    
    if now - last_scan < 2:
        logger.warning(f"Rate limit exceeded for IP {client_ip}")
        raise HTTPException(status_code=429, detail="Too Many Requests", headers={"Retry-After": "2"})
        
    CLIENT_RATE_LIMITS[client_ip] = now

    logger.info(f"Received scan request. Length: {len(request.text)} chars")
    try:
        # 1. HTML Stripping for cleaner inference
        cleaned_text = re.sub(r'<[^>]+>', ' ', request.text).strip()
        
        # 1b. Fuzzy Deduplication: Strip volatile timestamps and headers
        fuzzy_text = re.sub(r'On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun).*?wrote:', '', cleaned_text, flags=re.IGNORECASE)
        fuzzy_text = re.sub(r'\d{1,2}:\d{2}\s*(?:AM|PM)?', '', fuzzy_text, flags=re.IGNORECASE)
        fuzzy_text = re.sub(r'\d{4}-\d{2}-\d{2}', '', fuzzy_text)
        fuzzy_text = fuzzy_text.strip()
        
        # 2. Caching via SHA-256
        text_hash = hashlib.sha256(fuzzy_text.encode('utf-8')).hexdigest()
        
        # 3. Model Inference (cached)
        prediction = cached_inference(text_hash, cleaned_text)
        label = prediction['label']
        confidence = prediction['score']
        is_safe = (label == 'SAFE')
        
        heuristic_applied = "None"
        
        # 4. False Positive Mitigations (Downgrade Logic) & High-Danger Veto
        if not is_safe:
            has_high_danger = HIGH_DANGER_REGEX.search(cleaned_text) is not None
            
            if has_high_danger:
                heuristic_applied = "Veto (High Danger)"
            else:
                word_count = len(cleaned_text.split())
                has_marketing = MARKETING_REGEX.search(cleaned_text) is not None
                
                if word_count < 50 or has_marketing:
                    heuristic_applied = "Downgraded (Marketing/Short)"
                    is_safe = True
                    label = 'SAFE (Marketing)'

        logger.info(f"[DEBUG] Raw Text Sent to Model: {cleaned_text[:200]}...")
        logger.info(f"[DEBUG] Model Score: {confidence:.4f}")
        logger.info(f"[DEBUG] Heuristic Applied: {heuristic_applied}")
        logger.info(f"Scan complete. Result: {label} ({confidence:.4f})")

        scan_result = {
            "text": request.text,  # Return original text to extension
            "is_safe": is_safe,
            "label": label,
            "confidence": confidence
        }

        # Log to in-memory scan history for dashboard
        scan_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "time": datetime.now().strftime("%H:%M:%S"),
            "text": request.text[:200],
            "label": label,
            "confidence": confidence,
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


@app.post("/api/scan-file")
async def scan_file(http_request: Request, file: UploadFile = File(...)):
    """Scan an uploaded PDF or TXT file for prompt injections.
    Files are processed strictly in memory — never saved to disk."""
    # Separate rate limiter: 1 request per 10 seconds per IP
    client_ip = http_request.client.host
    now = time.time()
    last_file_scan = FILE_RATE_LIMITS.get(client_ip, 0)
    if now - last_file_scan < 10:
        logger.warning(f"File scan rate limit exceeded for IP {client_ip}")
        raise HTTPException(status_code=429, detail="Too Many Requests", headers={"Retry-After": "10"})
    FILE_RATE_LIMITS[client_ip] = now

    # Validate file type
    filename = file.filename or ""
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ""
    if ext not in ('pdf', 'txt'):
        raise HTTPException(status_code=400, detail="Unsupported file type. Only .pdf and .txt are allowed.")

    # Read file into memory
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB.")

    # Extract text
    raw_text = ""
    partial_scan = False
    try:
        if ext == 'pdf':
            reader = PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)
            pages_to_scan = min(total_pages, MAX_PDF_PAGES)
            partial_scan = total_pages > MAX_PDF_PAGES
            for i in range(pages_to_scan):
                page_text = reader.pages[i].extract_text() or ""
                raw_text += page_text + "\n"
        elif ext == 'txt':
            raw_text = file_bytes.decode('utf-8', errors='replace')
    except Exception as e:
        logger.error(f"File parsing failed: {e}")
        raise HTTPException(status_code=422, detail=f"Could not parse file: {str(e)}")
    finally:
        await file.close()

    cleaned_text = re.sub(r'<[^>]+>', ' ', raw_text).strip()
    if len(cleaned_text) < 12:
        return {
            "filename": filename,
            "is_safe": True,
            "label": "SAFE",
            "confidence": 1.0,
            "total_chunks": 0,
            "flagged_chunk": None,
            "malicious_text": None,
            "partial_scan": partial_scan,
            "note": "File contained no meaningful text to scan."
        }

    # Chunk and scan
    chunks = chunk_text(cleaned_text)
    logger.info(f"Scanning file '{filename}': {len(chunks)} chunks from {ext.upper()}")

    worst_chunk_idx = None
    worst_confidence = 0.0
    worst_text = ""
    file_is_safe = True

    for idx, chunk in enumerate(chunks):
        text_hash = hashlib.sha256(chunk.encode('utf-8')).hexdigest()
        prediction = cached_inference(text_hash, chunk)
        label = prediction['label']
        confidence = prediction['score']

        chunk_safe = (label == 'SAFE')

        # Apply heuristics per chunk
        if not chunk_safe:
            has_high_danger = HIGH_DANGER_REGEX.search(chunk) is not None
            if not has_high_danger:
                word_count = len(chunk.split())
                has_marketing = MARKETING_REGEX.search(chunk) is not None
                if word_count < 50 or has_marketing:
                    chunk_safe = True

        if not chunk_safe and confidence > worst_confidence:
            worst_confidence = confidence
            worst_chunk_idx = idx
            worst_text = chunk[:300]
            file_is_safe = False

    result_label = "SAFE" if file_is_safe else "INJECTION"
    logger.info(f"File scan complete: {filename} -> {result_label} (chunks: {len(chunks)})")

    scan_result = {
        "filename": filename,
        "is_safe": file_is_safe,
        "label": result_label,
        "confidence": worst_confidence if not file_is_safe else 0.0,
        "total_chunks": len(chunks),
        "flagged_chunk": worst_chunk_idx,
        "malicious_text": worst_text if not file_is_safe else None,
        "partial_scan": partial_scan,
    }
    if partial_scan:
        scan_result["note"] = f"Only the first {MAX_PDF_PAGES} pages were scanned."

    # Log to scan history
    scan_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": time.time(),
        "time": datetime.now().strftime("%H:%M:%S"),
        "text": f"[FILE] {filename} — {worst_text[:100]}" if not file_is_safe else f"[FILE] {filename} — SAFE",
        "label": result_label,
        "confidence": worst_confidence if not file_is_safe else 0.0,
        "is_safe": file_is_safe,
        "source": "file-scan",
    }
    scan_log.appendleft(scan_entry)
    scan_metrics["scanned"] += 1
    if not file_is_safe:
        scan_metrics["blocked"] += 1

    return scan_result

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
