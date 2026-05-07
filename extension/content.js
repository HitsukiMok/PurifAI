// ── AgentShield Content Script ─────────────────────────────────────────────
// Injected into ALL pages in the ISOLATED world.
// Bridges postMessage (page → extension) and announces presence.
//
// Responsibilities:
// 1. Dashboard connection handshake (for the React command center)
// 2. Dashboard update forwarding
// 3. ★ NEW: Bridge for interceptor.js scan requests
//    interceptor.js (MAIN world) cannot use chrome.runtime.sendMessage,
//    so it posts messages to us, and we forward them to background.js.

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

  // ── Listen for messages FROM the page (dashboard + interceptor) ──────────
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || typeof event.data.type !== "string") return;

    // ── Dashboard update forwarding ──
    if (event.data.type === "AGENTSHIELD_UPDATE") {
      try {
        chrome.runtime.sendMessage(
          { type: "DASHBOARD_UPDATE", data: event.data.data },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      } catch (e) { /* service worker restarting */ }
    }

    // ── Dashboard ping reply ──
    if (event.data.type === "AGENTSHIELD_PING") {
      window.postMessage({ type: "AGENTSHIELD_EXTENSION_READY", extensionId: chrome.runtime.id }, "*");
    }

    // ── ★ Interceptor scan request bridge ──
    // interceptor.js (MAIN world) sends texts here for scanning.
    // We forward each text to background.js in parallel, collect results,
    // and post them back so the interceptor can redact the response.
    if (event.data.type === "PURIFAI_INTERCEPT_SCAN") {
      const requestId = event.data.requestId;
      const texts = event.data.texts || [];

      if (texts.length === 0) {
        window.postMessage({
          type: "PURIFAI_INTERCEPT_RESULT",
          requestId: requestId,
          results: [],
        }, "*");
        return;
      }

      // Scan all texts in parallel via background.js
      const promises = texts.map((text) => {
        return new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage(
              { type: "PURIFAI_SCAN_REQUEST", text: text },
              (response) => {
                if (chrome.runtime.lastError || !response || !response.ok) {
                  // Fail-open: treat scan failure as safe
                  resolve({ is_safe: true, text: text, confidence: 0 });
                } else {
                  resolve(response.data);
                }
              }
            );
          } catch (e) {
            resolve({ is_safe: true, text: text, confidence: 0 });
          }
        });
      });

      Promise.all(promises).then((results) => {
        window.postMessage({
          type: "PURIFAI_INTERCEPT_RESULT",
          requestId: requestId,
          results: results,
        }, "*");
      });
    }

    // ── ★ Dashboard state fetch ──
    if (event.data.type === "PURIFAI_FETCH_REAL_STATE") {
      try {
        chrome.runtime.sendMessage({ type: "PURIFAI_FETCH_REAL_STATE" }, (state) => {
          if (state) {
            window.postMessage({ type: "PURIFAI_LIVE_UPDATE", state }, "*");
          }
        });
      } catch (e) { /* ignore */ }
    }
  });

  // ── Listen for real-time background state changes ────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.purifaiState && changes.purifaiState.newValue) {
      window.postMessage({ type: "PURIFAI_LIVE_UPDATE", state: changes.purifaiState.newValue }, "*");
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
