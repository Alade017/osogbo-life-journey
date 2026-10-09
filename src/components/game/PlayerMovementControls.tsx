import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LocateFixed } from "lucide-react";
import type { MovementDirection } from "@/lib/player-movement";

const KEYS: Record<string, MovementDirection> = {
  ArrowUp: "north",
  w: "north",
  W: "north",
  ArrowDown: "south",
  s: "south",
  S: "south",
  ArrowLeft: "west",
  a: "west",
  A: "west",
  ArrowRight: "east",
  d: "east",
  D: "east",
};

export function PlayerMovementControls({
  onDirectionChange,
  onFollowChange,
}: {
  onDirectionChange: (directions: ReadonlySet<MovementDirection>) => void;
  onFollowChange: (enabled: boolean) => void;
}) {
  const held = useRef(new Set<MovementDirection>());
  const [following, setFollowing] = useState(false);
  const update = useCallback(
    (direction: MovementDirection, active: boolean) => {
      if (active) held.current.add(direction);
      else held.current.delete(direction);
      onDirectionChange(new Set(held.current));
    },
    [onDirectionChange],
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      const target = event.target;
      if (
        !direction ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)))
      )
        return;
      event.preventDefault();
      update(direction, true);
    };
    const up = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      if (direction) update(direction, false);
    };
    const clear = () => {
      held.current.clear();
      onDirectionChange(new Set());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [onDirectionChange, update]);

  const buttons: { direction: MovementDirection; label: string; Icon: typeof ArrowUp }[] = [
    { direction: "north", label: "Move north", Icon: ArrowUp },
    { direction: "west", label: "Move west", Icon: ArrowLeft },
    { direction: "south", label: "Move south", Icon: ArrowDown },
    { direction: "east", label: "Move east", Icon: ArrowRight },
  ];

  return (
    <div className="player-movement-controls" aria-label="Player movement controls">
      <div className="player-dpad" aria-label="Touch movement pad">
        {buttons.map(({ direction, label, Icon }) => (
          <button
            key={direction}
            type="button"
            aria-label={label}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              update(direction, true);
            }}
            onPointerUp={() => update(direction, false)}
            onPointerCancel={() => update(direction, false)}
            onLostPointerCapture={() => update(direction, false)}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="player-follow-toggle"
        aria-pressed={following}
        onClick={() => {
          const next = !following;
          setFollowing(next);
          onFollowChange(next);
        }}
      >
        <LocateFixed size={16} aria-hidden="true" /> {following ? "Following" : "Follow player"}
      </button>
      <span className="sr-only">
        Use WASD or arrow keys to move. Touch controls are available on mobile.
      </span>
    </div>
  );
}
