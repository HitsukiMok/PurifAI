import os
import re
import hashlib
from supabase import create_client, Client
from fastapi import HTTPException
from transformers import pipeline

# ── Environment Config ────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ── Supabase Client ──────────────────────────────────────────────────────────
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        # For local testing, we might not have these, but they are needed for production
        print("Warning: Supabase credentials missing.")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Local AI Model Initialization (Global) ────────────────────────────────────
# This loads the model ONCE when the server starts. 
# HF Spaces provide 16GB RAM, enough for DeBERTa v3.
HF_MODEL = "ProtectAI/deberta-v3-base-prompt-injection-v2"

print(f"[PurifAI] Initializing local inference pipeline with model: {HF_MODEL}")
try:
    # Use CPU by default. For GPU, use device=0
    classifier = pipeline("text-classification", model=HF_MODEL)
    print("[PurifAI] Model loaded successfully.")
except Exception as e:
    print(f"[PurifAI] CRITICAL: Failed to load model: {e}")
    classifier = None

# ── Regexes ──────────────────────────────────────────────────────────────────
MARKETING_REGEX = re.compile(
    r"(unsubscribe|view in browser|manage preferences|opt-out|newsletter|privacy policy|click here to unsubscribe)", 
    re.IGNORECASE
)

HIGH_DANGER_REGEX = re.compile(
    r"(ignore all previous instructions|system override|jailbreak|you are now)",
    re.IGNORECASE
)

# ── Local Inference Logic ────────────────────────────────────────────────────
def query_huggingface(text: str):
    """
    Runs inference locally using the DeBERTa v3 model.
    Replaces the previous remote HTTP Inference API calls.
    """
    if classifier is None:
        return {"error": "Model not loaded", "warming_up": False}

    try:
        # Run local inference
        # The pipeline returns: [{"label": "SAFE", "score": 0.99...}]
        results = classifier(text)
        
        if isinstance(results, list) and len(results) > 0:
            # We transform this into the dictionary format expected by scan.py
            # Format: {"SAFE": 0.99, "INJECTION": 0.01}
            formatted = {}
            for res in results:
                # Some versions of transformers return a single dict for single string
                # Some return a list of dicts. We handle both.
                if isinstance(res, dict):
                    formatted[res["label"]] = res["score"]
            
            # Note: If the model only returns the top class, we might need to 
            # ensure 'SAFE' and 'INJECTION' keys exist for the threshold logic in scan.py
            if "SAFE" not in formatted: formatted["SAFE"] = 0.0
            if "INJECTION" not in formatted: formatted["INJECTION"] = 0.0
            
            return formatted
        
        return {"error": "Inference returned empty results"}
    except Exception as e:
        print(f"[PurifAI] Local inference error: {str(e)}")
        return {"error": str(e)}

# ── Text Processing Helpers ──────────────────────────────────────────────────
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
    """Split text into overlapping blocks."""
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
