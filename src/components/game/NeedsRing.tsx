import type { ReactNode } from "react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";

// Six arcs, one per need, drawn clockwise from the top. Each arc is 52 degrees
// with a 8 degree gap between arcs.
const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = (52 / 360) * CIRCUMFERENCE;
const ARC_START_OFFSET = -90 + 4;

export function NeedsRing({ children }: { children: ReactNode }) {
  const { simulation } = useGameTime();
  const needs = simulation.needs;

  const readings = NEED_NAMES.map((name) => {
    const value = Math.min(100, Math.max(0, Math.round(needs[name])));
    return { name, value, status: statusForNeed(name, value) };
  });

  const summary = readings
    .map(({ name, value, status }) => `${NEED_RULES[name].label} ${value} percent, ${status}`)
    .join("; ");

  return (
    <div className="needs-ring" role="group" aria-label={`Needs: ${summary}`} title="Needs">
      <svg className="needs-ring-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {readings.map(({ name, value, status }, index) => (
          <g key={name} transform={`rotate(${ARC_START_OFFSET + index * 60} 50 50)`}>
            <circle
              className="needs-ring-track"
              cx="50"
              cy="50"
              r={RADIUS}
              strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            />
            <circle
              className={`needs-ring-fill is-${status}`}
              cx="50"
              cy="50"
              r={RADIUS}
              strokeDasharray={`${(value / 100) * ARC_LENGTH} ${CIRCUMFERENCE}`}
            />
          </g>
        ))}
      </svg>
      <span className="needs-ring-avatar">{children}</span>
    </div>
  );
}
