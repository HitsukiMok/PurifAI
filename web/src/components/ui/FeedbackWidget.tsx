import { useState, useRef, useEffect } from "react";
import {
  ThumbsUp, ThumbsDown, Flag, X, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  submitFeedback, buildMetadata,
  type FeedbackCategory, type FeedbackRating, type FeedbackSeverity,
} from "@/lib/feedback";

// ── Types ──────────────────────────────────────────────────────────────────
interface FeedbackContext {
  /** Unique ID of the response/item being reported (e.g. agent ID, threat ID) */
  responseId: string;
  /** Which UI surface this is on — recorded in metadata */
  surface: string;
  /** The model input that produced this output (prompt / request) */
  input: string;
  /** The model output being evaluated (the text shown in the card) */
  output: string;
}

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "factually_wrong",  label: "Factually wrong"  },
  { value: "misleading",       label: "Misleading"       },
  { value: "missing_context",  label: "Missing context"  },
  { value: "wrong_risk_score", label: "Wrong risk score" },
  { value: "policy_error",     label: "Policy error"     },
  { value: "other",            label: "Other"            },
];

const SEVERITIES: { value: FeedbackSeverity; label: string; cls: string }[] = [
  { value: "minor",       label: "Minor",       cls: "border-success/40 text-success   data-[active]:bg-success/15"  },
  { value: "significant", label: "Significant", cls: "border-amber-400/40 text-amber-400 data-[active]:bg-amber-400/15" },
  { value: "critical",    label: "Critical",    cls: "border-danger/40 text-danger    data-[active]:bg-danger/15"   },
];

// ── Feedback Modal ──────────────────────────────────────────────────────────
function FeedbackModal({
  ctx,
  initialRating,
  onClose,
  onSubmitted,
}: {
  ctx: FeedbackContext;
  initialRating?: FeedbackRating;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [category, setCategory]         = useState<FeedbackCategory | null>(null);
  const [description, setDescription]   = useState("");
  const [severity, setSeverity]         = useState<FeedbackSeverity>("significant");
  const [showExpected, setShowExpected] = useState(false);
  const [expected, setExpected]         = useState("");
  const [submitting, setSubmitting]     = useState(false);

  const MIN_CHARS = 10;
  const canSubmit = category !== null && description.trim().length >= MIN_CHARS;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await submitFeedback({
      input: ctx.input,
      output: ctx.output,
      feedback_text: description.trim(),
      rating: initialRating,
      metadata: buildMetadata({
        response_id:     ctx.responseId,
        surface:         ctx.surface,
        category:        category ?? undefined,
        severity,
        expected_output: expected.trim() || undefined,
      }),
    });
    setSubmitting(false);
    onSubmitted();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30">
              <Flag className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-semibold text-foreground">Report AI Output</h2>
          </div>
          <button
            id="feedback-modal-close"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Quoted output */}
          <div className="rounded-lg border border-border/40 bg-muted/40 px-3.5 py-3 text-[11px] text-muted-foreground leading-relaxed">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              AI output being reported
            </p>
            <p className="line-clamp-3 text-foreground/70">{ctx.output}</p>
          </div>

          {/* Category pills */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              What's wrong? <span className="text-danger">*</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  id={`feedback-cat-${c.value}`}
                  onClick={() => setCategory(c.value)}
                  data-active={category === c.value ? "" : undefined}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground
                    transition-all hover:border-amber-400/40 hover:text-amber-400
                    data-[active]:border-amber-400/60 data-[active]:bg-amber-400/10 data-[active]:text-amber-400"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              What went wrong? <span className="text-danger">*</span>
            </label>
            <div className="relative mt-1.5">
              <textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the mistake clearly…"
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm
                  text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2
                  focus:ring-ai/40 transition-shadow"
              />
              <span
                className={`absolute bottom-2 right-2.5 text-[10px] font-mono transition-colors
                  ${description.length < MIN_CHARS ? "text-muted-foreground/50" : "text-success"}`}
              >
                {description.length}/{MIN_CHARS}+
              </span>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Severity
            </label>
            <div className="mt-1.5 flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  id={`feedback-sev-${s.value}`}
                  onClick={() => setSeverity(s.value)}
                  data-active={severity === s.value ? "" : undefined}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all ${s.cls}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expected output — progressive disclosure */}
          <div>
            <button
              id="feedback-toggle-expected"
              onClick={() => setShowExpected((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest
                text-muted-foreground hover:text-foreground transition-colors"
            >
              {showExpected ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showExpected ? "Hide" : "+ Add"} expected output (optional)
            </button>
            {showExpected && (
              <textarea
                id="feedback-expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                placeholder="If you know the correct output, share it here…"
                className="mt-2 w-full resize-none rounded-lg border border-border/60 bg-muted/40 px-3
                  py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none
                  focus:ring-2 focus:ring-ai/40"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/40 px-5 py-4">
          <button
            id="feedback-cancel"
            onClick={onClose}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            id="feedback-submit"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold
              text-white hover:bg-amber-500/90 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all"
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick-rating nudge ──────────────────────────────────────────────────────
function NegativeNudge({
  onOpen,
  onDismiss,
}: {
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/8
      px-2.5 py-1 text-[11px] text-amber-400 animate-in fade-in slide-in-from-right-2 duration-200">
      Want to add details?
      <button
        id="feedback-nudge-open"
        onClick={onOpen}
        className="font-semibold underline underline-offset-2 hover:no-underline"
      >
        Report →
      </button>
      <button
        id="feedback-nudge-dismiss"
        onClick={onDismiss}
        className="rounded-full p-0.5 hover:bg-amber-400/20 transition-colors"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FeedbackActionRow  — drop this below any AI-generated content block
// ══════════════════════════════════════════════════════════════════════════════
export function FeedbackActionRow({
  ctx,
  onSubmitted,
  _openModalImmediately,
  _onModalClose,
}: {
  ctx: FeedbackContext;
  /** Optional callback so the parent can show its own toast */
  onSubmitted?: () => void;
  /** Internal escape-hatch: open the modal immediately on mount (used by context-menu trigger) */
  _openModalImmediately?: boolean;
  /** Called when the imperatively-opened modal closes (so the parent can unmount this component) */
  _onModalClose?: () => void;
}) {
  type UiState = "idle" | "positive" | "negative" | "reported";
  const [state, setState]         = useState<UiState>("idle");
  const [showNudge, setShowNudge] = useState(false);
  const [showModal, setShowModal] = useState(_openModalImmediately ?? false);
  const [rating, setRating]       = useState<FeedbackRating | undefined>();
  const nudgeTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeModal() {
    setShowModal(false);
    _onModalClose?.();
  }

  function handleThumbUp() {
    if (state === "reported") return;
    setState("positive");
    setShowNudge(false);
    setRating("positive");
    // Fire quick signal immediately
    submitFeedback({
      input: ctx.input,
      output: ctx.output,
      feedback_text: "",
      rating: "positive",
      metadata: buildMetadata({ response_id: ctx.responseId, surface: ctx.surface }),
    });
    onSubmitted?.();
  }

  function handleThumbDown() {
    if (state === "reported") return;
    setState("negative");
    setRating("negative");
    // Fire quick negative signal
    submitFeedback({
      input: ctx.input,
      output: ctx.output,
      feedback_text: "",
      rating: "negative",
      metadata: buildMetadata({ response_id: ctx.responseId, surface: ctx.surface }),
    });
    // Show nudge after 400 ms so it feels snappy, not instant
    nudgeTimer.current = setTimeout(() => setShowNudge(true), 400);
  }

  function handleFlag() {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    setShowNudge(false);
    setShowModal(true);
  }

  function handleModalSubmitted() {
    setState("reported");
    setShowNudge(false);
    onSubmitted?.();
  }

  const isPositive = state === "positive";
  const isNegative = state === "negative";
  const isReported = state === "reported";

  return (
    <>
      <div className="flex items-center justify-end gap-1.5 pt-1.5">
        {/* Generated-by label */}
        <span className="mr-auto text-[10px] text-muted-foreground/50 italic select-none">
          ✦ AI-generated
        </span>

        {/* Nudge pill */}
        {showNudge && (
          <NegativeNudge
            onOpen={handleFlag}
            onDismiss={() => setShowNudge(false)}
          />
        )}

        {/* Reported state pill */}
        {isReported && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30
            bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400
            animate-in fade-in duration-300">
            <Flag className="h-3 w-3 feedback-flag-wave" /> Reported
          </span>
        )}

        {/* Thumb Up */}
        {!isReported && (
          <button
            id={`feedback-thumb-up-${ctx.responseId}`}
            onClick={handleThumbUp}
            title="This output was accurate"
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all
              ${isPositive
                ? "border-success/50 bg-success/15 text-success"
                : "border-transparent text-muted-foreground/40 hover:border-success/30 hover:bg-success/10 hover:text-success"
              }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Thumb Down */}
        {!isReported && (
          <button
            id={`feedback-thumb-down-${ctx.responseId}`}
            onClick={handleThumbDown}
            title="This output had a mistake"
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all
              ${isNegative
                ? "border-danger/50 bg-danger/15 text-danger"
                : "border-transparent text-muted-foreground/40 hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
              }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Flag / Report */}
        {!isReported && (
          <button
            id={`feedback-flag-${ctx.responseId}`}
            onClick={handleFlag}
            title="Report a mistake in this output"
            className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1
              text-[11px] text-muted-foreground/40 transition-all
              hover:border-amber-400/30 hover:bg-amber-400/8 hover:text-amber-400"
          >
            <Flag className="h-3 w-3" />
            <span className="hidden sm:inline">Flag</span>
          </button>
        )}

        {/* Positive confirmation */}
        {isPositive && (
          <span className="flex items-center gap-1 text-[10px] text-success animate-in fade-in duration-300">
            <Check className="h-3 w-3" /> Thanks!
          </span>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <FeedbackModal
          ctx={ctx}
          initialRating={rating}
          onClose={closeModal}
          onSubmitted={handleModalSubmitted}
        />
      )}
    </>
  );
}
