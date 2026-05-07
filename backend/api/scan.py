from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import time
import uuid
from datetime import datetime
from .utils import (
    query_huggingface, clean_text, HIGH_DANGER_REGEX, 
    MARKETING_REGEX, get_supabase, get_text_hash
)

app = FastAPI()

class ScanRequest(BaseModel):
    text: str

@app.post("/api/scan")
async def scan_text(request: ScanRequest, http_request: Request):
    # Rate Limiting: In serverless, we can't easily use in-memory dicts.
    # For MVP, we skip complex rate limiting or use a shared Redis/Upstash later.
    
    raw_text = request.text
    cleaned_text = clean_text(raw_text)
    
    # 1. Hugging Face Inference
    hf_result = query_huggingface(cleaned_text)

    # 2. Handle Cold Start / Warming Up
    if isinstance(hf_result, dict) and hf_result.get("warming_up"):
        return hf_result

    # 3. Process Predictions
    # model returns labels 'SAFE' and 'INJECTION' (or similar)
    # The dictionary from utils is {"SAFE": 0.99, "INJECTION": 0.01}
    injection_score = hf_result.get("INJECTION", 0.0)
    safe_score = hf_result.get("SAFE", 0.0)
    
    is_safe = safe_score > injection_score
    label = "SAFE" if is_safe else "INJECTION"
    confidence = safe_score if is_safe else injection_score
    
    heuristic_applied = "None"
    
    # 4. Heuristics (Downgrade Logic)
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
                label = "SAFE (Heuristic)"

    # 5. Log to Supabase (Crash-Proof)
    try:
        supabase = get_supabase()
        supabase.table("scans").insert({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "text": raw_text[:500], # Truncate for DB storage efficiency
            "label": label,
            "confidence": float(confidence),
            "is_safe": is_safe,
            "heuristic": heuristic_applied,
            "source": "extension-scan"
        }).execute()
    except Exception as e:
        # Don't crash the scan just because logging failed
        print(f"Supabase logging failed: {e}")

    return {
        "text": raw_text,
        "is_safe": is_safe,
        "label": label,
        "confidence": float(confidence),
        "heuristic": heuristic_applied
    }
