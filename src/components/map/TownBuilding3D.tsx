import { WorldHouse, WorldInstances, type WorldInstance } from "@/components/3d/WorldScene";
import { townBuildingProfile } from "./town-building-profile";

/** Existing landmark architecture, with distinct storeys and readable upper-floor façades. */
export function TownBuilding3D({
  building,
  position,
  cell,
}: {
  building: { x: number; z: number; buildingType: string };
  position: [number, number, number];
  cell: number;
}) {
  const profile = townBuildingProfile(building.buildingType, building.x, building.z, cell);
  const windows: WorldInstance[] = [];
  const courses: WorldInstance[] = [];
  for (let floor = 1; floor < profile.floors; floor++) {
    const y = (floor + 0.55) * profile.floorHeight;
    for (const side of [-1, 1]) {
      for (const column of [-1, 0, 1]) {
        windows.push({
          position: [column * profile.width * 0.27, y, side * (profile.depth / 2 + 0.025)],
          scale: [profile.width * 0.15, profile.floorHeight * 0.38, 0.05],
        });
        windows.push({
          position: [side * (profile.width / 2 + 0.025), y, column * profile.depth * 0.27],
          scale: [0.05, profile.floorHeight * 0.38, profile.depth * 0.15],
        });
      }
      courses.push({
        position: [0, floor * profile.floorHeight + 0.18, side * (profile.depth / 2 + 0.045)],
        scale: [profile.width + 0.12, 0.1, 0.12],
      });
    }
  }
  return (
    <group position={position}>
      <WorldHouse
        position={[0, 0, 0]}
        width={profile.width}
        depth={profile.depth}
        height={profile.height}
        variant={profile.variant}
        detailed
      />
      <WorldInstances items={windows} tone="glass" castShadow={false} />
      <WorldInstances items={courses} tone="concrete" />
    </group>
  );
}
