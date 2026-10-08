import { Activity, Droplets, Heart, Smile, Sparkles, Users, Utensils, Zap } from "lucide-react";
import type { Character } from "@/lib/game";

const NEEDS = [
  { key: "health", label: "Health", icon: Heart, tone: "var(--color-danger)", inverted: false },
  { key: "energy", label: "Energy", icon: Zap, tone: "var(--color-warm-orange)", inverted: false },
  {
    key: "hunger",
    label: "Hunger",
    icon: Utensils,
    tone: "var(--color-warm-orange)",
    inverted: true,
  },
  {
    key: "thirst",
    label: "Thirst",
    icon: Droplets,
    tone: "var(--color-osogbo-blue)",
    inverted: true,
  },
  {
    key: "happiness",
    label: "Happiness",
    icon: Smile,
    tone: "var(--color-emerald)",
    inverted: false,
  },
  {
    key: "social",
    label: "Social",
    icon: Users,
    tone: "var(--color-osogbo-blue)",
    inverted: false,
  },
  { key: "stress", label: "Stress", icon: Activity, tone: "var(--color-danger)", inverted: true },
] as const;

export function NeedsPanel({ character }: { character: Character }) {
  return (
    <section className="needs-panel" aria-label="Character needs">
      <div className="needs-heading">
        <span className="needs-heading-icon">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            How you're doing
          </p>
          <h2 className="font-display text-sm font-bold text-ink">Your status</h2>
        </div>
      </div>
      <div className="needs-list">
        {NEEDS.map((need) => {
          const Icon = need.icon;
          const rawValue = character[need.key];
          const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
          const fill = value === null ? 0 : need.inverted ? 100 - value : value;
          return (
            <div className={`need-meter ${value === null ? "need-untracked" : ""}`} key={need.key}>
              <div className="need-meter-top">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: need.tone }} />
                  <span className="truncate">{need.label}</span>
                </span>
                <span className="need-value">{value === null ? "—" : `${value}%`}</span>
              </div>
              <div
                className="need-track"
                aria-label={
                  value === null ? `${need.label} not tracked` : `${need.label} ${value} out of 100`
                }
              >
                <span style={{ width: `${fill}%`, backgroundColor: need.tone }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
