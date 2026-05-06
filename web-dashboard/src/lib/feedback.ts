// ── Daberta Feedback API Client ────────────────────────────────────────────
// POST /api/daberta/feedback  (v1)
// No login required. Captures anonymous_id + optional user_id if logged in.

export type FeedbackCategory =
  | "factually_wrong"
  | "misleading"
  | "missing_context"
  | "wrong_risk_score"
  | "policy_error"
  | "other";

export type FeedbackRating = "positive" | "negative";

export type FeedbackSeverity = "minor" | "significant" | "critical";

export interface FeedbackPayload {
  // What the model received / produced
  input: string;         // user prompt / agent input that generated the output
  output: string;        // the model response being reported
  // User feedback
  feedback_text: string;
  rating?: FeedbackRating;
  // Structured metadata
  metadata: {
    session_id: string;
    anonymous_id: string;
    user_id?: string;
    timestamp: string;   // ISO 8601
    model_version: string;
    category?: FeedbackCategory;
    severity?: FeedbackSeverity;
    expected_output?: string;
    surface: string;     // e.g. "agents_table", "threat_inspector"
    response_id: string; // ID of the item being reported
  };
}

// ── Session ID ─────────────────────────────────────────────────────────────
// Stable for the browser session, survives page navigations.
function getOrCreateSessionId(): string {
  const KEY = "agentshield_session_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// Persistent anonymous ID — survives sessions, no PII.
function getOrCreateAnonymousId(): string {
  const KEY = "agentshield_anon_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function buildMetadata(
  overrides: Partial<FeedbackPayload["metadata"]> &
    Pick<FeedbackPayload["metadata"], "response_id" | "surface">,
): FeedbackPayload["metadata"] {
  return {
    session_id: getOrCreateSessionId(),
    anonymous_id: getOrCreateAnonymousId(),
    timestamp: new Date().toISOString(),
    model_version: "daberta-v1",
    ...overrides,
  };
}

// ── POST helper ─────────────────────────────────────────────────────────────
const ENDPOINT = "/api/daberta/feedback";

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  // Optimistic — fire and forget. Errors are logged but not re-thrown so
  // they never break the UI flow.
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[Feedback] POST ${ENDPOINT} returned ${res.status}`);
    }
  } catch (err) {
    // Network error — swallow silently so the UI stays responsive.
    console.warn("[Feedback] Failed to submit:", err);
  }
}
