// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ATIKU_AREA, OKE_FIA_AREA, neighborhoodAreaForSlug } from "@/game/neighborhood-model";
import { neighborhoodObstacleFootprint, type GroundRect } from "@/game/neighborhood-geometry";

const AREAS = [
  { label: "Greenbank Estates", area: ATIKU_AREA, glb: "greenbank-estates.glb" },
  { label: "Hillview Quarter", area: OKE_FIA_AREA, glb: "hillview-quarter.glb" },
] as const;
const ENTRANCE = { x: 320, y: 300 };

function overlaps(a: GroundRect, b: GroundRect) {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}
function insideRect(point: { x: number; y: number }, rect: GroundRect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}
function rectOf(item: { x: number; y: number; width: number; height: number }) {
  return neighborhoodObstacleFootprint(item);
}

describe.each(AREAS)("$label residential neighbourhood", ({ label, area }) => {
  const obstacles = area.obstacles ?? [];
  const envRect = area.environment
    ? {
        left: area.environment.x - area.environment.width / 2,
        top: area.environment.y - area.environment.height / 2,
        width: area.environment.width,
        height: area.environment.height,
      }
    : null;

  it(`${label} is served from the hand-built layout`, () => {
    expect(neighborhoodAreaForSlug(area.slug)).toBe(area);
    expect(area.environment?.url).toContain("/models/environments/neighborhoods/");
  });

  it("keeps the entrance clear of solid obstacles", () => {
    for (const obstacle of obstacles) {
      expect(insideRect(ENTRANCE, rectOf(obstacle)), obstacle.id).toBe(false);
    }
  });

  it("never lets two solid obstacles overlap", () => {
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        expect(
          overlaps(rectOf(obstacles[i]!), rectOf(obstacles[j]!)),
          `${obstacles[i]!.id} vs ${obstacles[j]!.id}`,
        ).toBe(false);
      }
    }
  });

  it("keeps every object (home, shop, work, NPC) off the solid obstacles", () => {
    for (const object of area.objects) {
      for (const obstacle of obstacles) {
        expect(insideRect(object, rectOf(obstacle)), `${object.id} in ${obstacle.id}`).toBe(false);
      }
    }
  });

  it("places every solid obstacle inside the environment footprint it is drawn over", () => {
    expect(envRect).not.toBeNull();
    for (const obstacle of obstacles) {
      const r = rectOf(obstacle);
      const inside =
        r.left >= envRect!.left &&
        r.top >= envRect!.top &&
        r.left + r.width <= envRect!.left + envRect!.width &&
        r.top + r.height <= envRect!.top + envRect!.height;
      expect(inside, obstacle.id).toBe(true);
    }
  });

  it("keeps the road network to the environment and every object on a walkable road", () => {
    for (const object of area.objects) {
      const onRoad = (area.roads ?? []).some((road) =>
        road.axis === "horizontal"
          ? Math.abs(object.y - road.offset) <= road.width / 2
          : Math.abs(object.x - road.offset) <= road.width / 2,
      );
      expect(onRoad, `${object.id} on a road`).toBe(true);
    }
  });
});

describe.each([
  { label: "Greenbank Estates", glb: "greenbank-estates.glb", ground: "atk_ground" },
  { label: "Hillview Quarter", glb: "hillview-quarter.glb", ground: "hvq_ground" },
])("$label environment GLB", ({ glb, ground }) => {
  it("parses and its ground is the authored 30 m wide field the game scales to 800 street units", async () => {
    const loader = new GLTFLoader();
    const bytes = readFileSync(`public/models/environments/neighborhoods/${glb}`);
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const field = gltf.scene.getObjectByName(ground);
    expect(field).toBeTruthy();
    const size = new (await import("three")).Box3()
      .setFromObject(field!)
      .getSize(new (await import("three")).Vector3());
    expect(size.x).toBeCloseTo(30, 2);
    expect(size.z).toBeCloseTo(22.5, 2);
  });
});

describe("Greenbank Estates GLB orientation", () => {
  it("puts the north-east plot north and east of the origin, matching the game's street axes", async () => {
    const loader = new GLTFLoader();
    const bytes = readFileSync("public/models/environments/neighborhoods/greenbank-estates.glb");
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const block = gltf.scene.getObjectByName("atk_ne_block");
    expect(block).toBeTruthy();
    const world = block!.getWorldPosition(block!.position.clone());
    expect(world.x).toBeGreaterThan(10);
    expect(world.z).toBeLessThan(0);
  });
});
