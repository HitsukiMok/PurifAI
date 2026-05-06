"""
AgentShield Backend — Main Application Entry Point
Initializes FastAPI, registers routers, and configures middleware.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import chat, user
from core.config import settings


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before the server accepts requests."""
    print(f"🛡  AgentShield API starting — env: {settings.ENVIRONMENT}")
    yield
    print("AgentShield API shutting down.")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AgentShield API",
    description="AI agent security monitoring — indirect prompt injection detection.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(chat.router, prefix="/api/chat", tags=["Chat / AI"])
app.include_router(user.router, prefix="/api/user", tags=["User"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}
