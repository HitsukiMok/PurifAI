import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "danger" | "ai" | "success";

const toneRing: Record<Tone, string> = {
  neutral: "ring-border",
  danger: "ring-danger/30",
  ai: "ring-ai/30",
  success: "ring-success/30",
};

const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  danger: "text-danger",
  ai: "text-ai",
  success: "text-success",
};

const toneIconBg: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-danger/15 text-danger",
  ai: "bg-ai/15 text-ai",
  success: "bg-success/15 text-success",
};

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "neutral",
  pulseKey,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  tone?: Tone;
  pulseKey?: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 ring-1 transition-shadow",
        toneRing[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p
            key={pulseKey}
            className={cn(
              "font-mono text-3xl font-semibold tabular-nums",
              toneText[tone],
              pulseKey !== undefined && pulseKey > 0 && "metric-pop",
            )}
          >
            {value}
          </p>
          {delta && <p className="text-xs text-muted-foreground">{delta}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneIconBg[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current opacity-[0.04]" />
    </div>
  );
}
