import { useState } from "react";
import { Droplets, Smile, Sparkles, Utensils, Users, Zap } from "lucide-react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import type { PlayerState } from "@/lib/player-state";
import "@/components/game/game-needs-rail.css";

const NEED_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Droplets,
  fun: Smile,
  social: Users,
};

export function GameNeedsRail({ player }: { player: PlayerState }) {
  const { simulation } = useGameTime();
  const [detailNeed, setDetailNeed] = useState<(typeof NEED_NAMES)[number] | null>(null);
  const criticalCount = NEED_NAMES.filter(
    (name) => statusForNeed(name, Math.round(simulation.needs[name])) === "critical",
  ).length;
  const detailValue = detailNeed ? Math.round(simulation.needs[detailNeed]) : null;

  return (
    <aside
      className="game-needs-rail"
      aria-label={`${player.name}'s needs dashboard${criticalCount ? `, ${criticalCount} critical` : ""}`}
      data-critical-count={criticalCount}
    >
      <div className="game-needs-list">
        {NEED_NAMES.map((name) => {
          const Icon = NEED_ICONS[name];
          const value = Math.round(simulation.needs[name]);
          const status = statusForNeed(name, value);
          return (
            <button
              type="button"
              className={`game-needs-item is-${status}${detailNeed === name ? " is-active" : ""}`}
              key={name}
              aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}`}
              aria-pressed={detailNeed === name}
              title={`${NEED_RULES[name].label}: ${value}% · Tap for details`}
              onClick={() => setDetailNeed((current) => (current === name ? null : name))}
            >
              <span
                className="game-needs-icon-ring"
                style={{
                  background: `conic-gradient(var(--need-tone) ${value}%, #e8ece8 0)`,
                }}
              >
                <span className="game-needs-icon-core">
                  <Icon size={15} aria-hidden="true" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {detailNeed && detailValue !== null && (
        <p className="game-needs-detail" role="status" aria-live="polite">
          <strong>{NEED_RULES[detailNeed].label}</strong>
          <span>
            {detailValue}% · {statusForNeed(detailNeed, detailValue)}
          </span>
        </p>
      )}
    </aside>
  );
}
