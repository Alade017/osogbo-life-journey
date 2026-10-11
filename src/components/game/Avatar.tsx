// Original toy-figure avatar drawn in SVG. Appearance indices map to palettes below.
export const SKIN_TONES = ["#5a3825", "#6e452c", "#8a5a3b", "#a56f48", "#c28a5e", "#3f2618"];
export const HAIR_STYLES_BY_GENDER: Record<string, string[]> = {
  female: ["Low bun", "Natural afro", "Knotless braids", "Bald", "Bantu knots", "Locs"],
  male: ["Low fade", "Short afro", "Cornrows", "Bald", "Wave cut", "Locs"],
  nonbinary: ["Taper fade", "Natural afro", "Braids", "Bald", "Twist-out", "Locs"],
};
export const HAIR_STYLES = HAIR_STYLES_BY_GENDER["female"];
export const HAIR_COLORS = ["#1b1410", "#3b2416", "#6b3d1f", "#8c8c8c"];
export const OUTFITS = ["#2f9e5b", "#e8b422", "#d0623a", "#3b5bb5", "#9b3f8f", "#2b2f3a"];
export const TROUSERS = ["#27334a", "#20242c", "#614b3b", "#738095", "#3b5bb5", "#547250"];
export const SHOE_COLORS = ["#22242a", "#5b3526", "#eee5d5", "#b34535"];
export const HEADWEAR = ["None", "Gele", "Fila", "Cap"];

export type Appearance = {
  skin?: number;
  hair?: number;
  hairColor?: number;
  outfit?: number;
  bottoms?: number;
  shoes?: number;
  headwear?: number;
};

const EDGE = "#103d2c";

export function Avatar({
  appearance,
  gender = "nonbinary",
  size = 96,
}: {
  appearance: Appearance;
  gender?: string;
  size?: number;
}) {
  const skin = SKIN_TONES[appearance.skin ?? 0] ?? SKIN_TONES[0];
  const hairC = HAIR_COLORS[appearance.hairColor ?? 0] ?? HAIR_COLORS[0];
  const outfit = OUTFITS[appearance.outfit ?? 0] ?? OUTFITS[0];
  const bottoms = TROUSERS[appearance.bottoms ?? 0] ?? TROUSERS[0];
  const shoes = SHOE_COLORS[appearance.shoes ?? 0] ?? SHOE_COLORS[0];
  const hair = appearance.hair ?? 0;
  const head = appearance.headwear ?? 0;
  const isFemale = gender === "female";
  const isMale = gender === "male";

  return (
    <svg viewBox="0 0 100 120" width={size} height={(size * 120) / 100} aria-hidden>
      {/* stud */}
      <rect x="40" y="4" width="20" height="8" rx="2" fill={skin} stroke={EDGE} strokeWidth="2.5" />
      {/* hair back */}
      {hair === 0 && isFemale && (
        <path
          d="M66 18 Q82 17 84 30 Q84 42 73 45 L66 40Z"
          fill={hairC}
          stroke={EDGE}
          strokeWidth="2.5"
        />
      )}
      {hair === 1 && isFemale && (
        <circle cx="50" cy="32" r="30" fill={hairC} stroke={EDGE} strokeWidth="2.5" />
      )}
      {hair === 1 && isMale && (
        <path
          d="M23 29 Q22 10 50 10 Q78 10 77 29 Q67 20 50 22 Q33 20 23 29Z"
          fill={hairC}
          stroke={EDGE}
          strokeWidth="2.5"
        />
      )}
      {hair === 5 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          {[22, 32, 68, 78].map((x) => (
            <rect key={x} x={x - 4} y="24" width="8" height="34" rx="4" />
          ))}
        </g>
      )}
      {/* head */}
      <rect
        x="24"
        y="12"
        width="52"
        height="46"
        rx="12"
        fill={skin}
        stroke={EDGE}
        strokeWidth="2.5"
      />
      {/* hair front */}
      {hair === 0 && isMale && (
        <path
          d="M26 26 Q27 14 50 14 Q73 14 74 26 L70 21 Q50 17 30 21Z"
          fill={hairC}
          stroke={EDGE}
          strokeWidth="2"
        />
      )}
      {hair === 0 && gender === "nonbinary" && (
        <path
          d="M26 26 Q26 12 50 12 Q74 12 74 26 L70 22 Q50 17 30 22Z"
          fill={hairC}
          stroke={EDGE}
          strokeWidth="2"
        />
      )}
      {hair === 1 && !isFemale && !isMale && (
        <circle cx="50" cy="31" r="26" fill={hairC} stroke={EDGE} strokeWidth="2.5" />
      )}
      {hair === 2 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          {isMale ? (
            <>
              <path d="M24 28 Q24 11 50 11 Q76 11 76 28 L76 20 Q50 14 24 20Z" />
              <path d="M30 18 Q38 23 43 18 M44 14 Q50 21 56 14 M59 18 Q65 23 70 18" fill="none" />
              <rect x="20" y="22" width="6" height="30" rx="3" />
              <rect x="74" y="22" width="6" height="30" rx="3" />
            </>
          ) : (
            <>
              <path d="M23 29 Q23 10 50 10 Q77 10 77 29 L77 20 Q50 13 23 20Z" />
              <rect x="17" y="20" width="7" height="43" rx="3.5" />
              <rect x="76" y="20" width="7" height="43" rx="3.5" />
              <path d="M20 32v25 M79 32v25" fill="none" stroke="#d8b36a" strokeWidth="1" />
            </>
          )}
        </g>
      )}
      {hair === 4 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          {isMale ? (
            <>
              <path d="M27 25 Q29 12 50 12 Q71 12 73 25" fill="none" strokeWidth="4" />
              <path
                d="M31 22 Q36 17 42 22 M45 19 Q50 14 55 19 M58 22 Q64 17 69 22"
                fill="none"
                stroke="#6b3d1f"
                strokeWidth="1.5"
              />
            </>
          ) : (
            [30, 50, 70].map((x) => <circle key={x} cx={x} cy="12" r={isFemale ? 7 : 6} />)
          )}
        </g>
      )}
      {hair === 5 && (
        <path
          d="M24 26 Q24 11 50 11 Q76 11 76 26 L76 20 Q50 14 24 20Z"
          fill={hairC}
          stroke={EDGE}
          strokeWidth="2"
        />
      )}
      {/* headwear */}
      {head === 1 && (
        <path
          d="M18 24 Q30 0 52 6 Q80 2 84 24 Q70 16 50 18 Q30 16 18 24Z"
          fill={outfit}
          stroke={EDGE}
          strokeWidth="2.5"
        />
      )}
      {head === 2 && (
        <path
          d="M28 18 L32 4 L74 8 L72 20 Q50 14 28 18Z"
          fill={outfit}
          stroke={EDGE}
          strokeWidth="2.5"
        />
      )}
      {head === 3 && (
        <g stroke={EDGE} strokeWidth="2.5">
          <path d="M26 20 Q26 6 50 6 Q74 6 74 20Z" fill={outfit} />
          <rect x="60" y="16" width="26" height="6" rx="3" fill={outfit} />
        </g>
      )}
      {/* face */}
      <circle cx="40" cy="34" r="3.2" fill={EDGE} />
      <circle cx="60" cy="34" r="3.2" fill={EDGE} />
      <path
        d="M40 44 Q50 52 60 44"
        fill="none"
        stroke={EDGE}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* torso */}
      <path
        d="M20 62 L80 62 L82 88 L18 88Z"
        fill={outfit}
        stroke={EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="44" y="58" width="12" height="6" fill={skin} stroke={EDGE} strokeWidth="2" />
      {/* trousers */}
      <path
        d="M18 86 L82 86 L77 108 L55 108 L50 96 L45 108 L23 108Z"
        fill={bottoms}
        stroke={EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* shoes */}
      <path
        d="M23 105 L45 105 L44 112 L18 114 Q16 108 23 105Z"
        fill={shoes}
        stroke={EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M55 105 L77 105 Q84 108 82 114 L56 112Z"
        fill={shoes}
        stroke={EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* arms */}
      <rect
        x="6"
        y="64"
        width="12"
        height="34"
        rx="6"
        fill={outfit}
        stroke={EDGE}
        strokeWidth="2.5"
      />
      <rect
        x="82"
        y="64"
        width="12"
        height="34"
        rx="6"
        fill={outfit}
        stroke={EDGE}
        strokeWidth="2.5"
      />
      <circle cx="12" cy="102" r="5" fill={skin} stroke={EDGE} strokeWidth="2" />
      <circle cx="88" cy="102" r="5" fill={skin} stroke={EDGE} strokeWidth="2" />
    </svg>
  );
}
