import type { PlayerState } from "@/lib/player-state";

export type HudVitalName = "health" | "energy" | "hunger" | "thirst";
export type HudVital = { name: HudVitalName; value: number | null; label: string };

export function getHudVitals(
  player: Pick<PlayerState, "health" | "energy" | "hunger" | "thirst">,
): HudVital[] {
  return [
    { name: "health", value: player.health, label: `Health ${player.health} out of 100` },
    { name: "energy", value: player.energy, label: `Energy ${player.energy} out of 100` },
    {
      name: "hunger",
      value: 100 - player.hunger,
      label: `Hunger satisfaction ${100 - player.hunger} out of 100`,
    },
    {
      name: "thirst",
      value: player.thirst === null ? null : 100 - player.thirst,
      label:
        player.thirst === null
          ? "Thirst is not tracked yet"
          : `Thirst satisfaction ${100 - player.thirst} out of 100`,
    },
  ];
}
