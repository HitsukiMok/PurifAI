import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Bot, Shield, AlertTriangle, Clock, MoreHorizontal,
  Search, Filter, Activity, Plus, X, Check, Pencil, Trash2, Flag,
} from "lucide-react";
import { FeedbackActionRow } from "@/components/ui/FeedbackWidget";
import { useExtensionData } from "@/contexts/ExtensionContext";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "AI Agents — AgentShield Platform" },
      { name: "description", content: "Inventory and policy bindings for all protected AI agents." },
    ],
  }),
  component: AgentsPage,
});

type AgentStatus = "Active" | "Idle" | "Suspended";
type RiskLevel = "Low" | "Medium" | "High";

interface Agent {
  id: string;
  name: string;
  type: string;
  workspace: string;
  status: AgentStatus;
  risk: RiskLevel;
  scanned: number;
  blocked: number;
  policy: string;
  lastSeen: string;
  version: string;
}

const POLICIES = ["Strict-Finance", "Standard-CX", "Strict-HR", "Permissive-Research", "Standard-Email", "Lockdown", "Standard-Eng"];
const TYPES = ["Financial Automation", "Customer Support", "HR Automation", "Web Research", "Email Processing", "Sales Automation", "Document Analysis", "Integration"];
const WORKSPACES = ["Finance Ops", "CX Platform", "People Ops", "Strategy", "Executive", "Revenue", "Legal", "Engineering"];

// SEED removed — agents are derived dynamically from recentLogs


const statusStyle: Record<AgentStatus, string> = {
  Active: "bg-success/15 text-success border-success/30",
  Idle: "bg-muted text-muted-foreground border-border/60",
  Suspended: "bg-danger/15 text-danger border-danger/30",
};
const riskStyle: Record<RiskLevel, string> = { Low: "text-success", Medium: "text-amber-400", High: "text-danger" };
const riskBar: Record<RiskLevel, string> = { Low: "bg-success w-1/4", Medium: "bg-amber-400 w-1/2", High: "bg-danger w-3/4" };

const BLANK: Omit<Agent, "id" | "scanned" | "blocked" | "lastSeen"> = {
  name: "", type: TYPES[0], workspace: WORKSPACES[0],
  status: "Active", risk: "Low", policy: POLICIES[0], version: "1.0.0",
};

// ── Modal ────────────────────────────────────────────────────────────────────
function AgentModal({
  agent, onClose, onSave,
}: {
  agent: Partial<Agent> | null;
  onClose: () => void;
  onSave: (a: Omit<Agent, "id" | "scanned" | "blocked" | "lastSeen">) => void;
}) {
  const [form, setForm] = useState<Omit<Agent, "id" | "scanned" | "blocked" | "lastSeen">>(
    agent
      ? { name: agent.name!, type: agent.type!, workspace: agent.workspace!, status: agent.status!, risk: agent.risk!, policy: agent.policy!, version: agent.version! }
      : { ...BLANK },
  );

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isEdit = !!agent?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <h2 className="font-semibold text-foreground">{isEdit ? "Edit Agent" : "Register New Agent"}</h2>
          <button id="modal-close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {([
            { label: "Agent Name", key: "name", type: "text", placeholder: "e.g. FinanceBot v3" },
            { label: "Version", key: "version", type: "text", placeholder: "e.g. 1.0.0" },
          ] as const).map((f) => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{f.label}</label>
              <input
                id={`agent-field-${f.key}`}
                value={form[f.key]}
                onChange={(e) => field(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40"
              />
            </div>
          ))}
          {([
            { label: "Type", key: "type", options: TYPES },
            { label: "Workspace", key: "workspace", options: WORKSPACES },
            { label: "Policy", key: "policy", options: POLICIES },
            { label: "Status", key: "status", options: ["Active", "Idle", "Suspended"] },
            { label: "Risk", key: "risk", options: ["Low", "Medium", "High"] },
          ] as const).map((f) => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{f.label}</label>
              <select
                id={`agent-field-${f.key}`}
                value={form[f.key]}
                onChange={(e) => field(f.key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ai/40"
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 border-t border-border/40 px-5 py-4">
          <button id="modal-cancel" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            id="modal-save"
            onClick={() => { if (form.name.trim()) onSave(form); }}
            className="flex items-center gap-2 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-ai-foreground hover:bg-ai/90 disabled:opacity-50"
            disabled={!form.name.trim()}
          >
            <Check className="h-4 w-4" />
            {isEdit ? "Save Changes" : "Register Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────
function AgentMenu({ agent, onEdit, onDelete, onStatusChange, onClose, onReportAI }: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: AgentStatus) => void;
  onClose: () => void;
  onReportAI: () => void;
}) {
  return (
    <div className="absolute right-0 top-8 z-40 w-52 rounded-xl border border-border/60 bg-card shadow-xl py-1" onClick={(e) => e.stopPropagation()}>
      <button id={`menu-edit-${agent.id}`} onClick={() => { onEdit(); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent">
        <Pencil className="h-3.5 w-3.5 text-ai" /> Edit Agent
      </button>
      <button id={`menu-report-ai-${agent.id}`} onClick={() => { onReportAI(); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-amber-400 hover:bg-amber-400/10">
        <Flag className="h-3.5 w-3.5" /> Report AI Output
      </button>
      {(["Active", "Idle", "Suspended"] as AgentStatus[]).filter((s) => s !== agent.status).map((s) => (
        <button key={s} id={`menu-status-${s}-${agent.id}`} onClick={() => { onStatusChange(s); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent">
          {s === "Active" ? <Activity className="h-3.5 w-3.5 text-success" /> : s === "Idle" ? <Clock className="h-3.5 w-3.5 text-muted-foreground" /> : <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
          Set {s}
        </button>
      ))}
      <div className="my-1 border-t border-border/40" />
      <button id={`menu-delete-${agent.id}`} onClick={() => { onDelete(); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10">
        <Trash2 className="h-3.5 w-3.5" /> Remove Agent
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function AgentsPage() {
  const [manualAgents, setManualAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentStatus | "All">("All");
  const [modal, setModal] = useState<{ open: boolean; agent: Agent | null }>({ open: false, agent: null });
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<Agent | null>(null);

  const { state: extState } = useExtensionData();
  const recentLogs = extState.recentLogs || [];

  // Dynamically derive agents from unique targetAgent names in recentLogs
  const derivedAgents = useMemo<Agent[]>(() => {
    const agentMap = new Map<string, Agent>();
    for (const log of recentLogs) {
      const name = log.targetAgent || "Unknown Agent";
      if (!agentMap.has(name)) {
        agentMap.set(name, {
          id: `ag-${name.replace(/\s+/g, "-").toLowerCase()}`,
          name,
          type: "Email Processing",
          workspace: "General",
          status: "Active",
          risk: "Low",
          scanned: 0,
          blocked: 0,
          policy: "Standard-Email",
          lastSeen: "just now",
          version: "1.0.0",
        });
      }
      const entry = agentMap.get(name)!;
      entry.scanned += 1;
      if (log.status === "Blocked") {
        entry.blocked += 1;
        entry.risk = entry.blocked > 5 ? "High" : entry.blocked > 2 ? "Medium" : "Low";
      }
      if (log.timestamp) {
        entry.lastSeen = new Date(log.timestamp).toLocaleTimeString("en-GB", { hour12: false });
      }
    }
    return Array.from(agentMap.values());
  }, [recentLogs]);

  // Merge derived agents with any manually added/edited ones
  const baseAgents = useMemo<Agent[]>(() => {
    const manualNames = new Set(manualAgents.map((a) => a.name));
    const derived = derivedAgents.filter((a) => !manualNames.has(a.name));
    return [...manualAgents, ...derived];
  }, [derivedAgents, manualAgents]);

  if (recentLogs.length === 0 && manualAgents.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-ai/10 p-4 ring-1 ring-ai/20">
          <Bot className="h-10 w-10 text-ai" />
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-foreground">Awaiting Telemetry</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Start scanning emails to discover and monitor AI agents.
        </p>
      </div>
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const filtered = baseAgents.filter((a) => {
    const q = (search || "").toLowerCase();
    return ((a.name || "").toLowerCase().includes(q) || (a.workspace || "").toLowerCase().includes(q)) &&
      (filter === "All" || a.status === filter);
  });

  function saveAgent(form: Omit<Agent, "id" | "scanned" | "blocked" | "lastSeen">) {
    if (modal.agent) {
      setManualAgents((prev) => prev.map((a) => a.id === modal.agent!.id ? { ...a, ...form } : a));
      showToast(`"${form.name}" updated.`);
    } else {
      const newAgent: Agent = { ...form, id: `ag-${Date.now()}`, scanned: 0, blocked: 0, lastSeen: "just now" };
      setManualAgents((prev) => [newAgent, ...prev]);
      showToast(`"${form.name}" registered.`);
    }
    setModal({ open: false, agent: null });
  }

  function deleteAgent(id: string) {
    const name = baseAgents.find((a) => a.id === id)?.name;
    setManualAgents((prev) => prev.filter((a) => a.id !== id));
    showToast(`"${name}" removed.`);
  }

  function changeStatus(id: string, status: AgentStatus) {
    setManualAgents((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    showToast(`Status updated to ${status}.`);
  }

  const totScanned = extState.totalScans || 0;
  const totBlocked = extState.threatsBlocked || 0;
  const active = baseAgents.filter((a) => a.status === "Active").length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6" onClick={() => setOpenMenu(null)}>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-success/30 bg-card px-4 py-3 text-sm text-success shadow-xl">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <AgentModal agent={modal.agent} onClose={() => setModal({ open: false, agent: null })} onSave={saveAgent} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inventory & policy bindings for all protected agents</p>
        </div>
        <button
          id="add-agent-btn"
          onClick={() => setModal({ open: true, agent: null })}
          className="flex items-center gap-2 rounded-lg border border-ai/35 bg-ai/10 px-4 py-2 text-sm font-semibold text-ai transition-all hover:bg-ai/20"
        >
          <Plus className="h-4 w-4" /> Add Agent
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Agents", value: baseAgents.length, cls: "text-ai ring-ai/25" },
          { label: "Active Now", value: active, cls: "text-success ring-success/25" },
          { label: "Total Scanned", value: totScanned.toLocaleString(), cls: "text-ai ring-ai/25" },
          { label: "Total Blocked", value: totBlocked, cls: "text-danger ring-danger/25" },
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
          <input id="agent-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents or workspaces…"
            className="w-full rounded-lg border border-border/60 bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", "Active", "Idle", "Suspended"] as const).map((f) => (
            <button key={f} id={`filter-${f.toLowerCase()}`} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filter === f ? "bg-ai text-ai-foreground shadow" : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Workspace</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Risk</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Scanned</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Blocked</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden xl:table-cell">Policy</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Last Seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((agent) => (
                <tr key={agent.id} className="group transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ai/10 text-ai ring-1 ring-ai/20"><Bot className="h-4 w-4" /></div>
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground">{agent.type} · v{agent.version}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-muted-foreground">{agent.workspace}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[agent.status]}`}>
                      {agent.status === "Active" && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />}
                      {agent.status === "Idle" && <Clock className="h-3 w-3" />}
                      {agent.status === "Suspended" && <AlertTriangle className="h-3 w-3" />}
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="space-y-1">
                      <span className={`text-xs font-semibold ${riskStyle[agent.risk]}`}>{agent.risk}</span>
                      <div className="h-1 w-16 rounded-full bg-muted"><div className={`h-1 rounded-full ${riskBar[agent.risk]}`} /></div>
                    </div>
                    <FeedbackActionRow
                      ctx={{
                        responseId: agent.id,
                        surface: "agents_table",
                        input: `Agent: ${agent.name}, Type: ${agent.type}, Policy: ${agent.policy}`,
                        output: `Risk assessment: ${agent.risk} — ${agent.blocked} blocked out of ${agent.scanned} scanned`,
                      }}
                      onSubmitted={() => showToast("✓ Report submitted — thank you!")}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right hidden lg:table-cell font-mono text-muted-foreground">{agent.scanned.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right hidden lg:table-cell font-mono font-semibold text-danger">{agent.blocked}</td>
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{agent.policy}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-xs text-muted-foreground">{agent.lastSeen}</td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="relative inline-block">
                      <button
                        id={`agent-menu-${agent.id}`}
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === agent.id ? null : agent.id); }}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === agent.id && (
                        <AgentMenu
                          agent={agent}
                          onEdit={() => setModal({ open: true, agent })}
                          onDelete={() => deleteAgent(agent.id)}
                          onStatusChange={(s) => changeStatus(agent.id, s)}
                          onClose={() => setOpenMenu(null)}
                          onReportAI={() => setFeedbackTarget(agent)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {baseAgents.length === 0 ? 'No agents registered yet. Click "Add Agent" to get started.' : "No agents match your search."}
          </div>
        )}
      </div>

      {/* FeedbackWidget opened via context menu — renders its own modal */}
      {feedbackTarget && (
        <FeedbackActionRow
          ctx={{
            responseId: feedbackTarget.id,
            surface: "agents_table_menu",
            input: `Agent: ${feedbackTarget.name}, Type: ${feedbackTarget.type}, Policy: ${feedbackTarget.policy}`,
            output: `Risk assessment: ${feedbackTarget.risk} — ${feedbackTarget.blocked} blocked out of ${feedbackTarget.scanned} scanned`,
          }}
          onSubmitted={() => {
            showToast("✓ Report submitted — thank you!");
            setFeedbackTarget(null);
          }}
          _openModalImmediately
          _onModalClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
