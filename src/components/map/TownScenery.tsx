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
const KENNEY_CARS = "/models/city/cars/Models/GLB%20format";

// Flip these if a road or car appears turned the wrong way on the map.
const HORIZONTAL = 0;
const VERTICAL = Math.PI / 2;

const WATER_COLOR = "#5aa6c8";
const PLOT_COLOR = "#e7dcc0";

const layout = townData.grid as TownGridLayout;
const legend = townData.meta.legend as Record<string, TownCellKind>;
const grid = expandTownGridLayout(layout, legend);
const rows = layout.rows;
const tileSize = grid.cellSize;

function isRoad(x: number, z: number) {
  return rows[z]?.[x] === "r";
}

function toScene(x: number, z: number) {
  return mapTownGridToScene({ ...grid, cells: [{ x, z, kind: "grass" }] })[0]!;
}

type SceneryItem =
  | { key: string; kind: "tile"; x: number; y: number; z: number; color: string }
  | { key: string; kind: "model"; x: number; z: number; path: string; rotation: number; scale: number };

const items: SceneryItem[] = [];

// Roads: straight pieces and crossroads, chosen from the neighbouring road cells.
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
    const path = crossing ? `${KENNEY_ROADS}/road-crossroad.glb` : `${KENNEY_ROADS}/road-straight.glb`;
    const rotation = crossing ? HORIZONTAL : left || right ? HORIZONTAL : VERTICAL;
    items.push({
      key,
      kind: "model",
      x: point.x,
      z: point.z,
      path,
      rotation,
      scale: tileSize,
    });
  }
}

// Trees: alternate small and large trees so the town doesn't look copied.
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