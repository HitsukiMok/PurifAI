import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Settings, Bell, Globe, Lock, Users, ChevronRight,
  Mail, Check, Trash2, Plus, Eye, EyeOff, Copy,
  MessageSquare, Database, Link2,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AgentShield Platform" },
      { name: "description", content: "Workspace configuration and security settings." },
    ],
  }),
  component: SettingsPage,
});

type Tab = "workspace" | "notifications" | "integrations" | "security" | "team";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "workspace", label: "Workspace", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Globe },
  { id: "security", label: "Security", icon: Lock },
  { id: "team", label: "Team", icon: Users },
];

type TeamRole = "Owner" | "Admin" | "Analyst" | "Viewer";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar: string;
  online: boolean;
}

interface Integration {
  id: string;
  name: string;
  icon: React.ElementType;
  connected: boolean;
  desc: string;
  configValue: string;
}

const SEED_TEAM: TeamMember[] = [
  { id: "u-1", name: "Helena Vasquez", email: "helena@agentshield.io", role: "Owner", avatar: "HV", online: true },
  { id: "u-2", name: "Marcus Chen", email: "marcus@agentshield.io", role: "Admin", avatar: "MC", online: true },
  { id: "u-3", name: "Priya Patel", email: "priya@agentshield.io", role: "Analyst", avatar: "PP", online: false },
  { id: "u-4", name: "Tyler Brooks", email: "tyler@agentshield.io", role: "Viewer", avatar: "TB", online: false },
];

const SEED_INTEGRATIONS: Integration[] = [
  { id: "i-slack", name: "Slack Alerts", icon: MessageSquare, connected: true, desc: "Receive threat alerts in #security-alerts", configValue: "#security-alerts" },
  { id: "i-email", name: "Email Digest", icon: Mail, connected: true, desc: "Daily summary sent to workspace admins", configValue: "security@agentshield.io" },
  { id: "i-webhook", name: "Webhook", icon: Link2, connected: false, desc: "POST events to your SIEM or custom endpoint", configValue: "" },
  { id: "i-jira", name: "JIRA", icon: Database, connected: false, desc: "Auto-create tickets for Critical events", configValue: "" },
];

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: () => void; id: string }) {
  return (
    <button id={id} onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-ai" : "bg-muted"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

const roleStyle: Record<TeamRole, string> = {
  Owner: "border-ai/30 bg-ai/10 text-ai",
  Admin: "border-success/30 bg-success/10 text-success",
  Analyst: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  Viewer: "border-border/60 text-muted-foreground",
};

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [toast, setToast] = useState<string | null>(null);

  // Workspace
  const [workspaceName, setWorkspaceName] = useState("Acme Corp — Security");
  const [timezone, setTimezone] = useState("UTC+8 Asia/Singapore");
  const [wsUnsaved, setWsUnsaved] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState({ critical: true, high: true, daily: true, weekly: false });

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>(SEED_INTEGRATIONS);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [integrationInput, setIntegrationInput] = useState("");

  // Security
  const [twofa, setTwofa] = useState(true);
  const [sso, setSso] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const API_KEY = "sk-shield-a8f3c2e91b4d7f0e2a5c8b1d4e7f0a3c";

  // Team
  const [team, setTeam] = useState<TeamMember[]>(SEED_TEAM);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Viewer");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function saveWorkspace() {
    setWsUnsaved(false);
    showToast("Workspace settings saved.");
  }

  function toggleIntegration(id: string) {
    const ig = integrations.find((i) => i.id === id);
    if (!ig) return;
    if (!ig.connected && !ig.configValue) {
      setEditingIntegration(id);
      setIntegrationInput("");
      return;
    }
    setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, connected: !i.connected } : i));
    showToast(ig.connected ? `${ig.name} disconnected.` : `${ig.name} connected.`);
  }

  function connectWithConfig(id: string) {
    if (!integrationInput.trim()) return;
    setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, connected: true, configValue: integrationInput } : i));
    setEditingIntegration(null);
    showToast("Integration connected.");
  }

  function copyApiKey() {
    navigator.clipboard.writeText(API_KEY).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("API key copied.");
  }

  function inviteMember() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return;
    const initials = inviteEmail.split("@")[0].slice(0, 2).toUpperCase();
    const newMember: TeamMember = {
      id: `u-${Date.now()}`, name: inviteEmail.split("@")[0], email: inviteEmail,
      role: inviteRole, avatar: initials, online: false,
    };
    setTeam((prev) => [...prev, newMember]);
    setInviteEmail("");
    showToast(`Invite sent to ${inviteEmail}.`);
  }

  function changeRole(id: string, role: TeamRole) {
    setTeam((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
    showToast("Role updated.");
  }

  function removeMember(id: string) {
    setTeam((prev) => prev.filter((m) => m.id !== id));
    showToast("Member removed.");
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 md:p-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-success/30 bg-card px-4 py-3 text-sm text-success shadow-xl">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Workspace configuration, integrations & access control</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button key={t.id} id={`settings-tab-${t.id}`} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${tab === t.id ? "bg-ai/10 text-ai" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
              {tab === t.id && <ChevronRight className="ml-auto h-3 w-3" />}
            </button>
          ))}
        </nav>

        <div className="space-y-4">

          {/* ── Workspace ── */}
          {tab === "workspace" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">General</h2>
                <div>
                  <label htmlFor="ws-name" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace Name</label>
                  <input id="ws-name" value={workspaceName}
                    onChange={(e) => { setWorkspaceName(e.target.value); setWsUnsaved(true); }}
                    className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Plan</label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-ai/15 px-3 py-1 text-xs font-semibold text-ai">Enterprise</span>
                    <span className="text-xs text-muted-foreground">Renews Jan 1, 2027</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="ws-timezone" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timezone</label>
                  <select id="ws-timezone" value={timezone}
                    onChange={(e) => { setTimezone(e.target.value); setWsUnsaved(true); }}
                    className="mt-1 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ai/40">
                    {["UTC+8 Asia/Singapore", "UTC+0 Europe/London", "UTC-5 America/New_York", "UTC-8 America/Los_Angeles"].map((tz) => (
                      <option key={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                {wsUnsaved && (
                  <button id="save-workspace-btn" onClick={saveWorkspace}
                    className="flex items-center gap-2 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-ai-foreground hover:bg-ai/90">
                    <Check className="h-4 w-4" /> Save Changes
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Workspace Stats</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Protected Agents", value: "8" }, { label: "Active Policies", value: "6" },
                    { label: "Events This Month", value: "48,217" }, { label: "Threats Blocked", value: "127" },
                    { label: "Team Members", value: "4" }, { label: "API Calls", value: "2.1M" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-foreground">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Alert Preferences</h2>
              {[
                { key: "critical" as const, label: "Critical Threats", desc: "Immediate alert for Critical severity detections" },
                { key: "high" as const, label: "High Severity Events", desc: "Alert for High severity detections" },
                { key: "daily" as const, label: "Daily Digest", desc: "Summary email every day at 08:00 workspace time" },
                { key: "weekly" as const, label: "Weekly Report", desc: "Comprehensive weekly threat review on Mondays" },
              ].map((n) => (
                <div key={n.key} className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Toggle id={`notif-${n.key}`} checked={notifs[n.key]}
                    onChange={() => { setNotifs((p) => ({ ...p, [n.key]: !p[n.key] })); showToast("Preference saved."); }} />
                </div>
              ))}
            </div>
          )}

          {/* ── Integrations ── */}
          {tab === "integrations" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Connected Integrations</h2>
              {integrations.map((ig) => (
                <div key={ig.id} className={`rounded-xl border bg-card p-4 transition-all ${ig.connected ? "border-success/25" : "border-border/60"}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ig.connected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        <ig.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{ig.name}</p>
                        <p className="text-xs text-muted-foreground">{ig.configValue || ig.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ig.connected && <Check className="h-4 w-4 text-success" />}
                      <button id={`integration-${ig.id}`} onClick={() => toggleIntegration(ig.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          ig.connected
                            ? "border border-border/60 text-muted-foreground hover:text-danger hover:border-danger/40"
                            : "bg-ai/10 text-ai border border-ai/30 hover:bg-ai/20"
                        }`}>
                        {ig.connected ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  </div>
                  {editingIntegration === ig.id && (
                    <div className="mt-3 flex gap-2">
                      <input id={`integration-config-${ig.id}`} value={integrationInput}
                        onChange={(e) => setIntegrationInput(e.target.value)}
                        placeholder={ig.id === "i-slack" ? "#channel-name" : ig.id === "i-webhook" ? "https://your-endpoint.com/hook" : "Project key or URL"}
                        className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
                      <button id={`integration-confirm-${ig.id}`} onClick={() => connectWithConfig(ig.id)}
                        className="rounded-lg bg-ai px-3 py-2 text-xs font-semibold text-ai-foreground hover:bg-ai/90">Connect</button>
                      <button onClick={() => setEditingIntegration(null)}
                        className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Authentication</h2>
                {[
                  { id: "twofa", label: "Two-Factor Authentication", desc: "Required for all admin actions", checked: twofa, onChange: () => { setTwofa((v) => !v); showToast("2FA setting updated."); } },
                  { id: "sso", label: "SSO / SAML", desc: "Okta or Azure AD single sign-on", checked: sso, onChange: () => { setSso((v) => !v); showToast("SSO setting updated."); } },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Toggle id={`${item.id}-toggle`} checked={item.checked} onChange={item.onChange} />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">API Key</h2>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground overflow-hidden">
                    {apiKeyVisible ? API_KEY : "sk-shield-•••••••••••••••••••••••••••••••"}
                  </code>
                  <button id="api-key-toggle" onClick={() => setApiKeyVisible((v) => !v)}
                    className="shrink-0 rounded-lg border border-border/60 bg-card p-2 text-muted-foreground hover:text-foreground">
                    {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button id="api-key-copy" onClick={copyApiKey}
                    className={`shrink-0 rounded-lg border p-2 transition-colors ${copied ? "border-success/30 text-success" : "border-border/60 bg-card text-muted-foreground hover:text-foreground"}`}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">This key grants full API access. Keep it secret — never share or commit it.</p>
              </div>
            </div>
          )}

          {/* ── Team ── */}
          {tab === "team" && (
            <div className="space-y-4">
              {/* Invite form */}
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Invite Team Member</h2>
                <div className="flex flex-wrap gap-2">
                  <input id="invite-email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com" type="email"
                    className="flex-1 min-w-[180px] rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40" />
                  <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                    className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ai/40">
                    {(["Viewer", "Analyst", "Admin"] as TeamRole[]).map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <button id="send-invite-btn" onClick={inviteMember} disabled={!inviteEmail.includes("@")}
                    className="flex items-center gap-2 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-ai-foreground hover:bg-ai/90 disabled:opacity-50">
                    <Plus className="h-4 w-4" /> Send Invite
                  </button>
                </div>
              </div>

              {/* Member list */}
              <div className="space-y-2">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ai/20 text-xs font-bold text-ai">
                        {member.avatar}
                        {member.online && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role !== "Owner" ? (
                        <select
                          id={`role-select-${member.id}`}
                          value={member.role}
                          onChange={(e) => changeRole(member.id, e.target.value as TeamRole)}
                          className="rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ai/40"
                        >
                          {(["Viewer", "Analyst", "Admin"] as TeamRole[]).map((r) => <option key={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleStyle[member.role]}`}>{member.role}</span>
                      )}
                      {member.role !== "Owner" && (
                        <button id={`remove-member-${member.id}`} onClick={() => removeMember(member.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
