import type { HousePlacement } from "./HouseRoomScene";

/** A bed's floor area in the shared room, as room percentages. */
export type SharedBedZone = {
  bedSlot: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

/** The shared room as its current tenant sees it, from the server's shared_home_state. */
export type SharedHomeState = {
  unitId: string;
  myBedSlot: number;
  zones: SharedBedZone[];
  placements: HousePlacement[];
  /** Where the tenant's own bed stands, in room percentages, or null if it is not placed. */
  myBed: { x: number; y: number } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The tenant's own bed zone, or null when the player has no shared bed. */
export function myBedZone(shared: SharedHomeState | null): SharedBedZone | null {
  if (!shared) return null;
  return shared.zones.find((zone) => zone.bedSlot === shared.myBedSlot) ?? null;
}

/**
 * A zone's rectangle in world units, on the same inset as roomPercentToPosition but without its
 * 4 to 96 clamp, so the outline covers the whole zone.
 */
export function zoneWorldRect(zone: SharedBedZone, width: number, depth: number) {
  const x0 = (zone.xMin / 100 - 0.5) * (width - 0.8);
  const x1 = (zone.xMax / 100 - 0.5) * (width - 0.8);
  const z0 = (0.5 - zone.yMin / 100) * (depth - 0.8);
  const z1 = (0.5 - zone.yMax / 100) * (depth - 0.8);
  return {
    centerX: (x0 + x1) / 2,
    centerZ: (z0 + z1) / 2,
    sizeX: Math.abs(x1 - x0),
    sizeZ: Math.abs(z1 - z0),
  };
}

/** Shared-room furniture is game-placed and read-only, so its slot keys never reach a move or remove call. */
export function sharedSlotKey(slot: string): string {
  return `shared:${slot}`;
}

/** Parses the server's shared_home value. Anything malformed reads as no shared room. */
export function parseSharedHome(value: unknown): SharedHomeState | null {
  if (!isRecord(value)) return null;
  if (typeof value["unit_id"] !== "string") return null;
  const myBedSlot = finite(value["my_bed_slot"]);
  if (myBedSlot === null) return null;

  const rawZones = Array.isArray(value["zones"]) ? value["zones"] : [];
  const zones = rawZones.flatMap((entry): SharedBedZone[] => {
    if (!isRecord(entry)) return [];
    const bedSlot = finite(entry["bed_slot"]);
    const xMin = finite(entry["x_min"]);
    const xMax = finite(entry["x_max"]);
    const yMin = finite(entry["y_min"]);
    const yMax = finite(entry["y_max"]);
    if (bedSlot === null || xMin === null || xMax === null || yMin === null || yMax === null)
      return [];
    return [{ bedSlot, xMin, xMax, yMin, yMax }];
  });

  const rawPlacements = Array.isArray(value["placements"]) ? value["placements"] : [];
  let myBed: { x: number; y: number } | null = null;
  const placements = rawPlacements.flatMap((entry, index): HousePlacement[] => {
    if (!isRecord(entry)) return [];
    const slot = typeof entry["slot"] === "string" ? entry["slot"] : null;
    const itemId = typeof entry["item_id"] === "string" ? entry["item_id"] : null;
    const x = finite(entry["x"]);
    const y = finite(entry["y"]);
    if (!slot || !itemId || x === null || y === null) return [];
    if (myBed === null && entry["slot_type"] === "bed" && finite(entry["bed_slot"]) === myBedSlot)
      myBed = { x, y };
    const artKey = typeof entry["art_key"] === "string" ? entry["art_key"] : itemId;
    return [
      {
        id: typeof entry["id"] === "string" ? `shared-${entry["id"]}` : `shared-${index}`,
        item_id: itemId,
        slot: sharedSlotKey(slot),
        x,
        y,
        rotation_deg: finite(entry["rotation_deg"]) ?? 0,
        floor: 0,
        art_key: artKey,
        category: typeof entry["category"] === "string" ? entry["category"] : "furniture",
        slot_type: typeof entry["slot_type"] === "string" ? entry["slot_type"] : slot,
      },
    ];
  });

  return { unitId: value["unit_id"], myBedSlot, zones, placements, myBed };
}

/** The shared pieces to draw in a tenant's room. They are read-only: the game places them. */
export function sharedRoomPlacements(shared: SharedHomeState | null): HousePlacement[] {
  return shared ? shared.placements : [];
}
