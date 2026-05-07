import { Outlet, Link, createRootRoute, HeadContent, Scripts, useNavigate, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { Moon, Sun, Puzzle, LogOut, Globe2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getAuth, clearAuth, type AuthUser } from "@/lib/auth";
import { ExtensionProvider } from "@/contexts/ExtensionContext";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PurifAI Platform — AI Agent Security Command Center" },
      {
        name: "description",
        content:
          "PurifAI protects enterprise AI agents from indirect prompt injection attacks in emails, documents and tools.",
      },
      { property: "og:title", content: "PurifAI Platform — AI Agent Security Command Center" },
      { name: "twitter:title", content: "PurifAI Platform — AI Agent Security Command Center" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ac323b2d-c57f-452e-9530-da08a3e7533f/id-preview-aa5c1e94--6a4ca9a3-c868-4256-9f32-3c041c0503af.lovable.app-1777971971347.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss }
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ExtensionProvider>
          {children}
          <Scripts />
        </ExtensionProvider>
      </body>
    </html>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [key, setKey] = useState(0);

  function handleToggle() {
    setKey((k) => k + 1);
    toggleTheme();
  }

  const isDark = theme === "dark";

  return (
    <button
      id="theme-toggle"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
    >
      <span
        key={key}
        className="theme-icon-enter pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </span>
    </button>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────
function UserMenu({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function signOut() {
    clearAuth();
    navigate({ to: "/login" });
  }

  return (
    <div className="relative">
      <button
        id="user-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-ai/40 bg-ai/10 text-[11px] font-bold text-ai transition-all hover:shadow-[0_0_10px_rgba(34,211,238,0.25)]"
        aria-label="User menu"
      >
        {user.avatar}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border border-border/70 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ai/35 bg-ai/10 text-sm font-bold text-ai">
                {user.avatar}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            {user.method === "extension" && (
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 text-xs text-ai">
                <Globe2 className="h-3.5 w-3.5" />
                <span>Connected via extension</span>
              </div>
            )}
            <button
              id="signout-btn"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Auth guard wrapper ────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    setUser(auth);
    setChecked(true);
    if (!auth && pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [pathname, navigate]);

  // While checking (SSR-safe) render nothing to avoid flash
  if (!checked) return null;

  // On the login page, render without sidebar
  if (pathname === "/login") return <>{children}</>;

  // Not logged in → nothing (redirect in progress)
  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background scanline-bg">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur sm:gap-3 sm:px-4">
            <SidebarTrigger />
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold tracking-tight">PurifAI Platform</span>
              <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline whitespace-nowrap">
                / Command Center
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline-flex">
                ShotbuPullers
              </span>
              <div className="hidden items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 sm:flex">
                <span className="pulse-dot h-2 w-2 rounded-full bg-success" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-success whitespace-nowrap">
                  <span className="hidden xs:inline">Active </span>Monitoring
                </span>
              </div>
              {/* Mobile-only status dot */}
              <div className="flex items-center sm:hidden">
                <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-success" />
              </div>
              {/* Get Extension pill */}
              <a
                id="get-extension-header-btn"
                href="#extension"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("extension-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="hidden items-center gap-1.5 rounded-full border border-ai/35 bg-ai/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ai transition-all hover:bg-ai/20 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)] sm:inline-flex"
              >
                <Puzzle className="h-3 w-3" />
                Get Extension
              </a>
              <ThemeToggle />
              <UserMenu user={user} />
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthGuard>
        <Outlet />
      </AuthGuard>
    </ThemeProvider>
  );
}
