import { expect, it } from "vitest";
import { worldAppearance, worldEquipment } from "@/game/world-character-view";
import { normalizeAvatarAppearance } from "@/game/avatar-appearance";

it("retains saved body and outfit choices at the network rendering boundary", () => {
  const appearance = worldAppearance(
    JSON.stringify({ skin: 4, outfit: 3, stature: 2, build: 3, privateBalance: 10 }),
  );
  expect(appearance).toEqual({ skin: 4, outfit: 3, stature: 2, build: 3 });
  expect(normalizeAvatarAppearance(appearance)).toMatchObject({
    skin: 4,
    outfit: 3,
    stature: 2,
    build: 3,
  });
});
it("falls back safely for invalid appearance and equipment snapshots", () => {
  for (const value of ["invalid", "null", "[]"]) {
    expect(worldAppearance(value)).toEqual({});
    expect(worldEquipment(value)).toEqual([]);
  }
  expect(worldAppearance('{"skin":"4","build":1.5}')).toEqual({});
  expect(worldEquipment('[null,{"slot":"head","secret":true},{"slot":7}]')).toEqual([
    { slot: "head" },
  ]);
});
