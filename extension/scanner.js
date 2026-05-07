// ── PurifAI Scanner — Content Script ───────────────────────────────────────
// Injected into ALL web pages (including iframes via all_frames:true).
// Routes API calls through the background service worker to bypass CSP.
// Blocks dangerous content with a confirmation overlay.

(function () {
  "use strict";

  const DEBOUNCE_MS = 500;
  const MIN_TEXT_LENGTH = 12;

  let debounceTimer = null;
  let mutationDebounce = null;
  let lastScannedText = "";
  let activeBanner = null;
  let activeOverlay = null;
  let acknowledgedTexts = new Set(); // Track texts user has chosen to proceed on
  let processedMessageIds = new Set(); // Track message IDs to prevent popup spam

  console.log("[PurifAI] Scanner loaded on:", window.location.href);

  // ── Scan via background proxy ─────────────────────────────────────────────
  function scanText(text) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          { type: "PURIFAI_SCAN_REQUEST", text: text },
          function (response) {
            if (chrome.runtime.lastError) {
              console.warn("[PurifAI] sendMessage error:", chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            if (!response || !response.ok) {
              console.warn("[PurifAI] Bad response:", response);
              resolve(response || { error: true });
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
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          { type: "PURIFAI_FEEDBACK_REQUEST", payload: payload },
          function (response) {
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getRiskLevel(confidence) {
    var pct = Math.round(confidence * 100);
    if (pct >= 90) return { level: "CRITICAL", color: "#ff4444", bg: "rgba(255,68,68,0.15)" };
    if (pct >= 70) return { level: "HIGH", color: "#f87171", bg: "rgba(248,113,113,0.12)" };
    if (pct >= 50) return { level: "MEDIUM", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
    return { level: "LOW", color: "#4ade80", bg: "rgba(74,222,128,0.12)" };
  }

  function truncateText(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "…";
  }

  function getMessageId(element) {
    var container = element.closest ? element.closest('[data-message-id]') : null;
    if (container) return container.getAttribute('data-message-id');
    // Fallback if no message ID exists (e.g., subject line)
    var text = element.textContent || element.innerText || "";
    return text.trim().substring(0, 40);
  }

  // ── UI: Glass Shield (Optimistic Lock) ────────────────────────────────────
  function showGlassShield(element) {
    if (element.querySelector('.purifai-glass-shield')) return;
    element.style.position = "relative";
    var shield = document.createElement("div");
    shield.className = "purifai-glass-shield";
    shield.innerHTML = '<div class="purifai-glass-spinner"></div><div>PurifAI: Scanning...</div>';
    
    // Prevent clicks from reaching the email
    shield.addEventListener('click', function(e) { e.stopPropagation(); e.preventDefault(); }, true);
    
    element.appendChild(shield);
  }

  function removeGlassShield(element) {
    var shield = element.querySelector('.purifai-glass-shield');
    if (shield) shield.remove();
  }

  function showGlassShieldWarning(element, textToRetry) {
    var shield = element.querySelector('.purifai-glass-shield');
    if (!shield) {
        showGlassShield(element);
        shield = element.querySelector('.purifai-glass-shield');
    }
    
    shield.classList.add('purifai-glass-shield-warning');
    shield.innerHTML = `
      <div style="font-size:24px">⚠️</div>
      <div>Scan unavailable (Server Busy). Proceed with caution.</div>
      <div class="purifai-glass-btn-group">
        <button class="purifai-glass-btn purifai-glass-btn-retry">Retry Scan</button>
        <button class="purifai-glass-btn purifai-glass-btn-proceed">Read Anyway</button>
      </div>
    `;

    var retryBtn = shield.querySelector('.purifai-glass-btn-retry');
    var proceedBtn = shield.querySelector('.purifai-glass-btn-proceed');

    retryBtn.addEventListener('click', function(e) {
      e.stopPropagation(); e.preventDefault();
      shield.classList.remove('purifai-glass-shield-warning');
      shield.innerHTML = '<div class="purifai-glass-spinner"></div><div>PurifAI: Scanning...</div>';
      
      scanText(textToRetry).then(function(result) {
         handleScanResponse(result, element, textToRetry);
      });
    });

    proceedBtn.addEventListener('click', function(e) {
      e.stopPropagation(); e.preventDefault();
      removeGlassShield(element);
    });
  }

  function handleScanResponse(result, element, originalText) {
    if (result && result.status === 429) {
      showGlassShieldWarning(element, originalText);
      return;
    }
    
    if (!result || result.error) {
      removeGlassShield(element);
      console.warn("[PurifAI] Scan failed or returned error:", result);
      return;
    }

    removeGlassShield(element);

    var msgId = getMessageId(element);
    if (!element.isContentEditable) {
      processedMessageIds.add(msgId);
    }

    if (result.is_safe === false) {
      hasTriggeredDanger = true;
      showBlockingOverlay(element, result);
    } else {
      showSafe(element);
    }
  }

  // ── UI: Show blocking overlay (full-screen confirmation popup) ────────────
  function showBlockingOverlay(element, data) {
    console.log("[PurifAI] 🚨 INJECTION BLOCKED! Confidence:", data.confidence);

    // Don't re-block if user already acknowledged this text
    if (acknowledgedTexts.has(data.text)) {
      console.log("[PurifAI] User already acknowledged this text, showing warning only.");
      showWarningBanner(element, data);
      return;
    }

    element.classList.add("purifai-danger");
    removeActiveOverlay();
    removeActiveBanner();

    var riskPct = Math.round(data.confidence * 100);
    var risk = getRiskLevel(data.confidence);
    var previewText = truncateText(escapeHtml(data.text), 200);

    var overlay = document.createElement("div");
    overlay.className = "purifai-overlay";
    overlay.setAttribute("id", "purifai-blocking-overlay");

    overlay.innerHTML =
      '<div class="purifai-overlay-backdrop"></div>' +
      '<div class="purifai-overlay-card">' +
        // Header
        '<div class="purifai-overlay-header">' +
          '<div class="purifai-overlay-icon-wrap">' +
            '<div class="purifai-overlay-icon-ring"></div>' +
            '<div class="purifai-overlay-icon">🛡️</div>' +
          '</div>' +
          '<h2 class="purifai-overlay-title">Threat Detected</h2>' +
          '<p class="purifai-overlay-subtitle">PurifAI has identified a potential prompt injection attack in this content.</p>' +
        '</div>' +

        // Risk Meter
        '<div class="purifai-overlay-risk-section">' +
          '<div class="purifai-overlay-risk-meter">' +
            '<div class="purifai-overlay-risk-number" style="color:' + risk.color + '">' + riskPct + '%</div>' +
            '<div class="purifai-overlay-risk-label" style="color:' + risk.color + '">' + risk.level + ' RISK</div>' +
            '<div class="purifai-overlay-risk-bar-track">' +
              '<div class="purifai-overlay-risk-bar-fill" style="width:' + riskPct + '%;background:' + risk.color + '"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Details
        '<div class="purifai-overlay-details">' +
          '<div class="purifai-overlay-detail-row">' +
            '<span class="purifai-overlay-detail-label">Classification</span>' +
            '<span class="purifai-overlay-detail-value" style="color:' + risk.color + '">Prompt Injection</span>' +
          '</div>' +
          '<div class="purifai-overlay-detail-row">' +
            '<span class="purifai-overlay-detail-label">AI Confidence</span>' +
            '<span class="purifai-overlay-detail-value">' + (data.confidence * 100).toFixed(1) + '%</span>' +
          '</div>' +
          '<div class="purifai-overlay-detail-row">' +
            '<span class="purifai-overlay-detail-label">Model</span>' +
            '<span class="purifai-overlay-detail-value">DeBERTa v3</span>' +
          '</div>' +
        '</div>' +

        // Payload Preview
        '<div class="purifai-overlay-payload">' +
          '<div class="purifai-overlay-payload-label">⚠️ Detected Malicious Content</div>' +
          '<div class="purifai-overlay-payload-text">' + previewText + '</div>' +
        '</div>' +

        // Action Buttons
        '<div class="purifai-overlay-actions">' +
          '<button class="purifai-overlay-btn purifai-overlay-btn-leave" id="purifai-btn-leave">' +
            '<span class="purifai-btn-icon">🛡️</span>' +
            '<span class="purifai-btn-text">' +
              '<span class="purifai-btn-main">Leave This Page</span>' +
              '<span class="purifai-btn-sub">Recommended — stay safe</span>' +
            '</span>' +
          '</button>' +
          '<button class="purifai-overlay-btn purifai-overlay-btn-proceed" id="purifai-btn-proceed">' +
            '<span class="purifai-btn-icon">⚠️</span>' +
            '<span class="purifai-btn-text">' +
              '<span class="purifai-btn-main">Proceed Anyway</span>' +
              '<span class="purifai-btn-sub">I understand the risk</span>' +
            '</span>' +
          '</button>' +
        '</div>' +

        // False positive link
        '<div class="purifai-overlay-footer">' +
          '<button class="purifai-overlay-fp-btn" id="purifai-btn-fp">Not a real threat? Report false positive</button>' +
        '</div>' +
      '</div>';

    // ── Button Handlers ──

    // Leave button: go back or close tab
    var leaveBtn = overlay.querySelector("#purifai-btn-leave");
    leaveBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[PurifAI] User chose to LEAVE.");
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });

    // Proceed button: remove overlay, let user continue
    var proceedBtn = overlay.querySelector("#purifai-btn-proceed");
    proceedBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[PurifAI] User chose to PROCEED despite risk.");
      acknowledgedTexts.add(data.text);
      removeActiveOverlay();
      element.classList.remove("purifai-danger");
      // Show a small persistent warning banner instead
      showWarningBanner(element, data);
    });

    // False positive button
    var fpBtn = overlay.querySelector("#purifai-btn-fp");
    fpBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      fpBtn.textContent = "Sending…";
      fpBtn.disabled = true;

      sendFeedback({
        text: data.text,
        model_label: data.label,
        model_confidence: data.confidence,
        user_corrected_label: "SAFE",
      }).then(function (ok) {
        if (ok) {
          fpBtn.textContent = "✅ Feedback logged — thanks!";
          acknowledgedTexts.add(data.text);
          setTimeout(function () {
            removeActiveOverlay();
            element.classList.remove("purifai-danger");
          }, 1200);
        } else {
          fpBtn.textContent = "Error — try again";
          fpBtn.disabled = false;
        }
      });
    });

    // Prevent clicks on the overlay from passing through
    overlay.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    // Append to top-level document
    try {
      var targetDoc = window.top.document;
      targetDoc.body.appendChild(overlay);
    } catch (e) {
      document.body.appendChild(overlay);
    }
    activeOverlay = overlay;
  }

  // ── UI: Show floating toast warning (for acknowledged / lower-risk) ───────
  function showWarningBanner(element, data) {
    console.log("[PurifAI] ⚠️ Showing warning banner. Confidence:", data.confidence);
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

    try {
      var targetDoc = window.top.document;
      targetDoc.body.appendChild(banner);
    } catch (e) {
      document.body.appendChild(banner);
    }
    activeBanner = banner;
  }

  // ── UI: Brief green flash on safe text ───────────────────────────────────
  function showSafe(element) {
    console.log("[PurifAI] ✅ Text is safe.");
    element.classList.remove("purifai-danger");
    removeActiveBanner();
    removeActiveOverlay();
    element.classList.add("purifai-safe");
    setTimeout(function () { element.classList.remove("purifai-safe"); }, 1500);
  }

  function removeActiveBanner() {
    if (activeBanner) {
      try { activeBanner.remove(); } catch (e) {}
      activeBanner = null;
    }
    try {
      var old = (window.top || window).document.getElementById("purifai-active-banner");
      if (old) old.remove();
    } catch (e) {}
  }

  function removeActiveOverlay() {
    if (activeOverlay) {
      try {
        activeOverlay.classList.add("purifai-overlay-exit");
        var ref = activeOverlay;
        setTimeout(function () {
          try { ref.remove(); } catch (e) {}
        }, 300);
      } catch (e) {}
      activeOverlay = null;
    }
    try {
      var old = (window.top || window).document.getElementById("purifai-blocking-overlay");
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
    
    var msgId = getMessageId(element);
    if (processedMessageIds.has(msgId) && !element.isContentEditable) {
        // Skip scanning if we've already processed this rendered email body
        // (We still scan contentEditable inputs continuously as the user types)
        return;
    }

    lastScannedText = trimmed;

    console.log("[PurifAI] Scanning text:", trimmed.substring(0, 80) + "...");
    
    showGlassShield(element);

    scanText(trimmed).then(function (result) {
      handleScanResponse(result, element, trimmed);
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
  document.addEventListener("keyup", function (e) {
    var t = e.target;
    if (!t) return;
    if (!t.isContentEditable && t.getAttribute("contenteditable") !== "true") return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { handleInput(t); }, DEBOUNCE_MS);
  }, true);

  // ── Gmail-Specific Observer for Email Bodies ──────────────────────────────
  let currentEmailId = null;
  let hasTriggeredDanger = false;
  let isCurrentlyScanning = false;
  let apiDebounceTimer = null;

  var observer = new MutationObserver(function (mutations) {
    // ── The Circuit Breaker: Short-Circuit Logic ──
    var newEmailId = window.location.hash;
    if (newEmailId !== currentEmailId) {
      currentEmailId = newEmailId;
      hasTriggeredDanger = false;
      removeActiveOverlay();
    }

    if (hasTriggeredDanger) {
      return; // Do absolutely nothing if danger already triggered for this thread
    }
    
    // Clear the timeout: Every time the MutationObserver fires
    clearTimeout(apiDebounceTimer);

    var foundRelevantChange = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      
      // ── UI Blindspot: Ignore our own UI wrappers ──
      var target = m.target;
      if (target.nodeType === Node.ELEMENT_NODE) {
          if (target.className && typeof target.className === 'string' && target.className.includes('purifai-')) continue;
          if (target.closest && target.closest('[class*="purifai-"]')) continue;
      } else if (target.parentNode && target.parentNode.nodeType === Node.ELEMENT_NODE) {
          if (target.parentNode.closest && target.parentNode.closest('[class*="purifai-"]')) continue;
      }

      var hasPurifaiNode = false;
      for (var j = 0; j < m.addedNodes.length; j++) {
         var n = m.addedNodes[j];
         if (n.nodeType === Node.ELEMENT_NODE && n.className && typeof n.className === 'string' && n.className.includes('purifai-')) {
             hasPurifaiNode = true;
             break;
         }
      }
      if (hasPurifaiNode) continue;

      if (m.addedNodes.length > 0 || m.type === 'characterData') {
        foundRelevantChange = true;
        break;
      }
    }

    if (foundRelevantChange) {
      // Implement a strict 250ms Debounce Timer
      apiDebounceTimer = setTimeout(function () {
        // Preserve the Lock: set to true exactly when timer executes
        if (isCurrentlyScanning) return;
        isCurrentlyScanning = true;

        var emailContainers = document.querySelectorAll('.a3s.aiL, h2.hP');
        var combinedText = "";
        var mainElement = null;

        emailContainers.forEach(function (container) {
          // Precision DOM Targeting: Use innerText to ignore hidden scripts (<script>, <style>)
          var text = container.innerText || "";
          if (text.trim()) {
              combinedText += text.trim() + "\n";
              if (!mainElement) mainElement = container;
          }
        });

        var trimmed = combinedText.trim();
        if (trimmed.length < MIN_TEXT_LENGTH || trimmed === lastScannedText) {
          isCurrentlyScanning = false;
          return;
        }

        var msgId = mainElement ? getMessageId(mainElement) : currentEmailId;
        if (processedMessageIds.has(msgId)) {
          isCurrentlyScanning = false;
          return;
        }

        lastScannedText = trimmed;
        if (mainElement) showGlassShield(mainElement);

        scanText(trimmed).then(function (result) {
          isCurrentlyScanning = false;
          if (mainElement) {
              handleScanResponse(result, mainElement, trimmed);
          }
        });
      }, 250);
    }
  });

  // Start observing after a short delay to let the page settle
  setTimeout(function () {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      console.log("[PurifAI] Gmail MutationObserver started.");
    }
  }, 1000);

  // ── Listen for interceptor-level blocks (network layer) ───────────────────
  // When interceptor.js (MAIN world) detects and redacts a malicious payload
  // from a fetch/XHR response, it posts this event so we can show the
  // blocking overlay to the user.
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "PURIFAI_INTERCEPT_BLOCKED") return;

    var blockData = event.data.data;
    if (!blockData) return;

    console.log("[PurifAI] 🔒 Network-level interception received:", blockData.url);

    // Build a scan result object compatible with showBlockingOverlay
    var fakeResult = {
      text: blockData.text || "",
      confidence: blockData.confidence || 0.99,
      label: blockData.label || "INJECTION",
      is_safe: false,
    };

    // Use document.body as the element since the malicious text was
    // intercepted at the network level (never hit the DOM)
    var target = document.body || document.documentElement;
    showBlockingOverlay(target, fakeResult);
  });

  // ── Signal to interceptor.js that scanner is ready ────────────────────────
  // interceptor.js (MAIN world) queues PURIFAI_INTERCEPT_BLOCKED events
  // until it receives this signal, solving the race condition where
  // injections are detected during page load before scanner.js is loaded.
  window.postMessage({ type: "PURIFAI_SCANNER_READY" }, "*");
  console.log("[PurifAI] Scanner ready — notified interceptor.");

})();
