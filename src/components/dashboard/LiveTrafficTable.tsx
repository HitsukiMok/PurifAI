import { cn } from "@/lib/utils";
import type { TrafficRow } from "@/lib/mock-traffic";
import { Activity } from "lucide-react";

function riskColor(risk: number) {
  if (risk >= 80) return "text-danger";
  if (risk >= 50) return "text-amber-400";
  return "text-success";
}

export function LiveTrafficTable({
  rows,
  newestId,
  onSelect,
  selectedId,
}: {
  rows: TrafficRow[];
  newestId?: string;
  onSelect: (row: TrafficRow) => void;
  selectedId?: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-ai" />
          <h2 className="text-sm font-semibold tracking-tight">Live Traffic</h2>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Real-time feed · {rows.length}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur">
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Target Agent</th>
              <th className="px-3 py-3 font-medium">Risk</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isNew = r.id === newestId;
              const isSelected = r.id === selectedId;
              const blocked = r.status === "Blocked";
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className={cn(
                    "cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/40",
                    isNew && "row-in",
                    isSelected && "bg-muted/50",
                  )}
                >
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.time}</td>
                  <td className="px-3 py-3 font-mono text-xs text-foreground/90">
                    <span className="block max-w-[220px] truncate">{r.source}</span>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className="text-ai">{r.agent}</span>
                  </td>
                  <td className={cn("px-3 py-3 font-mono text-xs font-semibold", riskColor(r.risk))}>
                    {r.risk}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        blocked
                          ? "bg-danger/15 text-danger ring-1 ring-danger/30"
                          : "bg-success/10 text-success ring-1 ring-success/25",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          blocked ? "bg-danger" : "bg-success",
                        )}
                      />
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
