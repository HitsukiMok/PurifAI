from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from .utils import get_supabase

router = APIRouter()

class FeedbackRequest(BaseModel):
    text: str                    # The original text that was scanned
    model_label: str             # What the AI predicted (SAFE or INJECTION)
    model_confidence: float      # How confident the AI was (0.0 - 1.0)
    user_corrected_label: str    # What the user says it SHOULD be (SAFE or INJECTION)

@router.post("/feedback")
async def log_feedback(feedback: FeedbackRequest):
    """
    Logs feedback to Supabase 'feedback' table.
    """
    try:
        supabase = get_supabase()
        supabase.table("feedback").insert({
            "timestamp": datetime.now().isoformat(),
            "text": feedback.text,
            "model_label": feedback.model_label,
            "model_confidence": feedback.model_confidence,
            "user_corrected_label": feedback.user_corrected_label,
        }).execute()

        return {
            "status": "feedback_logged",
            "message": "Thank you! This helps improve the model."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log feedback: {str(e)}")
