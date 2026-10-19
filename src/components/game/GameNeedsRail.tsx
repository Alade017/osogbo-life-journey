import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ChevronDown, Droplets, Smile, Sparkles, Utensils, Users, Zap } from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import type { PlayerState } from "@/lib/player-state";

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

export function GameNeedsRail({ player }: { player: PlayerState }) {
  const { simulation } = useGameTime();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const needsAttention = NEED_NAMES.filter(
    (name) => statusForNeed(name, simulation.needs[name]) !== "healthy",
  ).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="game-needs-rail" ref={rootRef}>
      <button
        type="button"
        className="game-needs-trigger"
        aria-controls="game-needs-detail"
        aria-expanded={open}
        aria-label={`${player.name}, player needs${needsAttention ? `, ${needsAttention} need attention` : ", all doing well"}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="game-needs-avatar" aria-hidden="true">
          <Avatar
            appearance={player.avatar as object}
            gender={player.gender}
            size={42}
            equipment={player.equipment}
          />
        </span>
        <span className="game-needs-trigger-copy">
          <strong>Needs</strong>
          <small>{needsAttention ? `${needsAttention} need attention` : "All doing well"}</small>
        </span>
        <span className="game-needs-summary" aria-hidden="true">
          {NEED_NAMES.map((name) => (
            <i className={`is-${statusForNeed(name, simulation.needs[name])}`} key={name} />
          ))}
        </span>
        <ChevronDown className="game-needs-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <section className="game-needs-detail" id="game-needs-detail" aria-label="Player needs">
          <div className="game-needs-detail-header">
            <h2 className="game-needs-heading">
              <Activity size={16} aria-hidden="true" /> {player.name}'s needs
            </h2>
            <Link to="/profile" onClick={() => setOpen(false)}>
              View profile
            </Link>
          </div>
          <div className="game-needs-list">
            {NEED_NAMES.map((name) => {
              const Icon = NEED_ICONS[name];
              const value = Math.round(simulation.needs[name]);
              const status = statusForNeed(name, value);
              return (
                <div className={`game-needs-item is-${status}`} key={name}>
                  <div
                    className="game-needs-item-heading"
                    aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span className="game-needs-name">{NEED_RULES[name].label}</span>
                    <strong>{value}%</strong>
                    <span className="game-needs-track" aria-hidden="true">
                      <i style={{ width: `${value}%` }} />
                    </span>
                  </div>
                  <div className="game-needs-suggestion">
                    <span>
                      {status === "healthy"
                        ? "Doing well"
                        : status === "warning"
                          ? "Needs attention"
                          : "Needs care soon"}
                    </span>
                    <Link to={NEED_SHORTCUTS[name].to} onClick={() => setOpen(false)}>
                      {NEED_SHORTCUTS[name].label} →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
