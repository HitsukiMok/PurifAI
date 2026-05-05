import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, ScanSearch, ShieldX, Zap } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveTrafficTable } from "@/components/dashboard/LiveTrafficTable";
import { AttackInspectionPanel } from "@/components/dashboard/AttackInspectionPanel";
import {
  initialAttack,
  initialRows,
  makeAttackRow,
  makeCleanRow,
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
  const [rows, setRows] = useState<TrafficRow[]>([initialAttack, ...initialRows]);
  const [scanned, setScanned] = useState(48217);
  const [blocked, setBlocked] = useState(127);
  const [agents] = useState(34);
  const [selected, setSelected] = useState<TrafficRow>(initialAttack);
  const [newestId, setNewestId] = useState<string | undefined>(initialAttack.id);
  const [blockedPulse, setBlockedPulse] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Background ticker — adds clean rows so the feed feels alive.
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      const r = makeCleanRow();
      setRows((prev) => [r, ...prev].slice(0, 40));
      setNewestId(r.id);
      setScanned((s) => s + 1 + Math.floor(Math.random() * 3));
    }, 3500);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  function simulateAttack() {
    const a = makeAttackRow();
    setRows((prev) => [a, ...prev].slice(0, 40));
    setBlocked((b) => b + 1);
    setScanned((s) => s + 1);
    setSelected(a);
    setNewestId(a.id);
    setBlockedPulse((p) => p + 1);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      {/* Top row: metrics + CTA */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
          onClick={simulateAttack}
          className="group relative overflow-hidden rounded-xl border border-danger/40 bg-gradient-to-br from-danger/20 via-card to-ai/15 px-5 py-4 text-left transition-all hover:glow-danger lg:min-w-[220px]"
        >
          <span className="absolute right-3 top-3 rounded-full bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ai ring-1 ring-ai/40">
            Demo
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/20 text-danger ring-1 ring-danger/40 group-hover:glow-danger">
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

      {/* Main grid */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 min-h-[520px]">
          <LiveTrafficTable
            rows={rows}
            newestId={newestId}
            onSelect={(r) => r.status === "Blocked" && setSelected(r)}
            selectedId={selected.id}
          />
        </div>
        <div className="lg:col-span-2 min-h-[520px]">
          <AttackInspectionPanel attack={selected} />
        </div>
      </section>
    </div>
  );
}
