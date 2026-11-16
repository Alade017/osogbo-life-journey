import { useMemo } from "react";
import { WorldInstances, type WorldInstance } from "@/components/3d/WorldScene";
import type { TownHomeStyle, TownInfillHome } from "./town-residential-layout";

type BuildingParts = { walls: WorldInstance[]; roofs: WorldInstance[] };

/** Street-facing terraces, apartments and garden compounds share batched geometry. */
export function TownResidentialBlocks3D({
  homes,
  point,
  cell,
  districtProfiles,
}: {
  homes: readonly TownInfillHome[];
  point: (x: number, z: number) => [number, number, number];
  cell: number;
  districtProfiles?: Readonly<Record<string, { height: number; width: number; depth: number }>>;
}) {
  const parts = useMemo(() => {
    const blocks: Record<TownHomeStyle, BuildingParts> = {
      compound: { walls: [], roofs: [] },
      terrace: { walls: [], roofs: [] },
      apartment: { walls: [], roofs: [] },
    };
    const doors: WorldInstance[] = [],
      windows: WorldInstance[] = [],
      tanks: WorldInstance[] = [],
      fences: WorldInstance[] = [],
      balconies: WorldInstance[] = [];
    homes.forEach((home) => {
      const [x, , z] = point(home.x, home.z);
      const profile = districtProfiles?.[home.districtId];
      const width =
        cell *
        Math.min(
          home.style === "compound" ? 0.49 : home.style === "terrace" ? 0.75 : 0.65,
          profile ? profile.width * 0.6 : Infinity,
        );
      const depth =
        cell *
        Math.min(home.style === "compound" ? 0.52 : 0.66, profile ? profile.depth * 0.6 : Infinity);
      const height = profile
        ? cell * Math.max(0.6, Math.min(2, profile.height))
        : cell * 0.53 * home.floors;
      const floorHeight = height / home.floors;
      const cos = Math.cos(home.rotation),
        sin = Math.sin(home.rotation);
      const part = (
        lx: number,
        y: number,
        lz: number,
        scale: [number, number, number],
      ): WorldInstance => ({
        position: [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos],
        scale,
        rotation: home.rotation,
      });
      blocks[home.style].walls.push(part(0, height / 2, 0, [width, height, depth]));
      blocks[home.style].roofs.push(part(0, height + 0.1, 0, [width + 0.16, 0.2, depth + 0.16]));
      doors.push(
        part(-width * 0.2, Math.min(cell * 0.44, height * 0.8) / 2, depth / 2 + 0.025, [
          width * 0.2,
          Math.min(cell * 0.44, height * 0.8),
          0.05,
        ]),
      );
      for (let floor = 0; floor < home.floors; floor++)
        for (const side of [-1, 1]) {
          windows.push(
            part(
              width * 0.23,
              floor * floorHeight + floorHeight * 0.6,
              side * (depth / 2 + 0.025),
              [width * 0.25, Math.min(cell * 0.18, floorHeight * 0.32), 0.05],
            ),
          );
          if (home.style === "apartment" && floor > 0)
            balconies.push(
              part(0, floor * floorHeight, side * (depth / 2 + 0.07), [width + 0.1, 0.1, 0.2]),
            );
        }
      if (home.style === "compound") {
        fences.push(part(0, 0.2, -cell * 0.4, [cell * 0.83, 0.4, 0.08]));
        for (const side of [-1, 1])
          fences.push(part(side * cell * 0.4, 0.2, 0, [0.08, 0.4, cell * 0.83]));
      }
      if (home.style === "apartment")
        tanks.push(part(-width * 0.2, height + 0.4, -depth * 0.17, [0.5, 0.55, 0.5]));
    });
    return { blocks, doors, windows, tanks, fences, balconies };
  }, [homes, point, cell, districtProfiles]);
  return (
    <group userData={{ decorativeHousing: true }}>
      <WorldInstances items={parts.blocks.compound.walls} tone="linen" />
      <WorldInstances items={parts.blocks.compound.roofs} tone="rust" />
      <WorldInstances items={parts.blocks.terrace.walls} tone="clay" />
      <WorldInstances items={parts.blocks.terrace.roofs} tone="indigo" />
      <WorldInstances items={parts.blocks.apartment.walls} tone="concrete" />
      <WorldInstances items={parts.blocks.apartment.roofs} tone="roofLight" />
      <WorldInstances items={parts.doors} tone="door" castShadow={false} />
      <WorldInstances items={parts.windows} tone="glass" castShadow={false} />
      <WorldInstances items={parts.tanks} tone="metal" />
      <WorldInstances items={parts.fences} tone="wall" />
      <WorldInstances items={parts.balconies} tone="linen" />
    </group>
  );
}
