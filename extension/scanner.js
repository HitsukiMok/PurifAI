// ── PurifAI Scanner — Content Script ───────────────────────────────────────
// Injected into ALL web pages. Watches text inputs for prompt injections
// by calling the local Python backend at http://localhost:8000/api/scan.
// Provides visual warnings and a "Report Mistake" feedback button.

(function () {
  "use strict";

  const API_BASE = "http://localhost:8000";
  const DEBOUNCE_MS = 800;
  const MIN_TEXT_LENGTH = 10;

  let debounceTimer = null;
  let lastScannedText = "";

  console.log("🛡️ PurifAI Scanner is active on this page.");

  // ── Scan text against the backend ──────────────────────────────────────
  async function scanText(text) {
    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("PurifAI: Backend unreachable:", err.message);
      return null;
    }
  }

  // ── Send feedback (Report Mistake) ─────────────────────────────────────
  async function sendFeedback(text, modelLabel, modelConfidence) {
    try {
      const corrected = modelLabel === "INJECTION" ? "SAFE" : "INJECTION";
      await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_label: modelLabel,
          model_confidence: modelConfidence,
          user_corrected_label: corrected,
        }),
      });
      return true;
    } catch (err) {
      console.error("PurifAI: Feedback error:", err);
      return false;
    }
  }

  // ── Notify background script to update popup metrics ───────────────────
  function notifyBackground(scanResult) {
    try {
      chrome.runtime.sendMessage({
        type: "PURIFAI_SCAN_RESULT",
        data: scanResult,
      });
    } catch (e) { /* background may not be active */ }
  }

  // ── UI: Show warning banner ────────────────────────────────────────────
  function showWarning(element, data) {
    // Add red glow to the input
    element.classList.add("purifai-danger");

    // Remove any existing banner for this element
    removeWarning(element);

    const banner = document.createElement("div");
    banner.className = "purifai-banner purifai-banner-danger";
    banner.dataset.purifaiFor = getElementId(element);

    banner.innerHTML = `
      <div class="purifai-banner-content">
        <div class="purifai-banner-icon">🚨</div>
        <div class="purifai-banner-text">
          <strong>Prompt Injection Detected</strong>
          <span class="purifai-confidence">Confidence: ${(data.confidence * 100).toFixed(1)}%</span>
        </div>
        <button class="purifai-report-btn" title="Report as false positive">
          ✕ Not an attack
        </button>
      </div>
    `;

    // Wire up the Report Mistake button
    const reportBtn = banner.querySelector(".purifai-report-btn");
    reportBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      reportBtn.textContent = "Sending…";
      reportBtn.disabled = true;

      const ok = await sendFeedback(data.text, data.label, data.confidence);
      if (ok) {
        banner.className = "purifai-banner purifai-banner-feedback";
        banner.innerHTML = `
          <div class="purifai-banner-content">
            <div class="purifai-banner-icon">✅</div>
            <div class="purifai-banner-text">
              <strong>Feedback logged</strong>
              <span class="purifai-confidence">Thanks! This helps improve the model.</span>
            </div>
          </div>
        `;
        element.classList.remove("purifai-danger");
        setTimeout(() => banner.remove(), 3000);
      } else {
        reportBtn.textContent = "Error — try again";
        reportBtn.disabled = false;
      }
    });

    // Insert banner right after the element
    element.parentNode.insertBefore(banner, element.nextSibling);
  }

  // ── UI: Show safe indicator (brief flash) ──────────────────────────────
  function showSafe(element) {
    element.classList.remove("purifai-danger");
    removeWarning(element);

    element.classList.add("purifai-safe");
    setTimeout(() => element.classList.remove("purifai-safe"), 1500);
  }

  // ── UI: Remove warning ─────────────────────────────────────────────────
  function removeWarning(element) {
    const id = getElementId(element);
    const existing = document.querySelector(`.purifai-banner[data-purifai-for="${id}"]`);
    if (existing) existing.remove();
  }

  // ── Utility: Stable element ID ─────────────────────────────────────────
  let idCounter = 0;
  function getElementId(el) {
    if (!el.dataset.purifaiId) {
      el.dataset.purifaiId = `purifai-${idCounter++}`;
    }
    return el.dataset.purifaiId;
  }

  // ── Core: Handle input events ──────────────────────────────────────────
  async function handleInput(element) {
    // Get text from various input types
    const text = element.value || element.innerText || element.textContent || "";

    if (text.trim().length < MIN_TEXT_LENGTH) {
      element.classList.remove("purifai-danger");
      removeWarning(element);
      return;
    }

    // Don't re-scan identical text
    if (text === lastScannedText) return;
    lastScannedText = text;

    const result = await scanText(text);
    if (!result || result.error) return;

    // Notify the background/popup
    notifyBackground(result);

    if (result.is_safe === false) {
      showWarning(element, result);
    } else {
      showSafe(element);
    }
  }

  // ── Event Listener: Watch all text inputs ──────────────────────────────
  document.addEventListener("input", (e) => {
    const target = e.target;
    const tag = target.tagName;
    const isEditable = target.isContentEditable;
    const isTextInput =
      tag === "TEXTAREA" ||
      (tag === "INPUT" && ["text", "search", "url", ""].includes(target.type)) ||
      isEditable;

    if (!isTextInput) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleInput(target), DEBOUNCE_MS);
  }, true);

  // ── Also catch contenteditable divs (ChatGPT, Claude, etc.) ────────────
  // These apps often use contenteditable divs instead of textareas.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList" || m.type === "characterData") {
        const target = m.target.closest?.("[contenteditable='true']") || m.target;
        if (target.isContentEditable) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => handleInput(target), DEBOUNCE_MS);
        }
      }
    }
  });

  // Start observing after a short delay to let SPAs render
  setTimeout(() => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, 2000);

})();
