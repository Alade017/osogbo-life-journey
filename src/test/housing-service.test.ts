import { describe, expect, it } from "vitest";
import {
  canPlace,
  DEFAULT_HOUSING_SAVE,
  findPath,
  FURNITURE_CATALOG,
  HOME_LAYOUTS,
  parseHousingSave,
} from "@/lib/housing-service";
import { readLocalHousingSave, writeLocalHousingSave } from "@/lib/save-storage";

describe("housing navigation and placement", () => {
  it("finds a walkable route around a furniture obstacle", () => {
    const route = findPath(5, 5, [0, 2], [4, 2], new Set(["1,2", "2,2", "3,2"]));
    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual([4, 2]);
    expect(route?.some(([x, y]) => y !== 2)).toBe(true);
  });

  it("rejects unreachable, out-of-room, and colliding placements", () => {
    const room = HOME_LAYOUTS[0]!.rooms[0]!;
    const sofa = FURNITURE_CATALOG.find((item) => item.id === "sofa")!;
    const placed = [{ id: "one", itemId: "sofa", room: room.id, x: 1, y: 1, rotation: 0 as const }];
    expect(canPlace(room, sofa, 1, 1, placed)).toBe(false);
    expect(canPlace(room, sofa, room.width - 1, 0, [])).toBe(false);
    expect(canPlace(room, sofa, 3, 3, placed)).toBe(true);
    expect(findPath(3, 3, [0, 0], [3, 0], new Set())).toBeNull();
  });

  it("offers distinct starter floorplans and gameplay furniture", () => {
    expect(
      new Set(HOME_LAYOUTS.map((layout) => `${layout.rooms.length}:${layout.propertyType}`)).size,
    ).toBe(3);
    expect(FURNITURE_CATALOG.find((item) => item.id === "bed")?.effects.energy).toBeGreaterThan(0);
    expect(FURNITURE_CATALOG.some((item) => item.category === "bathroom")).toBe(true);
  });

  it("validates layout identifiers, bounds, needs, and furniture placement before restoring", () => {
    expect(parseHousingSave(DEFAULT_HOUSING_SAVE)).toEqual(DEFAULT_HOUSING_SAVE);
    expect(parseHousingSave({ ...DEFAULT_HOUSING_SAVE, x: 999 })).toBeNull();
    expect(
      parseHousingSave({
        ...DEFAULT_HOUSING_SAVE,
        needs: { ...DEFAULT_HOUSING_SAVE.needs, hunger: 101 },
      }),
    ).toBeNull();
    expect(
      parseHousingSave({
        ...DEFAULT_HOUSING_SAVE,
        furniture: [{ id: "bad", itemId: "unknown", room: "lounge", x: 0, y: 0, rotation: 0 }],
      }),
    ).toBeNull();
  });

  it("migrates legacy browser saves and recovers the prior valid backup", () => {
    const key = "housing-save-test";
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(DEFAULT_HOUSING_SAVE));
    expect(readLocalHousingSave(key)).toMatchObject({ migrated: true, recoveredFromBackup: false });
    const first = {
      ...DEFAULT_HOUSING_SAVE,
      layoutId: "courtyard-room",
      room: "lounge" as const,
      x: 2,
    };
    const second = {
      ...DEFAULT_HOUSING_SAVE,
      layoutId: "family-courtyard",
      room: "lounge" as const,
      x: 4,
    };
    expect(writeLocalHousingSave(key, first)).toBe(true);
    expect(writeLocalHousingSave(key, second)).toBe(true);
    localStorage.setItem(key, "{corrupt json");
    expect(readLocalHousingSave(key)).toMatchObject({
      payload: first,
      recoveredFromBackup: true,
      migrated: false,
    });
    localStorage.clear();
  });
});
