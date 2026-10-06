// Original toy-figure avatar drawn in SVG. Appearance indices map to palettes below.
export const SKIN_TONES = ["#5a3825", "#6e452c", "#8a5a3b", "#a56f48", "#c28a5e", "#3f2618"];
export const HAIR_STYLES = ["Low cut", "Afro", "Braids", "Bald", "Bantu knots", "Locs"];
export const HAIR_COLORS = ["#1b1410", "#3b2416", "#6b3d1f", "#8c8c8c"];
export const OUTFITS = ["#2f9e5b", "#e8b422", "#d0623a", "#3b5bb5", "#9b3f8f", "#2b2f3a"];
export const HEADWEAR = ["None", "Gele", "Fila", "Cap"];

export type Appearance = {
  skin?: number;
  hair?: number;
  hairColor?: number;
  outfit?: number;
  headwear?: number;
};

const EDGE = "#2b3245";

export function Avatar({ appearance, size = 96 }: { appearance: Appearance; size?: number }) {
  const skin = SKIN_TONES[appearance.skin ?? 0] ?? SKIN_TONES[0];
  const hairC = HAIR_COLORS[appearance.hairColor ?? 0] ?? HAIR_COLORS[0];
  const outfit = OUTFITS[appearance.outfit ?? 0] ?? OUTFITS[0];
  const hair = appearance.hair ?? 0;
  const head = appearance.headwear ?? 0;

  return (
    <svg viewBox="0 0 100 120" width={size} height={(size * 120) / 100} aria-hidden>
      {/* stud */}
      <rect x="40" y="4" width="20" height="8" rx="2" fill={skin} stroke={EDGE} strokeWidth="2.5" />
      {/* hair back */}
      {hair === 1 && <circle cx="50" cy="34" r="30" fill={hairC} stroke={EDGE} strokeWidth="2.5" />}
      {hair === 5 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          {[22, 32, 68, 78].map((x) => (
            <rect key={x} x={x - 4} y="24" width="8" height="34" rx="4" />
          ))}
        </g>
      )}
      {/* head */}
      <rect x="24" y="12" width="52" height="46" rx="12" fill={skin} stroke={EDGE} strokeWidth="2.5" />
      {/* hair front */}
      {hair === 0 && <path d="M26 26 Q26 13 50 13 Q74 13 74 26 L74 22 Q50 16 26 22Z" fill={hairC} stroke={EDGE} strokeWidth="2" />}
      {hair === 2 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          <path d="M24 28 Q24 11 50 11 Q76 11 76 28 L76 20 Q50 14 24 20Z" />
          <rect x="18" y="20" width="7" height="36" rx="3.5" />
          <rect x="75" y="20" width="7" height="36" rx="3.5" />
        </g>
      )}
      {hair === 4 && (
        <g fill={hairC} stroke={EDGE} strokeWidth="2">
          {[30, 50, 70].map((x) => (
            <circle key={x} cx={x} cy="12" r="6" />
          ))}
        </g>
      )}
      {hair === 5 && <path d="M24 26 Q24 11 50 11 Q76 11 76 26 L76 20 Q50 14 24 20Z" fill={hairC} stroke={EDGE} strokeWidth="2" />}
      {/* headwear */}
      {head === 1 && (
        <path d="M18 24 Q30 0 52 6 Q80 2 84 24 Q70 16 50 18 Q30 16 18 24Z" fill={outfit} stroke={EDGE} strokeWidth="2.5" />
      )}
      {head === 2 && <path d="M28 18 L32 4 L74 8 L72 20 Q50 14 28 18Z" fill={outfit} stroke={EDGE} strokeWidth="2.5" />}
      {head === 3 && (
        <g stroke={EDGE} strokeWidth="2.5">
          <path d="M26 20 Q26 6 50 6 Q74 6 74 20Z" fill={outfit} />
          <rect x="60" y="16" width="26" height="6" rx="3" fill={outfit} />
        </g>
      )}
      {/* face */}
      <circle cx="40" cy="34" r="3.2" fill={EDGE} />
      <circle cx="60" cy="34" r="3.2" fill={EDGE} />
      <path d="M40 44 Q50 52 60 44" fill="none" stroke={EDGE} strokeWidth="2.5" strokeLinecap="round" />
      {/* torso */}
      <path d="M20 62 L80 62 L86 108 L14 108Z" fill={outfit} stroke={EDGE} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="44" y="58" width="12" height="6" fill={skin} stroke={EDGE} strokeWidth="2" />
      {/* arms */}
      <rect x="6" y="64" width="12" height="34" rx="6" fill={outfit} stroke={EDGE} strokeWidth="2.5" />
      <rect x="82" y="64" width="12" height="34" rx="6" fill={outfit} stroke={EDGE} strokeWidth="2.5" />
      <circle cx="12" cy="102" r="5" fill={skin} stroke={EDGE} strokeWidth="2" />
      <circle cx="88" cy="102" r="5" fill={skin} stroke={EDGE} strokeWidth="2" />
    </svg>
  );
}
