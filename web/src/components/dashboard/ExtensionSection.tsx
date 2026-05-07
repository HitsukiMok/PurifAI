import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";
import {
  Puzzle,
  Zap,
  Activity,
  ScanSearch,
  ShieldX,
  CheckCircle2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FeedbackActionRow } from "@/components/ui/FeedbackWidget";

// ── Types ─────────────────────────────────────────────────────────────────
interface ExtensionSectionProps {
  extensionConnected: boolean;
}

// ── Feature list ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Activity,   label: "Real-time traffic feed in your toolbar" },
  { icon: ShieldX,    label: "Instant blocked-injection alerts" },
  { icon: ScanSearch, label: "Live metrics synced from dashboard" },
  { icon: Zap,        label: "One-click attack simulation (demo)" },
];

// ═════════════════════════════════════════════════════════════════════════
// Extension Section — only the install CTA card remains
// ═════════════════════════════════════════════════════════════════════════
export function ExtensionSection({ extensionConnected }: ExtensionSectionProps) {
  return (
    <section
      className="mx-auto max-w-[1500px] space-y-4 px-3 pb-8 pt-2 sm:px-4 md:px-6"
      id="extension-section"
    >
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai/15 text-ai ring-1 ring-ai/30">
          <Puzzle className="h-3.5 w-3.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Browser Extension</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Mini-dashboard · Real-time monitoring in your toolbar
          </p>
        </div>
        {extensionConnected && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
            Extension Active
          </span>
        )}
      </div>

      {/* Install card — full width */}
      <InstallCard extensionConnected={extensionConnected} />
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Install Card
// ═════════════════════════════════════════════════════════════════════════
function InstallCard({ extensionConnected }: { extensionConnected: boolean }) {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
    <div className="flex flex-col rounded-xl border bg-card lg:flex-row">
      {/* Card header (left on desktop) */}
      <div className="flex items-center gap-4 border-b px-5 py-5 lg:border-b-0 lg:border-r lg:flex-col lg:items-start lg:justify-between lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ai/20 via-card to-ai/5 ring-1 ring-ai/40 glow-ai">
            <img 
              src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} 
              alt="PurifAI Logo" 
              className={`h-9 w-9 object-contain ${theme === 'dark' ? 'drop-shadow-[0_0_12px_var(--color-ai)]' : ''}`} 
  />
          </div>
          <div>
            <p className="font-semibold tracking-tight">PurifAI Monitor</p>
            <p className="text-xs text-muted-foreground">for Chrome</p>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="h-3 w-3 fill-amber-400 text-amber-400" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[9px] text-muted-foreground ml-0.5">5.0</span>
            </div>
          </div>
        </div>

        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1",
            extensionConnected
              ? "bg-success/10 text-success ring-success/30"
              : "bg-ai/10 text-ai ring-ai/30",
          )}
        >
          {extensionConnected ? "Installed" : "Available"}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-8">
        {/* Description + features */}
        <div className="flex flex-1 flex-col gap-4">
          {/* AI-generated summary — wrapped with FeedbackActionRow */}
          <div className="rounded-lg border border-border/30 bg-muted/20 px-3.5 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Get your PurifAI mini-dashboard right in your browser toolbar. Monitor AI agent traffic,
              receive instant injection alerts, and inspect payloads — all without leaving your current tab.
            </p>
            <FeedbackActionRow
              ctx={{
                responseId: "extension-section-desc",
                surface: "extension_section",
                input: "Describe the AgentShield browser extension capabilities",
                output:
                  "Get your PurifAI mini-dashboard right in your browser toolbar. Monitor AI agent traffic, receive instant injection alerts, and inspect payloads — all without leaving your current tab.",
              }}
            />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ai/10 text-ai">
                  <Icon className="h-3 w-3" />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          {extensionConnected ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-semibold text-success">Extension Active</span>
            </div>
          ) : (
            <>
              <a
                id="install-extension-btn"
                href="chrome://extensions"
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-ai px-4 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                onClick={(e) => {
                  e.preventDefault();
                  alert(
                    "To install:\n1. Open chrome://extensions\n2. Enable Developer Mode\n3. Click \"Load unpacked\"\n4. Select the extension/ folder in this project",
                  );
                }}
              >
                <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                Add to Chrome
              </a>
              <button
                id="view-install-instructions-btn"
                className="w-full rounded-lg border border-border/60 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-ai/40 hover:text-ai"
                onClick={() => setShowModal(true)}
              >
                View setup instructions →
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Setup Instructions Modal */}
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
          <button 
            onClick={() => setShowModal(false)}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <ShieldX className="h-5 w-5" />
          </button>
          
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ai/10 text-ai ring-1 ring-ai/30">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Manual Installation</h3>
              <p className="text-xs text-muted-foreground">Follow these 4 simple steps to connect</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">1</div>
              <p className="text-sm text-muted-foreground pt-0.5"><strong className="text-foreground">Download</strong> the latest PurifAI release.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">2</div>
              <p className="text-sm text-muted-foreground pt-0.5">Go to <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">chrome://extensions/</code> and enable <strong className="text-foreground">Developer Mode</strong>.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">3</div>
              <p className="text-sm text-muted-foreground pt-0.5"><strong className="text-foreground">Drag and drop</strong> the .crx file (Packed Extension) or click "Load Unpacked" and select the PurifAI folder.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">4</div>
              <p className="text-sm text-muted-foreground pt-0.5"><strong className="text-foreground">Pin</strong> the extension to your toolbar and click to connect!</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowModal(false)}
            className="mt-6 w-full rounded-lg bg-ai px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    )}
    </>
  );
}
