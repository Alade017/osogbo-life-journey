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
let skillLevel = 0;

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
        return { data: [{ skill_slug: "financial_literacy", level: skillLevel }] };
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
              {
                path_slug: "banking",
                level: 2,
                title: "Customer Service Officer",
                salary: 5000,
                required_shifts: 5,
                required_skill_level: 1,
                steps: ["Review", "Resolve", "Report"],
              },
              {
                path_slug: "banking",
                level: 3,
                title: "Branch Supervisor",
                salary: 7000,
                required_shifts: 15,
                required_skill_level: 3,
                steps: ["Plan", "Support", "Report"],
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
    skillLevel = 0;
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
  it("blocks otherwise eligible promotion during an active shift", () => {
    employment = [{ is_current: true, job_id: "job", career_level: 1, times_performed: 5 }];
    skillLevel = 1;
    shifts = [
      { id: "shift", status: "active", step_count: 0, next_step_at: new Date(0).toISOString() },
    ];
    render(<CareerPanel />);
    const button = screen.getByRole("button", { name: "Claim promotion" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Finish or cancel your active shift before promotion."),
    ).toBeInTheDocument();
  });
  it("enables the existing promotion request for a qualified idle employee", () => {
    employment = [{ is_current: true, job_id: "job", career_level: 1, times_performed: 5 }];
    skillLevel = 1;
    render(<CareerPanel />);
    const button = screen.getByRole("button", { name: "Claim promotion" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(undefined);
  });
  it("does not offer a promotion before both thresholds or beyond rank three", () => {
    employment = [{ is_current: true, job_id: "job", career_level: 1, times_performed: 5 }];
    const view = render(<CareerPanel />);
    expect(screen.getByRole("button", { name: "Claim promotion" })).toBeDisabled();
    employment = [{ is_current: true, job_id: "job", career_level: 3, times_performed: 20 }];
    skillLevel = 3;
    view.rerender(<CareerPanel />);
    expect(screen.queryByRole("button", { name: "Claim promotion" })).not.toBeInTheDocument();
  });
});
