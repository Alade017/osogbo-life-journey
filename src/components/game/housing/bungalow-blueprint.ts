import type { BlueprintDoor, FloorBounds } from "./house-blueprints";

export function bungalowBlueprint(width: number, depth: number) {
  const x0 = -width / 2,
    x1 = width / 2,
    z0 = -depth / 2,
    z1 = depth / 2;
  const sx = width / 14,
    sz = depth / 11.2;
  const row = sz,
    hall = -0.2 * sz;
  const a = -3.2 * sx,
    b = 0.6 * sx;
  const bathroomX = 1.8 * sx;
  const kitchenX = 3 * sx,
    bathZ = -2.5 * sz;
  const ensuiteX = 4.8 * sx,
    ensuiteZ = 3.1 * sz;
  const bounds = (minX: number, maxX: number, minZ: number, maxZ: number): FloorBounds => ({
    minX,
    maxX,
    minZ,
    maxZ,
  });
  const whole = bounds(x0, x1, z0, z1);
  const master = bounds(b, x1, row, z1),
    bedroom2 = bounds(x0, a, row, z1),
    gym = bounds(a, b, row, z1);
  const bathroom = bounds(bathroomX, x1, bathZ, hall),
    ensuite = bounds(ensuiteX, x1, ensuiteZ, z1);
  const interiorDoors: BlueprintDoor[] = [
    { id: "bungalow-bedroom-2-door", axis: "x", x: (x0 + a) / 2, z: row, width: 1.1 },
    { id: "bungalow-gym-door", axis: "x", x: (a + b) / 2, z: row, width: 1.1 },
    { id: "bungalow-master-door", axis: "x", x: (b + x1) / 2, z: row, width: 1.1 },
    { id: "bungalow-kitchen-door", axis: "z", x: kitchenX, z: (z0 + bathZ) / 2, width: 1.1 },
    { id: "bungalow-bathroom-door", axis: "z", x: bathroomX, z: (bathZ + hall) / 2, width: 1.1 },
    { id: "bungalow-ensuite-door", axis: "z", x: ensuiteX, z: (ensuiteZ + z1) / 2, width: 1.1 },
  ];
  const partitions: {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
  }[] = [];
  function wall(id: string, axis: "x" | "z", line: number, start: number, end: number) {
    if (end - start < 0.001) return;
    partitions.push({
      id,
      position: axis === "x" ? [(start + end) / 2, 0.95, line] : [line, 0.95, (start + end) / 2],
      size: axis === "x" ? [end - start, 1.9, 0.12] : [0.12, 1.9, end - start],
    });
  }
  function doorwayWall(
    id: string,
    axis: "x" | "z",
    line: number,
    start: number,
    end: number,
    doors: BlueprintDoor[],
  ) {
    let cursor = start;
    for (const [i, door] of doors.entries()) {
      const center = axis === "x" ? door.x : door.z;
      wall(`${id}-${i}`, axis, line, cursor, center - door.width / 2);
      cursor = center + door.width / 2;
    }
    wall(`${id}-end`, axis, line, cursor, end);
  }
  doorwayWall("bungalow-bedroom-row", "x", row, x0, x1, interiorDoors.slice(0, 3));
  wall("bungalow-bedroom-2-divider", "z", a, row, z1);
  wall("bungalow-master-divider", "z", b, row, z1);
  doorwayWall("bungalow-kitchen", "z", kitchenX, z0, bathZ, [interiorDoors[3]!]);
  doorwayWall("bungalow-common-bath", "z", bathroomX, bathZ, hall, [interiorDoors[4]!]);
  wall("bungalow-common-bath-back", "x", bathZ, bathroomX, x1);
  wall("bungalow-common-bath-front", "x", hall, bathroomX, x1);
  doorwayWall("bungalow-ensuite", "z", ensuiteX, ensuiteZ, z1, [interiorDoors[5]!]);
  wall("bungalow-ensuite-back", "x", ensuiteZ, ensuiteX, x1);
  const rooms = [
    { id: "sitting" as const, label: "Living room", ...bounds(x0, -width / 14, z0, hall) },
    {
      id: "dining" as const,
      label: "Dining room",
      ...bounds(-width / 14, kitchenX, z0, hall),
      exclude: bathroom,
    },
    { id: "kitchen" as const, label: "Kitchen", ...bounds(kitchenX, x1, z0, bathZ) },
    { id: "bathroom" as const, label: "Common bathroom", ...bathroom },
    { id: "bedroom" as const, label: "Master bedroom", ...master, exclude: ensuite },
    { id: "bedroom-2" as const, label: "Bedroom 2", ...bedroom2 },
    { id: "gym" as const, label: "Gym / shared room", ...gym },
    { id: "ensuite" as const, label: "Master ensuite", ...ensuite },
    { id: "hallway" as const, label: "Hallway", ...bounds(x0, x1, hall, row) },
  ];
  return {
    whole,
    bathroom,
    bathroomDoor: null,
    sleep: null,
    sleepAreas: [bedroom2, { ...master, maxX: ensuiteX }],
    gymAreas: [gym],
    wetAreas: [bathroom, ensuite],
    entranceX: -width * 0.25,
    windows: [-depth * 0.32, depth * 0.3],
    windowWidth: depth * 0.2,
    interiorDoors,
    partitions,
    rooms,
    veranda: { x: -width * 0.25, z: z0 - 0.8, width: width * 0.4, depth: 1.6 },
  };
}
