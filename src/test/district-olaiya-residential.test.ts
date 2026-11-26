import { describe, expect, it } from "vitest";
import {
  busParts,
  carParts,
  compoundParts,
  districtParts,
  grassParts,
  treeParts,
  type Part,
} from "../components/district/district-builders.ts";
import { OLAIYA_JUNCTION } from "../game/districts/olaiya-junction.ts";
import type { DistrictRect } from "../game/districts/district-layout.ts";

const compounds = OLAIYA_JUNCTION.lots
  .map((lot, index) => ({ lot, index }))
  .filter(({ lot }) => lot.archetype === "compound");

/** Horizontal footprint of a part: its centre plus half its size on x and z. */
function footprint(part: Part) {
  const [px, , pz] = part.position;
  const [sx, , sz] = part.scale;
  return { minX: px - sx / 2, maxX: px + sx / 2, minZ: pz - sz / 2, maxZ: pz + sz / 2 };
}

function insideLot(part: Part, lot: DistrictRect, tolerance: number): boolean {
  const f = footprint(part);
  return (
    f.minX >= lot.x - lot.w / 2 - tolerance &&
    f.maxX <= lot.x + lot.w / 2 + tolerance &&
    f.minZ >= lot.z - lot.d / 2 - tolerance &&
    f.maxZ <= lot.z + lot.d / 2 + tolerance
  );
}

describe("Olaiya residential compounds", () => {
  it("has compound lots in more than one property type", () => {
    expect(compounds.length).toBeGreaterThanOrEqual(8);
    const counts = new Set(compounds.map(({ lot, index }) => compoundParts(lot, index).length));
    expect(counts.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps every compound part inside its own plot (with roof overhang and wall thickness)", () => {
    for (const { lot, index } of compounds) {
      for (const part of compoundParts(lot, index)) {
        expect(insideLot(part, lot, 0.7), `${lot.x},${lot.z} part at ${part.position}`).toBe(true);
      }
    }
  });

  it("places each house body inside the plot, set back from the front wall", () => {
    for (const { lot, index } of compounds) {
      const body = compoundParts(lot, index).find(
        (part) => part.kind === "box" && part.color !== undefined && part.scale[0] === lot.w - 5,
      );
      expect(body, `house body for lot ${lot.x},${lot.z}`).toBeDefined();
      const f = footprint(body!);
      expect(f.maxZ).toBeLessThan(lot.z + lot.d / 2);
      expect(f.minX).toBeGreaterThan(lot.x - lot.w / 2);
    }
  });

  it("leaves a gate opening centred on the front wall of walled compounds", () => {
    for (const { lot, index } of compounds) {
      const frontWalls = compoundParts(lot, index).filter(
        (part) =>
          part.kind === "box" &&
          Math.abs(part.position[2] - (lot.z + lot.d / 2)) < 0.01 &&
          part.scale[1] === 1.8,
      );
      if (frontWalls.length === 0) continue; // open-yard variant has no wall
      for (const wall of frontWalls) {
        const f = footprint(wall);
        const gateCentre = lot.x;
        expect(gateCentre < f.minX || gateCentre > f.maxX).toBe(true);
      }
    }
  });

  it("is deterministic: the same plot always produces the same parts", () => {
    const { lot, index } = compounds[0]!;
    expect(compoundParts(lot, index)).toEqual(compoundParts(lot, index));
  });
});

describe("Olaiya landscaping and vegetation", () => {
  it("builds grass from tufts and stemmed flowers, with no flat discs", () => {
    for (let index = 0; index < 12; index += 1) {
      const rect = { x: 0, z: 0, w: 4, d: 4 };
      for (const part of grassParts(rect, index)) {
        expect(part.kind).not.toBe("box");
        if (part.kind === "cylinder") {
          // Stems are tall and thin; a flat disc would be short and wide.
          expect(part.scale[1]).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it("uses one rounded canopy style for every tree", () => {
    const trees = OLAIYA_JUNCTION.trees;
    for (const part of treeParts(trees)) {
      if (part.kind !== "sphere" || part.scale[0] < 2) continue;
      const ratio = part.scale[1] / part.scale[0];
      expect(ratio).toBeGreaterThanOrEqual(0.8);
      expect(ratio).toBeLessThanOrEqual(1.1);
    }
  });

  it("gives trees the same rounded canopy style across the whole district", () => {
    const built = treeParts(OLAIYA_JUNCTION.trees).filter((p) => p.kind === "sphere");
    expect(built.length).toBe(OLAIYA_JUNCTION.trees.length);
  });
});

describe("Olaiya vehicles", () => {
  it("builds danfo minibuses and private cars from parts with wheels", () => {
    const bus = busParts(0, 0, 0);
    const car = carParts(0, 0, 0, "#c94b36");
    for (const vehicle of [bus, car]) {
      expect(vehicle.filter((p) => p.kind === "cylinder").length).toBe(4);
    }
  });
});

describe("Olaiya residential variety and street detail", () => {
  it("gives houses a wide range of wall colours and roof shapes", () => {
    const walls = new Set<string>();
    const roofKinds = new Set<string>();
    for (const { lot, index } of compounds) {
      for (const part of compoundParts(lot, index)) {
        if (part.kind === "gable" || part.kind === "hip") roofKinds.add(part.kind);
        if (part.kind === "box" && part.scale[0] === lot.w - 5 && part.scale[1] > 5) {
          walls.add(part.color);
        }
      }
    }
    expect(walls.size).toBeGreaterThanOrEqual(5);
    expect(roofKinds.has("gable")).toBe(true);
    expect(roofKinds.has("hip")).toBe(true);
  });

  it("includes duplex houses with two doors", () => {
    const duplex = compounds.find(({ index }) => index % 5 === 4);
    expect(duplex).toBeDefined();
    const doors = compoundParts(duplex!.lot, duplex!.index).filter(
      (part) => part.kind === "box" && part.scale[0] === 1.6 && part.scale[1] === 2.6,
    );
    expect(doors.length).toBe(2);
  });

  it("gives every shopfront a readable business sign on its front face", () => {
    const { signs } = districtParts(OLAIYA_JUNCTION);
    const shops =
      OLAIYA_JUNCTION.lots.filter((lot) => lot.archetype === "corner-block").length +
      OLAIYA_JUNCTION.places.filter((place) => place.kind !== "kiosk").length;
    expect(signs.length).toBe(shops);
    for (const sign of signs) {
      expect(sign.name.length).toBeGreaterThan(3);
      expect(sign.w).toBeGreaterThan(0);
    }
  });

  it("draws zebra crossings and street furniture across the district", () => {
    const { street } = districtParts(OLAIYA_JUNCTION);
    expect(street.some((part) => part.kind === "cone" || part.kind === "cylinder")).toBe(true);
    expect(street.filter((part) => part.color === "#f7f1df").length).toBeGreaterThan(20);
    expect(street.length).toBeGreaterThan(100);
  });
});
