import { useQuery } from "@tanstack/react-query";
import { Droplets, GlassWater, Smile, Sparkles, Users, Utensils, Zap } from "lucide-react";
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
  const { data: equipment } = useQuery({ ...q.equipment(), enabled: !!character });

  return (
    <details className="city-needs-dock">
      <summary aria-label="Show character needs including thirst">
        <span className="city-needs-avatar">
          {character ? (
            <Avatar
              appearance={character.appearance as object}
              gender={character.gender}
              size={34}
              equipment={equipment ?? []}
            />
          ) : (
            <Users size={18} aria-hidden="true" />
          )}
        </span>
        <span className="city-needs-summary-bars" aria-hidden="true">
          {NEED_NAMES.map((name) => {
            const Icon = NEED_ICONS[name];
            const value = Math.round(simulation.needs[name]);
            return (
              <span className="city-needs-mini-item" key={name} title={NEED_RULES[name].label}>
                <Icon size={12} aria-hidden="true" />
                <span className={`city-needs-mini is-${statusForNeed(name, value)}`}>
                  <i style={{ width: `${value}%` }} />
                </span>
              </span>
            );
          })}
          {character?.thirst != null && (
            <span className="city-needs-mini-item" title="Thirst satisfaction">
              <GlassWater size={12} aria-hidden="true" />
              <span
                className={`city-needs-mini is-${statusForNeed("hunger", 100 - character.thirst)}`}
              >
                <i style={{ width: `${100 - character.thirst}%` }} />
              </span>
            </span>
          )}
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
              <span className="city-needs-label" title={NEED_RULES[name].label}>
                <Icon size={14} aria-hidden="true" />
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
        <div
          className={`city-needs-row is-${character?.thirst == null ? "untracked" : statusForNeed("hunger", 100 - character.thirst)}`}
        >
          <span className="city-needs-label" title="Thirst satisfaction">
            <GlassWater size={14} aria-hidden="true" />
          </span>
          <span
            className="city-needs-track"
            role="meter"
            aria-label="Thirst satisfaction"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={character?.thirst == null ? undefined : 100 - character.thirst}
          >
            {character?.thirst != null && <i style={{ width: `${100 - character.thirst}%` }} />}
          </span>
          <strong>{character?.thirst == null ? "—" : `${100 - character.thirst}%`}</strong>
        </div>
      </div>
    </details>
  );
}
