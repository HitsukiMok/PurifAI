// ── AgentShield Extension Popup Script ─────────────────────────────────────
"use strict";

// ── State ──────────────────────────────────────────────────────────────────
let currentState  = null;
let selectedRow   = null;
let port          = null;
let userDropOpen  = false;

// ── Theme (runs before render to avoid flash) ──────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem("agentshield-ext-theme") || "dark";
  applyTheme(saved);
})();

function applyTheme(t) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(t);
  const sun  = document.getElementById("theme-icon-sun");
  const moon = document.getElementById("theme-icon-moon");
  if (!sun || !moon) return;
  if (t === "dark") { sun.style.display = "none"; moon.style.display = ""; }
  else              { sun.style.display = "";     moon.style.display = "none"; }
}

// ── Screen helpers ─────────────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("dashboard-screen").classList.add("hidden");
}

function showDashboardScreen() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("dashboard-screen").classList.remove("hidden");
}

// ── On load: check if already logged in ───────────────────────────────────
chrome.storage.local.get(["purifaiState"], (res) => {
  const state = res.purifaiState;
  if (state?.loggedIn && state?.user) {
    showDashboardScreen();
    handleStateUpdate(state);
  } else {
    showAuthScreen();
    if (state) handleStateUpdate(state);
  }
});

// ── Background port ─────────────────────────────────────────────────────────
function connectToBackground() {
  try {
    port = chrome.runtime.connect({ name: "agentshield-popup" });
    port.onMessage.addListener((msg) => {
      if (msg.type === "STATE_UPDATE") handleStateUpdate(msg.state);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connectToBackground, 1500);
    });
  } catch (e) {
    console.warn("[AgentShield] Could not connect to background:", e);
  }
}
connectToBackground();
checkBackgroundStatus();

// ── State update handler ────────────────────────────────────────────────────
function handleStateUpdate(state) {
  currentState = state;
  if (state.loggedIn && state.user) {
    showDashboardScreen();
    renderUserAvatar(state.user);
    renderConnection(state);
    renderMetrics({ scanned: state.totalScans, blocked: state.threatsBlocked, agents: state.agentsProtected });
    renderTrafficRows(state.recentLogs || []);
  } else {
    showAuthScreen();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SCREEN LOGIC
// ═══════════════════════════════════════════════════════════════════════════

// ── Tab switching ───────────────────────────────────────────────────────────
document.getElementById("tab-signin").addEventListener("click", () => switchTab("signin"));
document.getElementById("tab-signup").addEventListener("click", () => switchTab("signup"));

function switchTab(tab) {
  const signinTab = document.getElementById("tab-signin");
  const signupTab = document.getElementById("tab-signup");
  const signinForm = document.getElementById("form-signin");
  const signupForm = document.getElementById("form-signup");

  if (tab === "signin") {
    signinTab.classList.add("active");
    signupTab.classList.remove("active");
    signinForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  } else {
    signupTab.classList.add("active");
    signinTab.classList.remove("active");
    signupForm.classList.remove("hidden");
    signinForm.classList.add("hidden");
  }
  // Clear errors
  document.getElementById("si-error").textContent = "";
  document.getElementById("su-error").textContent = "";
}

// ── Password eye toggle (sign in) ───────────────────────────────────────────
document.getElementById("si-eye").addEventListener("click", () => {
  const input = document.getElementById("si-password");
  const open  = document.getElementById("si-eye-open");
  const closed = document.getElementById("si-eye-closed");
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  open.style.display   = isHidden ? "none" : "";
  closed.style.display = isHidden ? "" : "none";
});

// ── Sign In form submit ─────────────────────────────────────────────────────
document.getElementById("form-signin").addEventListener("submit", (e) => {
  e.preventDefault();
  const email    = document.getElementById("si-email").value.trim();
  const password = document.getElementById("si-password").value;
  const errEl    = document.getElementById("si-error");

  errEl.textContent = "";

  if (!email) { errEl.textContent = "Please enter your email."; return; }
  if (!email.includes("@")) { errEl.textContent = "Enter a valid email address."; return; }
  if (!password) { errEl.textContent = "Please enter your password."; return; }
  if (password.length < 6) { errEl.textContent = "Password must be at least 6 characters."; return; }

  // Show loading state
  const btn = document.getElementById("si-submit");
  btn.textContent = "Signing in…";
  btn.disabled = true;

  // Simulate auth (replace with real API call if needed)
  setTimeout(() => {
    btn.textContent = "Sign In";
    btn.disabled = false;
    const name = email.split("@")[0];
    const user = { name, email };
    if (port) port.postMessage({ type: "LOGIN", user });
    // Optimistically show dashboard
    showDashboardScreen();
    renderUserAvatar(user);
  }, 800);
});

// ── Sign Up form submit ─────────────────────────────────────────────────────
document.getElementById("form-signup").addEventListener("submit", (e) => {
  e.preventDefault();
  const name     = document.getElementById("su-name").value.trim();
  const email    = document.getElementById("su-email").value.trim();
  const password = document.getElementById("su-password").value;
  const errEl    = document.getElementById("su-error");

  errEl.textContent = "";

  if (!name) { errEl.textContent = "Please enter your full name."; return; }
  if (!email || !email.includes("@")) { errEl.textContent = "Enter a valid email address."; return; }
  if (!password || password.length < 8) { errEl.textContent = "Password must be at least 8 characters."; return; }

  const btn = document.getElementById("su-submit");
  btn.textContent = "Creating account…";
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = "Create Account";
    btn.disabled = false;
    const user = { name, email };
    if (port) port.postMessage({ type: "LOGIN", user });
    showDashboardScreen();
    renderUserAvatar(user);
  }, 900);
});

// ── Open Dashboard links (auth screen) ─────────────────────────────────────
["open-dashboard-signin", "open-dashboard-signup"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD SCREEN LOGIC
// ═══════════════════════════════════════════════════════════════════════════

// ── Theme toggle ───────────────────────────────────────────────────────────
const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark");
    const next   = isDark ? "light" : "dark";
    localStorage.setItem("agentshield-ext-theme", next);
    applyTheme(next);
  });
}

// ── User avatar ────────────────────────────────────────────────────────────
function renderUserAvatar(user) {
  const initials = (user.name || "U").slice(0, 2).toUpperCase();
  const el = document.getElementById("user-initials");
  const elLg = document.getElementById("user-avatar-lg");
  const nameEl  = document.getElementById("user-name-dd");
  const emailEl = document.getElementById("user-email-dd");
  if (el) el.textContent = initials;
  if (elLg) elLg.textContent = initials;
  if (nameEl) nameEl.textContent = user.name || "Agent";
  if (emailEl) emailEl.textContent = user.email || "";
}

// ── User menu dropdown ─────────────────────────────────────────────────────
const userMenuBtn = document.getElementById("user-menu-btn");
const userDropdown = document.getElementById("user-dropdown");

if (userMenuBtn && userDropdown) {
  userMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropOpen = !userDropOpen;
    userDropdown.classList.toggle("hidden", !userDropOpen);
  });
  document.addEventListener("click", () => {
    if (userDropOpen) {
      userDropOpen = false;
      userDropdown.classList.add("hidden");
    }
  });
}

// ── Logout ─────────────────────────────────────────────────────────────────
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (port) port.postMessage({ type: "LOGOUT" });
    userDropOpen = false;
    if (userDropdown) userDropdown.classList.add("hidden");
    showAuthScreen();
    switchTab("signin");
  });
}

// ── Connection status ──────────────────────────────────────────────────────
function checkBackgroundStatus() {
  const badge   = document.getElementById("conn-badge");
  const label   = document.getElementById("conn-label");
  if (!badge || !label) return;

  label.textContent = "Checking...";
  
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    badge.classList.remove("live"); badge.classList.add("offline");
    label.textContent = "Disconnected";
  }, 2000);

  try {
    chrome.runtime.sendMessage({ type: "PURIFAI_STATUS_CHECK" }, (response) => {
      if (timedOut) return;
      clearTimeout(timer);
      if (chrome.runtime.lastError || !response || !response.ok) {
        badge.classList.remove("live"); badge.classList.add("offline");
        label.textContent = "Disconnected";
      } else {
        badge.classList.remove("offline"); badge.classList.add("live");
        label.textContent = "Connected";
      }
    });
  } catch (e) {
    clearTimeout(timer);
    badge.classList.remove("live"); badge.classList.add("offline");
    label.textContent = "Disconnected";
  }
}

function renderConnection(state) {
  const urlDot  = document.getElementById("url-dot");
  const urlText = document.getElementById("url-text");
  if (!urlDot) return;

  if (state.dashboardConnected) {
    urlDot.style.background = "var(--green)";
    urlText.classList.remove("not-connected");
    urlText.textContent = state.dashboardUrl || "localhost — AgentShield Dashboard";
  } else {
    urlDot.style.background = "var(--amber)";
    urlText.classList.add("not-connected");
    urlText.textContent = "Not connected to AgentShield Dashboard";
  }
}

const openDashboardBtn = document.getElementById("open-dashboard-btn");
if (openDashboardBtn) {
  openDashboardBtn.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "http://localhost:5173" });
  });
}

// ── Metrics ────────────────────────────────────────────────────────────────
let prevScanned = null, prevBlocked = null;

function renderMetrics(metrics) {
  if (!metrics) return;
  const scannedEl = document.getElementById("m-scanned");
  const blockedEl = document.getElementById("m-blocked");
  const agentsEl  = document.getElementById("m-agents");
  if (!scannedEl) return;

  if (prevScanned !== null && metrics.scanned !== prevScanned) {
    scannedEl.classList.remove("metric-pop"); void scannedEl.offsetWidth;
    scannedEl.classList.add("metric-pop");
  }
  if (prevBlocked !== null && metrics.blocked !== prevBlocked) {
    blockedEl.classList.remove("metric-pop"); void blockedEl.offsetWidth;
    blockedEl.classList.add("metric-pop");
  }

  scannedEl.textContent = (metrics.scanned || 0).toLocaleString();
  blockedEl.textContent = (metrics.blocked || 0).toLocaleString();
  agentsEl.textContent  = (metrics.agents  || 0).toString();
  prevScanned = metrics.scanned;
  prevBlocked = metrics.blocked;
}

// ── Traffic Table ──────────────────────────────────────────────────────────
let renderedIds = [];

function riskClass(risk) {
  if (risk >= 80) return "high";
  if (risk >= 50) return "medium";
  return "low";
}

function renderTrafficRows(recentLogs) {
  const tbody = document.getElementById("traffic-tbody");
  const count = document.getElementById("traffic-count");
  if (!tbody) return;

  const display = recentLogs.slice(0, 10);
  count.textContent = `${recentLogs.length} rows`;

  const newIds = new Set(display.map((r) => r.id).filter((id) => !renderedIds.includes(id)));
  renderedIds = display.map((r) => r.id);
  tbody.innerHTML = "";

  for (const row of display) {
    const blocked = row.status === "Blocked";
    const rc = riskClass(row.risk);
    const isNew = newIds.has(row.id);
    const isSelected = selectedRow && selectedRow.id === row.id;

    const tr = document.createElement("tr");
    if (isNew) tr.classList.add("row-in");
    if (isSelected) tr.classList.add("selected");

    tr.innerHTML = `
      <td class="td-time">${row.time}</td>
      <td class="td-agent">${escHtml(row.agent)}</td>
      <td>
        <div class="td-risk ${rc}">${row.risk}%</div>
        <div class="risk-bar-wrap"><div class="risk-bar ${rc}" style="width:${row.risk}%"></div></div>
      </td>
      <td>
        <span class="status-badge ${blocked ? "blocked" : "clean"}">
          <span class="status-dot"></span>${blocked ? "Block" : "OK"}
        </span>
      </td>
    `;

    tr.addEventListener("click", () => {
      selectedRow = row;
      renderInspectPanel(row);
      renderTrafficRows(currentState?.recentLogs || []);
    });

    tbody.appendChild(tr);
  }
}

// ── Inspect Panel ──────────────────────────────────────────────────────────
function renderInspectPanel(row) {
  const panel = document.getElementById("inspect-panel");
  if (!panel) return;
  panel.classList.add("visible", "fade-in");

  const blocked = row.status === "Blocked";
  const riskLevel = row.risk >= 80 ? "Critical" : row.risk >= 50 ? "Medium" : "Low";

  document.getElementById("inspect-technique").textContent = row.technique || (blocked ? "Unknown" : "None — Safe");
  document.getElementById("inspect-time").textContent      = row.time;
  document.getElementById("inspect-risk").textContent      = `${row.risk}% ${riskLevel}`;
  document.getElementById("inspect-source").textContent    = shortenSource(row.source || "—");
  document.getElementById("inspect-agent").textContent     = row.agent;

  const payloadEl = document.getElementById("inspect-payload");
  if (row.payload) {
    const before = row.raw || row.payload;
    const parts  = before.split(row.payload);
    payloadEl.innerHTML = parts.map((p, i) =>
      i < parts.length - 1
        ? escHtml(p) + `<mark>${escHtml(row.payload)}</mark>`
        : escHtml(p)
    ).join("");
  } else if (row.raw) {
    payloadEl.textContent = row.raw;
  } else {
    payloadEl.textContent = blocked ? "No payload captured" : "Content scanned — no threats detected.";
  }
}

function shortenSource(src) {
  return src.replace(/^[a-z]+:\/\//, "");
}

// ── Simulate Attack ────────────────────────────────────────────────────────
const simulateBtn = document.getElementById("simulate-btn");
if (simulateBtn) {
  simulateBtn.addEventListener("click", () => {
    if (port) port.postMessage({ type: "SIMULATE_ATTACK" });
  });
}

// ── Utility ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD TABS & FILE SCANNER
// ═══════════════════════════════════════════════════════════════════════════

// ── Tab Switching ──────────────────────────────────────────────────────────
const dashTabs = document.querySelectorAll('.ext-dash-tab');
const dashViews = document.querySelectorAll('.dash-view');

dashTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-dash-tab');
    
    dashTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    dashViews.forEach(view => {
      if (view.id === `view-${target}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });
  });
});

// ── File Scanner Logic ─────────────────────────────────────────────────────
const dropzone = document.getElementById('scanner-dropzone');
const fileInput = document.getElementById('scanner-file-input');
const dropText = document.getElementById('drop-text');
const scanBtn = document.getElementById('scanner-btn');
const scanError = document.getElementById('scanner-error');
const scanResult = document.getElementById('scanner-result');
const resBadge = document.getElementById('res-badge');
const resConf = document.getElementById('res-conf');
const resTextWrap = document.getElementById('res-text-wrap');
const resText = document.getElementById('res-text');
const resNote = document.getElementById('res-note');

let selectedFile = null;

function handleFileSelect(file) {
  scanError.classList.add('hidden');
  scanResult.classList.add('hidden');
  
  if (!file) {
    selectedFile = null;
    dropText.textContent = "Drag & drop or click to upload";
    dropzone.classList.remove('has-file');
    scanBtn.disabled = true;
    return;
  }
  
  // Validate type
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pdf' && ext !== 'txt') {
    scanError.textContent = "Unsupported file type. Only .pdf and .txt are allowed.";
    scanError.classList.remove('hidden');
    selectedFile = null;
    dropText.textContent = "Drag & drop or click to upload";
    dropzone.classList.remove('has-file');
    scanBtn.disabled = true;
    return;
  }
  
  // Validate size (2MB = 2 * 1024 * 1024 bytes)
  if (file.size > 2 * 1024 * 1024) {
    scanError.textContent = "File too large. Max size is 2MB for the MVP.";
    scanError.classList.remove('hidden');
    selectedFile = null;
    dropText.textContent = "Drag & drop or click to upload";
    dropzone.classList.remove('has-file');
    scanBtn.disabled = true;
    return;
  }
  
  selectedFile = file;
  dropText.textContent = file.name;
  dropzone.classList.add('has-file');
  scanBtn.disabled = false;
}

// Click to upload
if (dropzone && fileInput) {
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
  });
}

// Drag and drop
if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
}

// Scan Execution
if (scanBtn) {
  scanBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    // UI Loading state
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="purifai-glass-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Scanning... (This may take a moment)';
    scanError.classList.add('hidden');
    scanResult.classList.add('hidden');
    
    const formData = new FormData();
    formData.append("file", selectedFile, selectedFile.name);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/scan-file", {
        method: "POST",
        body: formData
      });
      
      if (response.status === 429) {
        scanError.textContent = "Scan unavailable (Server Busy). Please wait 10 seconds and try again.";
        scanError.classList.remove('hidden');
        scanBtn.innerHTML = 'Scan File';
        scanBtn.disabled = false;
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Render results
      scanResult.classList.remove('hidden');
      
      if (data.is_safe) {
        resBadge.textContent = "Safe";
        resBadge.className = "res-badge safe";
        resConf.textContent = data.confidence ? `Confidence: ${(data.confidence*100).toFixed(1)}%` : "";
        resTextWrap.classList.add('hidden');
      } else {
        resBadge.textContent = "Injection Detected";
        resBadge.className = "res-badge danger";
        resConf.textContent = data.confidence ? `Confidence: ${(data.confidence*100).toFixed(1)}%` : "";
        resTextWrap.classList.remove('hidden');
        resText.textContent = data.malicious_text || "Malicious text identified in payload.";
      }
      
      if (data.partial_scan) {
        resNote.textContent = data.note || "Only partial content was scanned due to length limits.";
        resNote.classList.remove('hidden');
      } else {
        resNote.classList.add('hidden');
      }
      
    } catch (err) {
      scanError.textContent = "Failed to connect to PurifAI backend. Ensure the server is running.";
      scanError.classList.remove('hidden');
    } finally {
      scanBtn.innerHTML = 'Scan File';
      scanBtn.disabled = false;
    }
  });
}
