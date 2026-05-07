import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, FileText, Mail, Globe, MessageSquare, Database, CheckCircle2, AlertTriangle, Shield, Download, Trash2, Check, X } from "lucide-react";
import { useExtensionData } from "@/contexts/ExtensionContext";
import type { RichLogEntry } from "@/lib/mock-traffic";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — AgentShield Platform" },
      { name: "description", content: "Full ingestion audit trail for all AI agent activity." },
    ],
  }),
  component: LogsPage,
});

type LogStatus = "Clean" | "Blocked" | "Quarantined" | "Flagged";

// Removed SEED data

function srcIcon(src: string) {
  const s = src || "";
  if (s.startsWith("email")) return <Mail className="h-3 w-3" />;
  if (s.startsWith("doc")) return <FileText className="h-3 w-3" />;
  if (s.startsWith("slack")) return <MessageSquare className="h-3 w-3" />;
  if (s.startsWith("web")) return <Globe className="h-3 w-3" />;
  if (s.startsWith("ticket")) return <Database className="h-3 w-3" />;
  return <Globe className="h-3 w-3" />;
}

const statusStyle: Record<LogStatus, string> = {
  Clean: "text-success bg-success/10 border-success/25",
  Blocked: "text-danger bg-danger/10 border-danger/25",
  Quarantined: "text-ai bg-ai/10 border-ai/25",
  Flagged: "text-amber-400 bg-amber-400/10 border-amber-400/25",
};

const riskColor = (r: number) => r >= 85 ? "text-danger" : r >= 60 ? "text-amber-400" : "text-success";
const riskBarColor = (r: number) => r >= 85 ? "bg-danger" : r >= 60 ? "bg-amber-400" : "bg-success";

function LogsPage() {
  const { state: extState } = useExtensionData();
  const logs = extState.recentLogs || [];

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | "All">("All");
  const [selected, setSelected] = useState<RichLogEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-ai/10 p-4 ring-1 ring-ai/20">
          <Database className="h-10 w-10 text-ai" />
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-foreground">Awaiting Telemetry</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Start scanning emails to populate the audit logs.
        </p>
      </div>
    );
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function deleteLog(id: string) {
    // Disable global state deletion for this view, just show toast
    showToast("Log entry removed from view.");
    if (selected?.id === id) setSelected(null);
  }

  function clearAll() {
    showToast(`Cleared visible entries from view.`);
    setSelected(null);
  }

  function exportCSV() {
    const rows = [
      ["Time", "Agent", "Source", "Event", "Status", "Risk"].join(","),
      ...filtered.map((l) => [new Date(l.timestamp).toISOString(), l.targetAgent, l.source, `"${l.rawText}"`, l.status, l.risk || 0].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "agentshield-logs.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported.");
  }

  const filtered = logs.filter((l) => {
    const q = (search || "").toLowerCase();
    const match = (l.targetAgent || "").toLowerCase().includes(q) || (l.source || "").toLowerCase().includes(q) || (l.rawText || "").toLowerCase().includes(q);
    const statusMatch = filterStatus === "All" || l.status === filterStatus;
    return match && statusMatch;
  });

  const counts = {
    Total: logs.length,
    Clean: logs.filter((l) => l.status === "Clean").length,
    Blocked: logs.filter((l) => l.status === "Blocked").length,
    Flagged: logs.filter((l) => l.status === "Flagged" || l.status === "Quarantined").length,
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-success/30 bg-card px-4 py-3 text-sm text-success shadow-xl">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Full ingestion audit trail — every AI agent interaction, timestamped</p>
        </div>
        <div className="flex gap-2">
          <button id="export-csv-btn" onClick={exportCSV}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button id="clear-logs-btn" onClick={clearAll}
            className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Clear Visible
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Events", value: counts.Total, cls: "text-ai ring-ai/25", f: "All" },
          { label: "Clean", value: counts.Clean, cls: "text-success ring-success/25", f: "Clean" },
          { label: "Blocked", value: counts.Blocked, cls: "text-danger ring-danger/25", f: "Blocked" },
          { label: "Flagged / Quarantined", value: counts.Flagged, cls: "text-amber-400 ring-amber-400/25", f: "Flagged" },
        ].map((s) => (
          <button key={s.label} onClick={() => setFilterStatus(s.f as LogStatus | "All")}
            className={`rounded-xl border bg-card p-4 ring-1 text-left transition-all hover:ring-2 ${s.cls.split(" ")[1]} ${filterStatus === s.f ? "ring-2" : ""}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${s.cls.split(" ")[0]}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input id="log-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agent, source, event…"
            className="w-full rounded-lg border border-border/60 bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All", "Clean", "Blocked", "Flagged", "Quarantined"] as const).map((f) => (
            <button key={f} id={`log-filter-${f.toLowerCase()}`} onClick={() => setFilterStatus(f as LogStatus | "All")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filterStatus === f ? "bg-ai text-ai-foreground" : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Agent</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Source</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Event</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Risk</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((log) => (
                  <tr key={log.id}
                    onClick={() => setSelected(selected?.id === log.id ? null : log)}
                    className={`group cursor-pointer transition-colors hover:bg-accent/30 ${selected?.id === log.id ? "bg-ai/5" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                        ? new Date(log.timestamp).toLocaleTimeString("en-GB", { hour12: false })
                        : "Unknown Time"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-3 w-3 text-ai shrink-0" />
                        <span className="text-xs text-foreground whitespace-nowrap">{log.targetAgent}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{srcIcon(log.source)}<span className="truncate max-w-[180px]">{(log.source || "").split("://")[1] || log.source || "Unknown Source"}</span></span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">{log.rawText}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle[log.status] || "text-foreground"}`}>
                        {log.status === "Clean" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1 w-16 rounded-full bg-muted">
                          <div className={`h-1 rounded-full ${riskBarColor(log.risk || 0)}`} style={{ width: `${log.risk || 0}%` }} />
                        </div>
                        <span className={`font-mono text-xs w-7 text-right ${riskColor(log.risk || 0)}`}>{log.risk || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        id={`log-delete-${log.id}`}
                        onClick={(e) => { e.stopPropagation(); deleteLog(log.id); }}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-danger"
                        title="Remove entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No log entries match your search.</div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="rounded-xl border border-ai/25 bg-card p-4 space-y-3 self-start">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-ai">Entry Detail</h3>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {[
              { label: "Time", value: selected.timestamp && !isNaN(new Date(selected.timestamp).getTime()) ? new Date(selected.timestamp).toLocaleTimeString("en-GB", { hour12: false }) : "Unknown Time" },
              { label: "Agent", value: selected.targetAgent },
              { label: "Source", value: selected.source },
              { label: "Event", value: selected.rawText },
              { label: "Status", value: selected.status },
              { label: "Risk Score", value: String(selected.risk || 0) },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{row.label}</p>
                <p className="mt-0.5 text-sm text-foreground break-all">{row.value}</p>
              </div>
            ))}
            <button id="delete-selected-log" onClick={() => deleteLog(selected.id)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-danger/30 py-2 text-xs font-semibold text-danger hover:bg-danger/10">
              <Trash2 className="h-3.5 w-3.5" /> Remove Entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

