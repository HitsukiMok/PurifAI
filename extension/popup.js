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

// ── State update handler ────────────────────────────────────────────────────
function handleStateUpdate(state) {
  currentState = state;
  if (state.loggedIn && state.user) {
    showDashboardScreen();
    renderUserAvatar(state.user);
    renderConnection(state);
    renderMetrics(state.metrics);
    renderTrafficRows(state.rows || []);
    updateDashboardUrl(state);
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
    chrome.tabs.create({ url: "http://localhost:8080" });
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
function renderConnection(state) {
  const badge   = document.getElementById("conn-badge");
  const label   = document.getElementById("conn-label");
  const urlDot  = document.getElementById("url-dot");
  const urlText = document.getElementById("url-text");
  if (!badge) return;

  if (state.dashboardConnected) {
    badge.classList.remove("offline"); badge.classList.add("live");
    label.textContent = "Live";
    urlDot.style.background = "var(--green)";
    urlText.classList.remove("not-connected");
    urlText.textContent = state.dashboardUrl || "localhost — AgentShield Dashboard";
  } else {
    badge.classList.remove("live"); badge.classList.add("offline");
    label.textContent = "Offline";
    urlDot.style.background = "var(--amber)";
    urlText.classList.add("not-connected");
    urlText.textContent = "Not connected to AgentShield Dashboard";
  }
}

function updateDashboardUrl(state) {
  const btn = document.getElementById("open-dashboard-btn");
  if (btn) btn.href = state.dashboardUrl || "http://localhost:8080";
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

function renderTrafficRows(rows) {
  const tbody = document.getElementById("traffic-tbody");
  const count = document.getElementById("traffic-count");
  if (!tbody) return;

  const display = rows.slice(0, 10);
  count.textContent = `${rows.length} rows`;

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
      renderTrafficRows(currentState?.rows || []);
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
