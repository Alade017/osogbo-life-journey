import { Activity, Droplets, Smile, Sparkles, Utensils, Users, Zap } from "lucide-react";
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

  return (
    <aside className="game-needs-rail" aria-label={`${player.name}'s needs dashboard`}>
      <header className="game-needs-header">
        <h2>
          <Activity size={17} aria-hidden="true" />
          <span>{player.name}'s needs</span>
        </h2>
      </header>
      <div className="game-needs-list">
        {NEED_NAMES.map((name) => {
          const Icon = NEED_ICONS[name];
          const value = Math.round(simulation.needs[name]);
          const status = statusForNeed(name, value);
          return (
            <section className={`game-needs-item is-${status}`} key={name}>
              <div
                className="game-needs-item-heading"
                aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="game-needs-name">{NEED_RULES[name].label}</span>
                <strong>{value}%</strong>
                <span className="game-needs-track" aria-hidden="true">
                  <i style={{ width: `${value}%` }} />
                </span>
              </div>
              <p className="game-needs-status">
                {status === "healthy"
                  ? "Doing well"
                  : status === "warning"
                    ? "Needs attention"
                    : "Needs care soon"}
              </p>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
