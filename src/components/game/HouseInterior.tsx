import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BedDouble,
  ChefHat,
  DoorOpen,
  House,
  LampDesk,
  MonitorSmartphone,
  Sparkles,
  Sofa,
  Tv,
  Utensils,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ROOM_DEFINITIONS,
  getFurnitureUpgradeCost,
  getRoomFurniture,
  getUpgradeLabel,
  loadHouseState,
  saveHouseState,
  type HouseFurniture,
  type HouseRoomId,
  type HouseState,
} from "@/lib/house-state";

const ROOM_LAYOUT: Record<
  HouseRoomId,
  { left: string; top: string; width: string; height: string }
> = {
  "living-room": { left: "4%", top: "8%", width: "46%", height: "46%" },
  kitchen: { left: "52%", top: "8%", width: "42%", height: "36%" },
  bedroom: { left: "4%", top: "56%", width: "36%", height: "34%" },
  bathroom: { left: "42%", top: "48%", width: "26%", height: "28%" },
  study: { left: "70%", top: "48%", width: "24%", height: "30%" },
};

const ROOM_CONNECTIONS: Record<HouseRoomId, HouseRoomId[]> = {
  "living-room": ["kitchen", "bedroom", "bathroom", "study"],
  kitchen: ["living-room"],
  bedroom: ["living-room"],
  bathroom: ["living-room"],
  study: ["living-room"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getIconForFurniture(furniture: HouseFurniture) {
  switch (furniture.type) {
    case "sofa":
      return <Sofa className="h-4 w-4" />;
    case "tv":
      return <Tv className="h-4 w-4" />;
    case "bed":
      return <BedDouble className="h-4 w-4" />;
    case "kitchen":
      return <ChefHat className="h-4 w-4" />;
    case "computer":
      return <MonitorSmartphone className="h-4 w-4" />;
    case "shower":
      return <Utensils className="h-4 w-4" />;
    case "door":
      return <DoorOpen className="h-4 w-4" />;
    default:
      return <LampDesk className="h-4 w-4" />;
  }
}

export function HouseInterior() {
  const navigate = useNavigate();
  const [house, setHouse] = useState<HouseState>(() => loadHouseState());
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [interactionLog, setInteractionLog] = useState<string>("You are inside your home.");
  const [characterPosition, setCharacterPosition] = useState({ x: 18, y: 62 });

  const currentRoomFurniture = useMemo(() => getRoomFurniture(house.currentRoom, house), [house]);

  const selectedFurniture =
    selectedFurnitureId == null
      ? null
      : (Object.values(house.furniture).find((item) => item.id === selectedFurnitureId) ?? null);

  useEffect(() => {
    saveHouseState(house);
  }, [house]);

  useEffect(() => {
    if (!selectedFurniture) return;
    setCharacterPosition({
      x: clamp(selectedFurniture.position.x, 20, 78),
      y: clamp(selectedFurniture.position.y, 20, 78),
    });
  }, [selectedFurniture]);

  const goToRoom = (roomId: HouseRoomId) => {
    if (!house.unlockedRooms.includes(roomId)) return;
    setHouse((current) => ({ ...current, currentRoom: roomId }));
    setSelectedFurnitureId(null);
    setInteractionLog(`You entered the ${ROOM_DEFINITIONS[roomId].label.toLowerCase()}.`);
    setCharacterPosition({ x: 18, y: 62 });
  };

  const handleInteraction = (furniture: HouseFurniture) => {
    if (!furniture.interactable) return;

    setSelectedFurnitureId(furniture.id);
    setCharacterPosition({
      x: clamp(furniture.position.x, 20, 78),
      y: clamp(furniture.position.y, 20, 78),
    });

    const actionText = {
      sit: "You sit down and relax for a moment.",
      sleep: "You settle in for a short rest and regain energy.",
      cook: "You prepare a quick meal and feel ready for the day.",
      watch: "You watch the screen and take a break.",
      work: "You focus and make progress at your desk.",
      shower: "You freshen up and feel refreshed.",
      inspect: "You inspect the object and admire the room.",
      door: "You move through the house and continue your route.",
    }[furniture.interactionType];

    setInteractionLog(actionText ?? `You interact with the ${furniture.label}.`);
    setHouse((current) => ({
      ...current,
      lastInteraction: actionText ?? `You interact with the ${furniture.label}.`,
    }));
  };

  const upgradeFurniture = (furniture: HouseFurniture) => {
    const nextLevel = Math.min(4, furniture.level + 1);
    const upgradeCost = getFurnitureUpgradeCost(furniture, house.level);

    setHouse((current) => ({
      ...current,
      furniture: {
        ...current.furniture,
        [furniture.id]: {
          ...furniture,
          level: nextLevel,
          description:
            nextLevel === 2
              ? `${furniture.label} upgraded to an improved version.`
              : nextLevel === 3
                ? `${furniture.label} upgraded to a premium setup.`
                : `${furniture.label} upgraded to a luxury version.`,
        },
      },
      level: Math.max(current.level, nextLevel),
      lastInteraction: `${furniture.label} upgraded to ${getUpgradeLabel(nextLevel)}.`,
    }));

    setInteractionLog(
      `${furniture.label} upgraded to ${getUpgradeLabel(nextLevel)} (₦${upgradeCost.toLocaleString("en-NG")}).`,
    );
  };

  const roomInfo = ROOM_DEFINITIONS[house.currentRoom];
  const roomLinks = ROOM_CONNECTIONS[house.currentRoom] ?? [];

  return (
    <div className="space-y-5 px-2 pb-8 pt-3 md:px-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Property interior
          </p>
          <h1 className="font-display text-3xl font-black text-ink">My house</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/home"
            className="inline-flex items-center rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
          <Link
            to="/map"
            className="inline-flex items-center rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <House className="mr-2 h-4 w-4" />
            World map
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <section className="game-panel overflow-hidden p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {Object.entries(ROOM_DEFINITIONS).map(([roomId, room]) => (
              <button
                key={roomId}
                type="button"
                onClick={() => goToRoom(roomId as HouseRoomId)}
                className={
                  roomId === house.currentRoom
                    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    : "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-ink"
                }
              >
                {room.label}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-[24px] border-[3px] border-[#dfe5b2] bg-[linear-gradient(180deg,#eaf4d7_0%,#dfeec9_100%)] p-3 shadow-inner shadow-[#c8d6b3]">
            <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,#90c76d,#70a95d)]" />

            {Object.entries(ROOM_LAYOUT).map(([roomId, roomStyle]) => {
              const room = ROOM_DEFINITIONS[roomId as HouseRoomId];
              const active = roomId === house.currentRoom;

              return (
                <button
                  key={roomId}
                  type="button"
                  onClick={() => goToRoom(roomId as HouseRoomId)}
                  className={
                    active
                      ? "absolute rounded-[18px] border-[3px] border-[#2d4f4a] shadow-[0_10px_20px_rgba(42,70,46,0.16)]"
                      : "absolute rounded-[18px] border-[3px] border-[#d7d7c8] opacity-80"
                  }
                  style={{
                    left: roomStyle.left,
                    top: roomStyle.top,
                    width: roomStyle.width,
                    height: roomStyle.height,
                    background: room.accent,
                  }}
                >
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#234024]">
                        {room.label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="absolute left-[8%] top-[10%] h-[7%] w-[12%] rounded-[14px] border-[3px] border-[#d0c19d] bg-[#f4dcb4]" />
            <div className="absolute left-[18%] top-[18%] h-[18%] w-[16%] rounded-[16px] border-[3px] border-[#5d7a7e] bg-[#f7e3c2]" />
            <div className="absolute right-[12%] top-[16%] h-[18%] w-[18%] rounded-[18px] border-[3px] border-[#3a4a48] bg-[#d8ebdb]" />
            <div className="absolute left-[58%] top-[15%] h-[12%] w-[12%] rounded-[14px] border-[3px] border-[#91b7cb] bg-[#d3e9f4]" />
            <div className="absolute left-[58%] top-[58%] h-[16%] w-[18%] rounded-[14px] border-[3px] border-[#91a58c] bg-[#d6e2d0]" />
            <div className="absolute left-[23%] top-[62%] h-[18%] w-[18%] rounded-[18px] border-[3px] border-[#9987a7] bg-[#d6c5ea]" />
            <div className="absolute left-[76%] top-[56%] h-[16%] w-[12%] rounded-[14px] border-[3px] border-[#98afcf] bg-[#dbe7f4]" />

            {currentRoomFurniture.map((furniture) => (
              <button
                key={furniture.id}
                type="button"
                onClick={() => handleInteraction(furniture)}
                className={
                  selectedFurnitureId === furniture.id
                    ? "absolute flex items-center justify-center rounded-xl border-2 border-primary bg-primary/10 text-primary shadow-lg"
                    : "absolute flex items-center justify-center rounded-xl border-2 border-[#7d8f72] bg-white/30 text-[#1d2d1a]"
                }
                style={{
                  left: `${furniture.position.x}%`,
                  top: `${furniture.position.y}%`,
                  width: 72,
                  height: 58,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em]">
                  <span>{furniture.icon}</span>
                  {furniture.label}
                </div>
              </button>
            ))}

            <div
              className="absolute z-10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#1d2d1a] bg-[#f5d58a] text-xs font-black text-[#1d2d1a] shadow-[0_8px_18px_rgba(29,45,26,0.25)] transition-all duration-500"
              style={{
                left: `${characterPosition.x}%`,
                top: `${characterPosition.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              🧍
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="game-panel p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Current room
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">{roomInfo.label}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{roomInfo.description}</p>
            <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3 text-sm text-ink">
              {interactionLog}
            </div>
          </div>

          <div className="game-panel p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Furniture
            </p>
            {selectedFurniture ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-primary/5 text-xl">
                    {selectedFurniture.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink">{selectedFurniture.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {getUpgradeLabel(selectedFurniture.level)}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{selectedFurniture.description}</p>

                <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Interaction</span>
                    <span className="font-bold capitalize text-ink">
                      {selectedFurniture.interactionType}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Upgrade cost</span>
                    <span className="font-bold text-ink">
                      ₦
                      {getFurnitureUpgradeCost(selectedFurniture, house.level).toLocaleString(
                        "en-NG",
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleInteraction(selectedFurniture)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Use
                  </Button>
                  <Button
                    variant="plain"
                    className="flex-1"
                    onClick={() => upgradeFurniture(selectedFurniture)}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Upgrade
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Select a furniture item in the room to inspect or upgrade it.
              </p>
            )}
          </div>

          <div className="game-panel p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Fast travel
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {roomLinks.map((roomId) => (
                <button
                  key={roomId}
                  type="button"
                  onClick={() => goToRoom(roomId)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-sm font-semibold text-ink hover:border-primary hover:text-primary"
                >
                  Go to {ROOM_DEFINITIONS[roomId].label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
