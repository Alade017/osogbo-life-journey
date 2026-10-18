import { Activity, Droplets, Smile, Sparkles, Utensils, Users, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  const drag = useRef<{
    startX: number;
    startY: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem("osogbo:needs-position");
      const value = saved ? (JSON.parse(saved) as { left?: unknown; top?: unknown }) : null;
      return typeof value?.left === "number" && typeof value.top === "number"
        ? { left: value.left, top: value.top }
        : null;
    } catch {
      return null;
    }
  });
  const positionRef = useRef(position);
  const suppressClick = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: position?.left ?? bounds.left,
      top: position?.top ?? bounds.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (Math.hypot(deltaX, deltaY) > 5) current.moved = true;
    if (!current.moved) return;
    const width = event.currentTarget.offsetWidth;
    const height = event.currentTarget.offsetHeight;
    const next = {
      left: Math.max(8, Math.min(window.innerWidth - width - 8, current.left + deltaX)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, current.top + deltaY)),
    };
    positionRef.current = next;
    setPosition(next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.moved) {
      const next = positionRef.current;
      if (next) window.localStorage.setItem("osogbo:needs-position", JSON.stringify(next));
      suppressClick.current = true;
      event.preventDefault();
    }
  };

  return (
    <aside
      className="game-needs-rail"
      aria-label="Player needs"
      style={
        position
          ? {
              left: position.left,
              top: position.top,
              right: "auto",
              bottom: "auto",
              transform: "none",
            }
          : undefined
      }
    >
      <details className="game-needs-popover">
        <summary
          aria-label="Open player needs. Drag to move."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(event) => {
            if (!suppressClick.current) return;
            suppressClick.current = false;
            event.preventDefault();
          }}
        >
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
