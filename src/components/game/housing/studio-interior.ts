import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import {
  boundsContain,
  STUDIO_FINISH as finish,
  HOUSE_BLUEPRINTS,
  type BlueprintHomeType,
} from "./house-blueprints";
import {
  housePartitionSegmentsForFloor,
  houseWallSegments,
  roomViewHidesSegment,
  HOUSE_WALL_THICKNESS,
  type HouseRoomView,
  type HouseWallSegment,
} from "./house-room-contract";

type Point = [number, number, number];
type Box = { position: Point; size: Point; color: string };

/** Actual game geometry, also usable by the offline model preview. No furniture ownership is implied. */
export function createBlueprintInterior(
  houseTypeId: BlueprintHomeType,
  width: number,
  depth: number,
  {
    editMode = false,
    wallsClosed = false,
    roomView = null,
    activeFloor = 0,
  }: {
    editMode?: boolean;
    wallsClosed?: boolean;
    roomView?: HouseRoomView | null;
    activeFloor?: 0 | 1;
  } = {},
) {
  const root = new Group();
  root.name = `${houseTypeId}-blueprint-interior`;
  const plan = HOUSE_BLUEPRINTS[houseTypeId](width, depth, activeFloor);
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
  const batch = (sourceBoxes: Box[], name: string) => {
    const allBoxes =
      "stairwell" in plan && activeFloor === 1
        ? sourceBoxes.filter((box) => {
            const well = plan.stairwell;
            return (
              box.position[0] + box.size[0] / 2 <= well.x0 ||
              box.position[0] - box.size[0] / 2 >= well.x1 ||
              box.position[2] + box.size[2] / 2 <= well.z0 ||
              box.position[2] - box.size[2] / 2 >= well.z1
            );
          })
        : sourceBoxes;
    const boxes =
      (houseTypeId === "bungalow" || houseTypeId === "duplex") && roomView
        ? allBoxes.filter((box) => boundsContain(roomView, box.position[0], box.position[2], 0))
        : allBoxes;
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
  const base =
    (houseTypeId === "bungalow" || houseTypeId === "duplex") && roomView ? roomView : plan.whole;
  const basePieces =
    "stairwell" in plan && activeFloor === 1
      ? [
          {
            minX: base.minX,
            maxX: Math.min(base.maxX, plan.stairwell.x0),
            minZ: base.minZ,
            maxZ: base.maxZ,
          },
          {
            minX: Math.max(base.minX, plan.stairwell.x1),
            maxX: base.maxX,
            minZ: base.minZ,
            maxZ: base.maxZ,
          },
          {
            minX: Math.max(base.minX, plan.stairwell.x0),
            maxX: Math.min(base.maxX, plan.stairwell.x1),
            minZ: base.minZ,
            maxZ: Math.min(base.maxZ, plan.stairwell.z0),
          },
          {
            minX: Math.max(base.minX, plan.stairwell.x0),
            maxX: Math.min(base.maxX, plan.stairwell.x1),
            minZ: Math.max(base.minZ, plan.stairwell.z1),
            maxZ: base.maxZ,
          },
        ]
      : [base];
  for (const piece of basePieces)
    if (piece.maxX > piece.minX && piece.maxZ > piece.minZ) {
      const w = piece.maxX - piece.minX,
        d = piece.maxZ - piece.minZ,
        x = (piece.minX + piece.maxX) / 2,
        z = (piece.minZ + piece.maxZ) / 2;
      box(root, [w, 0.23, d], [x, -0.12, z], finish.trim, "foundation");
      box(root, [w, 0.025, d], [x, 0.01, z], finish.grout, "grout-bed");
    }
  const tiles: Box[] = [];
  const tile = 0.4;
  const wetAreas = "wetAreas" in plan ? plan.wetAreas : plan.bathroom ? [plan.bathroom] : [];
  for (let row = 0, z = -depth / 2; z < depth / 2 - 0.001; z += tile, row++) {
    for (let col = 0, x = -width / 2; x < width / 2 - 0.001; x += tile, col++) {
      const w = Math.min(tile, width / 2 - x),
        d = Math.min(tile, depth / 2 - z);
      const wet = wetAreas.some((area) => boundsContain(area, x + w / 2, z + d / 2));
      const gym =
        "gymAreas" in plan &&
        plan.gymAreas.some((area) => boundsContain(area, x + w / 2, z + d / 2));
      tiles.push({
        position: [x + w / 2, 0.026, z + d / 2],
        size: [w - 0.008, 0.025, d - 0.008],
        color: wet
          ? finish.wetTile
          : gym
            ? finish.gymFloor
            : (row + col) % 2
              ? finish.tile
              : finish.tileAlternate,
      });
    }
  }
  batch(tiles, "porcelain-floor-tiles");
  // A flush timber inset defines the sleeping zone without any wall or raised trip edge.
  const planks: Box[] = [];
  const sleepAreas = "sleepAreas" in plan ? plan.sleepAreas : plan.sleep ? [plan.sleep] : [];
  for (const sleep of sleepAreas)
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
  walls.name = `${houseTypeId}-cutaway-walls`;
  walls.scale.y = editMode ? 0.28 : 1;
  root.add(walls);
  const height = 2.5;
  const show = (segment: HouseWallSegment) => !roomView || !roomViewHidesSegment(segment, roomView);
  const wall = (source: HouseWallSegment, color: string = finish.plaster) => {
    let segment = source;
    if ((houseTypeId === "bungalow" || houseTypeId === "duplex") && roomView) {
      const [x, y, z] = source.position,
        [w, h, d] = source.size;
      if (w > d) {
        if (z < roomView.minZ - 0.1 || z > roomView.maxZ + 0.1) return;
        const left = Math.max(x - w / 2, roomView.minX),
          right = Math.min(x + w / 2, roomView.maxX);
        if (right - left < 0.01) return;
        segment = { ...source, position: [(left + right) / 2, y, z], size: [right - left, h, d] };
      } else {
        if (x < roomView.minX - 0.1 || x > roomView.maxX + 0.1) return;
        const back = Math.max(z - d / 2, roomView.minZ),
          front = Math.min(z + d / 2, roomView.maxZ);
        if (front - back < 0.01) return;
        segment = { ...source, position: [x, y, (back + front) / 2], size: [w, h, front - back] };
      }
    }
    if (!show(segment)) return;
    box(
      walls,
      segment.size,
      segment.position,
      houseTypeId === "single-room" && segment.id === "rear-left" ? finish.sage : color,
      segment.id,
    );
    const [x, y, z] = segment.position;
    const [w, h, d] = segment.size;
    box(walls, [w + 0.025, 0.045, d + 0.025], [x, y + h / 2, z], finish.trim);
    if (y - h / 2 < 0.1) {
      box(walls, [w + 0.018, 0.09, d + 0.018], [x, 0.08, z], finish.trim);
      if (houseTypeId === "shared-room") {
        const claddingHeight = Math.min(0.64, h);
        box(
          walls,
          [w + 0.012, claddingHeight, d + 0.012],
          [x, claddingHeight / 2, z],
          finish.sage,
          "shared-room-wall-panelling",
        );
        box(walls, [w + 0.025, 0.035, d + 0.025], [x, claddingHeight, z], finish.trim);
      }
    }
  };
  // Replace the left wall with real window openings; the remaining exterior keeps the common doorway.
  houseWallSegments(width, depth, height, 1.12, plan.entranceX, wallsClosed)
    .filter(
      (segment) =>
        !segment.id.startsWith("left-") &&
        (!("hasEntrance" in plan) || plan.hasEntrance || !segment.id.startsWith("rear-")) &&
        (!("balcony" in plan) || !plan.balcony || !segment.id.startsWith("front-")) &&
        (wallsClosed || !segment.id.startsWith("front-")),
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
  if ("hasEntrance" in plan && !plan.hasEntrance)
    wall({
      id: "duplex-upper-rear-wall",
      position: [0, height / 2, -depth / 2],
      size: [width, height, HOUSE_WALL_THICKNESS],
    });
  if (!("balcony" in plan && plan.balcony) && !wallsClosed)
    wall({
      id: "studio-front-cutaway",
      position: [0, 0.14, depth / 2],
      size: [width, 0.28, HOUSE_WALL_THICKNESS],
    });
  const windowWidth = plan.windowWidth;
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
    if (
      (houseTypeId !== "bungalow" && houseTypeId !== "duplex") ||
      !roomView ||
      boundsContain(roomView, -width / 2, center, 0.1)
    ) {
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
    }
    cursor = end;
  }
  wall({
    id: "studio-window-end-pier",
    position: [-width / 2, height / 2, (cursor + depth / 2) / 2],
    size: [HOUSE_WALL_THICKNESS, height, depth / 2 - cursor],
  });
  housePartitionSegmentsForFloor(houseTypeId, width, depth, activeFloor).forEach((segment) =>
    wall(segment, segment.id.includes("bath") ? finish.wetTile : finish.plaster),
  );
  // The bathroom door folds back against its wall, keeping the navigation opening clear.
  for (const door of plan.interiorDoors) {
    if (roomView && !boundsContain(roomView, door.x, door.z, 0.1)) continue;
    const frame = new Group();
    frame.userData["door"] = door;
    frame.name = `${door.id}-frame`;
    frame.position.set(door.x, 0, door.z);
    frame.rotation.y = door.axis === "x" ? Math.PI / 2 : 0;
    walls.add(frame);
    // Keep the opening clickable even when its leaf has swung against the wall.
    const threshold = box(frame, [0.12, 1.86, door.width], [0, 0.93, 0], finish.trim);
    threshold.visible = false;
    for (const side of [-1, 1])
      box(frame, [0.17, 1.95, 0.07], [0, 0.975, (side * door.width) / 2], finish.trim);
    box(frame, [0.17, 0.08, door.width + 0.14], [0, 1.95, 0], finish.trim);
    const panel = new Group();
    panel.name = door.id;
    panel.position.set(-HOUSE_WALL_THICKNESS / 2 - 0.025, 0, -door.width / 2);
    panel.rotation.y = Math.PI;
    frame.add(panel);
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
  }
  if ("veranda" in plan && plan.veranda && !roomView) {
    const porch = plan.veranda;
    box(
      root,
      [porch.width, 0.16, porch.depth],
      [porch.x, -0.05, porch.z],
      finish.wood,
      "bungalow-veranda",
    );
    for (const side of [-1, 1]) {
      const x = porch.x + side * (porch.width / 2 - 0.06);
      box(root, [0.09, 0.7, porch.depth], [x, 0.35, porch.z], finish.trim, "veranda-side-rail");
    }
    box(
      root,
      [1.4, 0.12, 0.35],
      [porch.x, -0.15, porch.z - porch.depth / 2 - 0.15],
      finish.trim,
      "veranda-step",
    );
  }
  if ("balcony" in plan && plan.balcony) {
    const deck = plan.balcony,
      railing = new Group();
    railing.name = "duplex-balcony-railing";
    root.add(railing);
    const h = wallsClosed ? height : 0.28;
    for (const [left, right] of [
      [-width / 2, deck.minX],
      [deck.maxX, width / 2],
    ])
      wall({
        id: `duplex-front-${left}`,
        position: [(left! + right!) / 2, h / 2, depth / 2],
        size: [right! - left!, h, HOUSE_WALL_THICKNESS],
      });
    if (
      !roomView ||
      boundsContain(roomView, (deck.minX + deck.maxX) / 2, (deck.minZ + deck.maxZ) / 2)
    ) {
      box(
        railing,
        [deck.maxX - deck.minX, 0.055, 0.075],
        [(deck.minX + deck.maxX) / 2, 0.95, deck.maxZ],
        finish.trim,
      );
      const count = Math.ceil((deck.maxX - deck.minX) / 0.35);
      for (let i = 0; i <= count; i++)
        box(
          railing,
          [0.035, 0.9, 0.035],
          [deck.minX + ((deck.maxX - deck.minX) * i) / count, 0.45, deck.maxZ],
          finish.trim,
        );
    }
  }
  return root;
}

/** Compatibility entry point for the studio scene and its geometry checks. */
export function createStudioInterior(
  width: number,
  depth: number,
  options: Parameters<typeof createBlueprintInterior>[3] = {},
) {
  return createBlueprintInterior("studio-flat", width, depth, options);
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
