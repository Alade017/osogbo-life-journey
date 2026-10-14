import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Character } from "@/lib/game";
import {
  Bath,
  BedDouble,
  ChefHat,
  Heart,
  House,
  LampDesk,
  Sparkles,
  Sofa,
  Tv,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  description: string;
  activities: string[];
  position: { left: string; top: string; width: string; height: string };
};

const rooms: Room[] = [
  {
    id: "living",
    name: "Living Room",
    emoji: "🛋️",
    accent: "var(--scene-accent)",
    description: "A warm family lounge with a couch, TV, and a small coffee table for downtime.",
    activities: ["Relax", "Watch TV", "Host visitors"],
    position: { left: "7%", top: "9%", width: "43%", height: "42%" },
  },
  {
    id: "kitchen",
    name: "Kitchen",
    emoji: "🍳",
    accent: "var(--scene-sky)",
    description:
      "The cooking corner where quick meals and fresh ingredients help keep the home alive.",
    activities: ["Cook", "Meal prep", "Clean up"],
    position: { left: "52%", top: "9%", width: "42%", height: "35%" },
  },
  {
    id: "bedroom",
    name: "Bedroom",
    emoji: "🛏️",
    accent: "var(--scene-building-edge)",
    description: "Your personal retreat for rest, recovery, and quiet time after a busy day.",
    activities: ["Sleep", "Rest", "Recharge"],
    position: { left: "7%", top: "54%", width: "35%", height: "33%" },
  },
  {
    id: "study",
    name: "Study",
    emoji: "📚",
    accent: "var(--scene-hill)",
    description: "A focused workspace built for learning, planning, and personal growth.",
    activities: ["Study", "Work smart", "Read"],
    position: { left: "45%", top: "48%", width: "24%", height: "32%" },
  },
  {
    id: "bathroom",
    name: "Bathroom",
    emoji: "🛁",
    accent: "var(--scene-sky)",
    description: "Clean and fresh, ready for refresh routines and daily reset moments.",
    activities: ["Freshen up", "Shower", "Reset"],
    position: { left: "72%", top: "48%", width: "22%", height: "30%" },
  },
  {
    id: "courtyard",
    name: "Courtyard",
    emoji: "🌿",
    accent: "var(--scene-hill)",
    description: "An open outdoor area with a little greenery and a chance to decompress outdoors.",
    activities: ["Stretch", "Breath in air", "Socialize"],
    position: { left: "69%", top: "78%", width: "23%", height: "16%" },
  },
];

const ROOM_EFFECTS: Record<
  string,
  Record<
    string,
    {
      energy?: number;
      hunger?: number;
      thirst?: number;
      happiness?: number;
      mood: string;
      toast: string;
    }
  >
> = {
  living: {
    Relax: {
      energy: 12,
      happiness: 8,
      mood: "Chill mode active",
      toast: "You relaxed and settled in.",
    },
    "Watch TV": {
      energy: 6,
      happiness: 10,
      mood: "Good vibes only",
      toast: "TV time brought the room to life.",
    },
    "Host visitors": {
      happiness: 12,
      mood: "Social energy boosted",
      toast: "You hosted a quick visit and felt more connected.",
    },
  },
  kitchen: {
    Cook: {
      hunger: -10,
      happiness: 6,
      mood: "Home cooking in motion",
      toast: "A quick meal made the place feel alive.",
    },
    "Meal prep": { hunger: -8, mood: "Prepared for the day", toast: "You prepped a simple meal." },
    "Clean up": {
      happiness: 4,
      mood: "The home feels fresh",
      toast: "A tidy kitchen keeps the house balanced.",
    },
  },
  bedroom: {
    Sleep: {
      energy: 22,
      happiness: 5,
      mood: "Fully rested",
      toast: "You slept deeply and recovered energy.",
    },
    Rest: { energy: 14, mood: "Recharge cycle unlocked", toast: "A calm rest reset your pace." },
    Recharge: {
      energy: 18,
      hunger: 2,
      mood: "Resetting your energy",
      toast: "You took a quiet recharge break.",
    },
  },
  study: {
    Study: {
      energy: -8,
      happiness: 2,
      mood: "Learning mode on",
      toast: "You focused and sharpened your mind.",
    },
    "Work smart": {
      energy: -5,
      happiness: 4,
      mood: "Productive afternoon",
      toast: "You got a bit of useful work done.",
    },
    Read: {
      energy: -2,
      happiness: 6,
      mood: "Reading time",
      toast: "A quiet read gave your brain a boost.",
    },
  },
  bathroom: {
    "Freshen up": {
      energy: 8,
      happiness: 5,
      mood: "Fresh and ready",
      toast: "You cleaned up and feel more awake.",
    },
    Shower: {
      energy: 10,
      happiness: 7,
      mood: "Fresh reset complete",
      toast: "A quick shower left you feeling renewed.",
    },
    Reset: {
      happiness: 6,
      mood: "Everything feels clearer",
      toast: "You reset your routine and felt better.",
    },
  },
  courtyard: {
    Stretch: {
      energy: 8,
      happiness: 5,
      mood: "Outdoors energy restored",
      toast: "A quick stretch improved your mood.",
    },
    "Breath in air": {
      energy: 6,
      happiness: 6,
      mood: "Calm and grounded",
      toast: "Fresh air helped you settle down.",
    },
    Socialize: {
      happiness: 10,
      mood: "A little more connected",
      toast: "You spent time socializing outside.",
    },
  },
};

const actionIcons: Record<string, string> = {
  Relax: "🛋️",
  "Watch TV": "📺",
  "Host visitors": "👋",
  Cook: "🍳",
  "Meal prep": "🥘",
  "Clean up": "🧽",
  Sleep: "😴",
  Rest: "💤",
  Recharge: "⚡",
  Study: "📘",
  "Work smart": "💡",
  Read: "📖",
  "Freshen up": "🧼",
  Shower: "🚿",
  Reset: "✨",
  Stretch: "🧘",
  "Breath in air": "🌬️",
  Socialize: "🗣️",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function VirtualHouse({ characterName }: { characterName: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("living");
  const [mood, setMood] = useState("Chill mode active");

  const selected = useMemo(
    () => rooms.find((room) => room.id === selectedId) ?? rooms[0],
    [selectedId],
  );

  if (!selected) return null;

  const handleAction = (roomId: string, action: string) => {
    const roomEffect = ROOM_EFFECTS[roomId]?.[action];
    if (!roomEffect) return;

    queryClient.setQueryData(["character"], (current: Character | undefined) => {
      if (!current) return current;

      const next = { ...current };
      next.energy = clamp((current.energy ?? 100) + (roomEffect.energy ?? 0), 0, 100);
      next.hunger = clamp((current.hunger ?? 100) + (roomEffect.hunger ?? 0), 0, 100);
      next.thirst = clamp((current.thirst ?? 100) + (roomEffect.thirst ?? 0), 0, 100);
      next.happiness = clamp((current.happiness ?? 70) + (roomEffect.happiness ?? 0), 0, 100);
      return next;
    });

    setMood(roomEffect.mood);
    toast.success(roomEffect.toast);
  };

  return (
    <section className="game-panel overflow-hidden p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            My home
          </p>
          <h2 className="font-display text-2xl font-black text-ink md:text-3xl">
            {characterName}&apos;s virtual house
          </h2>
        </div>
        <div className="rounded-full border border-edge bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          {mood}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[28px] border-[3px] border-[var(--scene-sky)] bg-[var(--scene-sky)] p-3 shadow-inner shadow-[var(--scene-building-edge)]">
          <div className="relative aspect-[1.45] overflow-hidden rounded-[22px] border-[3px] border-[var(--border)] bg-[linear-gradient(180deg,var(--scene-sky)_0%,#d5e7b5_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in srgb, var(--color-surface) 20%, transparent),transparent_35%)]" />
            <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,var(--scene-hill),var(--scene-hill-front))]" />
            <div className="absolute inset-x-[7%] bottom-[13%] top-[9%] rounded-[22px] border-[5px] border-[var(--scene-building-edge)] bg-[var(--scene-building)] shadow-[inset_0_0_0_3px_color-mix(in srgb, var(--destructive) 12%, transparent)]" />

            {rooms.map((room) => {
              const isSelected = room.id === selectedId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedId(room.id)}
                  className={cn(
                    "absolute rounded-[18px] border-[3px] transition-all duration-200 ease-out",
                    "flex items-center justify-center shadow-[0_8px_18px_color-mix(in srgb, var(--primary) 14%, transparent)]",
                    isSelected
                      ? "border-[var(--brand-royal)] ring-4 ring-[var(--color-primary-soft)]"
                      : "border-[var(--scene-building-edge)] hover:border-[var(--scene-building-edge)]",
                  )}
                  style={{
                    left: room.position.left,
                    top: room.position.top,
                    width: room.position.width,
                    height: room.position.height,
                    background: room.accent,
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-1 text-center leading-none text-[var(--brand-ink)]">
                    <span className="text-xl md:text-2xl">{room.emoji}</span>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] md:text-[11px]">
                      {room.name}
                    </span>
                  </div>
                </button>
              );
            })}

            <div className="absolute bottom-[16%] left-[54%] h-[18%] w-[22%] rounded-[18px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-sky)]" />
            <div className="absolute bottom-[16%] left-[78%] h-[12%] w-[10%] rounded-[12px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-sky)]" />
            <div className="absolute bottom-[18%] left-[18%] h-[10%] w-[18%] rounded-[16px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-building)]" />
            <div className="absolute bottom-[23%] left-[24%] h-[6%] w-[10%] rounded-[10px] bg-[var(--scene-wood-line)]" />
            <div className="absolute left-[62%] top-[26%] h-[18%] w-[9%] rounded-full border-[4px] border-[var(--chart-4)] bg-[var(--scene-building)]" />
            <div className="absolute left-[70%] top-[22%] h-[16%] w-[14%] rounded-[16px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-building)]" />
            <div className="absolute left-[18%] top-[18%] h-[10%] w-[14%] rounded-[14px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-building)]" />
            <div className="absolute left-[78%] top-[24%] h-[14%] w-[9%] rounded-[14px] border-[3px] border-[var(--scene-building-edge)] bg-[var(--scene-building)]" />
          </div>
        </div>

        <div className="rounded-[22px] border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-primary/5 text-2xl">
              {selected.emoji}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Selected room
              </p>
              <h3 className="text-lg font-bold text-ink">{selected.name}</h3>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>

          <div className="mt-4 rounded-xl border border-border bg-muted/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Go here
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.activities.map((activity) => (
                <button
                  key={activity}
                  type="button"
                  onClick={() => handleAction(selected.id, activity)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <span>{actionIcons[activity] ?? "✨"}</span>
                  {activity}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                setMood("Cozy evening mode");
                toast.success(`Home vibe updated for ${characterName}`);
                queryClient.setQueryData(["character"], (current: Character | undefined) => {
                  if (!current) return current;
                  return {
                    ...current,
                    happiness: clamp((current.happiness ?? 70) + 8, 0, 100),
                    energy: clamp((current.energy ?? 100) + 4, 0, 100),
                  };
                });
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Decorate home
            </Button>
            <Button
              variant="plain"
              className="w-full"
              onClick={() => {
                setMood("Reset and recharge");
                queryClient.setQueryData(["character"], (current: Character | undefined) => {
                  if (!current) return current;
                  return {
                    ...current,
                    energy: clamp((current.energy ?? 100) + 10, 0, 100),
                    happiness: clamp((current.happiness ?? 70) + 5, 0, 100),
                  };
                });
                toast.success("House mood refreshed.");
              }}
            >
              <Heart className="mr-2 h-4 w-4" />
              Refresh vibe
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
