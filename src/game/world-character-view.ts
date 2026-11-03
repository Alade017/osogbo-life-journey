import type { Appearance } from "./avatar-appearance";
import type { AvatarEquipment } from "@/components/game/Avatar";

export function worldAppearance(value: string): Appearance {
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const result: Appearance = {};
    for (const key of [
      "skin",
      "hair",
      "hairColor",
      "outfit",
      "bottoms",
      "shoes",
      "headwear",
      "stature",
      "build",
    ] as const) {
      const entry = (data as Record<string, unknown>)[key];
      if (typeof entry === "number" && Number.isInteger(entry)) result[key] = entry;
    }
    return result;
  } catch {
    return {};
  }
}
export function worldEquipment(value: string): AvatarEquipment[] {
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data)
      ? data.flatMap((entry) =>
          entry && typeof entry === "object" && typeof entry.slot === "string"
            ? [{ slot: entry.slot }]
            : [],
        )
      : [];
  } catch {
    return [];
  }
}
