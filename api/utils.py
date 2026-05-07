import os
import re
import hashlib
import requests
from supabase import create_client, Client
from fastapi import HTTPException

# ── Environment Config ────────────────────────────────────────────────────────
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")
HF_MODEL = "ProtectAI/deberta-v3-base-prompt-injection-v2"
HF_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ── Supabase Client ──────────────────────────────────────────────────────────
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Supabase credentials missing from environment.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Regexes from main.py ──────────────────────────────────────────────────────
MARKETING_REGEX = re.compile(
    r"(unsubscribe|view in browser|manage preferences|opt-out|newsletter|privacy policy|click here to unsubscribe)", 
    re.IGNORECASE
)

HIGH_DANGER_REGEX = re.compile(
    r"(ignore all previous instructions|system override|jailbreak|you are now)",
    re.IGNORECASE
)

# ── Hugging Face Client ──────────────────────────────────────────────────────
def query_huggingface(text: str):
    """
    Sends text to Hugging Face Inference API.
    Handles 503 Service Unavailable (Warming Up) gracefully.
    """
    if not HF_TOKEN:
        raise HTTPException(status_code=500, detail="Hugging Face API key missing.")

    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {"inputs": text, "options": {"wait_for_model": False}}

    try:
        response = requests.post(HF_URL, headers=headers, json=payload, timeout=8)
        
        # Check for Cold Start (503)
        if response.status_code == 503:
            data = response.json()
            est_time = data.get("estimated_time", 20)
            return {
                "warming_up": True,
                "message": "AI is waking up. Please try scanning again in 15 seconds.",
                "estimated_time": est_time
            }

        if response.status_code != 200:
            # 🚨 HARD ERROR CATCH: Don't try to parse JSON if status is not 200
            print(f"HF API non-200 response: {response.status_code}")
            return {"error": "hf_overload", "warming_up": False}

        try:
            results = response.json()
        except Exception as e:
            # 🚨 DEEP JSON CATCH: HF sometimes returns HTML on 429/500
            print(f"HF JSON Parsing failed: {e}")
            return {"error": "hf_overload", "warming_up": False}

        # HF returns a list of lists: [[{"label": "SAFE", "score": 0.99}, ...]]
        if isinstance(results, list) and len(results) > 0:
            predictions = results[0]
            return {p["label"]: p["score"] for p in predictions}
        
        return results
    except requests.exceptions.Timeout:
        return {"error": "hf_timeout", "warming_up": False}
    except Exception as e:
        print(f"Inference error in utils.py: {str(e)}")
        return {"error": "hf_unknown", "warming_up": False}

# ── Text Processing ─────────────────────────────────────────────────────────
def clean_text(text: str) -> str:
    # 1. HTML Stripping
    cleaned = re.sub(r'<[^>]+>', ' ', text).strip()
    
    # 2. Fuzzy Deduplication: Strip volatile timestamps and headers
    fuzzy = re.sub(r'On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun).*?wrote:', '', cleaned, flags=re.IGNORECASE)
    fuzzy = re.sub(r'\d{1,2}:\d{2}\s*(?:AM|PM)?', '', fuzzy, flags=re.IGNORECASE)
    fuzzy = re.sub(r'\d{4}-\d{2}-\d{2}', '', fuzzy)
    return fuzzy.strip()

def get_text_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def chunk_text(text: str, chunk_size=400, overlap=50):
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
