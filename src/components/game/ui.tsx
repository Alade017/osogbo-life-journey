import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  primary: "bg-primary",
  sun: "bg-sun",
  clay: "bg-clay",
  ink: "bg-ink",
  leaf: "bg-leaf",
} as const;
export type Tone = keyof typeof TONES;

export function StatBar({
  label,
  value,
  max = 100,
  tone = "primary",
  icon,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-border bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", TONES[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: Tone | "plain" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-bold",
        tone === "plain" ? "bg-card" : TONES[tone],
        (tone === "primary" || tone === "clay" || tone === "ink") && "text-primary-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function ComingSoon({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
      Coming Soon{children ? ` · ${children}` : ""}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="game-panel game-canvas p-8 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
    </div>
  );
}

export function GameDataUnavailable({
  error,
  onRetry,
  isRetrying = false,
}: {
  error: Error;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <main className="game-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="game-panel w-full max-w-xl p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay">
          Game setup unavailable
        </p>
        <h1 className="mt-2 text-2xl font-bold">We couldn’t load your Osogbo game data.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your sign-in is active, but the game database tables are missing or unavailable. Apply
          migrations 0000–0003 to the connected Supabase project, then retry. Your character will
          not be created until the game can check for an existing save.
        </p>
        <details className="mt-4 rounded-lg border border-border bg-muted p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Technical detail</summary>
          <p className="mt-2 wrap-break-word text-muted-foreground">{error.message}</p>
        </details>
        <Button className="mt-5" variant="default" disabled={isRetrying} onClick={onRetry}>
          <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
          {isRetrying ? "Checking…" : "Retry connection"}
        </Button>
      </section>
    </main>
  );
}
