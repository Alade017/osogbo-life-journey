import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ level: 1, rpc: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/map">{children}</a>,
}));
vi.mock("@/lib/career-service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/career-service")>("@/lib/career-service");
  return {
    ...actual,
    loadCareerShifts: async () => [],
    loadCareerCatalog: async () => ({
      paths: [{ slug: "banking", name: "Banking", description: "Banking", mood_reward: 2 }],
      ranks: [
        {
          path_slug: "banking",
          level: 1,
          title: "Banking Assistant",
          salary: 3500,
          required_shifts: 0,
          required_skill_level: 0,
          steps: ["Prepare", "Help", "Report"],
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
      ],
    }),
  };
});
vi.mock("@/lib/game", async () => {
  const actual = await vi.importActual<typeof import("@/lib/game")>("@/lib/game");
  return {
    ...actual,
    q: {
      character: () => ({
        queryKey: ["character"],
        queryFn: async () => ({ id: "player", current_location_id: "cedar", level: 1 }),
      }),
      jobs: () => ({
        queryKey: ["jobs"],
        queryFn: async () => [
          {
            id: "job",
            slug: "career_cedar_banking",
            name: "Cedar Bank",
            description: "Banking",
            location_id: "cedar",
            is_available: true,
            required_level: 1,
            skill_reward_slug: "financial_literacy",
          },
        ],
      }),
      myJobs: () => ({
        queryKey: ["myJobs"],
        queryFn: async () => [
          { is_current: true, job_id: "job", career_level: state.level, times_performed: 5 },
        ],
      }),
      locations: () => ({
        queryKey: ["locations"],
        queryFn: async () => [{ id: "cedar", slug: "cedar-bank", name: "Cedar Bank" }],
      }),
      playerSkills: () => ({
        queryKey: ["skills"],
        queryFn: async () => [{ skill_slug: "financial_literacy", level: 1 }],
      }),
    },
  };
});
import { CareerPanel } from "@/components/game/CareerPanel";
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
});
it("uses the real promotion service/action hook, preserves rank on rejection, and refreshes confirmed employment", async () => {
  state.level = 1;
  state.rpc.mockRejectedValueOnce(new Error("Finish your active shift before promotion"));
  let confirm!: (value: unknown) => void;
  state.rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CareerPanel />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Claim promotion" }));
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith("Finish your active shift before promotion"),
  );
  expect(screen.getByText("Your career · Level 1/3")).toBeInTheDocument();
  expect(state.success).not.toHaveBeenCalled();
  const button = await screen.findByRole("button", { name: "Claim promotion" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Promoting…" })).toBeDisabled();
  expect(screen.getByText("Your career · Level 1/3")).toBeInTheDocument();
  await act(async () => {
    state.level = 2;
    confirm({
      data: { career_level: 2, title: "Customer Service Officer", salary: 5000 },
      error: null,
    });
  });
  expect(await screen.findByText("Your career · Level 2/3")).toBeInTheDocument();
  expect(state.rpc.mock.calls).toEqual([["promote_career"], ["promote_career"]]);
  expect(state.success).toHaveBeenCalledTimes(1);
});
