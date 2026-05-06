// ── PurifAI Network Interceptor ────────────────────────────────────────────
// Runs in the MAIN world (same JS context as the webpage).
// Monkey-patches window.fetch and XMLHttpRequest so that every network
// response is scanned for prompt injections BEFORE the web app receives it.
//
// If malicious content is detected, the dangerous strings are redacted
// from the response body and replaced with a safe marker. The web app
// (e.g. Gmail) never sees the original payload — zero DOM exposure.
//
// Communication flow:
//   interceptor.js (MAIN)  →  window.postMessage("PURIFAI_INTERCEPT_SCAN")
//   content.js (ISOLATED)  →  chrome.runtime.sendMessage → background.js
//   background.js          →  backend /api/scan
//   results flow back the same path in reverse
// ───────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ── Configuration ─────────────────────────────────────────────────────────
  var SCAN_TIMEOUT_MS = 800;         // Fail-open if scan takes longer
  var MIN_TEXT_LENGTH = 60;          // Only scan strings >= 60 chars (reduces noise)
  var MAX_CHUNK_LENGTH = 1500;       // Truncate long strings before scanning
  var MAX_CHUNKS_PER_RESPONSE = 5;   // Max 5 chunks per response (reduces noise)
  var MAX_RESPONSE_SIZE = 300000;    // Skip responses larger than 300KB
  var REDACTION_MARKER = "[⛔ BLOCKED BY PURIFAI — Prompt Injection Detected]";

  // ── Deduplication & Rate Limiting ─────────────────────────────────────────
  var scannedTextCache = {};         // text hash → true (already scanned)
  var cacheMaxSize = 200;            // Max cache entries before clearing
  var overlayShownThisPage = false;  // Only show one overlay per page load

  // ── Scanner readiness queue ───────────────────────────────────────────────
  // scanner.js loads at document_idle, which is AFTER we start intercepting.
  // We queue blocked events until scanner.js signals it's ready.
  var scannerReady = false;
  var pendingBlocks = [];

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === "PURIFAI_SCANNER_READY") {
      scannerReady = true;
      // Replay any blocks that arrived before scanner loaded
      for (var i = 0; i < pendingBlocks.length; i++) {
        window.postMessage(pendingBlocks[i], "*");
      }
      pendingBlocks = [];
    }
  });

  function notifyBlock(data) {
    if (overlayShownThisPage) return; // Only one overlay per page
    overlayShownThisPage = true;

    var msg = { type: "PURIFAI_INTERCEPT_BLOCKED", data: data };
    if (scannerReady) {
      window.postMessage(msg, "*");
    } else {
      pendingBlocks.push(msg);
    }
  }

  // ── Text hashing for deduplication ────────────────────────────────────────
  function hashText(text) {
    // Simple fast hash (djb2)
    var hash = 5381;
    for (var i = 0; i < Math.min(text.length, 200); i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit int
    }
    return hash.toString(36);
  }

  function isAlreadyScanned(text) {
    var h = hashText(text);
    if (scannedTextCache[h]) return true;
    // Clear cache if too large
    if (Object.keys(scannedTextCache).length > cacheMaxSize) {
      scannedTextCache = {};
    }
    scannedTextCache[h] = true;
    return false;
  }

  // URLs to never intercept (our own infra + static assets)
  var SKIP_URL_PATTERNS = [
    /localhost:8000/,   // Our backend API
    /localhost:8080/,   // Our dashboard
    /localhost:5173/,   // Vite dev server
    /chrome-extension:\/\//,
    /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|bmp)(\?|#|$)/i,
    /\.(woff2?|ttf|eot|otf)(\?|#|$)/i,
    /\.(css|less|scss|sass)(\?|#|$)/i,
    /\.(js|mjs|cjs|ts|tsx|jsx|map)(\?|#|$)/i,
    /\.(mp3|mp4|webm|ogg|wav|avi)(\?|#|$)/i,
    /\.(zip|gz|tar|br|zst)(\?|#|$)/i,
    /\.(pdf|doc|docx|xls|xlsx)(\?|#|$)/i,
    /googleapis\.com\/\$discovery/,    // Google API discovery docs
    /apis\.google\.com/,               // Google APIs JS SDK
    /fonts\.googleapis\.com/,          // Google Fonts
    /www\.gstatic\.com/,               // Google static assets
    /play\.google\.com/,               // Play Store
    /accounts\.google\.com/,           // Auth endpoints
  ];

  // Content types that could carry text payloads
  var TEXT_CONTENT_TYPES = [
    "application/json",
    "text/html",
    "text/plain",
    "text/xml",
    "application/xml",
  ];

  console.log("[PurifAI Interceptor] 🔒 Network interceptor loaded — MAIN world.");

  // ── Utility: Should we skip this URL? ─────────────────────────────────────
  function shouldSkipUrl(url) {
    if (!url) return true;
    for (var i = 0; i < SKIP_URL_PATTERNS.length; i++) {
      if (SKIP_URL_PATTERNS[i].test(url)) return true;
    }
    return false;
  }

  // ── Utility: Is this a text-bearing content type? ─────────────────────────
  function isTextContentType(contentType) {
    if (!contentType) return false; // Unknown → skip (conservative)
    var ct = contentType.toLowerCase();
    for (var i = 0; i < TEXT_CONTENT_TYPES.length; i++) {
      if (ct.indexOf(TEXT_CONTENT_TYPES[i]) !== -1) return true;
    }
    return false;
  }

  // ── Utility: Extract scannable text chunks from a response body ───────────
  function extractChunks(bodyText) {
    var chunks = [];

    // Try to parse as JSON (strip anti-XSSI prefixes first)
    var jsonText = bodyText;
    if (jsonText.indexOf(")]}'") === 0) {
      var nlIndex = jsonText.indexOf("\n");
      if (nlIndex !== -1) jsonText = jsonText.substring(nlIndex + 1);
    }
    if (jsonText.indexOf("for(;;);") === 0) {
      jsonText = jsonText.substring(8);
    }

    try {
      var parsed = JSON.parse(jsonText);
      collectStrings(parsed, chunks, 0);
    } catch (e) {
      // Not JSON — treat as raw text (possibly HTML)
      var stripped = bodyText.replace(/<[^>]+>/g, " ").trim();
      if (stripped.length >= MIN_TEXT_LENGTH) {
        chunks.push(stripped.substring(0, MAX_CHUNK_LENGTH));
      }
    }

    // Filter: deduplicate, remove already-scanned, cap count
    var result = [];
    for (var i = 0; i < chunks.length && result.length < MAX_CHUNKS_PER_RESPONSE; i++) {
      var c = chunks[i].trim();
      if (c.length >= MIN_TEXT_LENGTH && !isAlreadyScanned(c)) {
        result.push(c);
      }
    }
    return result;
  }

  // ── Utility: Recursively extract strings from a JSON object ───────────────
  function collectStrings(obj, results, depth) {
    if (depth > 8) return;
    if (results.length >= MAX_CHUNKS_PER_RESPONSE * 2) return;

    if (typeof obj === "string") {
      if (obj.length >= MIN_TEXT_LENGTH) {
        // Attempt base64 decode for email bodies
        var decoded = tryBase64Decode(obj);
        if (decoded && decoded.length >= MIN_TEXT_LENGTH) {
          results.push(decoded.substring(0, MAX_CHUNK_LENGTH));
        } else {
          results.push(obj.substring(0, MAX_CHUNK_LENGTH));
        }
      }
    } else if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && results.length < MAX_CHUNKS_PER_RESPONSE * 2; i++) {
        collectStrings(obj[i], results, depth + 1);
      }
    } else if (obj && typeof obj === "object") {
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length && results.length < MAX_CHUNKS_PER_RESPONSE * 2; i++) {
        collectStrings(obj[keys[i]], results, depth + 1);
      }
    }
  }

  // ── Utility: Try to base64-decode a string (for email bodies) ─────────────
  function tryBase64Decode(str) {
    if (str.length < 40) return null;
    if (/[^A-Za-z0-9+/=\n\r]/.test(str)) return null;
    try {
      var decoded = atob(str.replace(/\s/g, ""));
      var printable = 0;
      for (var i = 0; i < Math.min(decoded.length, 100); i++) {
        var code = decoded.charCodeAt(i);
        if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
          printable++;
        }
      }
      if (printable / Math.min(decoded.length, 100) > 0.85) {
        return decoded;
      }
    } catch (e) {}
    return null;
  }

  // ── Core: Send chunks to content.js and wait for scan results ─────────────
  function scanViaContentBridge(chunks) {
    return new Promise(function (resolve) {
      var requestId = Math.random().toString(36).substring(2) + Date.now().toString(36);

      var handler = function (event) {
        if (event.source !== window) return;
        if (!event.data || event.data.type !== "PURIFAI_INTERCEPT_RESULT") return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener("message", handler);
        clearTimeout(timeoutId);
        resolve(event.data.results || null);
      };

      window.addEventListener("message", handler);

      var timeoutId = setTimeout(function () {
        window.removeEventListener("message", handler);
        resolve(null); // fail-open
      }, SCAN_TIMEOUT_MS);

      window.postMessage({
        type: "PURIFAI_INTERCEPT_SCAN",
        requestId: requestId,
        texts: chunks,
      }, "*");
    });
  }

  // ── Core: Redact malicious strings from a response body ───────────────────
  function redactBody(bodyText, scanResults, chunks) {
    var modified = bodyText;
    for (var i = 0; i < scanResults.length; i++) {
      if (!scanResults[i] || scanResults[i].is_safe !== false) continue;
      var maliciousText = chunks[i];
      var escaped = maliciousText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        modified = modified.replace(new RegExp(escaped, "g"), REDACTION_MARKER);
      } catch (e) {
        while (modified.indexOf(maliciousText) !== -1) {
          modified = modified.replace(maliciousText, REDACTION_MARKER);
        }
      }
    }
    return modified;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FETCH MONKEY-PATCH
  // ═══════════════════════════════════════════════════════════════════════════

  var originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    var url = "";
    if (typeof input === "string") url = input;
    else if (input && input.url) url = input.url;
    else if (input instanceof URL) url = input.href;

    if (shouldSkipUrl(url)) {
      return originalFetch.apply(this, arguments);
    }

    var response;
    try {
      response = await originalFetch.apply(this, arguments);
    } catch (err) {
      throw err;
    }

    var contentType = "";
    try { contentType = response.headers.get("content-type") || ""; } catch (e) {}
    if (!isTextContentType(contentType)) return response;
    if (!response.ok && response.status !== 200) return response;

    var clone;
    try { clone = response.clone(); } catch (e) { return response; }

    var bodyText;
    try { bodyText = await clone.text(); } catch (e) { return response; }

    if (bodyText.length < 100 || bodyText.length > MAX_RESPONSE_SIZE) return response;

    var chunks = extractChunks(bodyText);
    if (chunks.length === 0) return response;

    var scanResults = await scanViaContentBridge(chunks);
    if (!scanResults) return response;

    var hasInjection = false;
    var topResult = null;
    for (var i = 0; i < scanResults.length; i++) {
      if (scanResults[i] && scanResults[i].is_safe === false) {
        hasInjection = true;
        if (!topResult || scanResults[i].confidence > topResult.confidence) {
          topResult = scanResults[i];
        }
      }
    }

    if (!hasInjection) return response;

    console.warn("[PurifAI Interceptor] 🚨 INJECTION INTERCEPTED in fetch from:", url);
    var sanitized = redactBody(bodyText, scanResults, chunks);

    // Notify scanner to show blocking overlay
    notifyBlock({
      url: url,
      text: topResult ? topResult.text : chunks[0],
      confidence: topResult ? topResult.confidence : 0.99,
      label: topResult ? topResult.label : "INJECTION",
    });

    return new Response(sanitized, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  console.log("[PurifAI Interceptor] ✅ window.fetch patched.");

  // ═══════════════════════════════════════════════════════════════════════════
  //  XMLHTTPREQUEST MONKEY-PATCH
  // ═══════════════════════════════════════════════════════════════════════════

  var xhrProto = window.XMLHttpRequest.prototype;
  var originalOpen = xhrProto.open;
  var originalSend = xhrProto.send;
  var responseTextDesc = Object.getOwnPropertyDescriptor(xhrProto, "responseText");
  var responseDesc = Object.getOwnPropertyDescriptor(xhrProto, "response");

  xhrProto.open = function (method, url) {
    this._purifaiUrl = typeof url === "string" ? url : (url ? url.toString() : "");
    this._purifaiSkip = shouldSkipUrl(this._purifaiUrl);
    this._purifaiRedacted = null;
    this._purifaiScanned = false;
    return originalOpen.apply(this, arguments);
  };

  xhrProto.send = function () {
    var self = this;
    if (self._purifaiSkip) return originalSend.apply(this, arguments);

    self.addEventListener("readystatechange", function () {
      if (self.readyState !== 4 || self._purifaiScanned) return;
      self._purifaiScanned = true;

      var ct = "";
      try { ct = self.getResponseHeader("content-type") || ""; } catch (e) {}
      if (!isTextContentType(ct)) return;

      var rawText = "";
      try {
        rawText = responseTextDesc ? responseTextDesc.get.call(self) : self.responseText;
      } catch (e) { return; }

      if (!rawText || rawText.length < 100 || rawText.length > MAX_RESPONSE_SIZE) return;

      var chunks = extractChunks(rawText);
      if (chunks.length === 0) return;

      scanViaContentBridge(chunks).then(function (scanResults) {
        if (!scanResults) return;

        var topResult = null;
        for (var i = 0; i < scanResults.length; i++) {
          if (scanResults[i] && scanResults[i].is_safe === false) {
            if (!topResult || scanResults[i].confidence > topResult.confidence) {
              topResult = scanResults[i];
            }
          }
        }
        if (!topResult) return;

        self._purifaiRedacted = redactBody(rawText, scanResults, chunks);
        notifyBlock({
          url: self._purifaiUrl,
          text: topResult.text,
          confidence: topResult.confidence,
          label: topResult.label,
        });
      });
    });

    return originalSend.apply(this, arguments);
  };

  if (responseTextDesc && responseTextDesc.get) {
    Object.defineProperty(xhrProto, "responseText", {
      get: function () {
        return (this._purifaiRedacted != null) ? this._purifaiRedacted : responseTextDesc.get.call(this);
      },
      configurable: true,
    });
  }

  if (responseDesc && responseDesc.get) {
    Object.defineProperty(xhrProto, "response", {
      get: function () {
        if (this._purifaiRedacted != null && (this.responseType === "" || this.responseType === "text")) {
          return this._purifaiRedacted;
        }
        return responseDesc.get.call(this);
      },
      configurable: true,
    });
  }

  console.log("[PurifAI Interceptor] ✅ XMLHttpRequest patched.");

})();
