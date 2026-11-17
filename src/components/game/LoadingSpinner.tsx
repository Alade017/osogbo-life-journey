import type { CSSProperties } from "react";

const BAR_COUNT = 12;
const CYCLE_SECONDS = 1.2;

/** Radial spinner: twelve bars fade in a ring so the trail appears to turn. */
export function LoadingSpinner({
  className,
  durationSeconds = CYCLE_SECONDS,
}: {
  className?: string;
  durationSeconds?: number;
}) {
  return (
    <span
      className={className ? `loading-spinner ${className}` : "loading-spinner"}
      aria-hidden="true"
      style={{ "--loading-spinner-duration": `${durationSeconds}s` } as CSSProperties}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <i
          key={index}
          style={{
            transform: `rotate(${index * (360 / BAR_COUNT)}deg)`,
            animationDelay: `${-(index / BAR_COUNT) * durationSeconds}s`,
          }}
        />
      ))}
    </span>
  );
}
