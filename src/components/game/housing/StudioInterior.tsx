import { useEffect, useMemo } from "react";
import { createBlueprintInterior, createStudioRug, disposeStudioInterior } from "./studio-interior";
import type { HouseRoomView } from "./house-room-contract";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Object3D } from "three";
import type { BlueprintDoor, BlueprintHomeType } from "./house-blueprints";

export function BlueprintInterior({
  onEnterDoor,
  actorPosition,
  houseTypeId,
  activeFloor = 0,
  width,
  depth,
  editMode,
  wallsClosed,
  roomView,
}: {
  onEnterDoor: ((door: BlueprintDoor) => void) | undefined;
  actorPosition: [number, number, number] | undefined;
  houseTypeId: BlueprintHomeType;
  activeFloor?: 0 | 1;
  width: number;
  depth: number;
  editMode: boolean;
  wallsClosed: boolean;
  roomView: HouseRoomView | null;
}) {
  const scene = useMemo(
    () =>
      createBlueprintInterior(houseTypeId, width, depth, {
        editMode,
        wallsClosed,
        roomView,
        activeFloor,
      }),
    [houseTypeId, width, depth, editMode, wallsClosed, roomView, activeFloor],
  );
  useEffect(() => () => disposeStudioInterior(scene), [scene]);
  const doors = useMemo(() => {
    const leaves: { panel: Object3D; door: BlueprintDoor }[] = [];
    scene.traverse((frame) => {
      const door: BlueprintDoor | undefined = frame.userData["door"];
      const panel = door && frame.getObjectByName(door.id);
      if (door && panel) leaves.push({ door, panel });
    });
    return leaves;
  }, [scene]);
  useFrame(({ invalidate }, delta) => {
    for (const { door, panel } of doors) {
      const near =
        actorPosition && Math.hypot(actorPosition[0] - door.x, actorPosition[2] - door.z) < 1.6;
      const target = near || editMode ? Math.PI : 0;
      if (Math.abs(panel.rotation.y - target) < 0.005) continue;
      panel.rotation.y = MathUtils.damp(panel.rotation.y, target, 10, delta);
      invalidate();
    }
  });
  return (
    <primitive
      object={scene}
      onClick={
        onEnterDoor
          ? (event: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
              if (event.delta > 4) return;
              let hit: Object3D | null = event.object;
              while (hit && hit !== scene && !hit.userData["door"]) hit = hit.parent;
              if (hit?.userData["door"]) {
                event.stopPropagation();
                onEnterDoor(hit.userData["door"]);
              }
            }
          : undefined
      }
    />
  );
}

export function StudioRug({
  position,
  rotation,
  bed,
}: {
  position: [number, number, number];
  rotation: number;
  bed: boolean;
}) {
  const rug = useMemo(() => createStudioRug(bed ? 2.1 : 2.5, bed ? 2.6 : 1.8), [bed]);
  useEffect(() => () => disposeStudioInterior(rug), [rug]);
  return (
    <group
      position={[position[0], 0, position[2]]}
      rotation={[0, rotation, 0]}
      raycast={() => null}
    >
      <primitive object={rug} />
    </group>
  );
}
