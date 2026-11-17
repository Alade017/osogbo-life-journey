import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { boundsContain, STUDIO_FINISH as finish, studioBlueprint } from "./house-blueprints";
import {
  housePartitionSegments,
  houseWallSegments,
  roomViewHidesSegment,
  HOUSE_WALL_THICKNESS,
  type HouseRoomView,
  type HouseWallSegment,
} from "./house-room-contract";

type Point = [number, number, number];
type Box = { position: Point; size: Point; color: string };

/** Actual game geometry, also usable by the offline model preview. No furniture ownership is implied. */
export function createStudioInterior(
  width: number,
  depth: number,
  {
    editMode = false,
    wallsClosed = false,
    roomView = null,
  }: {
    editMode?: boolean;
    wallsClosed?: boolean;
    roomView?: HouseRoomView | null;
  } = {},
) {
  const root = new Group();
  root.name = "studio-blueprint-interior";
  const plan = studioBlueprint(width, depth);
  const unit = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color))
      materials.set(color, new MeshStandardMaterial({ color, roughness: 0.88 }));
    return materials.get(color)!;
  };
  const box = (parent: Group, size: Point, position: Point, color: string, name = "") => {
    const mesh = new Mesh(unit, material(color));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };
  const batch = (boxes: Box[], name: string) => {
    for (const color of new Set(boxes.map((item) => item.color))) {
      const items = boxes.filter((item) => item.color === color);
      const mesh = new InstancedMesh(unit, material(color), items.length);
      const transform = new Object3D();
      items.forEach((item, i) => {
        transform.position.set(...item.position);
        transform.scale.set(...item.size);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      mesh.receiveShadow = true;
      mesh.name = name;
      root.add(mesh);
    }
  };
  box(root, [width + 0.2, 0.23, depth + 0.2], [0, -0.12, 0], finish.trim, "foundation");
  box(root, [width, 0.025, depth], [0, 0.01, 0], finish.grout, "grout-bed");
  const tiles: Box[] = [];
  const tile = 0.4;
  for (let row = 0, z = -depth / 2; z < depth / 2 - 0.001; z += tile, row++) {
    for (let col = 0, x = -width / 2; x < width / 2 - 0.001; x += tile, col++) {
      const w = Math.min(tile, width / 2 - x),
        d = Math.min(tile, depth / 2 - z);
      const wet = boundsContain(plan.bathroom, x + w / 2, z + d / 2);
      tiles.push({
        position: [x + w / 2, 0.026, z + d / 2],
        size: [w - 0.008, 0.025, d - 0.008],
        color: wet ? finish.wetTile : (row + col) % 2 ? finish.tile : finish.tileAlternate,
      });
    }
  }
  batch(tiles, "porcelain-floor-tiles");
  // A flush timber inset defines the sleeping zone without any wall or raised trip edge.
  const planks: Box[] = [];
  const sleep = plan.sleep;
  for (let row = 0, z = sleep.minZ + 0.08; z < sleep.maxZ - 0.08; z += 0.18, row++) {
    const d = Math.min(0.174, sleep.maxZ - 0.08 - z);
    for (let col = 0, x = sleep.minX + 0.08; x < sleep.maxX - 0.08; x += 0.82, col++) {
      const w = Math.min(0.812, sleep.maxX - 0.08 - x);
      planks.push({
        position: [x + w / 2, 0.045, z + d / 2],
        size: [w, 0.018, d],
        color: (col + row) % 3 ? finish.wood : finish.woodAlternate,
      });
    }
  }
  batch(planks, "sleeping-zone-timber");
  const walls = new Group();
  walls.name = "studio-cutaway-walls";
  walls.scale.y = editMode ? 0.28 : 1;
  root.add(walls);
  const height = 2.5;
  const show = (segment: HouseWallSegment) => !roomView || !roomViewHidesSegment(segment, roomView);
  const wall = (segment: HouseWallSegment, color: string = finish.plaster) => {
    if (!show(segment)) return;
    box(walls, segment.size, segment.position, color, segment.id);
    const [x, y, z] = segment.position;
    const [w, h, d] = segment.size;
    box(walls, [w + 0.025, 0.045, d + 0.025], [x, y + h / 2, z], finish.trim);
    box(walls, [w + 0.018, 0.09, d + 0.018], [x, 0.08, z], finish.trim);
  };
  // Replace the left wall with real window openings; the remaining exterior keeps the common doorway.
  houseWallSegments(width, depth, height, 1.12, plan.entranceX, wallsClosed)
    .filter(
      (segment) =>
        !segment.id.startsWith("left-") && (wallsClosed || !segment.id.startsWith("front-")),
    )
    .forEach((segment) => {
      if (!wallsClosed && segment.id.startsWith("right-")) {
        wall({
          ...segment,
          position: [segment.position[0], 0.14, segment.position[2]],
          size: [segment.size[0], 0.28, segment.size[2]],
        });
      } else wall(segment);
    });
  if (!wallsClosed)
    wall({
      id: "studio-front-cutaway",
      position: [0, 0.14, depth / 2],
      size: [width, 0.28, HOUSE_WALL_THICKNESS],
    });
  const windowWidth = depth * 0.22;
  const sill = 0.9,
    windowHeight = 1.15;
  let cursor = -depth / 2;
  for (const [i, center] of plan.windows.entries()) {
    const start = center - windowWidth / 2,
      end = center + windowWidth / 2;
    wall({
      id: `studio-window-pier-${i}`,
      position: [-width / 2, height / 2, (cursor + start) / 2],
      size: [HOUSE_WALL_THICKNESS, height, start - cursor],
    });
    wall({
      id: `studio-window-sill-${i}`,
      position: [-width / 2, sill / 2, center],
      size: [HOUSE_WALL_THICKNESS, sill, windowWidth],
    });
    wall({
      id: `studio-window-head-${i}`,
      position: [-width / 2, (sill + windowHeight + height) / 2, center],
      size: [HOUSE_WALL_THICKNESS, height - sill - windowHeight, windowWidth],
    });
    box(
      walls,
      [0.045, windowHeight, windowWidth],
      [-width / 2 + 0.02, sill + windowHeight / 2, center],
      finish.glass,
      "window-glazing",
    );
    for (const y of [sill, sill + windowHeight / 2, sill + windowHeight])
      box(walls, [0.09, 0.035, windowWidth + 0.08], [-width / 2 + 0.06, y, center], finish.trim);
    for (const z of [start, center, end])
      box(
        walls,
        [0.09, windowHeight, 0.035],
        [-width / 2 + 0.06, sill + windowHeight / 2, z],
        finish.trim,
      );
    box(walls, [0.14, 0.035, windowWidth + 0.3], [-width / 2 + 0.13, 2.23, center], finish.brass);
    for (const side of [-1, 1]) {
      for (let fold = 0; fold < 5; fold++) {
        const z = center + side * (windowWidth / 2 - 0.07) + (fold - 2) * 0.045;
        box(
          walls,
          [fold % 2 ? 0.07 : 0.11, 1.95, 0.045],
          [-width / 2 + 0.16, 1.22, z],
          fold % 2 ? finish.curtain : finish.woodAlternate,
          "curtain-fold",
        );
      }
    }
    cursor = end;
  }
  wall({
    id: "studio-window-end-pier",
    position: [-width / 2, height / 2, (cursor + depth / 2) / 2],
    size: [HOUSE_WALL_THICKNESS, height, depth / 2 - cursor],
  });
  housePartitionSegments("studio-flat", width, depth).forEach((segment) =>
    wall(segment, finish.wetTile),
  );
  // The bathroom door folds back against its wall, keeping the navigation opening clear.
  const door = plan.bathroomDoor;
  for (const side of [-1, 1])
    box(walls, [0.17, 1.95, 0.07], [door.x, 0.975, door.z + (side * door.width) / 2], finish.trim);
  box(walls, [0.17, 0.08, door.width + 0.14], [door.x, 1.95, door.z], finish.trim);
  const panel = new Group();
  panel.name = "studio-bathroom-door";
  panel.position.set(door.x - HOUSE_WALL_THICKNESS / 2 - 0.025, 0, door.z - door.width / 2);
  panel.rotation.y = Math.PI;
  walls.add(panel);
  const panelWidth = door.width - 0.1;
  box(
    panel,
    [0.045, 1.86, panelWidth],
    [0, 0.97, panelWidth / 2],
    finish.wood,
    "bathroom-door-leaf",
  );
  for (const side of [-1, 1]) {
    for (const y of [0.58, 1.38])
      box(
        panel,
        [0.012, 0.6, panelWidth - 0.18],
        [side * 0.028, y, panelWidth / 2],
        finish.woodAlternate,
        "bathroom-door-inset",
      );
    box(panel, [0.035, 0.14, 0.045], [side * 0.04, 0.98, panelWidth - 0.1], finish.brass);
    box(
      panel,
      [0.045, 0.035, 0.14],
      [side * 0.065, 0.98, panelWidth - 0.14],
      finish.brass,
      "bathroom-door-handle",
    );
  }
  return root;
}

/** Soft floor decoration follows owned furniture; it neither blocks movement nor invents an item. */
export function createStudioRug(width: number, depth: number) {
  const root = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = [finish.rugBorder, finish.rug, finish.sage].map(
    (color) => new MeshStandardMaterial({ color, roughness: 1 }),
  );
  for (const [i, inset] of [0, 0.07, 0.12].entries()) {
    const mesh = new Mesh(geometry, materials[i]);
    mesh.scale.set(width - inset * 2, 0.006, depth - inset * 2);
    mesh.position.y = 0.06 + i * 0.007;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const patternGeometry = new CylinderGeometry(0.04, 0.04, 0.006, 4);
  const count = Math.max(1, Math.floor((width - 0.3) / 0.18));
  const pattern = new InstancedMesh(patternGeometry, materials[1], count * 2);
  const transform = new Object3D();
  for (let i = 0; i < count; i++) {
    for (let side = 0; side < 2; side++) {
      transform.position.set(
        -width / 2 + 0.22 + (i * (width - 0.44)) / Math.max(1, count - 1),
        0.085,
        (side ? 1 : -1) * (depth / 2 - 0.21),
      );
      transform.updateMatrix();
      pattern.setMatrixAt(i * 2 + side, transform.matrix);
    }
  }
  root.add(pattern);
  return root;
}

export function disposeStudioInterior(root: Group) {
  const geometries = new Set<BoxGeometry | CylinderGeometry>();
  const materials = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) object.dispose();
    geometries.add(object.geometry);
    for (const item of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(item as MeshStandardMaterial);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
