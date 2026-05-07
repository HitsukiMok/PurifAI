import os
import re
import hashlib
from supabase import create_client, Client
from fastapi import HTTPException
from transformers import pipeline, AutoTokenizer

# ── Thread Tuning (2-vCPU Optimization) ───────────────────────────────────────
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"

# ── Environment Config ────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ── Supabase Client ──────────────────────────────────────────────────────────
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Warning: Supabase credentials missing.")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Stable PyTorch Model Initialization ──────────────────────────────────────
# Using the fine-tuned security model on the standard PyTorch engine
HF_MODEL = "ProtectAI/deberta-v3-base-prompt-injection-v2"

print(f"[PurifAI] Initializing Stable PyTorch pipeline: {HF_MODEL}")
try:
    # We bypass ONNX and load directly into the stable transformer pipeline
    classifier = pipeline(
        "text-classification", 
        model=HF_MODEL, 
        tokenizer=HF_MODEL,
        truncation=True,
        max_length=512
    )
    print("[PurifAI] Stable PyTorch Engine loaded successfully.")
except Exception as e:
    print(f"[PurifAI] CRITICAL: Failed to load PyTorch model: {e}")
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

# ── Stable Inference Logic ────────────────────────────────────────────────
def query_huggingface(text: str):
    """
    Runs inference locally using the stable PyTorch DeBERTa v3 model.
    """
    if classifier is None:
        return {"error": "Model not loaded", "warming_up": False}

    try:
        # Run inference with strict truncation
        results = classifier(text, truncation=True, max_length=512)
        
        if isinstance(results, list) and len(results) > 0:
            prediction = results[0]
            label = prediction['label']
            score = prediction['score']
            
            # --- The 85% Confidence Threshold ---
            # If the AI thinks it's an injection but isn't 85% sure, force it to SAFE
            CONFIDENCE_THRESHOLD = 0.85
            if label == "INJECTION" and score < CONFIDENCE_THRESHOLD:
                print(f"[PurifAI] Overriding INJECTION ({score:.2f}) to SAFE due to low confidence.")
                label = "SAFE"
                
            formatted = {
                label: score,
                "SAFE" if label == "INJECTION" else "INJECTION": 1.0 - score 
            }
            
            return formatted
        
        return {"error": "Inference returned empty results"}
    except Exception as e:
        print(f"[PurifAI] PyTorch inference error: {str(e)}")
        return {"error": str(e)}

# ── Text Processing Helpers ──────────────────────────────────────────────────
def clean_text(text: str) -> str:
    # 1. HTML Stripping
    cleaned = re.sub(r'<[^>]+>', ' ', text).strip()
    
    # 2. Fuzzy Deduplication
    fuzzy = re.sub(r'On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun).*?wrote:', '', cleaned, flags=re.IGNORECASE)
    fuzzy = re.sub(r'\d{1,2}:\d{2}\s*(?:AM|PM)?', '', fuzzy, flags=re.IGNORECASE)
    fuzzy = re.sub(r'\d{4}-\d{2}-\d{2}', '', fuzzy)
    return fuzzy.strip()

def get_text_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def chunk_text(text: str, chunk_size=400, overlap=50):
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