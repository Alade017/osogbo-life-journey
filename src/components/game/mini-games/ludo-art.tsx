import type { Colour } from "@/lib/mini-games/ludo-engine";
import { LUDO_COLOURS } from "@/components/game/mini-games/ludo-palette";

/** Blend a hex colour toward white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = t >= 0 ? 255 : 0;
  const amount = Math.abs(t);
  const [r, g, b] = channels.map((c) => Math.round(c + (target - c) * amount));
  return `rgb(${r} ${g} ${b})`;
}

/**
 * A Ludo pawn with shaded gradients, a glossy highlight and a soft contact shadow.
 * Drawn on a square whose base sits near the lower edge, so it can stand on a tile centre.
 */
export function PawnArt({
  colour,
  size,
  className,
}: {
  colour: Colour;
  size?: number;
  className?: string;
}) {
  const base = LUDO_COLOURS[colour];
  const headId = `pawn-head-${colour}`;
  const bodyId = `pawn-body-${colour}`;
  return (
    <svg
      viewBox="-0.4 -0.4 0.8 0.8"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={headId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={shade(base, 0.55)} />
          <stop offset="45%" stopColor={base} />
          <stop offset="100%" stopColor={shade(base, -0.45)} />
        </radialGradient>
        <linearGradient id={bodyId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={shade(base, -0.35)} />
          <stop offset="40%" stopColor={shade(base, 0.18)} />
          <stop offset="70%" stopColor={base} />
          <stop offset="100%" stopColor={shade(base, -0.45)} />
        </linearGradient>
      </defs>
      <ellipse cx="0.03" cy="0.35" rx="0.3" ry="0.07" fill="rgb(0 0 0 / 0.35)" />
      <rect
        x="-0.27"
        y="0.22"
        width="0.54"
        height="0.13"
        rx="0.065"
        fill={`url(#${bodyId})`}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth="0.01"
      />
      <path
        d="M -0.1 0.24 L -0.055 -0.05 Q 0 -0.07 0.055 -0.05 L 0.1 0.24 Z"
        fill={`url(#${bodyId})`}
      />
      <ellipse cx="0" cy="-0.05" rx="0.075" ry="0.022" fill={shade(base, -0.4)} />
      <circle
        cx="0"
        cy="-0.16"
        r="0.17"
        fill={`url(#${headId})`}
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.012"
      />
      <ellipse
        cx="-0.06"
        cy="-0.225"
        rx="0.05"
        ry="0.028"
        transform="rotate(-28 -0.06 -0.225)"
        fill="#ffffff"
        opacity="0.8"
      />
      <rect x="-0.2" y="0.25" width="0.2" height="0.018" rx="0.009" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}
