import type { CSSProperties } from "react";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";

const CATEGORY_BADGES: Record<string, { emoji: string; tone: string }> = {
  food: { emoji: "🍽️", tone: "#f97316" },
  market: { emoji: "🛍️", tone: "#eab308" },
  health: { emoji: "🏥", tone: "#ef4444" },
  services: { emoji: "🏛️", tone: "#3b82f6" },
  worship: { emoji: "⛪", tone: "#8b5cf6" },
  transport: { emoji: "🚌", tone: "#14b8a6" },
  sport: { emoji: "⚽", tone: "#22c55e" },
  school: { emoji: "🎓", tone: "#6366f1" },
  jobs: { emoji: "💼", tone: "#0ea5e9" },
};

const FALLBACK_BADGE = { emoji: "📍", tone: "#64748b" };

export function placeBadgeFor(category: string) {
  return CATEGORY_BADGES[category] ?? FALLBACK_BADGE;
}

/** A round emoji badge floating above a place in the 3D town. Clicks pass through to the building. */
export function PlaceBadge({
  position,
  label,
  category,
}: {
  position: [number, number, number];
  label: string;
  category: string;
}) {
  const badge = placeBadgeFor(category);
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        className="map-place-badge"
        role="img"
        aria-label={label}
        style={{ "--badge-tone": badge.tone } as CSSProperties}
      >
        {badge.emoji}
      </div>
    </Html>
  );
}

export { MapPin3D } from "./MapPin3D";
