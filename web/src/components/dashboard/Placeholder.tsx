import { Construction } from "lucide-react";

export function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ai/15 text-ai glow-ai">
          <Construction className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Coming soon
        </p>
      </div>
    </div>
  );
}
