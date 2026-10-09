import { Activity, Droplets, Smile, Sparkles, Users, Utensils, Zap } from "lucide-react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";

const NEED_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Droplets,
  fun: Smile,
  social: Users,
};

export function NeedsPanel() {
  const { simulation } = useGameTime();

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
        {NEED_NAMES.map((name) => {
          const Icon = NEED_ICONS[name];
          const value = simulation.needs[name];
          const status = statusForNeed(name, value);
          return (
            <div className={`need-meter need-${status}`} key={name}>
              <div className="need-meter-top">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{NEED_RULES[name].label}</span>
                </span>
                <span className="need-value">{Math.round(value)}%</span>
              </div>
              <div
                className="need-track"
                role="meter"
                aria-label={NEED_RULES[name].label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value)}
                aria-valuetext={`${Math.round(value)} percent, ${status}`}
              >
                <span style={{ width: `${value}%` }} />
              </div>
              <small className="need-status-label">
                {status === "critical"
                  ? "Critical"
                  : status === "warning"
                    ? "Needs attention"
                    : "Healthy"}
              </small>
            </div>
          );
        })}
      </div>
      <p className="sr-only">
        <Activity aria-hidden="true" /> Mood: {simulation.mood.mood}. {simulation.mood.reason}
      </p>
    </section>
  );
}
