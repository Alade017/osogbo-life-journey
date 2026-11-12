/**
 * Badges a player earns from what the profile already knows. Nothing is stored: each badge is worked
 * out from the character, the missions completed and the outfit worn, so it can't drift from the data.
 */

export type BadgeId =
  "first-steps" | "mission-runner" | "trailblazer" | "rising-star" | "respected" | "dressed-up";

export type BadgeInput = {
  missionsCompleted: number;
  level: number;
  reputation: number;
  /** Outfit slots with something worn in them, and how many slots there are altogether. */
  outfitWorn: number;
  outfitSlots: number;
};

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
};

export function profileBadges(input: BadgeInput): Badge[] {
  const rows: { id: BadgeId; name: string; description: string; value: number; target: number }[] =
    [
      {
        id: "first-steps",
        name: "First Steps",
        description: "Complete your first mission.",
        value: input.missionsCompleted,
        target: 1,
      },
      {
        id: "mission-runner",
        name: "Mission Runner",
        description: "Complete 5 missions.",
        value: input.missionsCompleted,
        target: 5,
      },
      {
        id: "trailblazer",
        name: "Trailblazer",
        description: "Complete 10 missions.",
        value: input.missionsCompleted,
        target: 10,
      },
      {
        id: "rising-star",
        name: "Rising Star",
        description: "Reach level 5.",
        value: input.level,
        target: 5,
      },
      {
        id: "respected",
        name: "Respected",
        description: "Reach a reputation of 50 around Osogbo.",
        value: input.reputation,
        target: 50,
      },
      {
        id: "dressed-up",
        name: "Dressed to Impress",
        description: "Wear something in every outfit slot.",
        value: input.outfitWorn,
        target: Math.max(1, input.outfitSlots),
      },
    ];
  return rows.map(({ value, target, ...badge }) => {
    const progress = Math.max(0, Math.min(value, target));
    return { ...badge, progress, target, earned: value >= target };
  });
}
