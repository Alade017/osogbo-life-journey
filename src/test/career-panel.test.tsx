// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CareerPanel } from "@/components/game/CareerPanel";

const mutate = vi.fn();
let employment: {
  is_current: boolean;
  job_id: string;
  career_level: number;
  times_performed: number;
}[] = [];
let shifts: unknown[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/jobs">{children}</a>,
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"] }),
    jobs: () => ({ queryKey: ["jobs"] }),
    myJobs: () => ({ queryKey: ["myJobs"] }),
    locations: () => ({ queryKey: ["locations"] }),
    playerSkills: () => ({ queryKey: ["playerSkills"] }),
  },
  rpc: { selectJob: vi.fn() },
  formatNaira: (value: number) => `₦${value.toLocaleString()}`,
  useGameAction: () => ({ mutate, isPending: false }),
}));
vi.mock("@/lib/career-service", () => ({
  loadCareerCatalog: vi.fn(),
  loadCareerShifts: vi.fn(),
  startCareerShift: vi.fn(),
  completeCareerStep: vi.fn(),
  claimCareerShift: vi.fn(),
  cancelCareerShift: vi.fn(),
  promoteCareer: vi.fn(),
  leaveCareer: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    switch (queryKey[0]) {
      case "character":
        return { data: { current_location_id: "cedar", level: 1 } };
      case "jobs":
        return {
          data: [
            {
              id: "job",
              slug: "career_cedar_banking",
              name: "Cedar Bank · Banking & Finance",
              description: "Banking",
              location_id: "cedar",
              is_available: true,
              required_level: 1,
              skill_reward_slug: "financial_literacy",
            },
          ],
        };
      case "myJobs":
        return { data: employment };
      case "locations":
        return { data: [{ id: "cedar", slug: "cedar-bank", name: "Cedar Bank" }] };
      case "playerSkills":
        return { data: [] };
      case "careerCatalog":
        return {
          data: {
            paths: [
              {
                slug: "banking",
                name: "Banking & Finance",
                description: "Help customers",
                mood_reward: 2,
              },
            ],
            ranks: [
              {
                path_slug: "banking",
                level: 1,
                title: "Banking Assistant",
                salary: 3500,
                required_shifts: 0,
                required_skill_level: 0,
                steps: ["Prepare the branch", "Help a customer", "File the shift report"],
              },
            ],
          },
        };
      case "careerShifts":
        return { data: shifts };
      default:
        return { data: null };
    }
  },
}));

describe("career panel", () => {
  beforeEach(() => {
    employment = [];
    shifts = [];
    mutate.mockClear();
  });
  it("shows a bank career listing and applies through the existing job action", () => {
    render(<CareerPanel />);
    expect(screen.getByText("Banking Assistant")).toBeTruthy();
    expect(screen.getByText(/₦3,500/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply for career" }));
    expect(mutate).toHaveBeenCalledWith("job");
  });
  it("shows server shift progress without offering early payment", () => {
    employment = [{ is_current: true, job_id: "job", career_level: 1, times_performed: 0 }];
    shifts = [
      {
        id: "shift",
        character_job_id: "employment",
        location_id: "cedar",
        path_slug: "banking",
        rank_level: 1,
        step_count: 1,
        status: "active",
        started_at: new Date().toISOString(),
        next_step_at: new Date(0).toISOString(),
        completed_at: null,
        paid_amount: 0,
      },
    ];
    render(<CareerPanel />);
    expect(screen.getByText(/Shift in progress/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete step 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim pay/i })).toBeNull();
  });
});
