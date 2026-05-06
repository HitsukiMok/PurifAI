// ── AgentShield Content Script ─────────────────────────────────────────────
// Injected into the AgentShield dashboard page.
// Bridges postMessage (page → extension) and announces presence.

(function () {
  "use strict";

  let announced = false;

  function announce() {
    if (announced) return;
    announced = true;

    // Inject a marker the page React code can detect
    const marker = document.createElement("meta");
    marker.name = "agentshield-extension";
    marker.content = chrome.runtime.id;
    document.head.appendChild(marker);

    // Post back to the page so the React bridge hook knows we're here
    window.postMessage({ type: "AGENTSHIELD_EXTENSION_READY", extensionId: chrome.runtime.id }, "*");

    // Tell background we're connected
    try {
      chrome.runtime.sendMessage({ type: "DASHBOARD_CONNECTED" });
    } catch (e) { /* service worker may be inactive */ }
  }

  // ── Listen for messages FROM the dashboard page ──────────────────────────
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || typeof event.data.type !== "string") return;

    if (event.data.type === "AGENTSHIELD_UPDATE") {
      try {
        chrome.runtime.sendMessage(
          { type: "DASHBOARD_UPDATE", data: event.data.data },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      } catch (e) { /* service worker restarting */ }
    }

    if (event.data.type === "AGENTSHIELD_PING") {
      // Dashboard is checking if extension is present — reply
      window.postMessage({ type: "AGENTSHIELD_EXTENSION_READY", extensionId: chrome.runtime.id }, "*");
    }
  });

  // ── Announce on unload ────────────────────────────────────────────────────
  window.addEventListener("beforeunload", () => {
    try {
      chrome.runtime.sendMessage({ type: "DASHBOARD_DISCONNECTED" });
    } catch (e) { /* ignore */ }
  });

  // ── Announce immediately and also after DOM ready ─────────────────────────
  announce();
  if (document.readyState !== "complete") {
    window.addEventListener("load", announce);
  }
})();
