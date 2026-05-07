import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, ScanSearch, ShieldX, Zap } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveTrafficTable } from "@/components/dashboard/LiveTrafficTable";
import { AttackInspectionPanel } from "@/components/dashboard/AttackInspectionPanel";
import { ExtensionSection } from "@/components/dashboard/ExtensionSection";
import type { RichLogEntry } from "@/lib/mock-traffic";
import { useExtensionData } from "@/contexts/ExtensionContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PurifAI Platform — AI Agent Security Command Center" },
      {
        name: "description",
        content:
          "Real-time monitoring and inspection of indirect prompt injection attacks against enterprise AI agents.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state: extState, connected: extensionConnected } = useExtensionData();
  const rows = extState.recentLogs || [];
  const scanned = extState.totalScans || 0;
  const blocked = extState.threatsBlocked || 0;
  
  // Aggregate agents
  const agentsSet = new Set(rows.map(r => r.targetAgent).filter(Boolean));
  const agents = agentsSet.size > 0 ? agentsSet.size : 1;

  const [selected, setSelected] = useState<RichLogEntry | null>(null);
  const newestId = rows.length > 0 ? rows[0].id : undefined;
  
  const [blockedPulse, setBlockedPulse] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  // Pulse effect when blocked count increases
  const prevBlockedRef = useRef(blocked);
  useEffect(() => {
    if (blocked > prevBlockedRef.current) {
      setBlockedPulse(p => p + 1);
      // Auto-select latest blocked event
      const latestBlocked = rows.find(r => r.status === "Blocked");
      if (latestBlocked && (!selected || latestBlocked.id !== selected.id)) {
        setSelected(latestBlocked);
        setShowPanel(true);
      }
    }
    prevBlockedRef.current = blocked;
  }, [blocked, rows, selected]);

  function simulateAttack() {
    // Attack simulation handled by extension, or just UI demo
    // We'll leave it as a mock local update, or remove it. 
    // Since we rely on global state, simulation should happen there if needed, 
    // but user says "One-click attack simulation (demo)" so maybe we just show an alert
    alert("To simulate an attack, use the extension popup 'Simulate Attack' button.");
  }

  function handleSelect(r: RichLogEntry) {
    if (r.status === "Blocked") {
      setSelected(r);
      setShowPanel(true);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="mx-au to max-w-[1500px] space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">
        {/* Top row: metrics + CTA */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <MetricCard
            label="AI Ingestions Scanned"
            value={scanned.toLocaleString()}
            delta="↑ 2.4% last hour"
            icon={ScanSearch}
            tone="ai"
          />
          <MetricCard
            label="Prompt Injections Blocked"
            value={blocked.toLocaleString()}
            delta="last 24h"
            icon={ShieldX}
            tone="danger"
            pulseKey={blockedPulse}
          />
          <MetricCard
            label="Active AI Agents Protected"
            value={agents}
            delta="across 7 workspaces"
            icon={Bot}
            tone="success"
          />

          <button
            id="simulate-attack-btn"
            onClick={simulateAttack}
            className="group relative overflow-hidden rounded-xl border border-danger/40 bg-gradient-to-br from-danger/20 via-card to-ai/15 px-5 py-4 text-left transition-all hover:glow-danger sm:col-span-2 lg:col-span-1 lg:min-w-[220px]"
          >
            <span className="absolute right-3 top-3 rounded-full bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ai ring-1 ring-ai/40">
              Demo
            </span>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/20 text-danger ring-1 ring-danger/40 group-hover:glow-danger">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Hackathon
                </p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  Simulate Incoming Attack
                </p>
              </div>
            </div>
          </button>
        </section>

        {/* Main grid — stacks on mobile, side-by-side on lg+ */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 min-h-[400px] sm:min-h-[480px] lg:min-h-[520px]">
            <LiveTrafficTable
              rows={rows}
              newestId={newestId}
              onSelect={handleSelect}
              selectedId={selected?.id}
            />
          </div>

          {/* On mobile: show panel only after selecting a blocked row / simulating */}
          <div
            className={`lg:col-span-2 min-h-[400px] sm:min-h-[480px] lg:min-h-[520px] ${showPanel ? "block" : "hidden lg:block"
              }`}
          >
            {selected && <AttackInspectionPanel attack={selected} />}
          </div>

          {/* Mobile: show a prompt when panel is hidden */}
          {!showPanel && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/50 p-6 text-center lg:hidden">
              <p className="text-xs text-muted-foreground">
                Tap a <span className="text-danger font-semibold">Blocked</span> row or simulate an attack to inspect the payload.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Extension section (full-width, below main content) ── */}
      <div className="border-t border-border/40">
        <ExtensionSection extensionConnected={extensionConnected} />
      </div>
    </div>
  );
}
