import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
const state = vi.hoisted(() => ({ navigate: vi.fn(), href: "/jobs" }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  useLocation: ({ select }: { select: (location: { href: string }) => unknown }) =>
    select({ href: state.href }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/lib/game", () => ({
  q: { notifications: () => ({}) },
  rpc: { markRead: vi.fn() },
  useGameAction: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/game-audio", () => ({ playGameSound: vi.fn() }));
vi.mock("@/hooks/use-live-clock", () => ({ useLiveClock: () => null }));
vi.mock("@/hooks/use-missions", () => ({ useMissions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-mission-claim", () => ({ useMissionClaim: () => ({ mutate: vi.fn() }) }));
beforeEach(() => {
  state.href = "/jobs";
  vi.clearAllMocks();
});
afterEach(cleanup);

it.each([
  ["Map", "/map"],
  ["Home", "/home"],
])("opens the %s launcher as a full page and closes the phone", async (app, href) => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  fireEvent.click(screen.getByRole("button", { name: `Open ${app}` }));
  expect(state.navigate).toHaveBeenCalledWith({ href });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(document.querySelector("canvas")).toBeNull();
});

it("redirects external neighborhood and friend-home requests without opening a phone world", () => {
  render(<PhoneLauncher />);
  for (const [app, search, href] of [
    ["Neighborhood", "", "/neighborhood"],
    ["Home", "?visit=friend-1", "/home?visit=friend-1"],
  ]) {
    fireEvent(window, new CustomEvent("osogbo-open-phone-app", { detail: { app, search } }));
    expect(state.navigate).toHaveBeenLastCalledWith({ href });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
});

it("dismisses an open phone after programmatic navigation to a world page", async () => {
  const view = render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  state.href = "/house";
  view.rerender(<PhoneLauncher />);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
