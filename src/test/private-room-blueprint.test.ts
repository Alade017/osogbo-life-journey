import { describe, expect, it } from "vitest";
import { InstancedMesh, Raycaster, Vector3 } from "three";
import housing from "@/data/housing.json";
import {
  createBlueprintInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import {
  privateRoomBlueprint,
  isBlueprintHomeType,
} from "@/components/game/housing/house-blueprints";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  housePartitionSegments,
  houseRoomViews,
} from "@/components/game/housing/house-room-contract";
import { findRoomPath, placementPoint, roomObstacles } from "@/game/house-navigation";
import type { HousePlacement } from "@/components/game/housing/HouseRoomScene";

const [width, depth] = HOUSE_ROOM_SIZE["single-room"]!;
describe("private-bedroom blueprint", () => {
  it("preserves the private bedroom's existing facilities and adds no ensuite or cooking partition", () => {
    expect(isBlueprintHomeType("single-room")).toBe(true);
    expect(isBlueprintHomeType("toString")).toBe(false);
    expect(privateRoomBlueprint(width, depth).bathroom).toBeNull();
    expect(housing.find((home) => home.id === "single-room")!.shared_facilities).toBe(true);
    expect(housePartitionSegments("single-room", width, depth)).toEqual([]);
    expect(houseRoomViews("single-room", width, depth)).toHaveLength(1);
    const scene = createBlueprintInterior("single-room", width, depth);
    let timberCount = 0;
    scene.traverse((object) => {
      if (object instanceof InstancedMesh && object.name === "sleeping-zone-timber")
        timberCount += object.count;
    });
    expect(timberCount).toBeGreaterThan(0);
    scene.updateMatrixWorld(true);
    const windowZ = privateRoomBlueprint(width, depth).windows[0]!;
    const ray = new Raycaster(
      new Vector3(-width / 2 - 1, 1.4, windowZ + 0.1),
      new Vector3(1, 0, 0),
      0,
      1.3,
    );
    expect(
      ray.intersectObject(scene, true).some((hit) => hit.object.name === "window-glazing"),
    ).toBe(true);
    expect(scene.getObjectByName("studio-bathroom-door")).toBeUndefined();
    disposeStudioInterior(scene);
  });

  it("keeps the doorway and approach to the saved bed and storage clear", () => {
    const slots = housing.find((home) => home.id === "single-room")!.home_slots;
    const placements: HousePlacement[] = slots
      .filter((slot) => slot.slot_type === "bed" || slot.slot_type === "storage")
      .map((slot) => ({
        id: slot.id,
        slot: slot.id,
        item_id: slot.id,
        art_key: slot.slot_type,
        slot_type: slot.slot_type,
        category: "furniture",
      }));
    const start = houseDoorThreshold("single-room", width, depth);
    const obstacles = roomObstacles("single-room", width, depth, placements, slots);
    expect(findRoomPath(start, [0, 0.06, depth / 2 - 0.7], width, depth, obstacles)).not.toBeNull();
    for (const item of placements) {
      const target = placementPoint(item, slots, width, depth);
      expect(findRoomPath(start, target, width, depth, obstacles, true)).not.toBeNull();
    }
    const scene = createBlueprintInterior("single-room", width, depth);
    scene.updateMatrixWorld(true);
    const ray = new Raycaster(
      new Vector3(start[0], 1, -depth / 2 - 0.4),
      new Vector3(0, 0, 1),
      0,
      0.8,
    );
    expect(ray.intersectObject(scene, true)).toEqual([]);
    disposeStudioInterior(scene);
  });
});
