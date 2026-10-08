import { JOB_CATEGORY_LABELS, resolveJobCategory } from "@/lib/job-activity-model";
import type { Json } from "@/integrations/supabase/types";
import { parseJobActivityRequirements } from "@/lib/job-activity-model";

export type SearchableJob = {
  slug: string;
  name: string;
  description: string;
  category?: string | null;
  is_available: boolean;
  searchText?: string;
};

export function filterJobListings<T extends SearchableJob>(
  jobs: readonly T[],
  search: string,
  category: string,
): T[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  return jobs.filter((job) => {
    if (!job.is_available) return false;
    const resolvedCategory = resolveJobCategory(job.category, job.slug, job.name);
    if (category !== "all" && category !== resolvedCategory) return false;
    if (!normalizedSearch) return true;
    const searchableText = [
      job.name,
      job.description,
      job.slug,
      resolvedCategory,
      JOB_CATEGORY_LABELS[resolvedCategory],
      job.searchText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchableText.includes(normalizedSearch);
  });
}

export type JobRequirementDefinition = {
  required_level: number;
  required_course_slug: string | null;
  requirements?: Json;
};

export type SkillProgress = {
  skill_slug: string;
  level: number;
  experience: number;
};

export function checkJobEligibility(
  job: JobRequirementDefinition,
  player: { level: number; skills: readonly SkillProgress[] },
  course: { required: boolean; completed: boolean; name?: string },
) {
  const requirements = parseJobActivityRequirements(job.requirements ?? {});
  const reasons: string[] = [];
  const levelRequired = Math.max(job.required_level, requirements.level ?? 1);
  if (player.level < levelRequired) {
    reasons.push(`Requires Level ${levelRequired} (you are Level ${player.level}).`);
  }
  if (course.required && !course.completed) {
    reasons.push(`Complete ${course.name ?? job.required_course_slug ?? "the required course"}.`);
  }

  for (const requirement of requirements.skills ?? []) {
    const progress = player.skills.find((skill) => skill.skill_slug === requirement.slug);
    const currentLevel = progress?.level ?? 0;
    const currentExperience = progress?.experience ?? 0;
    const knownNames: Record<string, string> = {
      javascript: "JavaScript",
      js: "JavaScript",
      ui_ux: "UI/UX",
    };
    const skillName =
      knownNames[requirement.slug] ??
      requirement.slug.replaceAll(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    if (requirement.minimumLevel !== undefined && currentLevel < requirement.minimumLevel) {
      reasons.push(`${skillName} skill: Level ${currentLevel}/${requirement.minimumLevel}.`);
    }
    if (
      requirement.minimumExperience !== undefined &&
      currentExperience < requirement.minimumExperience
    ) {
      reasons.push(`${skillName} skill: ${currentExperience}/${requirement.minimumExperience} XP.`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
