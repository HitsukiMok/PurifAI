import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, ScanSearch, ShieldX, Zap } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveTrafficTable } from "@/components/dashboard/LiveTrafficTable";
import { AttackInspectionPanel } from "@/components/dashboard/AttackInspectionPanel";
import { ExtensionSection } from "@/components/dashboard/ExtensionSection";
import { useExtensionBridge } from "@/hooks/use-extension-bridge";
import { useBackendPolling } from "@/hooks/use-backend-polling";
import {
  initialAttack,
  makeAttackRow,
  type TrafficRow,
} from "@/lib/mock-traffic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — AgentShield Platform" },
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
  // Real-time data from the backend
  const { realRows, realMetrics, backendOnline } = useBackendPolling();

  // Combined state: real rows from backend + simulated demo rows
  const [demoRows, setDemoRows] = useState<TrafficRow[]>([]);
  const [demoBlocked, setDemoBlocked] = useState(0);
  const [demoScanned, setDemoScanned] = useState(0);

  // Combine real + demo rows, real rows first
  const allRows = [...realRows, ...demoRows].slice(0, 50);

  // Metrics: real from backend + demo additions
  const scanned = realMetrics.scanned + demoScanned;
  const blocked = realMetrics.blocked + demoBlocked;
  const agents = 1; // PurifAI Scanner

  const [selected, setSelected] = useState<TrafficRow>(initialAttack);
  const [newestId, setNewestId] = useState<string | undefined>(undefined);
  const [blockedPulse, setBlockedPulse] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  // Auto-select the newest blocked row when real data comes in
  useEffect(() => {
    if (realRows.length > 0) {
      const latestBlocked = realRows.find((r) => r.status === "Blocked");
      if (latestBlocked) {
        setSelected(latestBlocked);
        setShowPanel(true);
        setBlockedPulse((p) => p + 1);
      }
      setNewestId(realRows[0].id);
    }
  }, [realRows]);

  // Extension bridge — broadcasts live data to the Chrome extension popup
  const { extensionConnected } = useExtensionBridge(allRows, { scanned, blocked, agents });

  function simulateAttack() {
    const a = makeAttackRow();
    setDemoRows((prev) => [a, ...prev].slice(0, 40));
    setDemoBlocked((b) => b + 1);
    setDemoScanned((s) => s + 1);
    setSelected(a);
    setNewestId(a.id);
    setBlockedPulse((p) => p + 1);
    setShowPanel(true);
  }

  function handleSelect(r: TrafficRow) {
    setSelected(r);
    setShowPanel(true);
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">
        {/* Backend status indicator */}
        {!backendOnline && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger">
            ⚠️ Backend offline — start <code>uvicorn main:app --reload</code> in <code>backend/</code>
          </div>
        )}

        {/* Top row: metrics + CTA */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <MetricCard
            label="AI Ingestions Scanned"
            value={scanned.toLocaleString()}
            delta={backendOnline ? "● live" : "○ offline"}
            icon={ScanSearch}
            tone="ai"
          />
          <MetricCard
            label="Prompt Injections Blocked"
            value={blocked.toLocaleString()}
            delta="real-time"
            icon={ShieldX}
            tone="danger"
            pulseKey={blockedPulse}
          />
          <MetricCard
            label="Active AI Agents Protected"
            value={agents}
            delta="PurifAI Scanner"
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
              rows={allRows}
              newestId={newestId}
              onSelect={handleSelect}
              selectedId={selected.id}
            />
          </div>

          {/* On mobile: show panel only after selecting a blocked row / simulating */}
          <div
            className={`lg:col-span-2 min-h-[400px] sm:min-h-[480px] lg:min-h-[520px] ${showPanel ? "block" : "hidden lg:block"
              }`}
          >
            <AttackInspectionPanel attack={selected} />
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
