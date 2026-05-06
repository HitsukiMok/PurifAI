import { useEffect, useRef, useState } from "react";
import type { TrafficRow } from "@/lib/mock-traffic";

interface BridgeMetrics {
  scanned: number;
  blocked: number;
  agents: number;
}

interface ExtensionBridgeResult {
  extensionConnected: boolean;
}

/**
 * useExtensionBridge
 *
 * Detects when the AgentShield Chrome Extension is active on this page
 * (via the content script's postMessage handshake), then continuously
 * broadcasts live traffic + metric data to the extension background worker.
 *
 * Communication flow:
 *  content.js → window.postMessage("AGENTSHIELD_EXTENSION_READY")
 *  React hook → window.postMessage("AGENTSHIELD_UPDATE", { rows, metrics })
 *  content.js → chrome.runtime.sendMessage("DASHBOARD_UPDATE")
 *  background.js → broadcast to all open popup ports
 */
export function useExtensionBridge(
  rows: TrafficRow[],
  metrics: BridgeMetrics,
): ExtensionBridgeResult {
  const [extensionConnected, setExtensionConnected] = useState(false);
  const prevRowsRef = useRef<TrafficRow[]>([]);
  const prevMetricsRef = useRef<BridgeMetrics | null>(null);
  const detectionAttempts = useRef(0);

  // ── Step 1: Detect extension presence ─────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data?.type === "AGENTSHIELD_EXTENSION_READY"
      ) {
        setExtensionConnected(true);
        detectionAttempts.current = 0;
      }
    };

    window.addEventListener("message", handler);

    // Ping the content script every 5 s in case the service worker restarted
    const pingInterval = setInterval(() => {
      detectionAttempts.current += 1;
      window.postMessage({ type: "AGENTSHIELD_PING" }, "*");
      // After 5 unsuccessful pings with no reply, mark as disconnected
      if (detectionAttempts.current > 5 && extensionConnected) {
        setExtensionConnected(false);
      }
    }, 5000);

    // Initial ping
    window.postMessage({ type: "AGENTSHIELD_PING" }, "*");

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(pingInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: Broadcast updates whenever rows or metrics change ─────────
  useEffect(() => {
    if (!extensionConnected) return;

    const rowsChanged = rows !== prevRowsRef.current;
    const metricsChanged =
      !prevMetricsRef.current ||
      prevMetricsRef.current.scanned !== metrics.scanned ||
      prevMetricsRef.current.blocked !== metrics.blocked;

    if (!rowsChanged && !metricsChanged) return;

    prevRowsRef.current   = rows;
    prevMetricsRef.current = metrics;

    window.postMessage(
      {
        type: "AGENTSHIELD_UPDATE",
        data: {
          rows: rows.slice(0, 20).map((r) => ({
            id:        r.id,
            time:      r.time,
            source:    r.source,
            agent:     r.agent,
            risk:      r.risk,
            status:    r.status,
            technique: r.technique,
            payload:   r.payload,
            raw:       r.raw,
          })),
          metrics,
        },
      },
      "*",
    );
    detectionAttempts.current = 0;
  }, [rows, metrics, extensionConnected]);

  return { extensionConnected };
}
