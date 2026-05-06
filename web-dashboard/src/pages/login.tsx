import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Shield, Mail, Lock, User, Eye, EyeOff, Puzzle,
  ArrowRight, Check, Globe2,
} from "lucide-react";
import { getAuth, setAuth, makeAvatarInitials, type AuthUser } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — AgentShield Platform" },
      { name: "description", content: "Sign in or connect your Chrome extension to AgentShield." },
    ],
  }),
  component: LoginPage,
});

type Tab = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sign-in fields
  const [siEmail, setSiEmail] = useState("");
  const [siPw, setSiPw] = useState("");

  // Sign-up fields
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPw, setSuPw] = useState("");

  // Already logged in → redirect straight to dashboard
  useEffect(() => {
    if (getAuth()) navigate({ to: "/" });
  }, [navigate]);

  function login(user: AuthUser) {
    setAuth(user);
    navigate({ to: "/" });
  }

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!siEmail || !siEmail.includes("@")) { setError("Enter a valid email address."); return; }
    if (!siPw || siPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    // Simulate auth delay — replace with real API
    setTimeout(() => {
      setLoading(false);
      const name = siEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      login({ name, email: siEmail, method: "login", avatar: makeAvatarInitials(name) });
    }, 750);
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!suName.trim()) { setError("Please enter your full name."); return; }
    if (!suEmail || !suEmail.includes("@")) { setError("Enter a valid email address."); return; }
    if (!suPw || suPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login({ name: suName.trim(), email: suEmail, method: "login", avatar: makeAvatarInitials(suName) });
    }, 850);
  }

  function handleExtension() {
    // Extension "connect" flow — simulate connecting, then enter
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login({ name: "Extension User", email: "extension@agentshield.io", method: "extension", avatar: "EU" });
    }, 600);
  }

  const switchTab = (t: Tab) => { setTab(t); setError(""); setShowPw(false); };

  return (
    <div className="flex min-h-screen w-full bg-background scanline-bg">
      {/* ── Left hero panel ─────────────────────────────────────────────── */}
      <div className="relative hidden w-[45%] flex-col items-start justify-between overflow-hidden bg-card/60 p-10 lg:flex border-r border-border/40">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-ai/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-danger/5 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ai/40 bg-ai/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <Shield className="h-5 w-5 text-ai" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground">AgentShield</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Security Platform</div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground">
              Protect your<br />
              <span className="text-ai">AI agents</span><br />
              in real time.
            </h1>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              AgentShield detects and blocks indirect prompt injection attacks before they compromise your enterprise AI workflows.
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="space-y-3">
            {[
              { text: "Live traffic monitoring across all agents", color: "text-ai" },
              { text: "Payload inspection & technique analysis", color: "text-success" },
              { text: "Policy-based blocking with audit trail", color: "text-amber-400" },
              { text: "Chrome extension for always-on coverage", color: "text-purple-400" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${f.color} bg-current/10 ring-1 ring-current/20`}>
                  <Check className={`h-3 w-3 ${f.color}`} />
                </div>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Stats strip */}
        <div className="relative grid w-full grid-cols-3 gap-3">
          {[
            { label: "Agents Protected", value: "34" },
            { label: "Attacks Blocked", value: "127" },
            { label: "Uptime", value: "99.9%" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/50 bg-card/80 p-3 text-center">
              <div className="font-mono text-xl font-bold text-ai">{s.value}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right auth panel ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ai/40 bg-ai/10">
            <Shield className="h-4 w-4 text-ai" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">AgentShield</span>
        </div>

        <div className="w-full max-w-[380px] space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace or connect your browser extension.</p>
          </div>

          {/* ── Connect to Extension card ──────────────────────────────── */}
          <button
            id="connect-extension-btn"
            onClick={handleExtension}
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl border border-ai/35 bg-gradient-to-r from-ai/10 via-card to-purple-500/10 p-4 text-left transition-all hover:border-ai/60 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)] disabled:opacity-60"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ai/30 bg-ai/15 shadow-[0_0_14px_rgba(34,211,238,0.2)] transition-all group-hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]">
                <Globe2 className="h-5 w-5 text-ai" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Connect Extension</span>
                  <span className="rounded-full bg-ai/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ai border border-ai/25">Recommended</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Link your AgentShield Chrome extension to sync live data</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-ai" />
            </div>

            {/* Animated shimmer on hover */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ai/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>

          {/* ── OR divider ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">or sign in with email</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* ── Tab switcher ─────────────────────────────────────────── */}
          <div className="flex rounded-xl border border-border/60 bg-card p-1">
            <button
              id="tab-signin"
              onClick={() => switchTab("signin")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${tab === "signin" ? "bg-ai/15 text-ai shadow-sm border border-ai/25" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              onClick={() => switchTab("signup")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${tab === "signup" ? "bg-ai/15 text-ai shadow-sm border border-ai/25" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create Account
            </button>
          </div>

          {/* ── Sign In form ──────────────────────────────────────────── */}
          {tab === "signin" && (
            <form id="signin-form" onSubmit={handleSignIn} noValidate className="space-y-3">
              <Field label="Email" id="si-email">
                <FieldInput icon={<Mail className="h-3.5 w-3.5" />}>
                  <input
                    id="si-email"
                    type="email"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="field-input"
                  />
                </FieldInput>
              </Field>

              <Field label="Password" id="si-pw">
                <FieldInput icon={<Lock className="h-3.5 w-3.5" />} suffix={
                  <button type="button" id="si-eye" onClick={() => setShowPw((v) => !v)} className="eye-btn">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                }>
                  <input
                    id="si-password"
                    type={showPw ? "text" : "password"}
                    value={siPw}
                    onChange={(e) => setSiPw(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="field-input"
                  />
                </FieldInput>
              </Field>

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                id="signin-submit"
                type="submit"
                disabled={loading}
                className="auth-cta-btn"
              >
                {loading ? <Spinner /> : <><ArrowRight className="h-4 w-4" /> Sign In</>}
              </button>
            </form>
          )}

          {/* ── Sign Up form ──────────────────────────────────────────── */}
          {tab === "signup" && (
            <form id="signup-form" onSubmit={handleSignUp} noValidate className="space-y-3">
              <Field label="Full Name" id="su-name">
                <FieldInput icon={<User className="h-3.5 w-3.5" />}>
                  <input
                    id="su-name"
                    type="text"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    placeholder="Helena Vasquez"
                    autoComplete="name"
                    className="field-input"
                  />
                </FieldInput>
              </Field>

              <Field label="Work Email" id="su-email">
                <FieldInput icon={<Mail className="h-3.5 w-3.5" />}>
                  <input
                    id="su-email"
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="field-input"
                  />
                </FieldInput>
              </Field>

              <Field label="Password" id="su-pw">
                <FieldInput icon={<Lock className="h-3.5 w-3.5" />} suffix={
                  <button type="button" id="su-eye" onClick={() => setShowPw((v) => !v)} className="eye-btn">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                }>
                  <input
                    id="su-password"
                    type={showPw ? "text" : "password"}
                    value={suPw}
                    onChange={(e) => setSuPw(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="field-input"
                  />
                </FieldInput>
              </Field>

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                id="signup-submit"
                type="submit"
                disabled={loading}
                className="auth-cta-btn"
              >
                {loading ? <Spinner /> : <><Puzzle className="h-4 w-4" /> Create Account</>}
              </button>
            </form>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            By continuing you agree to the{" "}
            <a href="#" className="text-ai hover:underline">Terms of Service</a>{" "}
            and{" "}
            <a href="#" className="text-ai hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tiny shared sub-components ─────────────────────────────────────────────

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldInput({
  icon, suffix, children,
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-muted-foreground">{icon}</span>
      <style>{`
        .field-input {
          width: 100%;
          padding: 9px 36px 9px 32px;
          border-radius: 0.625rem;
          border: 1px solid hsl(var(--border) / 0.7);
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: hsl(var(--muted-foreground)); }
        .field-input:focus {
          border-color: var(--color-ai, #22d3ee);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ai, #22d3ee) 15%, transparent);
        }
        .eye-btn {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          color: hsl(var(--muted-foreground));
          display: flex;
          align-items: center;
          padding: 2px;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: hsl(var(--foreground)); }
        .auth-cta-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 11px;
          border-radius: 0.625rem;
          border: none;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, box-shadow 0.2s;
          letter-spacing: 0.02em;
          margin-top: 4px;
        }
        .auth-cta-btn:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 0 20px color-mix(in srgb, hsl(var(--primary)) 35%, transparent); }
        .auth-cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      {children}
      {suffix}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
