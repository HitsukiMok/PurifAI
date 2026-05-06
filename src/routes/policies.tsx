import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield, Unlock, CheckCircle2, AlertTriangle, Plus, ToggleLeft, ToggleRight,
  Trash2, Pencil, Check, X,
} from "lucide-react";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies — AgentShield Platform" },
      { name: "description", content: "Sanitization and blocking rules for AI agent protection." },
    ],
  }),
  component: PoliciesPage,
});

type Severity = "Strict" | "Standard" | "Permissive" | "Lockdown";

interface Policy {
  id: string;
  name: string;
  description: string;
  scope: string[];
  rules: number;
  active: boolean;
  severity: Severity;
  lastModified: string;
}

const AGENTS_LIST = ["FinanceBot v2", "SupportAgent v4", "HR-Copilot", "ResearchScout", "InboxTriage", "DealDeskAI", "DocuParser Pro", "DataSync Agent"];

const SEED: Policy[] = [
  { id: "p-001", name: "Strict-Finance", description: "Zero-tolerance for any financial data manipulation or exfiltration instructions. Blocks overrides, PO approvals, and fund transfers.", scope: ["FinanceBot v2", "DealDeskAI"], rules: 14, active: true, severity: "Strict", lastModified: "2h ago" },
  { id: "p-002", name: "Standard-CX", description: "Balanced policy for customer-facing agents. Blocks privilege escalation and prompt leaks while allowing normal support workflows.", scope: ["SupportAgent v4"], rules: 9, active: true, severity: "Standard", lastModified: "1d ago" },
  { id: "p-003", name: "Strict-HR", description: "Protects PII and salary data. Blocks any instruction to reveal personnel records or system prompts.", scope: ["HR-Copilot"], rules: 11, active: true, severity: "Strict", lastModified: "3d ago" },
  { id: "p-004", name: "Permissive-Research", description: "Relaxed policy for research agents. Flags suspicious patterns but allows broader web and document access.", scope: ["ResearchScout"], rules: 5, active: true, severity: "Permissive", lastModified: "5d ago" },
  { id: "p-005", name: "Standard-Email", description: "Standard email ingestion rules. Blocks forwarding overrides, credential harvesting, and system prompt injection via email.", scope: ["InboxTriage"], rules: 8, active: true, severity: "Standard", lastModified: "1d ago" },
  { id: "p-006", name: "Lockdown", description: "Maximum security. All tool calls require human review. Applied to suspended agents pending investigation.", scope: ["DocuParser Pro"], rules: 22, active: false, severity: "Lockdown", lastModified: "6h ago" },
  { id: "p-007", name: "Standard-Eng", description: "Engineering workspace policy. Allows broad integration access with anomaly detection for lateral movement.", scope: ["DataSync Agent"], rules: 7, active: true, severity: "Standard", lastModified: "2d ago" },
];

const DEFAULT_RULES = [
  { name: "Block system-prompt overrides", category: "Injection", active: true },
  { name: "Block data exfiltration via email forwarding", category: "Exfiltration", active: true },
  { name: "Block unauthorized tool calls (transfer_funds, send_email)", category: "Tool Hijack", active: true },
  { name: "Quarantine suspected prompt-leak instructions", category: "Prompt Leak", active: true },
  { name: "Flag indirect injection via HTML/markdown comments", category: "Indirect Injection", active: true },
  { name: "Block privilege escalation (approve, sign, authorize)", category: "Escalation", active: true },
  { name: "Sanitize base64-encoded payloads", category: "Evasion", active: false },
  { name: "Rate-limit high-risk source ingestion (>3 blocked/min)", category: "Rate Limit", active: true },
];

const sevStyle: Record<Severity, string> = {
  Strict: "bg-danger/15 text-danger border-danger/30",
  Standard: "bg-ai/15 text-ai border-ai/30",
  Permissive: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  Lockdown: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

// ── Policy Modal ─────────────────────────────────────────────────────────────
function PolicyModal({ policy, onClose, onSave }: {
  policy: Policy | null;
  onClose: () => void;
  onSave: (p: Omit<Policy, "id" | "rules" | "lastModified">) => void;
}) {
  const [form, setForm] = useState({
    name: policy?.name ?? "",
    description: policy?.description ?? "",
    severity: policy?.severity ?? "Standard" as Severity,
    active: policy?.active ?? true,
    scope: policy?.scope ?? [] as string[],
  });

  function toggleAgent(agent: string) {
    setForm((f) => ({
      ...f,
      scope: f.scope.includes(agent) ? f.scope.filter((a) => a !== agent) : [...f.scope, agent],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4 sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{policy ? "Edit Policy" : "New Policy"}</h2>
          <button id="policy-modal-close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Policy Name</label>
            <input id="policy-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Strict-Legal"
              className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</label>
            <textarea id="policy-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe what this policy protects against…" rows={3}
              className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40 resize-none" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Severity</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["Strict", "Standard", "Permissive", "Lockdown"] as Severity[]).map((s) => (
                <button key={s} id={`sev-${s}`} onClick={() => setForm((f) => ({ ...f, severity: s }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${form.severity === s ? sevStyle[s] : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bind to Agents</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AGENTS_LIST.map((a) => (
                <button key={a} id={`bind-${a.replace(/\s/g, "-")}`} onClick={() => toggleAgent(a)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${form.scope.includes(a) ? "border-ai/40 bg-ai/15 text-ai" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
                  {form.scope.includes(a) && <span className="mr-1">✓</span>}{a}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-3">
            <span className="text-sm text-foreground">Active</span>
            <button id="policy-active-toggle" onClick={() => setForm((f) => ({ ...f, active: !f.active }))}>
              {form.active ? <ToggleRight className="h-5 w-5 text-ai" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border/40 px-5 py-4 sticky bottom-0 bg-card">
          <button id="policy-cancel" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button id="policy-save" onClick={() => { if (form.name.trim()) onSave(form); }}
            disabled={!form.name.trim()}
            className="flex items-center gap-2 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-ai-foreground hover:bg-ai/90 disabled:opacity-50">
            <Check className="h-4 w-4" />{policy ? "Save Changes" : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>(SEED);
  const [selected, setSelected] = useState<Policy>(SEED[0]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [modal, setModal] = useState<{ open: boolean; policy: Policy | null }>({ open: false, policy: null });
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function togglePolicy(id: string) {
    setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));
    setSelected((prev) => prev.id === id ? { ...prev, active: !prev.active } : prev);
    showToast("Policy status updated.");
  }

  function toggleRule(idx: number) {
    setRules((prev) => prev.map((r, i) => i === idx ? { ...r, active: !r.active } : r));
    showToast("Rule updated.");
  }

  function deletePolicy(id: string) {
    const name = policies.find((p) => p.id === id)?.name;
    const remaining = policies.filter((p) => p.id !== id);
    setPolicies(remaining);
    if (selected.id === id && remaining.length > 0) setSelected(remaining[0]);
    showToast(`"${name}" deleted.`);
  }

  function savePolicy(form: Omit<Policy, "id" | "rules" | "lastModified">) {
    if (modal.policy) {
      const updated: Policy = { ...modal.policy, ...form, lastModified: "just now" };
      setPolicies((prev) => prev.map((p) => p.id === modal.policy!.id ? updated : p));
      setSelected(updated);
      showToast(`"${form.name}" updated.`);
    } else {
      const newPolicy: Policy = { ...form, id: `p-${Date.now()}`, rules: 5, lastModified: "just now" };
      setPolicies((prev) => [newPolicy, ...prev]);
      setSelected(newPolicy);
      showToast(`"${form.name}" created.`);
    }
    setModal({ open: false, policy: null });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-success/30 bg-card px-4 py-3 text-sm text-success shadow-xl">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      {modal.open && (
        <PolicyModal policy={modal.policy} onClose={() => setModal({ open: false, policy: null })} onSave={savePolicy} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Policies</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sanitization & blocking rules for all protected agents</p>
        </div>
        <button id="new-policy-btn" onClick={() => setModal({ open: true, policy: null })}
          className="flex items-center gap-2 rounded-lg border border-ai/35 bg-ai/10 px-4 py-2 text-sm font-semibold text-ai hover:bg-ai/20">
          <Plus className="h-4 w-4" /> New Policy
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Policies", value: policies.length, cls: "text-ai ring-ai/25" },
          { label: "Active", value: policies.filter((p) => p.active).length, cls: "text-success ring-success/25" },
          { label: "Strict / Lockdown", value: policies.filter((p) => p.severity === "Strict" || p.severity === "Lockdown").length, cls: "text-danger ring-danger/25" },
          { label: "Total Rules", value: policies.reduce((s, p) => s + p.rules, 0), cls: "text-amber-400 ring-amber-400/25" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border bg-card p-4 ring-1 ${s.cls.split(" ")[1]}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${s.cls.split(" ")[0]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Policy list */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Policy Library</h2>
          <div className="space-y-2">
            {policies.map((policy) => (
              <div key={policy.id}
                onClick={() => setSelected(policy)}
                className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${selected.id === policy.id ? "border-ai/40 bg-ai/5 ring-1 ring-ai/20" : "border-border/50 bg-card hover:border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${policy.active ? "bg-ai/10 text-ai" : "bg-muted text-muted-foreground"}`}>
                      {policy.active ? <Shield className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm font-mono">{policy.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sevStyle[policy.severity]}`}>{policy.severity}</span>
                        {!policy.active && <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">Inactive</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{policy.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {policy.scope.map((s) => <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{s}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button id={`edit-policy-${policy.id}`}
                      onClick={(e) => { e.stopPropagation(); setModal({ open: true, policy }); }}
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button id={`delete-policy-${policy.id}`}
                      onClick={(e) => { e.stopPropagation(); deletePolicy(policy.id); }}
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button id={`toggle-policy-${policy.id}`}
                      onClick={(e) => { e.stopPropagation(); togglePolicy(policy.id); }}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      {policy.active ? <ToggleRight className="h-5 w-5 text-ai" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail + rules */}
        <div className="space-y-4">
          <div className="rounded-xl border border-ai/25 bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-ai">Policy Detail</h3>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sevStyle[selected.severity]}`}>{selected.severity}</span>
                <button id="edit-selected-policy" onClick={() => setModal({ open: true, policy: selected })}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div>
              <p className="font-mono font-bold text-foreground">{selected.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Bound Agents</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.scope.length > 0
                  ? selected.scope.map((s) => <span key={s} className="rounded-lg border border-ai/25 bg-ai/10 px-2.5 py-1 text-[11px] font-semibold text-ai">{s}</span>)
                  : <span className="text-xs text-muted-foreground">No agents bound</span>}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selected.rules} active rules</span>
              <span>Modified {selected.lastModified}</span>
            </div>
            <button id="toggle-selected-policy" onClick={() => togglePolicy(selected.id)}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-all ${
                selected.active
                  ? "border-muted-foreground/30 text-muted-foreground hover:border-danger/40 hover:text-danger"
                  : "border-success/30 bg-success/10 text-success hover:bg-success/20"
              }`}>
              {selected.active ? <><ToggleLeft className="h-4 w-4" /> Disable Policy</> : <><ToggleRight className="h-4 w-4" /> Enable Policy</>}
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Detection Rules</h3>
            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{rule.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rule.category}</p>
                  </div>
                  <button id={`rule-toggle-${idx}`} onClick={() => toggleRule(idx)}
                    className={`shrink-0 transition-all ${rule.active ? "text-success hover:text-muted-foreground" : "text-muted-foreground hover:text-success"}`}>
                    {rule.active ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
