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
  onStateUpdate?: (state: any) => void
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
        // Request initial state when connected
        window.postMessage({ type: "PURIFAI_FETCH_REAL_STATE" }, "*");
      }

      // Handle real-time updates from extension
      if (
        event.source === window &&
        event.data?.type === "PURIFAI_LIVE_UPDATE"
      ) {
        if (onStateUpdate && event.data.state) {
          onStateUpdate(event.data.state);
        }
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

  // (Removed Step 2: we no longer broadcast mock data to the extension)

  return { extensionConnected };
}
