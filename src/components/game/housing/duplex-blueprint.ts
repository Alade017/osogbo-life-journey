import { bungalowBlueprint } from "./bungalow-blueprint";
import type { BlueprintDoor, FloorBounds } from "./house-blueprints";

export function duplexStairwell(width: number, depth: number) {
  const x0 = -width / 2 + 0.1,
    x1 = x0 + 1,
    z0 = -depth * 0.45,
    z1 = -depth * 0.1,
    cx = (x0 + x1) / 2;
  return {
    x0,
    x1,
    z0,
    z1,
    bottom: [cx, z1 + 0.35] as [number, number],
    top: [cx, Math.max(-depth / 2 + 0.35, z0 - 0.2)] as [number, number],
  };
}

export function duplexBlueprint(width: number, depth: number, floor: 0 | 1 = 0) {
  const base = bungalowBlueprint(width, depth),
    sx = width / 14,
    sz = depth / 11.2;
  const rename = (id: string) => id.replace("bungalow", "duplex");
  const stairwell = duplexStairwell(width, depth);
  if (floor === 1) {
    const gym = base.rooms.find((room) => room.id === "gym")!;
    const balcony: FloorBounds = {
      minX: 0.6 * sx,
      maxX: 4.8 * sx,
      minZ: 4.5 * sz,
      maxZ: depth / 2,
    };
    const rooms = base.rooms.map((room) => {
      switch (room.id) {
        case "gym":
          return { ...room, id: "bedroom-3" as const, label: "Bedroom 3" };
        case "sitting":
          return { ...room, label: "Family lounge" };
        case "dining":
          return { ...room, id: "landing" as const, label: "Landing" };
        case "kitchen":
          return { ...room, id: "study" as const, label: "Home office" };
        case "bathroom":
          return { ...room, label: "Family bathroom" };
        case "bedroom":
          return { ...room, excludeAreas: [balcony] };
        default:
          return room;
      }
    });
    const balconyDoor: BlueprintDoor = {
      id: "duplex-balcony-door",
      axis: "x",
      x: 2.7 * sx,
      z: balcony.minZ,
      width: 1.1,
    };
    const partitions = base.partitions.map((wall) => ({ ...wall, id: rename(wall.id) }));
    for (const [i, [start, end]] of [
      [balcony.minX, balconyDoor.x - 0.55],
      [balconyDoor.x + 0.55, balcony.maxX],
    ].entries())
      partitions.push({
        id: `duplex-balcony-divider-${i}`,
        position: [(start! + end!) / 2, 0.95, balcony.minZ],
        size: [end! - start!, 1.9, 0.12],
      });
    return {
      ...base,
      rooms: [...rooms, { id: "balcony" as const, label: "Balcony", ...balcony }],
      partitions,
      interiorDoors: [
        ...base.interiorDoors.map((door) => ({
          ...door,
          id: rename(door.id).replace("gym", "bedroom-3").replace("kitchen", "study"),
        })),
        balconyDoor,
      ],
      sleepAreas: [base.sleepAreas[0]!, gym, { ...base.sleepAreas[1]!, maxZ: balcony.minZ }],
      gymAreas: [],
      hasEntrance: false,
      veranda: undefined,
      balcony,
      stairwell,
    };
  }
  const row = sz,
    split = 0.6 * sx;
  const guest: FloorBounds = { minX: -width / 2, maxX: split, minZ: row, maxZ: depth / 2 };
  const family: FloorBounds = { minX: split, maxX: width / 2, minZ: row, maxZ: depth / 2 };
  const doors: BlueprintDoor[] = [
    { id: "duplex-guest-door", axis: "x", x: (guest.minX + guest.maxX) / 2, z: row, width: 1.1 },
    { id: "duplex-family-door", axis: "x", x: (family.minX + family.maxX) / 2, z: row, width: 1.1 },
    ...base.interiorDoors
      .filter((door) => door.id.includes("kitchen") || door.id.includes("bathroom"))
      .map((door) => ({ ...door, id: rename(door.id) })),
  ];
  const partitions = base.partitions
    .filter(
      (wall) =>
        !wall.id.includes("bedroom-row") &&
        !wall.id.includes("bedroom-2-divider") &&
        !wall.id.includes("ensuite"),
    )
    .map((wall) => ({ ...wall, id: rename(wall.id) }));
  let cursor = -width / 2;
  for (const [i, door] of doors.slice(0, 2).entries()) {
    const end = door.x - 0.55;
    partitions.push({
      id: `duplex-guest-family-row-${i}`,
      position: [(cursor + end) / 2, 0.95, row],
      size: [end - cursor, 1.9, 0.12],
    });
    cursor = door.x + 0.55;
  }
  partitions.push({
    id: "duplex-guest-family-row-end",
    position: [(cursor + width / 2) / 2, 0.95, row],
    size: [width / 2 - cursor, 1.9, 0.12],
  });
  const rooms = [
    ...base.rooms
      .filter((room) => ["sitting", "dining", "kitchen", "bathroom", "hallway"].includes(room.id))
      .map((room) => ({ ...room, label: room.id === "bathroom" ? "Guest bathroom" : room.label })),
    { id: "bedroom" as const, label: "Guest bedroom", ...guest },
    { id: "family" as const, label: "Family room", ...family },
  ];
  return {
    ...base,
    rooms,
    partitions,
    interiorDoors: doors,
    sleepAreas: [guest],
    gymAreas: [],
    wetAreas: [base.bathroom],
    hasEntrance: true,
    balcony: undefined,
    stairwell,
  };
}
