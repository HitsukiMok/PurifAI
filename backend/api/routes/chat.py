"""
/api/chat — AI inference endpoints.
Handles prompt submission, streaming responses, and feedback logging.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from ai.agent import AgentShieldAgent
from api.dependencies import CurrentUser
from models.schemas import ChatRequest, ChatResponse, FeedbackRequest

router = APIRouter()
_agent = AgentShieldAgent()


@router.post("/", response_model=ChatResponse, summary="Send a prompt to the AI agent")
async def chat(body: ChatRequest, current_user: CurrentUser) -> ChatResponse:
    """
    Submit a user message. The agent applies threat-analysis context,
    detects indirect prompt injection, and returns a safe response.
    """
    try:
        result = await _agent.run(
            user_message=body.message,
            session_id=body.session_id,
            user_id=current_user.user_id,
        )
        return ChatResponse(
            reply=result.reply,
            risk_score=result.risk_score,
            flagged=result.flagged,
            session_id=result.session_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/feedback", status_code=status.HTTP_204_NO_CONTENT, summary="Submit feedback on an AI response")
async def submit_feedback(body: FeedbackRequest, current_user: CurrentUser) -> None:
    """
    Record a thumbs-up / thumbs-down rating and optional comment
    for a specific AI response session.
    """
    await _agent.record_feedback(
        session_id=body.session_id,
        rating=body.rating,
        comment=body.comment,
        user_id=current_user.user_id,
    )
