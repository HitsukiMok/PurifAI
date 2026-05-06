/**
 * SharedDataContext — Global live-traffic and threat data for the web dashboard.
 *
 * Centralises the mock (or future real-API) data so every page
 * (Home, Threats, Logs, Agents, Policies) pulls from one source of truth
 * instead of each managing its own state.
 *
 * Usage:
 *   const { traffic, threats, refresh, isLoading } = useSharedData();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { generateTrafficRows, type TrafficRow } from "@/lib/mock-traffic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedDataContextValue {
  /** Full traffic log (newest first). */
  traffic: TrafficRow[];
  /** Only rows where risk >= 60 or status === "Blocked". */
  threats: TrafficRow[];
  isLoading: boolean;
  /** Trigger a manual data refresh (e.g. pull-to-refresh). */
  refresh: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SharedDataContext = createContext<SharedDataContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

export function SharedDataProvider({ children }: { children: ReactNode }) {
  const [traffic, setTraffic] = useState<TrafficRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    // Swap generateTrafficRows() for a real fetch() call when the backend is ready:
    //   const rows = await fetch("/api/traffic").then(r => r.json());
    const rows = generateTrafficRows(40);
    setTraffic(rows);
    setIsLoading(false);
  }, []);

  // Initial load + polling
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const threats = traffic.filter(
    (r) => r.risk >= 60 || r.status === "Blocked"
  );

  return (
    <SharedDataContext.Provider
      value={{ traffic, threats, isLoading, refresh: load }}
    >
      {children}
    </SharedDataContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSharedData(): SharedDataContextValue {
  const ctx = useContext(SharedDataContext);
  if (!ctx) {
    throw new Error("useSharedData must be used inside <SharedDataProvider>");
  }
  return ctx;
}
