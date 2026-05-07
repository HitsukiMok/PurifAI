from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import time
import uuid
from datetime import datetime
from .utils import (
    query_huggingface, clean_text, HIGH_DANGER_REGEX, 
    MARKETING_REGEX, get_supabase, get_text_hash
)

# 1. Change FastAPI() to APIRouter()
router = APIRouter()

class ScanRequest(BaseModel):
    text: str

# 2. Change @app.post to @router.post and remove the "/api" prefix
@router.post("/scan")
async def scan_text(request: ScanRequest, http_request: Request):
    raw_text = request.text
    cleaned_text = clean_text(raw_text)
    
    # 1. Hugging Face Inference
    hf_result = query_huggingface(cleaned_text)

    # 2. Handle Cold Start / Warming Up
    if isinstance(hf_result, dict) and hf_result.get("warming_up"):
        return hf_result

    # 3. Process Predictions (Calibrated Threshold)
    # Increase threshold to 0.8 to avoid false positives on ambiguous text
    injection_score = hf_result.get("INJECTION", 0.0)
    safe_score = hf_result.get("SAFE", 0.0)
    
    # Innocent until proven guilty: requires high confidence to block
    is_safe = injection_score < 0.8
    label = "SAFE" if is_safe else "INJECTION"
    confidence = safe_score if is_safe else injection_score
    
    heuristic_applied = "None"
    
    # 4. Heuristics (Whitelist Logic)
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
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "text": raw_text[:500],
            "label": label,
            "confidence": float(confidence),
            "is_safe": is_safe,
            "heuristic": heuristic_applied,
            "source": "extension-scan"
        }
        supabase.table("scans").insert(log_data).execute()
    except Exception as e:
        # This will show up in your Vercel logs
        print(f"CRITICAL: Supabase logging failed. Check if table 'scans' has columns: {list(log_data.keys())}. Error: {e}")

    return {
        "text": raw_text,
        "is_safe": is_safe,
        "label": label,
        "confidence": float(confidence),
        "heuristic": heuristic_applied
    }