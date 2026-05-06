import type { TrafficRow } from "@/lib/mock-traffic";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function riskColor(risk: number) {
  if (risk >= 80) return "text-danger";
  if (risk >= 50) return "text-amber-400";
  return "text-success";
}

function riskBarColor(risk: number) {
  if (risk >= 80) return "bg-danger";
  if (risk >= 50) return "bg-amber-400";
  return "bg-success";
}

function riskLabel(risk: number) {
  if (risk >= 80) return "Critical";
  if (risk >= 50) return "Medium";
  return "Low";
}

export function AttackInspectionPanel({ attack }: { attack: TrafficRow }) {
  const before = attack.raw ?? "";
  const payload = attack.payload ?? "";
  const after = payload
    ? before.replace(payload, "[REDACTED — Prompt Injection]")
    : before;

  const parts = payload ? before.split(payload) : [before];

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-danger" />
          <h2 className="text-sm font-semibold tracking-tight">Attack Inspection</h2>
        </div>
        {attack.technique && (
          <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger ring-1 ring-danger/30 truncate max-w-[120px] sm:max-w-none">
            {attack.technique}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b px-4 py-4 text-xs sm:px-5">
        <Meta label="Time" value={attack.time} mono />
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Risk Score</p>
          {/* Risk percentage with bar */}
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("font-mono text-sm font-bold", riskColor(attack.risk))}>
              {attack.risk}%
            </span>
            <span className={cn("text-[10px] font-medium uppercase", riskColor(attack.risk))}>
              {riskLabel(attack.risk)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn("h-full rounded-full transition-all duration-700", riskBarColor(attack.risk))}
              style={{ width: `${attack.risk}%` }}
            />
          </div>
        </div>
        <Meta label="Source" value={attack.source} mono />
        <Meta label="Target Agent" value={attack.agent} tone="ai" />
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4 sm:p-5">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-danger">
              Before · Raw Ingestion
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-xs leading-relaxed text-foreground/90">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <mark className="rounded bg-danger/30 px-1 text-danger ring-1 ring-danger/50">
                    {payload}
                  </mark>
                )}
              </span>
            ))}
          </pre>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-success" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
              After · Sanitized for Agent
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-success/30 bg-success/5 p-3 font-mono text-xs leading-relaxed text-foreground/90">
            {after}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "danger" | "ai";
}) {
  const toneCls = tone === "danger" ? "text-danger" : tone === "ai" ? "text-ai" : "text-foreground";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`${mono ? "font-mono" : ""} mt-0.5 truncate text-xs font-medium ${toneCls}`}>
        {value}
      </p>
    </div>
  );
}
