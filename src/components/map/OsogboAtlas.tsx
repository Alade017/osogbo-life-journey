import { hasSignatureLandmark } from "./atlas-parcels";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { SRGBColorSpace, TextureLoader } from "three";
import town from "@/data/osogbo-town.json";
import { WorldInstances, type WorldInstance } from "../3d/WorldScene";
import type { TownMapPlace } from "./R3FTownSurface";

export function AtlasGround({ width, depth }: { width: number; depth: number }) {
  const texture = useLoader(TextureLoader, "/maps/osogbo_topdown.png");
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

const built = new Set(town.grid.buildings.map((building) => building.placeId));

/** Small venues without an authored building share a handful of instanced meshes. */
export function AtlasPlaceModels({
  places,
  point,
  cell,
}: {
  places: readonly TownMapPlace[];
  point: (x: number, z: number) => [number, number, number];
  cell: number;
}) {
  const parts = useMemo(() => {
    const walls: WorldInstance[] = [],
      roofs: WorldInstance[] = [],
      awnings: WorldInstance[] = [];
    const glass: WorldInstance[] = [],
      pitches: WorldInstance[] = [],
      towers: WorldInstance[] = [];
    const platforms: WorldInstance[] = [],
      crosses: WorldInstance[] = [];
    for (const place of places) {
      if (built.has(place.id) || hasSignatureLandmark(place.id)) continue;
      const [x, , z] = point(place.grid.x, place.grid.z);
      const box = (
        dx: number,
        y: number,
        dz: number,
        w: number,
        h: number,
        d: number,
      ): WorldInstance => ({
        position: [x + dx * cell, y * cell, z + dz * cell],
        scale: [w * cell, h * cell, d * cell],
      });
      platforms.push(box(0, 0.025, 0, 0.89, 0.05, 0.82));
      if (place.category === "junction") continue;
      if (place.category === "sport") {
        pitches.push(box(0, 0.065, 0, 0.76, 0.05, 0.55));
        for (const end of [-0.32, 0.32]) towers.push(box(end, 0.12, 0, 0.04, 0.1, 0.18));
        continue;
      }
      const canopy = ["food", "market", "transport"].includes(place.category);
      walls.push(box(0, 0.22, 0, canopy ? 0.36 : 0.63, 0.38, canopy ? 0.32 : 0.5));
      (canopy ? awnings : roofs).push(box(0, 0.43, 0, 0.76, 0.08, 0.62));
      glass.push(box(0, 0.22, 0.255, 0.33, 0.19, 0.025));
      if (place.category === "health") {
        crosses.push(box(0, 0.481, 0, 0.32, 0.018, 0.09), box(0, 0.482, 0, 0.09, 0.018, 0.32));
      }
      if (place.category === "worship") towers.push(box(0.25, 0.48, -0.1, 0.11, 0.85, 0.11));
    }
    return { walls, roofs, awnings, glass, pitches, towers, platforms, crosses };
  }, [places, point, cell]);
  return (
    <group name="atlas-places">
      <WorldInstances items={parts.platforms} tone="concrete" />
      <WorldInstances items={parts.walls} tone="linen" />
      <WorldInstances items={parts.roofs} tone="indigo" />
      <WorldInstances items={parts.awnings} tone="rust" />
      <WorldInstances items={parts.glass} tone="glass" />
      <WorldInstances items={parts.pitches} tone="cityLawn" color="#548750" />
      <WorldInstances items={parts.towers} tone="linen" />
      <WorldInstances items={parts.crosses} tone="rust" color="#b64435" />
    </group>
  );
}
