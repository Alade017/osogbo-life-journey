import { describe, expect, it } from "vitest";
import { canPromoteCareer, isCareerJob, nextCareerStep, type CareerRank } from "@/lib/career-rules";

const second: CareerRank = {
  path_slug: "banking",
  level: 2,
  title: "Customer Service Officer",
  salary: 5000,
  required_shifts: 5,
  required_skill_level: 1,
  steps: ["Review", "Resolve", "Report"],
};
const third: CareerRank = {
  ...second,
  level: 3,
  title: "Branch Supervisor",
  salary: 7000,
  required_shifts: 15,
  required_skill_level: 3,
};

describe("career rules", () => {
  it("permits only the next ordered work step", () => {
    expect([0, 1, 2, 3].map(nextCareerStep)).toEqual([1, 2, 3, null]);
    expect(nextCareerStep(-1)).toBeNull();
    expect(nextCareerStep(1.5)).toBeNull();
  });
  it("requires completed shifts, skill, and one-rank progression", () => {
    expect(canPromoteCareer(1, 5, 1, second)).toBe(true);
    expect(canPromoteCareer(1, 4, 1, second)).toBe(false);
    expect(canPromoteCareer(1, 5, 0, second)).toBe(false);
    expect(canPromoteCareer(1, 15, 3, third)).toBe(false);
    expect(canPromoteCareer(2, 15, 3, third)).toBe(true);
  });
  it("recognizes only the seeded career jobs", () => {
    expect(isCareerJob("career_cedar_banking")).toBe(true);
    expect(isCareerJob("career_meridian_banking")).toBe(true);
    expect(isCareerJob("career_osun_mall_retail")).toBe(true);
    expect(isCareerJob("cedar_bank_teller")).toBe(false);
  });
});
