from fastapi import FastAPI, Request, HTTPException, UploadFile, File
import io
import uuid
import re
import time
from datetime import datetime
from pypdf import PdfReader
from .utils import (
    query_huggingface, clean_text, HIGH_DANGER_REGEX, 
    MARKETING_REGEX, get_supabase, chunk_text
)

app = FastAPI()

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_PDF_PAGES = 5

@app.post("/api/scan-file")
async def scan_file(http_request: Request, file: UploadFile = File(...)):
    """Scan an uploaded PDF or TXT file for prompt injections."""
    
    filename = file.filename or "unknown"
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ""
    if ext not in ('pdf', 'txt'):
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large.")

    raw_text = ""
    partial_scan = False
    try:
        if ext == 'pdf':
            reader = PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)
            pages_to_scan = min(total_pages, MAX_PDF_PAGES)
            partial_scan = total_pages > MAX_PDF_PAGES
            for i in range(pages_to_scan):
                raw_text += (reader.pages[i].extract_text() or "") + "\n"
        elif ext == 'txt':
            raw_text = file_bytes.decode('utf-8', errors='replace')
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parse error: {str(e)}")
    finally:
        await file.close()

    cleaned_text = clean_text(raw_text)
    if not cleaned_text:
        return {"filename": filename, "is_safe": True, "label": "SAFE", "confidence": 1.0}

    chunks = chunk_text(cleaned_text)
    worst_confidence = 0.0
    file_is_safe = True
    worst_text = ""

    for chunk in chunks:
        hf_result = query_huggingface(chunk)
        
        # Handle Cold Start
        if isinstance(hf_result, dict) and hf_result.get("warming_up"):
            return hf_result

        injection_score = hf_result.get("INJECTION", 0.0)
        safe_score = hf_result.get("SAFE", 0.0)
        
        chunk_safe = safe_score > injection_score
        confidence = safe_score if chunk_safe else injection_score

        # Heuristics
        if not chunk_safe:
            has_high_danger = HIGH_DANGER_REGEX.search(chunk) is not None
            if not has_high_danger:
                word_count = len(chunk.split())
                has_marketing = MARKETING_REGEX.search(chunk) is not None
                if word_count < 50 or has_marketing:
                    chunk_safe = True

        if not chunk_safe and confidence > worst_confidence:
            worst_confidence = confidence
            worst_text = chunk[:200]
            file_is_safe = False

    result_label = "SAFE" if file_is_safe else "INJECTION"

    # Log to Supabase
    try:
        supabase = get_supabase()
        supabase.table("scans").insert({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "text": f"[FILE] {filename}: {worst_text}",
            "label": result_label,
            "confidence": float(worst_confidence),
            "is_safe": file_is_safe,
            "source": "file-scan"
        }).execute()
    except: pass

    return {
        "filename": filename,
        "is_safe": file_is_safe,
        "label": result_label,
        "confidence": float(worst_confidence),
        "partial_scan": partial_scan
    }
