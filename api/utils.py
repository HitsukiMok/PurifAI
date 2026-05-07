import os
import re
import hashlib
from supabase import create_client, Client
from fastapi import HTTPException
from transformers import pipeline, AutoTokenizer
from optimum.onnxruntime import ORTModelForSequenceClassification

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

# ── Optimized AI Model Initialization (ONNX) ──────────────────────────────────
# Using Optimum to convert and run the model via ONNX Runtime for CPU speedup.
HF_MODEL = "ProtectAI/deberta-v3-base-prompt-injection-v2"

print(f"[PurifAI] Initializing ONNX inference pipeline: {HF_MODEL}")
try:
    # 1. Load the tokenizer
    tokenizer = AutoTokenizer.from_pretrained(HF_MODEL)
    
    # 2. Load and Export to ONNX (on-the-fly)
    # This might take a moment on the first boot in the Space
    model = ORTModelForSequenceClassification.from_pretrained(HF_MODEL, export=True)
    
    # 3. Create the optimized pipeline
    classifier = pipeline(
        "text-classification", 
        model=model, 
        tokenizer=tokenizer
    )
    print("[PurifAI] ONNX Runtime Engine loaded successfully.")
except Exception as e:
    print(f"[PurifAI] CRITICAL: Failed to load ONNX model: {e}")
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

# ── Optimized Inference Logic ────────────────────────────────────────────────
def query_huggingface(text: str):
    """
    Runs inference locally using the ONNX-optimized DeBERTa v3 model.
    """
    if classifier is None:
        return {"error": "Model not loaded", "warming_up": False}

    try:
        # Run inference with strict truncation to 512 tokens
        results = classifier(text, truncation=True, max_length=512)
        
        if isinstance(results, list) and len(results) > 0:
            formatted = {}
            for res in results:
                if isinstance(res, dict):
                    formatted[res["label"]] = res["score"]
            
            # Compatibility padding
            if "SAFE" not in formatted: formatted["SAFE"] = 0.0
            if "INJECTION" not in formatted: formatted["INJECTION"] = 0.0
            
            return formatted
        
        return {"error": "Inference returned empty results"}
    except Exception as e:
        print(f"[PurifAI] ONNX inference error: {str(e)}")
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
