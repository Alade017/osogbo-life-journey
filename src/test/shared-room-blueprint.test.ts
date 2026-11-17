import { describe, expect, it } from "vitest";
import { Mesh, Raycaster, Vector3 } from "three";
import housing from "@/data/housing.json";
import {
  createBlueprintInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import { sharedRoomBlueprint } from "@/components/game/housing/house-blueprints";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  housePartitionSegments,
  houseRoomViews,
  houseSlotPosition,
} from "@/components/game/housing/house-room-contract";
import {
  findRoomPath,
  placementPoint,
  roomObstacles,
  type RoomPoint,
} from "@/game/house-navigation";
import type { HousePlacement } from "@/components/game/housing/HouseRoomScene";

const [width, depth] = HOUSE_ROOM_SIZE["shared-room"]!;
describe("shared-bedroom blueprint", () => {
  it("keeps one bedroom with no private kitchen, wet area or bathroom partition", () => {
    const plan = sharedRoomBlueprint(width, depth);
    expect(plan.bathroom).toBeNull();
    expect(plan.bathroomDoor).toBeNull();
    expect(housePartitionSegments("shared-room", width, depth)).toEqual([]);
    expect(houseRoomViews("shared-room", width, depth)).toHaveLength(1);
    const scene = createBlueprintInterior("shared-room", width, depth);
    expect(scene.getObjectByName("studio-bathroom-door")).toBeUndefined();
    expect(scene.getObjectByName("shared-room-wall-panelling")).toBeInstanceOf(Mesh);
    scene.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(-width / 2 - 1, 1.4, 0.1), new Vector3(1, 0, 0), 0, 1.3);
    expect(
      ray.intersectObject(scene, true).some((hit) => hit.object.name === "window-glazing"),
    ).toBe(true);
    disposeStudioInterior(scene);
  });

  it("keeps the entrance opening and a central route usable with both existing bed slots occupied", () => {
    const slots = housing.find((house) => house.id === "shared-room")!.home_slots;
    const beds: HousePlacement[] = slots
      .filter((slot) => slot.slot_type === "bed")
      .map((slot, i) => ({
        id: `bed-${i}`,
        item_id: `owned-bed-${i}`,
        slot: slot.id,
        art_key: "bed",
        category: "furniture",
        slot_type: "bed",
      }));
    expect(beds).toHaveLength(2);
    const obstacles = roomObstacles("shared-room", width, depth, beds, slots);
    const start = houseDoorThreshold("shared-room", width, depth);
    const end: RoomPoint = [0, 0.06, depth / 2 - 0.7];
    const path = findRoomPath(start, end, width, depth, obstacles);
    expect(path).not.toBeNull();
    for (const bed of beds) {
      const target = placementPoint(bed, slots, width, depth);
      const approach = findRoomPath(start, target, width, depth, obstacles, true);
      expect(approach).not.toBeNull();
      expect(
        Math.hypot(approach!.at(-1)![0] - target[0], approach!.at(-1)![2] - target[2]),
      ).toBeLessThan(1.65);
    }
    const scene = createBlueprintInterior("shared-room", width, depth);
    scene.updateMatrixWorld(true);
    const ray = new Raycaster(
      new Vector3(start[0], 1, -depth / 2 - 0.4),
      new Vector3(0, 0, 1),
      0,
      0.8,
    );
    expect(ray.intersectObject(scene, true)).toEqual([]);
    // The design consumes the existing slots rather than moving player saves into new coordinates.
    expect(placementPoint(beds[0]!, slots, width, depth)).toEqual(
      houseSlotPosition(slots[0]!, width, depth),
    );
    disposeStudioInterior(scene);
  });
});
