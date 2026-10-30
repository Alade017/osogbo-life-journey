import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActiveGoalSummary } from "@/components/game/ActiveGoalSummary";
import { useMissionClaim } from "@/hooks/use-mission-claim";
import { useMissions } from "@/hooks/use-missions";
import { activeGoal, getMissions, type PlayerMission } from "@/lib/mission-service";

const state = vi.hoisted(() => ({
  userId: "u1",
  sessionId: "u1",
  character: { id: "c1", user_id: "u1" },
  rows: [] as unknown[],
  error: false,
  read: vi.fn(),
  rpc: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  filters: [] as string[][],
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.failure } }));
vi.mock("@tanstack/react-router", () => ({
  useRouteContext: () => ({ user: { id: state.userId } }),
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.sessionId } } } }) },
    from: () => ({
      select: () => ({
        eq: (key: string, value: string) => {
          state.filters.push([key, value]);
          return {
            eq: async (key2: string, value2: string) => {
              state.filters.push([key2, value2]);
              await state.read();
              return { data: state.rows, error: state.error ? { message: "Unavailable" } : null };
            },
          };
        },
      }),
    }),
  },
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"], queryFn: async () => state.character }),
    missions: (userId = "", characterId = "") => ({
      queryKey: ["missions", userId, characterId],
      enabled: !!userId && !!characterId,
      retry: false,
      queryFn: () => getMissions(userId, characterId),
    }),
  },
  rpc: { claimMission: (id: string) => state.rpc(id) },
  formatNaira: (n: number) => `₦${n.toLocaleString("en-NG")}`,
}));
const row = (id = "m1", status = "in_progress", order = 1): PlayerMission => ({
  id,
  user_id: "u1",
  character_id: "c1",
  mission_id: id,
  progress: 3500,
  status,
  claimed_at: null,
  completed_at: null,
  created_at: "",
  updated_at: "",
  mission: {
    created_at: "",
    id,
    slug: "earn_10000",
    title: `Goal ${id}`,
    description: "Earn money from job shifts.",
    target: 10000,
    reward_money: 2000,
    reward_xp: 40,
    sort_order: order,
  },
});
let client: QueryClient;
function Wrapper({ children }: React.PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  state.userId = state.sessionId = "u1";
  state.character = { id: "c1", user_id: "u1" };
  state.rows = [row()];
  state.error = false;
  state.filters = [];
  state.read.mockReset().mockResolvedValue(undefined);
  state.rpc.mockReset().mockResolvedValue({ money: 2000, xp: 40 });
  state.success.mockClear();
  state.failure.mockClear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  onlineManager.setOnline(true);
});
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
});
it("prioritizes ready rewards then catalog order with stable ties", () => {
  expect(
    activeGoal([row("z", "in_progress", 0), row("b", "completed", 2), row("a", "completed", 2)])
      ?.id,
  ).toBe("a");
  expect(activeGoal([row("b", "in_progress", 2), row("a", "in_progress", 1)])?.id).toBe("a");
  expect(activeGoal([row("a", "claimed")])).toBeUndefined();
});
it("shows the existing target, reward, meter and Missions navigation", async () => {
  render(<ActiveGoalSummary />, { wrapper: Wrapper });
  expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow", "3500");
  expect(screen.getByText(/₦3,500 \/ ₦10,000/)).toHaveTextContent("₦2,000 · 40 XP");
  expect(screen.getByRole("link", { name: "View missions" })).toHaveAttribute("href", "/missions");
  expect(state.rpc).not.toHaveBeenCalled();
});
it("bounds the meter and displays completed rewards", async () => {
  state.rows = [{ ...row("ready", "completed"), progress: 12000 }];
  render(<ActiveGoalSummary />, { wrapper: Wrapper });
  expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow", "10000");
  expect(screen.getByText("Ready to claim in Missions")).toBeVisible();
});
it("distinguishes claimed goals from an empty catalog", async () => {
  state.rows = [row("done", "claimed")];
  render(<ActiveGoalSummary />, { wrapper: Wrapper });
  expect(await screen.findByText(/All lifetime goals claimed/)).toBeVisible();
  state.rows = [];
  await act(() => client.invalidateQueries({ queryKey: ["missions"] }));
  expect(await screen.findByText("No lifetime goals available yet.")).toBeVisible();
});
it("preserves cached progress with refresh errors and offline feedback", async () => {
  render(<ActiveGoalSummary />, { wrapper: Wrapper });
  await screen.findByRole("meter");
  state.error = true;
  await act(() => client.invalidateQueries({ queryKey: ["missions"] }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not refresh");
  expect(screen.getByRole("meter")).toBeVisible();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  fireEvent(window, new Event("offline"));
  expect(screen.getByText(/showing last confirmed/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
});
it("shows loading and initial error without inventing progress", async () => {
  let finish!: () => void;
  state.read.mockImplementation(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  render(<ActiveGoalSummary />, { wrapper: Wrapper });
  expect(screen.getByRole("status")).toBeVisible();
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  state.error = true;
  await act(async () => finish());
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("meter")).toBeNull();
});
it("filters reads by account and character, rejecting a session switch mid-read", async () => {
  await getMissions("u1", "c1");
  expect(state.filters).toEqual([
    ["user_id", "u1"],
    ["character_id", "c1"],
  ]);
  state.read.mockImplementationOnce(async () => {
    state.sessionId = "u2";
  });
  await expect(getMissions("u1", "c1")).rejects.toThrow("account changed");
});
it("hides the prior account snapshot while its old character is cached", async () => {
  const hook = renderHook(() => useMissions(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.data).toHaveLength(1));
  state.userId = state.sessionId = "u2";
  hook.rerender();
  expect(hook.result.current.data).toBeUndefined();
  expect(hook.result.current.characterId).toBe("");
  state.rows = [{ ...row("second"), user_id: "u2", character_id: "c2" }];
  state.character = { id: "c2", user_id: "u2" };
  await act(() => client.invalidateQueries({ queryKey: ["character"] }));
  await waitFor(() => expect(hook.result.current.data?.[0]?.id).toBe("second"));
});
it("blocks same-tick duplicate claims and only marks confirmed success", async () => {
  state.rows = [row("m1", "completed")];
  let finish!: (value: { money: number; xp: number }) => void;
  state.rpc.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const hook = renderHook(() => useMissionClaim("u1", "c1"), { wrapper: Wrapper });
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.mutate("m1");
    void hook.result.current.mutate("m1");
  });
  await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
  expect(state.success).not.toHaveBeenCalled();
  await act(async () => {
    finish({ money: 2000, xp: 40 });
    await pending;
  });
  expect(state.success).toHaveBeenCalledTimes(1);
  expect(client.getQueryData<PlayerMission[]>(["missions", "u1", "c1"])?.[0]?.status).toBe(
    "claimed",
  );
});
it("recovers a lost response from canonical claimed state without a success toast", async () => {
  state.rows = [row("m1", "completed")];
  state.rpc.mockImplementation(async () => {
    state.rows = [row("m1", "claimed")];
    throw Error("lost response");
  });
  const hook = renderHook(() => useMissionClaim("u1", "c1"), { wrapper: Wrapper });
  await act(() => hook.result.current.mutate("m1"));
  expect(state.success).not.toHaveBeenCalled();
  expect(state.failure).not.toHaveBeenCalled();
  expect(client.getQueryData<PlayerMission[]>(["missions", "u1", "c1"])?.[0]?.status).toBe(
    "claimed",
  );
});
it("never queues offline claims", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  onlineManager.setOnline(false);
  const hook = renderHook(() => useMissionClaim("u1", "c1"), { wrapper: Wrapper });
  await act(() => hook.result.current.mutate("m1"));
  onlineManager.setOnline(true);
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.failure).toHaveBeenCalledWith(expect.stringContaining("Nothing was queued"));
});
it("suppresses late success after unmount", async () => {
  state.rows = [row("m1", "completed")];
  let finish!: (v: { money: number; xp: number }) => void;
  state.rpc.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const hook = renderHook(() => useMissionClaim("u1", "c1"), { wrapper: Wrapper });
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.mutate("m1");
  });
  await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
  hook.unmount();
  await act(async () => {
    finish({ money: 2000, xp: 40 });
    await pending;
  });
  expect(state.success).not.toHaveBeenCalled();
});
