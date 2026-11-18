import { useEffect, useMemo } from "react";
import { createBlueprintInterior, createStudioRug, disposeStudioInterior } from "./studio-interior";
import type { HouseRoomView } from "./house-room-contract";
import type { BlueprintHomeType } from "./house-blueprints";

export function BlueprintInterior({
  houseTypeId,
  activeFloor = 0,
  width,
  depth,
  editMode,
  wallsClosed,
  roomView,
}: {
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
  return <primitive object={scene} />;
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
