import { useQuery } from "@tanstack/react-query";
import { Droplets, Smile, Sparkles, Users, Utensils, Zap } from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import { q } from "@/lib/game";

const NEED_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Droplets,
  fun: Smile,
  social: Users,
};

export function CityNeedsDock() {
  const { simulation } = useGameTime();
  const { data: character } = useQuery(q.character());

  return (
    <details className="city-needs-dock">
      <summary aria-label="Show character needs">
        <span className="city-needs-avatar">
          {character ? (
            <Avatar
              appearance={character.appearance as object}
              gender={character.gender}
              size={34}
            />
          ) : (
            <Users size={18} aria-hidden="true" />
          )}
        </span>
        <span className="city-needs-summary-bars" aria-hidden="true">
          {NEED_NAMES.map((name) => {
            const value = Math.round(simulation.needs[name]);
            return (
              <span className={`city-needs-mini is-${statusForNeed(name, value)}`} key={name}>
                <i style={{ width: `${value}%` }} />
              </span>
            );
          })}
        </span>
        <span className="city-needs-expand" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="city-needs-expanded">
        {NEED_NAMES.map((name) => {
          const Icon = NEED_ICONS[name];
          const value = Math.round(simulation.needs[name]);
          const status = statusForNeed(name, value);
          return (
            <div className={`city-needs-row is-${status}`} key={name}>
              <span className="city-needs-label">
                <Icon size={14} aria-hidden="true" />
                {NEED_RULES[name].label}
              </span>
              <span
                className="city-needs-track"
                role="meter"
                aria-label={NEED_RULES[name].label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
              >
                <i style={{ width: `${value}%` }} />
              </span>
              <strong>{value}%</strong>
            </div>
          );
        })}
      </div>
    </details>
  );
}
