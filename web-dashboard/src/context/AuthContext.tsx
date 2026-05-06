/**
 * AuthContext — Global authentication state for the web dashboard.
 *
 * Wraps the existing `lib/auth.ts` helpers in a React context so any
 * component can read the current user and call login/logout without
 * prop-drilling.
 *
 * Usage:
 *   const { user, login, logout, isAuthenticated } = useAuth();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAuth, setAuth, clearAuth, type AuthUser } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Null when unauthenticated / not yet resolved. */
  user: AuthUser | null;
  /** True once the initial auth check has completed. */
  ready: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Rehydrate from storage on mount
  useEffect(() => {
    const stored = getAuth();
    setUser(stored);
    setReady(true);
  }, []);

  const login = useCallback((newUser: AuthUser) => {
    setAuth(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
