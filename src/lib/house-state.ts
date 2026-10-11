export type HouseRoomId = "living-room" | "kitchen" | "bedroom" | "bathroom" | "study";

export type FurnitureInteractionType =
  "sit" | "sleep" | "cook" | "watch" | "work" | "shower" | "inspect" | "door";

export type HouseFurniture = {
  id: string;
  type: string;
  label: string;
  room: HouseRoomId;
  level: number;
  unlocked: boolean;
  interactable: boolean;
  interactionType: FurnitureInteractionType;
  position: { x: number; y: number };
  icon: string;
  upgradeCost: number;
  description: string;
};

export type HouseState = {
  level: number;
  currentRoom: HouseRoomId;
  unlockedRooms: HouseRoomId[];
  upgrades: Record<string, number>;
  furniture: Record<string, HouseFurniture>;
  lastInteraction: string;
};

export const HOUSE_STORAGE_KEY = "osogbo-house-state-v1";

export const ROOM_DEFINITIONS: Record<
  HouseRoomId,
  { label: string; accent: string; description: string }
> = {
  "living-room": {
    label: "Living Room",
    accent: "#f3d9a2",
    description: "The main social space for relaxing, TV, and welcoming guests.",
  },
  kitchen: {
    label: "Kitchen",
    accent: "#c4e1cf",
    description: "Where meals, prep, and daily routines happen.",
  },
  bedroom: {
    label: "Bedroom",
    accent: "#d8c0ea",
    description: "A quiet private space for rest, recovery, and sleep.",
  },
  bathroom: {
    label: "Bathroom",
    accent: "#d5e7f2",
    description: "A clean, relaxing space for hygiene and reset moments.",
  },
  study: {
    label: "Study",
    accent: "#dfeec6",
    description: "A productive area for learning, planning, and work.",
  },
};

const DEFAULT_FURNITURE: HouseFurniture[] = [
  {
    id: "sofa",
    type: "sofa",
    label: "Sofa",
    room: "living-room",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "sit",
    position: { x: 26, y: 62 },
    icon: "🛋️",
    upgradeCost: 25000,
    description: "A basic sofa for relaxing and unwinding.",
  },
  {
    id: "tv",
    type: "tv",
    label: "Television",
    room: "living-room",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "watch",
    position: { x: 68, y: 28 },
    icon: "📺",
    upgradeCost: 30000,
    description: "A modest screen for entertainment and downtime.",
  },
  {
    id: "bed",
    type: "bed",
    label: "Bed",
    room: "bedroom",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "sleep",
    position: { x: 52, y: 58 },
    icon: "🛏️",
    upgradeCost: 35000,
    description: "A simple bed for recovery and rest.",
  },
  {
    id: "kitchen-counter",
    type: "kitchen",
    label: "Kitchen Counter",
    room: "kitchen",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "cook",
    position: { x: 60, y: 52 },
    icon: "🍳",
    upgradeCost: 28000,
    description: "A basic kitchen counter for preparing meals.",
  },
  {
    id: "computer",
    type: "computer",
    label: "Workstation",
    room: "study",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "work",
    position: { x: 62, y: 54 },
    icon: "💻",
    upgradeCost: 42000,
    description: "A practical desk for work, planning, and study.",
  },
  {
    id: "shower",
    type: "shower",
    label: "Shower",
    room: "bathroom",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "shower",
    position: { x: 58, y: 58 },
    icon: "🚿",
    upgradeCost: 22000,
    description: "A compact shower setup for refreshing up.",
  },
  {
    id: "door-living",
    type: "door",
    label: "Front Door",
    room: "living-room",
    level: 1,
    unlocked: true,
    interactable: true,
    interactionType: "door",
    position: { x: 85, y: 30 },
    icon: "🚪",
    upgradeCost: 0,
    description: "Exit back into the city or move to another room.",
  },
];

export function createDefaultHouseState(): HouseState {
  const furniture = Object.fromEntries(DEFAULT_FURNITURE.map((item) => [item.id, item]));

  return {
    level: 1,
    currentRoom: "living-room",
    unlockedRooms: ["living-room", "kitchen", "bedroom", "bathroom", "study"],
    upgrades: Object.fromEntries(DEFAULT_FURNITURE.map((item) => [item.id, item.level])),
    furniture,
    lastInteraction: "You are inside your home.",
  };
}

export function loadHouseState(): HouseState {
  if (typeof window === "undefined") return createDefaultHouseState();

  try {
    const raw = window.localStorage.getItem(HOUSE_STORAGE_KEY);
    if (!raw) return createDefaultHouseState();

    const parsed = JSON.parse(raw) as Partial<HouseState>;
    const base = createDefaultHouseState();

    return {
      ...base,
      ...parsed,
      furniture: {
        ...base.furniture,
        ...(parsed.furniture ?? {}),
      },
      upgrades: {
        ...base.upgrades,
        ...(parsed.upgrades ?? {}),
      },
      unlockedRooms: parsed.unlockedRooms?.length ? parsed.unlockedRooms : base.unlockedRooms,
      currentRoom: parsed.currentRoom ?? base.currentRoom,
    };
  } catch {
    return createDefaultHouseState();
  }
}

export function saveHouseState(state: HouseState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOUSE_STORAGE_KEY, JSON.stringify(state));
}

export function getRoomFurniture(roomId: HouseRoomId, state: HouseState): HouseFurniture[] {
  return Object.values(state.furniture).filter((item) => item.room === roomId);
}

export function getUpgradeLabel(level: number): string {
  if (level <= 1) return "Basic";
  if (level === 2) return "Improved";
  if (level === 3) return "Premium";
  return "Luxury";
}

export function getFurnitureUpgradeCost(furniture: HouseFurniture, houseLevel: number): number {
  const multiplier = Math.max(1, houseLevel);
  return Math.round(furniture.upgradeCost * multiplier * (furniture.level >= 2 ? 1.6 : 1));
}
