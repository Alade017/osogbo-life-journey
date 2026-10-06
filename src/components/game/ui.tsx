import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
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

export function StatBar({ label, value, max = 100, tone = "primary", icon }: { label: string; value: number; max?: number; tone?: Tone; icon?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className="tabular-nums">{value}/{max}</span>
      </div>
      <div className="h-3.5 overflow-hidden rounded-full border-2 border-edge bg-muted">
        <div className={cn("h-full rounded-full transition-all", TONES[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: Tone | "plain" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-edge px-2.5 py-0.5 text-xs font-bold",
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
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-edge bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
      Coming Soon{children ? ` · ${children}` : ""}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="brick studs-sand p-8 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function LoadingBricks() {
  return (
    <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="Loading">
      {["bg-primary", "bg-sun", "bg-clay"].map((c, i) => (
        <span key={c} className={cn("bob h-5 w-7 rounded-md border-2 border-edge", c)} style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}
