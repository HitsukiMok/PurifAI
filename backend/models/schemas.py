"""
Pydantic v2 schemas for request/response validation and serialisation.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, EmailStr, Field


# ── Auth / User ───────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str
    email: str = ""


# ── Chat / AI ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8_000)
    session_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    flagged: bool
    session_id: str


# ── Feedback ──────────────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    session_id: str
    rating: Literal["positive", "negative"]
    comment: str = ""


# ── Traffic / Threats (mirrors frontend TrafficRow) ───────────────────────────

class TrafficEvent(BaseModel):
    id: str
    time: str
    source: str
    agent: str
    risk: float = Field(..., ge=0.0, le=100.0)
    status: Literal["Clean", "Blocked"]
    raw: str | None = None
    payload: str | None = None
    technique: str | None = None
