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

const CAREER_JOB_PATHS: Readonly<Record<string, string>> = {
  career_cedar_banking: "banking",
  career_meridian_banking: "banking",
  career_osun_mall_retail: "retail",
};

export function isCareerJob(slug: string): boolean {
  return Object.hasOwn(CAREER_JOB_PATHS, slug);
}

/** The career path a career job belongs to, or null for ordinary jobs and workplaces. */
export function careerPathForJob(slug: string): string | null {
  return CAREER_JOB_PATHS[slug] ?? null;
}
