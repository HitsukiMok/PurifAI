import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle, FileText, Mail, Globe, MessageSquare,
  Database, Search, Filter, Check, Shield, X, Trash2
} from "lucide-react";
import { useExtensionData } from "@/contexts/ExtensionContext";
import type { RichLogEntry } from "@/lib/mock-traffic";

export const Route = createFileRoute("/threats")({
  head: () => ({
    meta: [
      { title: "Threats — AgentShield Platform" },
      { name: "description", content: "Detected attack techniques and threat intelligence." },
    ],
  }),
  component: ThreatsPage,
});

// Removed SEED data

const TECHNIQUE_STATS = [
  { name: "System Override", count: 38, pct: 30, color: "bg-danger" },
  { name: "Data Exfiltration", count: 29, pct: 23, color: "bg-orange-500" },
  { name: "Tool Hijack", count: 24, pct: 19, color: "bg-amber-400" },
  { name: "Privilege Escalation", count: 18, pct: 14, color: "bg-ai" },
  { name: "Prompt Leak", count: 14, pct: 11, color: "bg-purple-400" },
  { name: "Indirect Injection", count: 4, pct: 3, color: "bg-success" },
];

function srcIcon(src: string) {
  const s = src || "";
  if (s.startsWith("email")) return <Mail className="h-3.5 w-3.5" />;
  if (s.startsWith("doc")) return <FileText className="h-3.5 w-3.5" />;
  if (s.startsWith("slack")) return <MessageSquare className="h-3.5 w-3.5" />;
  if (s.startsWith("web")) return <Globe className="h-3.5 w-3.5" />;
  if (s.startsWith("ticket")) return <Database className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

const sevStyle: Record<string, string> = {
  Critical: "bg-danger/15 text-danger border-danger/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-400/15 text-amber-400 border-amber-400/30",
};

function getSeverity(risk: number): string {
  if (risk >= 80) return "Critical";
  if (risk >= 50) return "High";
  return "Medium";
}

export function ThreatsPage() {
  const { state: extState } = useExtensionData();
  const recentLogs = extState.recentLogs || [];
  
  // Filter for blocked threats
  const allEvents = recentLogs.filter(log => log.status === "Blocked");

  const [selected, setSelected] = useState<RichLogEntry | null>(allEvents[0] || null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | "All">("All");
  const [toast, setToast] = useState<string | null>(null);

  if (recentLogs.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-ai/10 p-4 ring-1 ring-ai/20">
          <Shield className="h-10 w-10 text-ai" />
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-foreground">Awaiting Telemetry</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Start scanning emails to populate threat intelligence data.
        </p>
      </div>
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const filtered = allEvents.filter((ev) => {
    const q = (search || "").toLowerCase();
    const matchQ = (ev.threatType || "").toLowerCase().includes(q) || (ev.targetAgent || "").toLowerCase().includes(q) || (ev.source || "").toLowerCase().includes(q);
    const matchSev = severityFilter === "All" || getSeverity(ev.risk || 0) === severityFilter;
    return matchQ && matchSev;
  });

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-success/30 bg-card px-4 py-3 text-sm text-success shadow-xl">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Threat Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">Detected attack techniques & adversarial payload analysis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Events", value: allEvents.length, cls: "text-danger ring-danger/25" },
          { label: "Critical", value: allEvents.filter((e) => getSeverity(e.risk || 0) === "Critical").length, cls: "text-orange-400 ring-orange-400/25" },
          { label: "Blocked", value: allEvents.filter((e) => e.status === "Blocked").length, cls: "text-success ring-success/25" },
          { label: "Quarantined", value: allEvents.filter((e) => e.status === "Flagged").length, cls: "text-ai ring-ai/25" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border bg-card p-4 ring-1 ${s.cls.split(" ")[1]}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${s.cls.split(" ")[0]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input id="threat-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search technique, agent, source…"
            className="w-full rounded-lg border border-border/60 bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", "Critical", "High", "Medium"] as const).map((f) => (
            <button key={f} id={`sev-filter-${f.toLowerCase()}`} onClick={() => setSeverityFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${severityFilter === f ? "bg-ai text-ai-foreground" : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Event list */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Attack Events <span className="text-muted-foreground/60">({filtered.length})</span>
          </h2>
          {filtered.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-card py-12 text-center text-sm text-muted-foreground">
              No events match your search.
            </div>
          )}
          <div className="space-y-2">
            {filtered.map((ev) => (
              <div
                key={ev.id}
                className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                  selected && selected.id === ev.id ? "border-danger/40 bg-danger/5 ring-1 ring-danger/25" : "border-border/50 bg-card hover:border-border"
                }`}
                onClick={() => setSelected(ev)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{ev.threatType}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sevStyle[getSeverity(ev.risk || 0)]}`}>{getSeverity(ev.risk || 0)}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${ev.status === "Blocked" ? "border-success/30 text-success bg-success/10" : "border-ai/30 text-ai bg-ai/10"}`}>{ev.status}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {srcIcon(ev.source)}<span className="truncate">{(ev.source || "").split("://")[1] || ev.source || "Unknown Source"}</span><span className="shrink-0">→ {ev.targetAgent || "Unknown Agent"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {ev.timestamp && !isNaN(new Date(ev.timestamp).getTime())
                        ? new Date(ev.timestamp).toLocaleTimeString("en-GB", { hour12: false })
                        : "Unknown Time"}
                    </span>
                    <button
                      id={`dismiss-${ev.id}`}
                      onClick={(e) => { e.stopPropagation(); showToast("Event dismissed."); }}
                      title="Dismiss event"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selected && (
            <>
              <div className="rounded-xl border border-danger/30 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-danger">Payload Inspector</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sevStyle[getSeverity(selected.risk || 0)]}`}>{getSeverity(selected.risk || 0)}</span>
                </div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Technique</p><p className="font-semibold text-foreground mt-0.5">{selected.threatType}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Target Agent</p><p className="text-sm text-foreground mt-0.5">{selected.targetAgent}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Source</p><p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">{srcIcon(selected.source)}{selected.source || "Unknown Source"}</p></div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Injected Payload</p>
                  <pre className="mt-1 rounded-lg bg-muted/60 p-3 text-[11px] text-danger leading-relaxed whitespace-pre-wrap break-all font-mono">{selected.rawText}</pre>
                </div>
                <div className="flex gap-2 pt-1">
                  {selected.status === "Blocked" ? (
                    <button id="quarantine-btn" onClick={() => showToast("Moved to Quarantine")}
                      className="flex-1 rounded-lg border border-ai/30 bg-ai/10 py-1.5 text-xs font-semibold text-ai hover:bg-ai/20">
                      Move to Quarantine
                    </button>
                  ) : (
                    <button id="block-btn" onClick={() => showToast("Marked as Blocked")}
                      className="flex-1 rounded-lg border border-success/30 bg-success/10 py-1.5 text-xs font-semibold text-success hover:bg-success/20">
                      Mark as Blocked
                    </button>
                  )}
                  <button id="dismiss-selected-btn" onClick={() => showToast("Dismissed event")}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-danger hover:border-danger/40">
                    <Trash2 className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Technique Breakdown</h3>
                <div className="space-y-3">
                  {TECHNIQUE_STATS.map((t) => (
                    <div key={t.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{t.name}</span>
                        <span className="text-muted-foreground font-mono">{t.count} · {t.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className={`h-1.5 rounded-full ${t.color}`} style={{ width: `${t.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {!selected && (
            <div className="rounded-xl border border-dashed border-border/50 py-16 text-center text-sm text-muted-foreground">
              Select an event to inspect its payload
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
