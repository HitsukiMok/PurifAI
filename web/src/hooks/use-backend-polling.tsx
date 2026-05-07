import { useEffect, useRef, useState, useCallback } from "react";
import type { TrafficRow } from "@/lib/mock-traffic";

const API_BASE = "http://localhost:8000";
const POLL_INTERVAL = 2000; // 2 seconds for snappier updates
const LOOKBACK_BUFFER = 2;  // seconds to overlap when querying, prevents missed scans

interface ScanEntry {
  id: string;
  timestamp: number;
  time: string;
  text: string;
  label: string;
  confidence: number;
  is_safe: boolean;
  source: string;
}

interface PollResult {
  scans: ScanEntry[];
  metrics: { scanned: number; blocked: number };
}

/**
 * useBackendPolling
 *
 * Polls the backend /api/recent-scans endpoint every few seconds.
 * Converts backend scan entries into TrafficRow objects for the dashboard.
 * Returns new rows and updated metrics from real scan activity.
 *
 * Uses a lookback buffer on the `since` timestamp to ensure scans that
 * land between poll intervals are never missed. Deduplication via `seenIds`
 * prevents the same scan from appearing twice.
 */
export function useBackendPolling() {
  const [realRows, setRealRows] = useState<TrafficRow[]>([]);
  const [realMetrics, setRealMetrics] = useState({ scanned: 0, blocked: 0 });
  const [backendOnline, setBackendOnline] = useState(false);
  const lastTimestamp = useRef(0);
  const seenIds = useRef(new Set<string>());

  const poll = useCallback(async () => {
    try {
      // Apply a lookback buffer so we re-check a small window of recent scans.
      // seenIds deduplication prevents double-counting.
      const sinceParam = Math.max(0, lastTimestamp.current - LOOKBACK_BUFFER);
      const res = await fetch(
        `${API_BASE}/api/traffic?since=${sinceParam}`
      );
      if (!res.ok) {
        setBackendOnline(false);
        return;
      }

      const data: PollResult = await res.json();
      setBackendOnline(true);

      // Always update metrics from the backend (authoritative source)
      if (data.metrics) {
        setRealMetrics(data.metrics);
      }

      // Convert new scans to TrafficRow format
      if (data.scans && data.scans.length > 0) {
        const newRows: TrafficRow[] = [];

        for (const scan of data.scans) {
          // Deduplicate: skip scans we've already processed
          if (seenIds.current.has(scan.id)) continue;
          seenIds.current.add(scan.id);

          // Track the latest timestamp so next poll starts from here
          if (scan.timestamp > lastTimestamp.current) {
            lastTimestamp.current = scan.timestamp;
          }

          const row: TrafficRow = {
            id: scan.id,
            time: scan.time,
            source: scan.source || "extension://scanner",
            agent: "PurifAI Scanner",
            risk: scan.is_safe
              ? Math.floor(Math.random() * 15)
              : Math.round(scan.confidence * 100),
            status: scan.is_safe ? "Clean" : "Blocked",
            raw: scan.text,
          };

          if (!scan.is_safe) {
            row.technique = "Prompt Injection";
            row.payload = scan.text;
          }

          newRows.push(row);
        }

        if (newRows.length > 0) {
          setRealRows((prev) => [...newRows, ...prev].slice(0, 50));
        }
      }
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    // Initial poll immediately
    poll();

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  return { realRows, realMetrics, backendOnline };
}
