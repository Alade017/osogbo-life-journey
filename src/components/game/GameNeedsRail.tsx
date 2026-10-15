import { Activity, Droplets, Smile, Sparkles, Utensils, Users, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
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

const NEED_SHORTCUTS = {
  hunger: { to: "/inventory", label: "Choose food from your inventory" },
  energy: { to: "/home", label: "Go home to rest" },
  hygiene: { to: "/home", label: "Go home to shower" },
  bladder: { to: "/home", label: "Use your home facilities" },
  fun: { to: "/home", label: "Relax at home" },
  social: { to: "/social", label: "Meet people nearby" },
} as const;

export function GameNeedsRail() {
  const { simulation } = useGameTime();

  return (
    <aside className="game-needs-rail" aria-label="Player needs">
      <details className="game-needs-popover">
        <summary aria-label="Open player needs">
          <Activity size={16} aria-hidden="true" />
          <span>Needs</span>
        </summary>
        <div className="game-needs-list">
          {NEED_NAMES.map((name) => {
            const Icon = NEED_ICONS[name];
            const value = Math.round(simulation.needs[name]);
            const status = statusForNeed(name, value);
            return (
              <details className={`game-needs-item is-${status}`} key={name}>
                <summary
                  aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}. Show suggestion`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span className="game-needs-name">{NEED_RULES[name].label}</span>
                  <strong>{value}%</strong>
                  <span className="game-needs-track" aria-hidden="true">
                    <i style={{ width: `${value}%` }} />
                  </span>
                </summary>
                <div className="game-needs-suggestion">
                  <span>
                    {status === "healthy"
                      ? "Doing well"
                      : status === "warning"
                        ? "Needs attention"
                        : "Needs care soon"}
                  </span>
                  <Link to={NEED_SHORTCUTS[name].to}>{NEED_SHORTCUTS[name].label} →</Link>
                </div>
              </details>
            );
          })}
        </div>
      </details>
    </aside>
  );
}
