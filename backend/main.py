from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch

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
