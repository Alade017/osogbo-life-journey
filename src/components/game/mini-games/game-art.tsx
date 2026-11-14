import type { CSSProperties } from "react";
import type { Shape } from "@/lib/mini-games/whot";
import { SHAPE_COLORS } from "@/components/game/mini-games/game-art-data";

/** Drawn artwork for the mini-games. Everything is SVG, so it scales and needs no image files. */

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

export function ShapeGlyph({
  shape,
  size = 24,
  color,
}: {
  shape: Shape;
  size?: number;
  color?: string;
}) {
  const fill = color ?? SHAPE_COLORS[shape];
  return (
    <svg
      className="mg-glyph"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {shape === "circle" && <circle cx="12" cy="12" r="9" fill={fill} />}
      {shape === "square" && <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill={fill} />}
      {shape === "triangle" && (
        <polygon points="12,3 22,20 2,20" fill={fill} strokeLinejoin="round" />
      )}
      {shape === "cross" && (
        <polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9" fill={fill} />
      )}
      {shape === "star" && <polygon points={starPoints(12, 12, 10.5, 4.3)} fill={fill} />}
    </svg>
  );
}

/** A Whot card: a face with rank, shape and colour, or the Whot card (rank 20). */
export function CardFace({
  rank,
  shape,
  size = "md",
}: {
  rank: number;
  shape: Shape | null;
  size?: "sm" | "md" | "lg";
}) {
  if (rank === 20 || shape === null) {
    return (
      <span className={`mg-card-art mg-card-${size} is-whot`} aria-hidden="true">
        <span className="mg-whot-star">
          <ShapeGlyph shape="star" size={size === "sm" ? 22 : 34} color="#f6c744" />
        </span>
        <span className="mg-whot-word">WHOT</span>
      </span>
    );
  }
  const accent = SHAPE_COLORS[shape];
  return (
    <span
      className={`mg-card-art mg-card-${size}`}
      aria-hidden="true"
      style={{ "--card-accent": accent } as CSSProperties}
    >
      <span className="mg-card-corner is-top">
        <b>{rank}</b>
        <ShapeGlyph shape={shape} size={size === "sm" ? 9 : 11} />
      </span>
      <span className="mg-card-centre">
        <ShapeGlyph shape={shape} size={size === "sm" ? 26 : size === "lg" ? 52 : 40} />
      </span>
      <span className="mg-card-corner is-bottom">
        <b>{rank}</b>
        <ShapeGlyph shape={shape} size={size === "sm" ? 9 : 11} />
      </span>
    </span>
  );
}

/** The back of a card, for the stock pile and the computer's hand. */
export function CardBack({ size = "md" }: { size?: "sm" | "md" }) {
  return <span className={`mg-card-art mg-card-${size} is-back`} aria-hidden="true" />;
}

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/** A die face. Give it a new key each roll so the roll animation plays again. */
export function Die({ value }: { value: number | null }) {
  return (
    <svg className="mg-die" viewBox="0 0 24 24" width={56} height={56} aria-hidden="true">
      <rect className="mg-die-body" x="1.5" y="1.5" width="21" height="21" rx="5" />
      {value !== null &&
        (PIPS[value] ?? []).map(([col, row], index) => (
          <circle key={index} className="mg-pip" cx={6 + col * 6} cy={6 + row * 6} r="1.9" />
        ))}
    </svg>
  );
}

/** An X or an O, drawn with a stroke that writes itself in. */
export function TicMark({ mark }: { mark: "X" | "O" }) {
  return (
    <svg
      className={`mg-mark mg-mark-${mark}`}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      {mark === "X" ? (
        <>
          <path pathLength={1} d="M12 12 L36 36" />
          <path pathLength={1} d="M36 12 L12 36" />
        </>
      ) : (
        <circle pathLength={1} cx="24" cy="24" r="13" />
      )}
    </svg>
  );
}

/** The crown on a king piece. */
export function Crown() {
  return (
    <svg className="mg-crown" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <path d="M3 8 L7 13 L12 6 L17 13 L21 8 L19 18 L5 18 Z" />
    </svg>
  );
}
