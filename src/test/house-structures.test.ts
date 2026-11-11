import { describe, expect, it } from "vitest";
import {
  HOUSE_ROOM_SIZE,
  HOUSE_STRUCTURES,
  houseStructureBoxes,
} from "@/components/game/housing/house-room-contract";

const [bungalowW, bungalowD] = HOUSE_ROOM_SIZE["bungalow"]!;
const [duplexW, duplexD] = HOUSE_ROOM_SIZE["duplex"]!;

describe("house structures", () => {
  it("gives the bungalow a front veranda on the entrance wall and nothing upstairs", () => {
    expect(HOUSE_STRUCTURES["bungalow"]?.map((s) => s.kind)).toEqual(["veranda"]);
    const boxes = houseStructureBoxes("bungalow", bungalowW, bungalowD, 0);
    expect(boxes.some((box) => box.id === "front-veranda-roof")).toBe(true);
    expect(houseStructureBoxes("bungalow", bungalowW, bungalowD, 1)).toEqual([]);
  });

  it("keeps the veranda outside the room, beyond the entrance wall", () => {
    const slab = houseStructureBoxes("bungalow", bungalowW, bungalowD, 0).find(
      (box) => box.id === "front-veranda-slab",
    )!;
    const nearest = slab.position[2] + slab.size[2] / 2;
    const farthest = slab.position[2] - slab.size[2] / 2;
    // The entrance wall is at z = -depth / 2, and the veranda sits entirely behind it.
    expect(Math.max(nearest, farthest)).toBeLessThanOrEqual(-bungalowD / 2);
    expect(Math.min(nearest, farthest)).toBeLessThan(-bungalowD / 2);
  });

  it("gives the duplex an optional balcony upstairs only, off the garden wall", () => {
    expect(HOUSE_STRUCTURES["duplex"]?.[0]?.optional).toBe(true);
    expect(houseStructureBoxes("duplex", duplexW, duplexD, 0)).toEqual([]);
    const upstairs = houseStructureBoxes("duplex", duplexW, duplexD, 1);
    expect(upstairs.some((box) => box.id === "upstairs-balcony-rail-front")).toBe(true);
    // The balcony projects out from the garden wall at z = +depth / 2.
    const slab = upstairs.find((box) => box.id === "upstairs-balcony-slab")!;
    expect(slab.position[2] - slab.size[2] / 2).toBeGreaterThanOrEqual(duplexD / 2 - 1e-9);
  });

  it("draws no structures for homes without them", () => {
    expect(houseStructureBoxes("studio-flat", 8.6, 6.4, 0)).toEqual([]);
    expect(houseStructureBoxes("duplex", duplexW, duplexD, 0)).toEqual([]);
  });

  it("keeps every structure within the span given by its config", () => {
    const boxes = houseStructureBoxes("bungalow", bungalowW, bungalowD, 0);
    const slab = boxes.find((box) => box.id === "front-veranda-slab")!;
    expect(slab.size[0]).toBeCloseTo(bungalowW * 0.6);
  });
});
