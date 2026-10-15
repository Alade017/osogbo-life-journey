import { memo, useCallback, useEffect, useMemo, useState, type PointerEvent } from "react";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";

export type HouseSlot = { id: string; slot_type: string; x: number; y: number; z?: number };
export type HousePlacement = {
  id: string;
  item_id: string;
  slot: string;
  art_key: string;
  category: string;
  slot_type: string;
  front_overlay_art_key?: string;
};
export type HouseInventoryItem = {
  id: string;
  item_id: string;
  category: string;
  slot_type: string;
  art_key: string;
  price_minor: number;
  quantity: number;
};
export type HouseOutfit = Record<"head" | "top" | "bottom" | "shoes" | "accessory", string | null>;

type Props = {
  house: { house_type_id: string; label: string; asset_key: string; status: string };
  slots: HouseSlot[];
  placements: HousePlacement[];
  outfit: HouseOutfit;
  inventory: HouseInventoryItem[];
  appearance: Appearance;
  gender: string;
  editMode: boolean;
  onSelectPlacement: (placement: HousePlacement) => void;
  onSelectSlot: (slot: HouseSlot) => void;
  walkableArea?: {
    x: number;
    y: number;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
};

const OUTFIT_ORDER = ["bottom", "top", "shoes", "head", "accessory"] as const;
const ITEM_ASSET_FALLBACK: Record<string, string> = {
  "starter-bed": "starter-bed",
  bed: "starter-bed",
  "starter-light": "starter-light",
  plant: "starter-light",
  "starter-seat": "starter-seat",
  sofa: "starter-seat",
};

function assetPath(key: string, fallback?: string) {
  const safe = /^[a-z0-9-]+$/i.test(key) ? key : (fallback ?? "");
  return safe ? `/assets/items/${safe}.webp` : "";
}

const OutfitSprites = memo(function OutfitSprites({
  outfit,
  inventory,
}: {
  outfit: HouseOutfit;
  inventory: HouseInventoryItem[];
}) {
  const equipped = useMemo(
    () =>
      OUTFIT_ORDER.flatMap((slot) => {
        const id = outfit[slot];
        const item = id ? inventory.find((entry) => entry.item_id === id) : undefined;
        return item ? [{ slot, item }] : [];
      }),
    [inventory, outfit],
  );
  return (
    <div className="house-avatar-outfit" aria-hidden="true">
      {equipped.map(({ slot, item }) => (
        <GarmentSprite key={slot} slot={slot} itemId={item.item_id} artKey={item.art_key} />
      ))}
    </div>
  );
});

/** A small local vector fallback keeps catalogue wearables visible without per-item image files. */
function GarmentSprite({ slot, itemId, artKey }: { slot: string; itemId: string; artKey: string }) {
  const seed = `${itemId}:${artKey}`
    .split("")
    .reduce((value, char) => value + char.charCodeAt(0), 0);
  const colors = ["#22543d", "#174b83", "#9b3f36", "#6c4b91", "#b7791f", "#263238"];
  const fill = colors[seed % colors.length];
  const paths: Record<string, string> = {
    bottom: "M30 8h40l-4 78H51l-2-48-3 48H30z",
    top: "M27 12 42 6h16l15 6 10 23-14 6-5-11v47H36V30l-5 11-14-6z",
    shoes: "M18 60h27v14c0 7-8 11-25 10l-5-5zm38 0h27l4 18c-4 5-13 7-29 5z",
    head: "M22 37c1-20 12-31 28-31s27 11 28 31l-8 4-4-16-5 14H36l-5-14-2 16z",
    accessory: "M31 15h38l-4 13H35zM42 28h16l-4 31h-8z",
  };
  return (
    <svg data-outfit-layer={slot} viewBox="0 0 100 100" focusable="false" aria-hidden="true">
      <path
        d={paths[slot] ?? paths["accessory"]}
        fill={fill}
        stroke="#14213d"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {slot === "top" && (
        <path d="M50 9v72" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" />
      )}
      {slot === "head" && <path d="M21 35h58" fill="none" stroke="#f5c542" strokeWidth="5" />}
      {slot === "accessory" && (
        <circle cx="50" cy="64" r="8" fill="#f5c542" stroke="#14213d" strokeWidth="2" />
      )}
    </svg>
  );
}

const equippedSpriteKey = (outfit: HouseOutfit, inventory: HouseInventoryItem[]) =>
  OUTFIT_ORDER.map((slot) => {
    const id = outfit[slot];
    return id ? (inventory.find((item) => item.item_id === id)?.art_key ?? id) : "";
  }).join("|");

const HouseAvatar = memo(
  function HouseAvatar({
    x,
    y,
    outfit,
    inventory,
    appearance,
    gender,
    reducedMotion,
  }: Pick<Props, "outfit" | "inventory" | "appearance" | "gender"> & {
    x: number;
    y: number;
    reducedMotion: boolean;
  }) {
    const equipment = OUTFIT_ORDER.filter((slot) => outfit[slot]).map((slot) => ({ slot }));
    const outfitDescription = OUTFIT_ORDER.flatMap((slot) => {
      const itemId = outfit[slot];
      return itemId ? [itemId.replaceAll("-", " ")] : [];
    });
    return (
      <div
        className="house-avatar"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transition: reducedMotion ? "none" : "left 480ms linear, top 480ms linear",
        }}
        role="img"
        aria-label={
          outfitDescription.length
            ? `Your character wearing ${outfitDescription.join(", ")}`
            : "Your character"
        }
      >
        <Avatar appearance={appearance} gender={gender} size={78} equipment={equipment} />
        <OutfitSprites outfit={outfit} inventory={inventory} />
      </div>
    );
  },
  (previous, next) =>
    previous.x === next.x &&
    previous.y === next.y &&
    previous.gender === next.gender &&
    previous.reducedMotion === next.reducedMotion &&
    JSON.stringify(previous.appearance) === JSON.stringify(next.appearance) &&
    JSON.stringify(previous.outfit) === JSON.stringify(next.outfit) &&
    equippedSpriteKey(previous.outfit, previous.inventory) ===
      equippedSpriteKey(next.outfit, next.inventory),
);

export const HouseScene = memo(function HouseScene({
  house,
  slots,
  placements,
  outfit,
  inventory,
  appearance,
  gender,
  editMode,
  onSelectPlacement,
  onSelectSlot,
  walkableArea = { x: 52, y: 78, min_x: 8, max_x: 92, min_y: 30, max_y: 86 },
}: Props) {
  const [walkPoint, setWalkPoint] = useState<{ x: number; y: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const place = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (editMode || (event.target as HTMLElement).closest("button")) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = Math.max(
        walkableArea.min_x,
        Math.min(walkableArea.max_x, ((event.clientX - bounds.left) / bounds.width) * 100),
      );
      const y = Math.max(
        walkableArea.min_y,
        Math.min(walkableArea.max_y, ((event.clientY - bounds.top) / bounds.height) * 100),
      );
      setWalkPoint({ x, y });
    },
    [editMode, walkableArea],
  );
  const slotsById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const occupied = useMemo(
    () => new Set(placements.map((placement) => placement.slot)),
    [placements],
  );
  const character = walkPoint ?? { x: walkableArea.x, y: walkableArea.y };
  const setMotionPreference = useCallback((event: MediaQueryListEvent) => {
    setReducedMotion(event.matches);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener?.("change", setMotionPreference);
    return () => media.removeEventListener?.("change", setMotionPreference);
  }, [setMotionPreference]);

  return (
    <div className={`house-scene${house.status === "overdue" ? " is-overdue" : ""}`}>
      <div className="house-scene-layers" onPointerUp={place}>
        <img
          className="house-room-background"
          src={`/assets/homes/${house.asset_key}.webp`}
          alt=""
          fetchPriority="high"
        />
        {placements.map((placement) => {
          const slot = slotsById.get(placement.slot);
          if (!slot) return null;
          const fallback = ITEM_ASSET_FALLBACK[placement.item_id];
          const src = assetPath(placement.art_key, fallback);
          return (
            <button
              key={placement.id}
              type="button"
              className="house-furniture"
              aria-label={placement.item_id.replaceAll("-", " ")}
              onClick={() => editMode && onSelectPlacement(placement)}
              tabIndex={editMode ? 0 : -1}
              aria-hidden={!editMode}
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 5 + (slot.z ?? 0) }}
            >
              {src ? (
                <>
                  <img
                    src={src}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      event.currentTarget.parentElement
                        ?.querySelector(".house-furniture-label")
                        ?.removeAttribute("hidden");
                    }}
                  />
                  <span className="house-furniture-label" hidden>
                    {placement.item_id.replaceAll("-", " ")}
                  </span>
                </>
              ) : (
                <span>{placement.item_id.replaceAll("-", " ")}</span>
              )}
            </button>
          );
        })}
        {editMode &&
          slots
            .filter((slot) => !occupied.has(slot.id))
            .map((slot) => (
              <button
                key={slot.id}
                type="button"
                className="house-empty-slot"
                aria-label={`Place furniture in ${slot.slot_type} slot`}
                onClick={() => onSelectSlot(slot)}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                +
              </button>
            ))}
        <HouseAvatar
          x={character.x}
          y={character.y}
          outfit={outfit}
          inventory={inventory}
          appearance={appearance}
          gender={gender}
          reducedMotion={reducedMotion}
        />
        {placements.flatMap((placement) => {
          if (!placement.front_overlay_art_key) return [];
          const slot = slotsById.get(placement.slot);
          const src = assetPath(placement.front_overlay_art_key);
          if (!slot || !src) return [];
          return [
            <img
              key={`${placement.id}:front`}
              className="house-furniture-front-overlay"
              src={src}
              alt=""
              aria-hidden="true"
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 30 + (slot.z ?? 0) }}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />,
          ];
        })}
      </div>
      <p className="sr-only">
        {placements.length
          ? `Placed: ${placements.map((item) => item.item_id.replaceAll("-", " ")).join(", ")}.`
          : "No furniture has been placed yet."}
      </p>
    </div>
  );
});
