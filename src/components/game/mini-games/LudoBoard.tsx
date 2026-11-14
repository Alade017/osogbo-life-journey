import { useEffect, useState, type CSSProperties } from "react";
import { COLOURS, absoluteTile, isSafeTile, type Colour } from "@/lib/mini-games/ludo-engine";
import { LUDO_COLOURS } from "@/components/game/mini-games/ludo-palette";
import {
  BOARD_SIZE,
  CENTRE,
  LOOP_CELLS,
  YARD_SLOTS,
  centreTriangle,
  homeLane,
  hopStep,
  tokenPoint,
  yardRect,
  type Point,
} from "@/lib/mini-games/ludo-board";

/** Time per tile while a token walks its path. */
const HOP_MS = 170;
const STACK_OFFSETS: readonly Point[] = [
  { x: -0.24, y: -0.24 },
  { x: 0.24, y: -0.24 },
  { x: 0.24, y: 0.24 },
  { x: -0.24, y: 0.24 },
];

type Progress = Readonly<Record<Colour, readonly number[]>>;

const cellKey = (row: number, col: number) => `${row},${col}`;
const ARM_STARTS = new Map(COLOURS.map((colour) => [absoluteTile(colour, 0), colour] as const));
const LOOP_INDEX = new Map(
  LOOP_CELLS.map(([row, col], tile) => [cellKey(row, col), tile] as const),
);
const HOME_INDEX = new Map(
  COLOURS.flatMap((colour, arm) =>
    homeLane(arm).map(([row, col]) => [cellKey(row, col), colour] as const),
  ),
);

function stepAll(shown: Progress, target: Progress): Progress {
  const next = {} as Record<Colour, number[]>;
  for (const colour of COLOURS) {
    next[colour] = (shown[colour] ?? []).map((step, token) =>
      hopStep(step, target[colour]?.[token] ?? step),
    );
  }
  return next;
}

function sameAll(a: Progress, b: Progress) {
  return COLOURS.every((colour) =>
    (a[colour] ?? []).every((step, token) => step === b[colour]?.[token]),
  );
}

/** Pawn drawn in its colour with a dark base, centred on the origin. */
function Pawn({ colour }: { colour: Colour }) {
  return (
    <svg viewBox="-0.4 -0.4 0.8 0.8" className="lb-pawn" aria-hidden="true">
      <ellipse cx="0.04" cy="0.36" rx="0.3" ry="0.07" className="lb-pawn-shadow" />
      <path
        d="M -0.1 -0.06 L -0.27 0.3 L 0.27 0.3 L 0.1 -0.06 Z"
        fill={LUDO_COLOURS[colour]}
        stroke="#1f2937"
        strokeWidth="0.035"
        strokeLinejoin="round"
      />
      <rect x="-0.33" y="0.28" width="0.66" height="0.12" rx="0.05" fill="#1f2937" opacity="0.7" />
      <circle
        cx="0"
        cy="-0.2"
        r="0.2"
        fill={LUDO_COLOURS[colour]}
        stroke="#1f2937"
        strokeWidth="0.035"
      />
      <circle cx="-0.07" cy="-0.27" r="0.05" fill="#fff" opacity="0.55" />
    </svg>
  );
}

function cellStyle(row: number, col: number): CSSProperties {
  return { gridRow: row + 1, gridColumn: col + 1 };
}

export function LudoBoard({
  pieces,
  playable,
  onPick,
  playerCount,
}: {
  pieces: Progress;
  playable: ReadonlySet<string>;
  onPick: (colour: Colour, token: number) => void;
  playerCount: number;
}) {
  const [shown, setShown] = useState<Progress>(pieces);

  useEffect(() => {
    if (sameAll(shown, pieces)) return;
    const timer = window.setTimeout(() => setShown((current) => stepAll(current, pieces)), HOP_MS);
    return () => window.clearTimeout(timer);
  }, [shown, pieces]);

  // Group tokens that share a tile, so stacked tokens are scaled and laid out in a small sub-grid.
  const tiles = new Map<string, { colour: Colour; token: number; point: Point }[]>();
  for (const colour of COLOURS) {
    (shown[colour] ?? []).forEach((step, token) => {
      const point = tokenPoint(colour, step, token);
      const key = `${point.x},${point.y}`;
      tiles.set(key, [...(tiles.get(key) ?? []), { colour, token, point }]);
    });
  }

  return (
    <div className="lb-board" data-players={playerCount}>
      <div className="lb-grid" role="img" aria-label="Ludo board">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const key = cellKey(row, col);
          const tile = LOOP_INDEX.get(key);
          const homeColour = HOME_INDEX.get(key);
          const inCentre =
            row >= CENTRE.low &&
            row < CENTRE.low + CENTRE.size &&
            col >= CENTRE.low &&
            col < CENTRE.low + CENTRE.size;
          const startColour = tile !== undefined ? ARM_STARTS.get(tile) : undefined;
          const star = tile !== undefined && isSafeTile(tile) && !startColour;
          const isYardCell = !inCentre && tile === undefined && !homeColour;
          if (isYardCell) return null;
          const classes = ["lb-cell"];
          if (homeColour) classes.push("is-home");
          if (startColour) classes.push("is-start");
          if (inCentre) classes.push("is-centre");
          const style: CSSProperties = homeColour
            ? { ...cellStyle(row, col), background: LUDO_COLOURS[homeColour] }
            : startColour
              ? { ...cellStyle(row, col), background: LUDO_COLOURS[startColour] }
              : cellStyle(row, col);
          return (
            <div key={key} className={classes.join(" ")} style={style}>
              {star && (
                <svg viewBox="-1 -1 2 2" className="lb-mark" aria-hidden="true">
                  <polygon
                    points={starPoints()}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="0.14"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {startColour && (
                <svg viewBox="-1 -1 2 2" className="lb-mark" aria-hidden="true">
                  <polygon points={chevron(row, col)} fill="#fff" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      {COLOURS.map((colour, arm) => {
        const rect = yardRect(arm);
        if ((pieces[colour]?.length ?? 0) === 0) return null;
        const box = {
          left: `${(rect.x / BOARD_SIZE) * 100}%`,
          top: `${(rect.y / BOARD_SIZE) * 100}%`,
          width: `${(rect.size / BOARD_SIZE) * 100}%`,
          height: `${(rect.size / BOARD_SIZE) * 100}%`,
        };
        return (
          <div
            key={`yard-${colour}`}
            className="lb-yard"
            style={{ ...box, background: LUDO_COLOURS[colour] }}
          >
            <div className="lb-yard-plate" />
            {YARD_SLOTS.map((slot, index) => (
              <span
                key={index}
                className="lb-socket"
                style={{
                  left: `${((rect.size / 2 + slot.x) / rect.size) * 100}%`,
                  top: `${((rect.size / 2 + slot.y) / rect.size) * 100}%`,
                  background: LUDO_COLOURS[colour],
                }}
              />
            ))}
          </div>
        );
      })}
      <svg className="lb-centre" viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} aria-hidden="true">
        <rect
          x={CENTRE.low}
          y={CENTRE.low}
          width={CENTRE.size}
          height={CENTRE.size}
          fill="#fff"
          stroke="#1f2937"
          strokeWidth="0.06"
        />
        {COLOURS.map((colour, arm) => (
          <polygon
            key={colour}
            points={centreTriangle(arm)}
            fill={LUDO_COLOURS[colour]}
            stroke="#1f2937"
            strokeWidth="0.04"
          />
        ))}
      </svg>
      {[...tiles.values()].flatMap((group) =>
        group.map((item, index) => {
          const stacked = group.length > 1;
          const offset = stacked
            ? (STACK_OFFSETS[index % STACK_OFFSETS.length] ?? { x: 0, y: 0 })
            : { x: 0, y: 0 };
          const left = ((item.point.x + offset.x) / BOARD_SIZE) * 100;
          const top = ((item.point.y + offset.y) / BOARD_SIZE) * 100;
          const isPlayable = playable.has(`${item.colour}-${item.token}`);
          const size = stacked ? 0.62 : 0.9;
          return (
            <div
              key={`${item.colour}-${item.token}`}
              className={`lb-piece ${isPlayable ? "is-playable" : ""}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${(size / BOARD_SIZE) * 100}%`,
                zIndex: isPlayable ? 6 : 4 + index,
              }}
              role={isPlayable ? "button" : undefined}
              tabIndex={isPlayable ? 0 : undefined}
              aria-label={
                isPlayable ? `Move ${item.colour.toLowerCase()} token ${item.token + 1}` : undefined
              }
              onClick={isPlayable ? () => onPick(item.colour, item.token) : undefined}
              onKeyDown={
                isPlayable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onPick(item.colour, item.token);
                      }
                    }
                  : undefined
              }
            >
              <Pawn colour={item.colour} />
            </div>
          );
        }),
      )}
    </div>
  );
}

function starPoints() {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? 0.6 : 0.26;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${radius * Math.cos(angle)},${radius * Math.sin(angle)}`;
  }).join(" ");
}

/** A chevron on a start tile, pointing into the board. */
function chevron(row: number, col: number) {
  const cx = col + 0.5 - BOARD_SIZE / 2;
  const cy = row + 0.5 - BOARD_SIZE / 2;
  const horizontal = Math.abs(cx) >= Math.abs(cy);
  const dx = horizontal ? -Math.sign(cx) : 0;
  const dy = horizontal ? 0 : -Math.sign(cy);
  const tip = [dx * 0.55, dy * 0.55];
  const base = [-dx * 0.25, -dy * 0.25];
  const side = [-dy * 0.4, dx * 0.4];
  return [
    tip,
    [base[0]! + side[0]!, base[1]! + side[1]!],
    [base[0]! - side[0]!, base[1]! - side[1]!],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}
