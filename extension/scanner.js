// ── PurifAI Scanner — Content Script ───────────────────────────────────────
// Injected into ALL web pages (including iframes via all_frames:true).
// Routes API calls through the background service worker to bypass CSP.

(function () {
  "use strict";

  const DEBOUNCE_MS = 900;
  const MIN_TEXT_LENGTH = 12;

  let debounceTimer = null;
  let mutationDebounce = null;
  let lastScannedText = "";
  let activeBanner = null;

  console.log("[PurifAI] Scanner loaded on:", window.location.href);

  // ── Scan via background proxy ─────────────────────────────────────────────
  function scanText(text) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "PURIFAI_SCAN_REQUEST", text: text },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn("[PurifAI] sendMessage error:", chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            if (!response || !response.ok) {
              console.warn("[PurifAI] Bad response:", response);
              resolve(null);
              return;
            }
            console.log("[PurifAI] Scan result:", response.data);
            resolve(response.data);
          }
        );
      } catch (e) {
        console.error("[PurifAI] scanText exception:", e);
        resolve(null);
      }
    });
  }

  // ── Send feedback via background proxy ────────────────────────────────────
  function sendFeedback(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "PURIFAI_FEEDBACK_REQUEST", payload: payload },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
              return;
            }
            resolve(response && response.ok);
          }
        );
      } catch (e) {
        resolve(false);
      }
    });
  }

  // ── UI: Show floating toast warning ───────────────────────────────────────
  function showWarning(element, data) {
    console.log("[PurifAI] 🚨 INJECTION DETECTED! Confidence:", data.confidence);
    element.classList.add("purifai-danger");
    removeActiveBanner();

    var banner = document.createElement("div");
    banner.className = "purifai-banner purifai-banner-danger";
    banner.setAttribute("id", "purifai-active-banner");

    banner.innerHTML =
      '<div class="purifai-banner-content">' +
        '<div class="purifai-banner-icon">🚨</div>' +
        '<div class="purifai-banner-text">' +
          '<strong>Prompt Injection Detected</strong>' +
          '<span class="purifai-confidence">AI Confidence: ' + (data.confidence * 100).toFixed(1) + '%</span>' +
        '</div>' +
        '<button class="purifai-report-btn" title="Flag as false positive">Not an attack</button>' +
      '</div>';

    var reportBtn = banner.querySelector(".purifai-report-btn");
    reportBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      reportBtn.textContent = "Sending…";
      reportBtn.disabled = true;

      sendFeedback({
        text: data.text,
        model_label: data.label,
        model_confidence: data.confidence,
        user_corrected_label: "SAFE",
      }).then(function (ok) {
        if (ok) {
          banner.className = "purifai-banner purifai-banner-feedback";
          banner.innerHTML =
            '<div class="purifai-banner-content">' +
              '<div class="purifai-banner-icon">✅</div>' +
              '<div class="purifai-banner-text">' +
                '<strong>Feedback logged</strong>' +
                '<span class="purifai-confidence">Thanks — this helps improve the model.</span>' +
              '</div>' +
            '</div>';
          element.classList.remove("purifai-danger");
          setTimeout(function () { banner.remove(); }, 3000);
        } else {
          reportBtn.textContent = "Error — retry?";
          reportBtn.disabled = false;
        }
      });
    });

    // Append to the top-level document body (works even from iframes via try/catch)
    try {
      var targetDoc = window.top.document;
      targetDoc.body.appendChild(banner);
    } catch (e) {
      // Cross-origin iframe — append to this frame's body instead
      document.body.appendChild(banner);
    }
    activeBanner = banner;
  }

  // ── UI: Brief green flash on safe text ───────────────────────────────────
  function showSafe(element) {
    console.log("[PurifAI] ✅ Text is safe.");
    element.classList.remove("purifai-danger");
    removeActiveBanner();
    element.classList.add("purifai-safe");
    setTimeout(function () { element.classList.remove("purifai-safe"); }, 1500);
  }

  function removeActiveBanner() {
    if (activeBanner) {
      try { activeBanner.remove(); } catch (e) {}
      activeBanner = null;
    }
    // Also clean up any orphaned banners
    try {
      var old = (window.top || window).document.getElementById("purifai-active-banner");
      if (old) old.remove();
    } catch (e) {}
  }

  // ── Core: Handle an input event on any element ────────────────────────────
  function handleInput(element) {
    var text = "";
    if (element.value !== undefined && element.value !== "") {
      text = element.value;
    } else if (element.textContent) {
      text = element.textContent;
    } else if (element.innerText) {
      text = element.innerText;
    }
    var trimmed = text.trim();

    console.log("[PurifAI] handleInput called, text length:", trimmed.length);

    if (trimmed.length < MIN_TEXT_LENGTH) {
      element.classList.remove("purifai-danger");
      removeActiveBanner();
      return;
    }

    if (trimmed === lastScannedText) {
      console.log("[PurifAI] Same text, skipping.");
      return;
    }
    lastScannedText = trimmed;

    console.log("[PurifAI] Scanning text:", trimmed.substring(0, 80) + "...");

    scanText(trimmed).then(function (result) {
      if (!result || result.error) {
        console.warn("[PurifAI] Scan failed or returned error:", result);
        return;
      }

      if (result.is_safe === false) {
        showWarning(element, result);
      } else {
        showSafe(element);
      }
    });
  }

  // ── Watch all normal inputs ───────────────────────────────────────────────
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t) return;

    var isText =
      t.tagName === "TEXTAREA" ||
      (t.tagName === "INPUT" && /^(text|search|url|)$/i.test(t.type || "")) ||
      t.isContentEditable ||
      t.getAttribute("contenteditable") === "true";

    if (!isText) return;

    console.log("[PurifAI] Input event on:", t.tagName, t.className);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { handleInput(t); }, DEBOUNCE_MS);
  }, true);

  // ── Watch contenteditable divs (Gmail, ChatGPT, Claude, etc.) ─────────────
  // Also watch for keyup events as a fallback for editors that swallow input events
  document.addEventListener("keyup", function (e) {
    var t = e.target;
    if (!t) return;
    if (!t.isContentEditable && t.getAttribute("contenteditable") !== "true") return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { handleInput(t); }, DEBOUNCE_MS);
  }, true);

  // MutationObserver as final fallback
  var observer = new MutationObserver(function () {
    var editable = document.activeElement;
    if (!editable) return;
    if (!editable.isContentEditable &&
        editable.getAttribute("contenteditable") !== "true" &&
        editable.tagName !== "TEXTAREA") return;

    clearTimeout(mutationDebounce);
    mutationDebounce = setTimeout(function () { handleInput(editable); }, DEBOUNCE_MS);
  });

  // Start observing after a short delay to let the page settle
  setTimeout(function () {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      console.log("[PurifAI] MutationObserver started.");
    }
  }, 1000);

})();
