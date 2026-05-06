# AgentShield Platform — Original Design Brief

> Source: `.lovable/plan.md` (Lovable.dev scaffolding prompt)
> Preserved here as a permanent reference for the project vision.

---

A single-page dark-mode "Command Center" dashboard for an Enterprise AI Agent security product, with a working "Simulate Attack" demo flow.

## Visual Design

- **Theme**: Deep midnight blue background (`#0A0F1F` / oklch equivalent), elevated card surfaces with subtle cyan border glows.
- **Accents**:
  - 🟢 Neon green — safe / clean traffic, healthy metrics
  - 🔴 Electric red — blocked attacks, danger states, malicious tokens
  - 🔵 Cyan — AI agent indicators, links, focus rings
- **Typography**: Sans for UI, monospace for prompts, log times, and risk scores.
- **Motion**: Pulsing "Active Monitoring" dot, subtle row-fade-in when new traffic arrives, soft glow on metric increments.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │  Top Bar: AgentShield Platform   ● Active Monitor  │
│         ├──────────────────────────────────────────────────── │
│ Dash    │  [Scanned] [Blocked] [Agents]   [Simulate Attack]  │
│ Agents  │                                                     │
│ Threats │  ┌─────────────────────┐  ┌───────────────────────┐ │
│ Logs    │  │  Live Traffic Table │  │ Attack Inspection     │ │
│ Policy  │  │  Time│Src│Agent│… │  │ Before / After block  │ │
│ Settings│  │  …                  │  │ Highlighted payload   │ │
│         │  └─────────────────────┘  └───────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Collapsible shadcn sidebar with icon-only collapsed state.
- Main area: top metrics row (3 cards + CTA), then a 2-column grid (traffic table ~60%, inspection panel ~40%). Stacks on mobile.

## Components

1. **Top bar** — App name "AgentShield Platform", pulsing green dot + "Active Monitoring" label, environment chip ("Production").
2. **Metric cards** (3):
   - Total AI Ingestions Scanned (neutral, large number, sparkline-style trend)
   - Prompt Injections Blocked (red accent, increments on simulate)
   - Active AI Agents Protected (cyan accent)
3. **Simulate Incoming Attack button** — prominent red/cyan gradient, top-right of metrics row. Includes a small "Demo" badge.
4. **Live Traffic Table** — columns: Time, Source (e.g. `email://invoices@…`), Target Agent, Risk Score (0–100, color-graded), Status (Clean = green pill / Blocked = red pill). Newest row at top with fade-in.
5. **Attack Inspection Panel** — shows the most recent blocked attack:
   - Header: timestamp, source, target agent, risk score
   - **Before** block: raw ingested text with malicious payload highlighted in red
   - **After** block: sanitized text with payload replaced by `[REDACTED — Prompt Injection]`
   - Detected technique tag (e.g. "System Override", "Tool Hijack", "Data Exfiltration")

## Simulate Incoming Attack — Interaction Flow

On click:
1. Generate a new attack event (random source, target agent, risk score 85–99, canned malicious payload).
2. Prepend a new row to the Live Traffic table with red "Blocked" status + fade-in animation.
3. Increment the "Prompt Injections Blocked" metric by 1 (with brief glow pulse).
4. Replace the Attack Inspection panel content with the new attack's Before/After.

Background ticker adds occasional "Clean" rows every few seconds so the feed feels live (Scanned counter ticks up).

## Routes

| Path | Status |
|---|---|
| `/` | Dashboard (fully functional) |
| `/agents` | Placeholder ("Coming soon") |
| `/threats` | Placeholder |
| `/logs` | Placeholder |
| `/policies` | Placeholder |
| `/settings` | Placeholder |

## Tech Stack

- TanStack Start + React + Tailwind v4 + shadcn/ui
- All state local (`useState` + `useEffect` interval) — no backend at hackathon stage
- Design tokens in `styles.css`: `--color-success` (neon green), `--color-danger` (electric red), `--color-ai` (cyan)
