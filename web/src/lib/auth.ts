// ── AgentShield Auth Store ─────────────────────────────────────────────────
// Lightweight localStorage-backed auth. Replace with real JWT/session logic
// when connecting to a real backend.

export interface AuthUser {
  name: string;
  email: string;
  /** "login" | "extension" */
  method: "login" | "extension";
  avatar: string; // initials
}

const KEY = "agentshield-auth";

export function getAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function makeAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
