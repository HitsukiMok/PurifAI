import { cn } from "@/lib/utils";
import type { TrafficRow } from "@/lib/mock-traffic";
import { Activity } from "lucide-react";

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
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-4">
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
              <th className="px-4 py-3 font-medium sm:px-5">Time</th>
              {/* Hide source on very small screens */}
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Source</th>
              <th className="px-3 py-3 font-medium">Agent</th>
              <th className="px-3 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium sm:px-5">Status</th>
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
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground sm:px-5 sm:py-3 whitespace-nowrap">
                    {r.time}
                  </td>
                  {/* Hide source on very small screens */}
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-foreground/90 sm:table-cell sm:py-3">
                    <span className="block max-w-[160px] truncate lg:max-w-[220px]">{r.source}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs sm:py-3">
                    <span className="text-ai truncate block max-w-[90px] sm:max-w-none">{r.agent}</span>
                  </td>
                  <td className={cn("px-3 py-2.5 sm:py-3")}>
                    <div className="flex flex-col gap-1 min-w-[56px]">
                      <span className={cn("font-mono text-xs font-semibold", riskColor(r.risk))}>
                        {r.risk}%
                      </span>
                      {/* Mini progress bar */}
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", riskBarColor(r.risk))}
                          style={{ width: `${r.risk}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 sm:px-5 sm:py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:gap-1.5 sm:px-2.5",
                        blocked
                          ? "bg-danger/15 text-danger ring-1 ring-danger/30"
                          : "bg-success/10 text-success ring-1 ring-success/25",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          blocked ? "bg-danger" : "bg-success",
                        )}
                      />
                      <span className="hidden sm:inline">{r.status}</span>
                      <span className="sm:hidden">{blocked ? "Block" : "OK"}</span>
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
