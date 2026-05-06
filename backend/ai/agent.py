"""
Core AI agent — model initialization, prompt injection detection,
threat scoring, and response generation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from ai.prompts import SYSTEM_PROMPT, build_threat_analysis_prompt
from core.config import settings


@dataclass
class AgentResult:
    reply: str
    risk_score: float          # 0.0 – 1.0
    flagged: bool
    session_id: str
    techniques_detected: list[str] = field(default_factory=list)


class AgentShieldAgent:
    """
    Wraps an LLM provider with AgentShield's security layer.
    Detects indirect prompt injection, scores risk, and optionally
    blocks or sanitizes responses before returning them to the caller.
    """

    def __init__(self) -> None:
        self._provider = settings.OPENAI_API_KEY and "openai" or "stub"
        self._feedback_log: list[dict] = []

    # ── Public API ────────────────────────────────────────────────────────────

    async def run(
        self,
        user_message: str,
        session_id: str | None = None,
        user_id: str = "",
    ) -> AgentResult:
        """
        Process a user message through the security pipeline:
          1. Build threat-aware prompt
          2. Call LLM (or stub)
          3. Parse risk score from response
          4. Return structured result
        """
        sid = session_id or str(uuid.uuid4())
        system = SYSTEM_PROMPT
        threat_context = build_threat_analysis_prompt(user_message)

        raw_reply, risk_score, techniques = await self._call_llm(
            system=system,
            user_message=threat_context,
        )

        flagged = risk_score >= 0.6

        return AgentResult(
            reply=raw_reply,
            risk_score=risk_score,
            flagged=flagged,
            session_id=sid,
            techniques_detected=techniques,
        )

    async def record_feedback(
        self,
        session_id: str,
        rating: str,          # "positive" | "negative"
        comment: str = "",
        user_id: str = "",
    ) -> None:
        """Persist user feedback for RLHF or review."""
        self._feedback_log.append(
            {
                "session_id": session_id,
                "rating": rating,
                "comment": comment,
                "user_id": user_id,
            }
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _call_llm(
        self, system: str, user_message: str
    ) -> tuple[str, float, list[str]]:
        """
        Route to the configured LLM provider.
        Falls back to a deterministic stub if no API keys are set.
        """
        if self._provider == "openai":
            return await self._openai(system, user_message)
        return self._stub(user_message)

    async def _openai(
        self, system: str, user_message: str
    ) -> tuple[str, float, list[str]]:
        """OpenAI chat-completion call (requires openai package)."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            text = resp.choices[0].message.content or ""
            risk, techniques = self._parse_risk(text)
            return text, risk, techniques
        except Exception as exc:
            return f"[LLM error: {exc}]", 0.0, []

    def _stub(self, user_message: str) -> tuple[str, float, list[str]]:
        """Deterministic stub used when no LLM key is configured."""
        keywords = ["ignore", "disregard", "forget", "override", "jailbreak"]
        matched = [k for k in keywords if k.lower() in user_message.lower()]
        risk = min(len(matched) * 0.25, 1.0)
        return (
            f"[STUB] Analysed input. Risk: {risk:.2f}. Matched: {matched or 'none'}.",
            risk,
            matched,
        )

    @staticmethod
    def _parse_risk(text: str) -> tuple[float, list[str]]:
        """
        Extract risk_score from a structured LLM response.
        Expects a line like:  RISK_SCORE: 0.75
        """
        import re

        score = 0.0
        techniques: list[str] = []
        for line in text.splitlines():
            if m := re.search(r"RISK_SCORE:\s*([0-9.]+)", line):
                score = min(float(m.group(1)), 1.0)
            if m := re.search(r"TECHNIQUES:\s*(.+)", line):
                techniques = [t.strip() for t in m.group(1).split(",") if t.strip()]
        return score, techniques
