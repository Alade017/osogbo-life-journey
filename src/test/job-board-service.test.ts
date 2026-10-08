import { describe, expect, it } from "vitest";
import { checkJobEligibility, filterJobListings } from "@/lib/job-board-service";

const listings = [
  {
    slug: "junior_developer",
    name: "Junior Developer",
    description: "Build web features for a local team.",
    category: "technology",
    is_available: true,
    searchText: "Osun Tech Hub Student District",
  },
  {
    slug: "waiter",
    name: "Waiter",
    description: "Help serve meals at a neighbourhood restaurant.",
    is_available: true,
    searchText: "Oke-Fia restaurant",
  },
  {
    slug: "closed_role",
    name: "Closed role",
    description: "No longer hiring.",
    category: "retail",
    is_available: false,
  },
] as const;

describe("filterJobListings", () => {
  it("filters by category and keeps older jobs discoverable from their names", () => {
    expect(filterJobListings(listings, "", "food_hospitality").map((job) => job.slug)).toEqual([
      "waiter",
    ]);
  });

  it("searches roles, descriptions, businesses, and districts without case sensitivity", () => {
    expect(filterJobListings(listings, "TECH HUB", "all").map((job) => job.slug)).toEqual([
      "junior_developer",
    ]);
    expect(filterJobListings(listings, "serve meals", "all").map((job) => job.slug)).toEqual([
      "waiter",
    ]);
  });

  it("excludes unavailable roles from the job board", () => {
    expect(filterJobListings(listings, "", "all").map((job) => job.slug)).not.toContain(
      "closed_role",
    );
  });
});

describe("checkJobEligibility", () => {
  const job = {
    required_level: 1,
    required_course_slug: null,
    requirements: {
      level: 2,
      skills: [
        { slug: "javascript", minimum_experience: 20 },
        { slug: "design", minimum_level: 1 },
      ],
    },
  };

  it("explains every unmet level and skill requirement with current values", () => {
    const result = checkJobEligibility(
      job,
      {
        level: 1,
        skills: [{ skill_slug: "javascript", level: 0, experience: 14 }],
      },
      { required: false, completed: true },
    );
    expect(result).toEqual({
      eligible: false,
      reasons: [
        "Requires Level 2 (you are Level 1).",
        "JavaScript skill: 14/20 XP.",
        "Design skill: Level 0/1.",
      ],
    });
  });

  it("requires the legacy course gate and accepts satisfied skill requirements", () => {
    const courseJob = { ...job, required_course_slug: "coding-bootcamp" };
    expect(
      checkJobEligibility(
        courseJob,
        { level: 2, skills: [] },
        {
          required: true,
          completed: false,
          name: "Coding Bootcamp",
        },
      ).reasons,
    ).toEqual([
      "Complete Coding Bootcamp.",
      "JavaScript skill: 0/20 XP.",
      "Design skill: Level 0/1.",
    ]);

    expect(
      checkJobEligibility(
        courseJob,
        {
          level: 2,
          skills: [
            { skill_slug: "javascript", level: 1, experience: 20 },
            { skill_slug: "design", level: 1, experience: 0 },
          ],
        },
        { required: true, completed: true },
      ).eligible,
    ).toBe(true);
  });
});
