import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EducationPage } from "@/routes/_authenticated/_game/education";
import { CareerLifeApp } from "@/components/game/CareerLifeApp";

const state = vi.hoisted(() => ({
  saved: [] as { course_id: string; planned_at: string }[],
  failSave: false,
  failPlans: false,
  save: vi.fn(),
  complete: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/location/student-district">{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: state.toastError } }));
vi.mock("@/components/game/CareerPanel", () => ({
  CareerPanel: () => <div>Current career progression</div>,
}));
vi.mock("@/lib/career-life-service", () => ({
  loadSavedCourses: async () => {
    if (state.failPlans) throw new Error("Unavailable");
    return [...state.saved];
  },
  setSavedCourse: async (args: { slug: string; saved: boolean }) => {
    state.save(args);
    if (state.failSave) throw new Error("Could not save course");
    state.saved = args.saved ? [{ course_id: "c1", planned_at: "2026-11-01" }] : [];
  },
  loadCareerLifeSummary: async () => ({
    earned: 90000,
    shifts: 42,
    employments: [
      {
        id: "e1",
        name: "Cedar Bank",
        current: true,
        level: 2,
        shifts: 35,
        hiredAt: "2026-10-01",
        lastWorkedAt: null,
        location: "City Centre",
        requiredCourse: "Finance basics",
      },
      {
        id: "e2",
        name: "Old workplace",
        current: false,
        level: 1,
        shifts: 7,
        hiredAt: "2026-09-01",
        lastWorkedAt: null,
        location: null,
        requiredCourse: null,
      },
    ],
  }),
  loadCareerLifeHistory: async (offset: number) => ({
    rows: [
      {
        id: String(offset),
        at: "2026-11-01",
        kind: "payment",
        label: offset ? "Older shift" : "Recent shift",
        amount: 3500,
        level: null,
      },
    ],
    hasMore: offset === 0,
  }),
}));
vi.mock("@/lib/game", () => {
  const data: Record<string, unknown> = {
    character: { id: "player", energy: 100 },
    wallet: { balance: 10000 },
    locations: [{ id: "campus", slug: "student-district" }],
    visits: [],
    educationCourses: [
      {
        id: "c1",
        slug: "finance",
        name: "Finance basics",
        provider: "Osun Tech",
        description: "Build money skills",
        tuition: 1000,
        energy_cost: 15,
        intelligence_gain: 2,
        career_gain: 3,
      },
      {
        id: "c2",
        slug: "retail",
        name: "Retail essentials",
        provider: "Polytechnic",
        description: "Serve customers",
        tuition: 1500,
        energy_cost: 10,
        intelligence_gain: 1,
        career_gain: 2,
      },
    ],
    myCourses: [
      { character_id: "player", course_id: "c2", completed_at: "2026-10-31" },
      { character_id: "other-player", course_id: "c1", completed_at: "2026-10-30" },
    ],
  };
  return {
    q: Object.fromEntries(
      Object.keys(data).map((key) => [
        key,
        () => ({ queryKey: [key], queryFn: async () => data[key] }),
      ]),
    ),
    formatNaira: (n: number) => `₦${n}`,
    rpc: { completeEducationCourse: state.complete },
    useGameAction: () => ({ mutate: state.complete, isPending: false }),
  };
});

function show(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  state.saved = [];
  state.failSave = false;
  state.failPlans = false;
  vi.clearAllMocks();
});
afterEach(cleanup);

it("saves before visiting campus, reloads persisted saves and supports unsave", async () => {
  const view = show(<EducationPage />);
  const save = await screen.findByRole("button", { name: "Save Finance basics" });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await screen.findByRole("button", { name: "Unsave Finance basics" });
  expect(state.save).toHaveBeenCalledWith({ slug: "finance", saved: true });
  expect(state.complete).not.toHaveBeenCalled();
  view.unmount();
  show(<EducationPage phoneMode />);
  await screen.findByRole("button", { name: "Unsave Finance basics" });
  fireEvent.click(screen.getByRole("button", { name: "Saved" }));
  expect(screen.queryByRole("heading", { name: "Retail essentials" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unsave Finance basics" }));
  await screen.findByText("Your next chapter is waiting");
});
it("shows only this character's completions and searches by provider", async () => {
  show(<EducationPage />);
  await screen.findByRole("heading", { name: "Finance basics" });
  fireEvent.click(screen.getByRole("button", { name: "Completed" }));
  expect(screen.getByRole("heading", { name: "Retail essentials" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Finance basics" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search courses" }), {
    target: { value: "osun tech" },
  });
  expect(screen.queryByRole("heading", { name: "Retail essentials" })).not.toBeInTheDocument();
});
it("does not claim a failed save succeeded and retries unavailable saved courses", async () => {
  state.failSave = true;
  show(<EducationPage />);
  const save = await screen.findByRole("button", { name: "Save Finance basics" });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(state.toastError).toHaveBeenCalledWith("Could not save course"));
  expect(screen.queryByRole("button", { name: "Unsave Finance basics" })).not.toBeInTheDocument();
  cleanup();
  state.failPlans = true;
  show(<EducationPage />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Saved" }));
  expect(screen.queryByText("Your next chapter is waiting")).not.toBeInTheDocument();
  state.failPlans = false;
  state.saved = [{ course_id: "c1", planned_at: "2026-11-01" }];
  fireEvent.click(screen.getByRole("button", { name: "Retry learning record" }));
  await screen.findByRole("heading", { name: "Finance basics" });
});
it("exposes full metrics, current and past roles, paginated logs, opportunities and courses", async () => {
  show(<CareerLifeApp opportunities={<div>Existing workplace controls</div>} />);
  await screen.findByText("₦90000");
  expect(screen.getByText("42")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Work history" }));
  await screen.findByText("Old workplace");
  const record = screen.getByRole("region", { name: "Current and past jobs" });
  expect(within(record).getByText("Current")).toBeInTheDocument();
  expect(within(record).getByText("Past")).toBeInTheDocument();
  await screen.findByText("Recent shift");
  fireEvent.click(screen.getByRole("button", { name: "Older" }));
  await screen.findByText("Older shift");
  expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Opportunities" }));
  expect(screen.getByText("Existing workplace controls")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Learning" }));
  await screen.findByRole("heading", { name: "Finance basics" });
});
