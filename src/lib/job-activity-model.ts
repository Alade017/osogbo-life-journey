import type { Json } from "@/integrations/supabase/types";

export const JOB_CATEGORIES = [
  "technology",
  "design",
  "retail",
  "transportation",
  "food_hospitality",
  "construction",
  "security",
  "services",
  "healthcare",
  "education",
  "entertainment",
  "trading",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  technology: "Technology",
  design: "Design",
  retail: "Retail",
  transportation: "Transportation",
  food_hospitality: "Food & hospitality",
  construction: "Construction",
  security: "Security",
  services: "Services",
  healthcare: "Healthcare",
  education: "Education",
  entertainment: "Entertainment",
  trading: "Trading",
};

export function resolveJobCategory(
  category: string | null | undefined,
  slug: string,
  name: string,
): JobCategory {
  if (category && (JOB_CATEGORIES as readonly string[]).includes(category)) {
    return category as JobCategory;
  }

  const searchable = `${slug} ${name}`.toLowerCase();
  if (/developer|computer|technology|tech/.test(searchable)) return "technology";
  if (/graphic|design|photograph/.test(searchable)) return "design";
  if (/driver|delivery|transport/.test(searchable)) return "transportation";
  if (/waiter|cook|food|restaurant/.test(searchable)) return "food_hospitality";
  if (/mechanic|repair|construction|farm/.test(searchable)) return "construction";
  if (/security|guard/.test(searchable)) return "security";
  if (/health|clinic|hospital/.test(searchable)) return "healthcare";
  if (/teacher|tutor|education/.test(searchable)) return "education";
  if (/trader|vendor|trading/.test(searchable)) return "trading";
  if (/shop|stock|cashier|retail/.test(searchable)) return "retail";
  return "services";
}

export const ACTIVITY_CATEGORIES = [
  "rest",
  "study",
  "exercise",
  "social",
  "exploration",
  "food",
  "culture",
  "event",
  "other",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type SkillRequirement = {
  slug: string;
  minimumLevel?: number;
  minimumExperience?: number;
};

/** Extensible JSON requirements shared by future job and activity checks. */
export type JobActivityRequirements = {
  level?: number;
  skills?: SkillRequirement[];
  items?: string[];
  minimumReputation?: number;
  locationSlug?: string;
  availableHours?: { start: number; end: number };
};

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeInteger(value: Json | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Reads extensible requirement metadata safely without trusting malformed JSON. */
export function parseJobActivityRequirements(value: Json): JobActivityRequirements {
  if (!isRecord(value)) return {};

  const rawSkills = value["skills"];
  const skills = Array.isArray(rawSkills)
    ? rawSkills.flatMap((entry) => {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
        const slug = entry["slug"];
        if (typeof slug !== "string" || !slug.trim()) return [];
        const minimumLevel = nonNegativeInteger(entry["minimum_level"]);
        const minimumExperience = nonNegativeInteger(entry["minimum_experience"]);
        return [
          {
            slug: slug.trim(),
            ...(minimumLevel === undefined ? {} : { minimumLevel }),
            ...(minimumExperience === undefined ? {} : { minimumExperience }),
          },
        ];
      })
    : undefined;
  const rawHours = value["available_hours"];
  const availableHours =
    rawHours !== null && typeof rawHours === "object" && !Array.isArray(rawHours)
      ? {
          start: nonNegativeInteger(rawHours["start"]),
          end: nonNegativeInteger(rawHours["end"]),
        }
      : undefined;
  let normalizedHours: { start: number; end: number } | undefined;
  if (
    availableHours?.start !== undefined &&
    availableHours.end !== undefined &&
    availableHours.start <= 23 &&
    availableHours.end <= 23 &&
    availableHours.start !== availableHours.end
  ) {
    normalizedHours = { start: availableHours.start, end: availableHours.end };
  }

  const requirements: JobActivityRequirements = {};
  const level = nonNegativeInteger(value["level"]);
  const minimumReputation = nonNegativeInteger(value["minimum_reputation"]);
  const locationSlug = value["location_slug"];
  const items = value["items"];
  if (level !== undefined) requirements.level = level;
  if (skills !== undefined) requirements.skills = skills;
  if (Array.isArray(items)) {
    requirements.items = items.filter(
      (item): item is string => typeof item === "string" && !!item.trim(),
    );
  }
  if (minimumReputation !== undefined) requirements.minimumReputation = minimumReputation;
  if (typeof locationSlug === "string" && locationSlug.trim()) {
    requirements.locationSlug = locationSlug.trim();
  }
  if (normalizedHours) requirements.availableHours = normalizedHours;
  return requirements;
}
