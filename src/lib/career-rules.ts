export type CareerRank = {
  path_slug: string;
  level: number;
  title: string;
  salary: number;
  required_shifts: number;
  required_skill_level: number;
  steps: [string, string, string];
};

export function nextCareerStep(completed: number): number | null {
  return Number.isInteger(completed) && completed >= 0 && completed < 3 ? completed + 1 : null;
}

export function canPromoteCareer(
  currentLevel: number,
  completedShifts: number,
  skillLevel: number,
  nextRank: CareerRank | undefined,
): boolean {
  return (
    !!nextRank &&
    nextRank.level === currentLevel + 1 &&
    completedShifts >= nextRank.required_shifts &&
    skillLevel >= nextRank.required_skill_level
  );
}

export function isCareerJob(slug: string): boolean {
  return (
    slug === "career_cedar_banking" ||
    slug === "career_meridian_banking" ||
    slug === "career_osun_mall_retail"
  );
}
