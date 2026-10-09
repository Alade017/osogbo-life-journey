export type RoomId = "lounge" | "bedroom" | "kitchen" | "bathroom" | "study" | "dining";
export type FurnitureCategory = "seating" | "sleep" | "kitchen" | "bathroom" | "work" | "decor";
export type FurnitureItem = {
  id: string;
  name: string;
  category: FurnitureCategory;
  price: number;
  icon: string;
  width: number;
  height: number;
  effects: Partial<Record<"energy" | "fun" | "hygiene" | "bladder" | "hunger" | "skill", number>>;
};
export type PlacedFurniture = {
  id: string;
  itemId: string;
  room: RoomId;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
};
export type RoomDefinition = {
  id: RoomId;
  name: string;
  width: number;
  height: number;
  floor: string;
  connections: RoomId[];
  upgrades: string[];
};
export type HomeLayout = {
  id: string;
  name: string;
  description: string;
  propertyType: string;
  rooms: RoomDefinition[];
};
export const HOME_LAYOUTS: HomeLayout[] = [
  {
    id: "courtyard-room",
    name: "Courtyard Room",
    description: "A compact starter room with shared courtyard access.",
    propertyType: "room",
    rooms: [
      {
        id: "lounge",
        name: "Living & sleep",
        width: 6,
        height: 5,
        floor: "timber",
        connections: [],
        upgrades: ["storage", "finish"],
      },
    ],
  },
  {
    id: "garden-flat",
    name: "Garden Court Flat",
    description: "A practical flat with separate living, sleeping, and kitchen space.",
    propertyType: "apartment",
    rooms: [
      {
        id: "lounge",
        name: "Living room",
        width: 7,
        height: 6,
        floor: "timber",
        connections: ["kitchen", "bedroom"],
        upgrades: ["finish", "lighting"],
      },
      {
        id: "kitchen",
        name: "Kitchen",
        width: 4,
        height: 4,
        floor: "tile",
        connections: ["lounge"],
        upgrades: ["appliance"],
      },
      {
        id: "bedroom",
        name: "Bedroom",
        width: 5,
        height: 5,
        floor: "timber",
        connections: ["lounge"],
        upgrades: ["storage"],
      },
    ],
  },
  {
    id: "family-courtyard",
    name: "Family Courtyard Home",
    description: "A spacious home with room for rest, meals, work, and upgrades.",
    propertyType: "house",
    rooms: [
      {
        id: "lounge",
        name: "Living room",
        width: 8,
        height: 7,
        floor: "timber",
        connections: ["dining", "study", "bedroom"],
        upgrades: ["finish", "lighting"],
      },
      {
        id: "dining",
        name: "Dining room",
        width: 5,
        height: 5,
        floor: "tile",
        connections: ["lounge", "kitchen"],
        upgrades: ["finish"],
      },
      {
        id: "kitchen",
        name: "Kitchen",
        width: 5,
        height: 5,
        floor: "tile",
        connections: ["dining", "bathroom"],
        upgrades: ["appliance"],
      },
      {
        id: "bedroom",
        name: "Bedroom",
        width: 6,
        height: 6,
        floor: "timber",
        connections: ["lounge", "bathroom"],
        upgrades: ["storage"],
      },
      {
        id: "bathroom",
        name: "Bathroom",
        width: 4,
        height: 4,
        floor: "tile",
        connections: ["bedroom", "kitchen"],
        upgrades: ["appliance"],
      },
      {
        id: "study",
        name: "Study",
        width: 4,
        height: 4,
        floor: "timber",
        connections: ["lounge"],
        upgrades: ["lighting"],
      },
    ],
  },
];
export const FURNITURE_CATALOG: FurnitureItem[] = [
  {
    id: "sofa",
    name: "Lounge sofa",
    category: "seating",
    price: 900,
    icon: "🛋️",
    width: 2,
    height: 1,
    effects: { fun: 5 },
  },
  {
    id: "bed",
    name: "Starter bed",
    category: "sleep",
    price: 1400,
    icon: "🛏️",
    width: 2,
    height: 2,
    effects: { energy: 25 },
  },
  {
    id: "stove",
    name: "Compact stove",
    category: "kitchen",
    price: 1200,
    icon: "♨️",
    width: 2,
    height: 1,
    effects: { hunger: 10 },
  },
  {
    id: "shower",
    name: "Shower",
    category: "bathroom",
    price: 1100,
    icon: "🚿",
    width: 1,
    height: 2,
    effects: { hygiene: 25 },
  },
  {
    id: "toilet",
    name: "Toilet",
    category: "bathroom",
    price: 750,
    icon: "🚽",
    width: 1,
    height: 1,
    effects: { bladder: 25 },
  },
  {
    id: "computer",
    name: "Study computer",
    category: "work",
    price: 1800,
    icon: "💻",
    width: 2,
    height: 1,
    effects: { skill: 5 },
  },
  {
    id: "television",
    name: "Living room TV",
    category: "work",
    price: 1600,
    icon: "📺",
    width: 2,
    height: 1,
    effects: { fun: 5 },
  },
  {
    id: "plant",
    name: "Potted plant",
    category: "decor",
    price: 250,
    icon: "🪴",
    width: 1,
    height: 1,
    effects: { fun: 2 },
  },
];
export type HousingSave = {
  layoutId: string;
  room: RoomId;
  x: number;
  y: number;
  exterior: { lat: number; lng: number } | null;
  furniture: PlacedFurniture[];
  storage: string[];
  upgrades: string[];
  needs: Record<string, number>;
};
export const DEFAULT_HOUSING_SAVE: HousingSave = {
  layoutId: "garden-flat",
  room: "lounge",
  x: 3,
  y: 3,
  exterior: null,
  furniture: [],
  storage: [],
  upgrades: [],
  needs: { energy: 70, fun: 50, hygiene: 70, bladder: 30, hunger: 60, skill: 0 },
};

export function parseHousingSave(value: unknown): HousingSave | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<HousingSave>;
  const layout = HOME_LAYOUTS.find((entry) => entry.id === candidate.layoutId);
  if (!layout || !layout.rooms.some((room) => room.id === candidate.room)) return null;
  const room = layout.rooms.find((entry) => entry.id === candidate.room)!;
  if (
    !Number.isInteger(candidate.x) ||
    !Number.isInteger(candidate.y) ||
    candidate.x! < 0 ||
    candidate.y! < 0 ||
    candidate.x! >= room.width ||
    candidate.y! >= room.height ||
    !Array.isArray(candidate.furniture) ||
    candidate.furniture.length > 100 ||
    !Array.isArray(candidate.storage) ||
    candidate.storage.length > 100 ||
    !candidate.storage.every((id) => FURNITURE_CATALOG.some((item) => item.id === id)) ||
    !Array.isArray(candidate.upgrades) ||
    candidate.upgrades.length > 100 ||
    !candidate.upgrades.every((upgrade) =>
      layout.rooms.some((entry) => entry.upgrades.includes(upgrade)),
    ) ||
    !candidate.needs ||
    typeof candidate.needs !== "object" ||
    Array.isArray(candidate.needs)
  )
    return null;
  const needs = { ...DEFAULT_HOUSING_SAVE.needs };
  for (const key of Object.keys(needs)) {
    const amount = candidate.needs[key];
    if (!Number.isFinite(amount) || amount! < 0 || amount! > 100) return null;
    needs[key] = amount!;
  }
  const placedIds = new Set<string>();
  const furniture: PlacedFurniture[] = [];
  for (const raw of candidate.furniture) {
    if (!raw || typeof raw !== "object") return null;
    const placed = raw as PlacedFurniture;
    const item = FURNITURE_CATALOG.find((entry) => entry.id === placed.itemId);
    const placedRoom = layout.rooms.find((entry) => entry.id === placed.room);
    if (
      !item ||
      !placedRoom ||
      !placed.id ||
      placedIds.has(placed.id) ||
      !Number.isInteger(placed.x) ||
      !Number.isInteger(placed.y) ||
      ![0, 90, 180, 270].includes(placed.rotation) ||
      !canPlace(
        placedRoom,
        item,
        placed.x,
        placed.y,
        furniture.filter((other) => other.room === placed.room),
        undefined,
        placed.rotation,
      )
    )
      return null;
    placedIds.add(placed.id);
    furniture.push(placed);
  }
  const exterior = candidate.exterior;
  if (
    exterior !== null &&
    exterior !== undefined &&
    (!Number.isFinite(exterior.lat) ||
      !Number.isFinite(exterior.lng) ||
      exterior.lat < 7.48 ||
      exterior.lat > 8.02 ||
      exterior.lng < 4.25 ||
      exterior.lng > 4.88)
  )
    return null;
  return {
    layoutId: layout.id,
    room: room.id,
    x: candidate.x!,
    y: candidate.y!,
    exterior: exterior ?? null,
    furniture,
    storage: [...candidate.storage],
    upgrades: [...candidate.upgrades],
    needs,
  };
}
export function findPath(
  width: number,
  height: number,
  start: [number, number],
  goal: [number, number],
  blocked: Set<string>,
): [number, number][] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  if (
    goal[0] < 0 ||
    goal[1] < 0 ||
    goal[0] >= width ||
    goal[1] >= height ||
    blocked.has(key(...goal))
  )
    return null;
  const queue: [number, number][] = [start];
  const previous = new Map<string, string>();
  const seen = new Set([key(...start)]);
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (x === goal[0] && y === goal[1]) {
      const path: [number, number][] = [];
      let cursor = key(x, y);
      while (cursor !== key(...start)) {
        const [px, py] = cursor.split(",").map(Number) as [number, number];
        path.unshift([px, py]);
        cursor = previous.get(cursor)!;
      }
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const next = key(nx, ny);
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        !blocked.has(next) &&
        !seen.has(next)
      ) {
        seen.add(next);
        previous.set(next, key(x, y));
        queue.push([nx, ny]);
      }
    }
  }
  return null;
}
export function canPlace(
  room: RoomDefinition,
  item: FurnitureItem,
  x: number,
  y: number,
  placed: PlacedFurniture[],
  ignoreId?: string,
  rotation = placed.find((f) => f.id === ignoreId)?.rotation ?? 0,
) {
  const rotated = item.width !== item.height ? rotation % 180 === 90 : false;
  const width = rotated ? item.height : item.width;
  const height = rotated ? item.width : item.height;
  if (x < 0 || y < 0 || x + width > room.width || y + height > room.height) return false;
  return !placed
    .filter((f) => f.room === room.id && f.id !== ignoreId)
    .some((f) => {
      const other = FURNITURE_CATALOG.find((entry) => entry.id === f.itemId);
      if (!other) return false;
      const ow = f.rotation % 180 ? other.height : other.width;
      const oh = f.rotation % 180 ? other.width : other.height;
      return x < f.x + ow && x + width > f.x && y < f.y + oh && y + height > f.y;
    });
}
