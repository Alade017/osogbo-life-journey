export const XP_PER_LEVEL = 150;

export type Progression = {
  level: number;
  experience: number;
  experienceIntoLevel: number;
  experienceRequired: number;
  experienceToNextLevel: number;
  progressPercent: number;
};

export type ExperienceGrant = {
  experience: number;
  level: number;
  leveledUp: boolean;
  levelsGained: number;
};

function safeExperience(experience: number): number {
  if (!Number.isFinite(experience)) return 0;
  return Math.max(0, Math.trunc(experience));
}

export function levelFromExperience(experience: number): number {
  return Math.floor(safeExperience(experience) / XP_PER_LEVEL) + 1;
}

export function experienceRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) return XP_PER_LEVEL;
  return level * XP_PER_LEVEL;
}

export function progressionFromExperience(experience: number): Progression {
  const total = safeExperience(experience);
  const experienceIntoLevel = total % XP_PER_LEVEL;
  const experienceRequired = XP_PER_LEVEL;
  return {
    level: levelFromExperience(total),
    experience: total,
    experienceIntoLevel,
    experienceRequired,
    experienceToNextLevel: experienceRequired - experienceIntoLevel,
    progressPercent: (experienceIntoLevel / experienceRequired) * 100,
  };
}

/** Pure calculation only; authoritative XP writes stay inside server-side RPCs. */
export function addExperience(currentExperience: number, amount: number): ExperienceGrant {
  if (!Number.isInteger(currentExperience) || currentExperience < 0) {
    throw new RangeError("Current experience must be a non-negative integer.");
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("Experience awards must be a non-negative integer.");
  }
  const experience = currentExperience + amount;
  const currentLevel = levelFromExperience(currentExperience);
  const level = levelFromExperience(experience);
  return {
    experience,
    level,
    leveledUp: level > currentLevel,
    levelsGained: level - currentLevel,
  };
}
