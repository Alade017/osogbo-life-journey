import { Component, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import townData from "@/data/osogbo-town.json";
import { DRACO_PATH } from "@/types/models";
import {
  expandTownGridLayout,
  mapTownGridToScene,
  type TownCellKind,
  type TownGridLayout,
} from "@/lib/town-grid";

const KENNEY_ROADS = "/models/city/roads/Models/GLB%20format";
const KENNEY_SUBURBAN = "/models/city/suburban/Models/GLB%20format";
const KENNEY_COMMERCIAL = "/models/city/commercial/Models/GLB%20format";
const KENNEY_CARS = "/models/city/cars/Models/GLB%20format";

// Flip these if a road or car faces the wrong way.
const HORIZONTAL = 0;
const VERTICAL = Math.PI / 2;

const WATER_COLOR = "#5aa6c8";
const PLOT_COLOR = "#e7dcc0";

// Filler buildings for empty grass cells, so the town feels dense like a real city.
const FILLER_BUILDINGS = [
  `${KENNEY_SUBURBAN}/building-type-a.glb`,
  `${KENNEY_SUBURBAN}/building-type-b.glb`,
  `${KENNEY_SUBURBAN}/building-type-c.glb`,
  `${KENNEY_SUBURBAN}/building-type-d.glb`,
  `${KENNEY_COMMERCIAL}/building-a.glb`,
  `${KENNEY_COMMERCIAL}/building-b.glb`,
  `${KENNEY_COMMERCIAL}/building-c.glb`,
  `${KENNEY_COMMERCIAL}/building-skyscraper-a.glb`,
];

const layout = townData.grid as TownGridLayout;
const legend = townData.meta.legend as Record<string, TownCellKind>;
const grid = expandTownGridLayout(layout, legend);
const rows = layout.rows;
const tileSize = grid.cellSize;

const landmarkModel = new Map(townData.landmarks.map((l) => [l.id, l.model] as const));

const reserved = new Set(
  [...(layout.treeCells ?? []), ...(layout.carCells ?? [])].map(([x, z]) => `${x}:${z}`),
);

function isRoad(x: number, z: number) {
  return rows[z]?.[x] === "r";
}

function toScene(x: number, z: number) {
  return mapTownGridToScene({ ...grid, cells: [{ x, z, kind: "grass" }] })[0]!;
}

type SceneryItem =
  | { key: string; kind: "tile"; x: number; y: number; z: number; color: string }
  | {
      key: string;
      kind: "model";
      x: number;
      z: number;
      path: string;
      rotation: number;
      scale: number;
    };

const items: SceneryItem[] = [];

for (const cell of grid.cells) {
  const point = toScene(cell.x, cell.z);
  const key = `${cell.kind}-${cell.x}-${cell.z}`;

  if (cell.kind === "water") {
    items.push({ key, kind: "tile", x: point.x, y: 0.03, z: point.z, color: WATER_COLOR });
  } else if (cell.kind === "plot") {
    items.push({ key, kind: "tile", x: point.x, y: 0.025, z: point.z, color: PLOT_COLOR });
  } else if (cell.kind === "road") {
    const left = isRoad(cell.x - 1, cell.z);
    const right = isRoad(cell.x + 1, cell.z);
    const up = isRoad(cell.x, cell.z - 1);
    const down = isRoad(cell.x, cell.z + 1);
    const crossing = (left || right) && (up || down);
    items.push({
      key,
      kind: "model",
      x: point.x,
      z: point.z,
      path: crossing ? `${KENNEY_ROADS}/road-crossroad.glb` : `${KENNEY_ROADS}/road-straight.glb`,
      rotation: left || right ? HORIZONTAL : VERTICAL,
      scale: tileSize,
    });
  } else if (cell.kind === "building") {
    // Landmark buildings: each one uses the model named in osogbo-town.json.
    const path = landmarkModel.get(cell.placeId ?? "");
    if (path) {
      items.push({ key, kind: "model", x: point.x, z: point.z, path, rotation: 0, scale: 1.45 });
    }
  } else if (cell.kind === "grass") {
    const seed = cell.seed ?? 0;
    const nextToRoad =
      isRoad(cell.x - 1, cell.z) ||
      isRoad(cell.x + 1, cell.z) ||
      isRoad(cell.x, cell.z - 1) ||
      isRoad(cell.x, cell.z + 1);
    // About one in four free grass cells gets a filler building, away from roads.
    if (!reserved.has(`${cell.x}:${cell.z}`) && !nextToRoad && seed % 4 === 0) {
      items.push({
        key,
        kind: "model",
        x: point.x,
        z: point.z,
        path: FILLER_BUILDINGS[seed % FILLER_BUILDINGS.length]!,
        rotation: (seed % 4) * (Math.PI / 2),
        scale: 1.2,
      });
    }
  }
}

// Trees: alternate small and large trees.
(layout.treeCells ?? []).forEach(([x, z], index) => {
  const point = toScene(x, z);
  items.push({
    key: `tree-${x}-${z}`,
    kind: "model",
    x: point.x,
    z: point.z,
    path: `${KENNEY_SUBURBAN}/${index % 2 === 0 ? "tree-large.glb" : "tree-small.glb"}`,
    rotation: index * 0.7,
    scale: 1.45,
  });
});

// Parked cars.
(layout.carCells ?? []).forEach(([x, z], index) => {
  const point = toScene(x, z);
  items.push({
    key: `car-${x}-${z}`,
    kind: "model",
    x: point.x,
    z: point.z,
    path: `${KENNEY_CARS}/sedan.glb`,
    rotation: index % 2 === 0 ? HORIZONTAL : VERTICAL,
    scale: 1.2,
  });
});

/** A missing or broken model hides only that item, not the whole map. */
class SceneryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function SceneryModel({
  path,
  x,
  z,
  rotation,
  scale,
}: {
  path: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
}) {
  const gltf = useGLTF(path, DRACO_PATH);
  const object = useMemo(() => clone(gltf.scene), [gltf.scene]);
  return (
    <primitive
      object={object}
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      scale={scale}
      dispose={null}
    />
  );
}

export function TownScenery() {
  return (
    <group>
      {items.map((item) =>
        item.kind === "tile" ? (
          <mesh key={item.key} position={[item.x, item.y, item.z]} receiveShadow>
            <boxGeometry args={[tileSize, 0.04, tileSize]} />
            <meshStandardMaterial color={item.color} roughness={0.9} />
          </mesh>
        ) : (
          <SceneryBoundary key={item.key}>
            <SceneryModel
              path={item.path}
              x={item.x}
              z={item.z}
              rotation={item.rotation}
              scale={item.scale}
            />
          </SceneryBoundary>
        ),
      )}
    </group>
  );
}