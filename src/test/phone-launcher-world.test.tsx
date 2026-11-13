import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
const state = vi.hoisted(() => ({ navigate: vi.fn(), href: "/jobs" }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  useLocation: ({ select }: { select: (location: { href: string }) => unknown }) =>
    select({ href: state.href }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/game", () => ({
  q: {
    notifications: () => ({}),
    profile: () => ({ queryKey: ["profile"], queryFn: async () => null }),
  },
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

it.each([["Map", "/map"]])(
  "opens the %s launcher as a full page and closes the phone",
  async (app, href) => {
    render(<PhoneLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
    fireEvent.click(screen.getByRole("button", { name: `Open ${app}` }));
    expect(state.navigate).toHaveBeenCalledWith({ href });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.querySelector("canvas")).toBeNull();
  },
);

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

it("keeps the shared navigation inside the modal focus boundary", async () => {
  render(
    <PhoneLauncher
      dock={
        <nav aria-label="Game navigation">
          <button>Home</button>
        </nav>
      }
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveClass("phone-dialog-shell");
  expect(dialog).toContainElement(screen.getByRole("navigation", { name: "Game navigation" }));
  expect(dialog.querySelector(".phone-dialog")).not.toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("groups launcher apps into pages of sixteen and includes optional Shortcuts", () => {
  render(<PhoneLauncher shortcutEditor={<div>Editor</div>} />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));

  const pages = document.querySelectorAll(".phone-app-grid");
  expect(Array.from(pages, (page) => page.querySelectorAll(".phone-app").length)).toEqual([16, 13]);
  expect(pages[0]?.querySelector('[aria-label="Open Shortcuts"]')).not.toBeNull();
  expect(screen.getAllByRole("button", { name: /Go to app page/ })).toHaveLength(pages.length);
  expect(screen.getByRole("button", { name: "Go to app page 1" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it("moves one launcher page per swipe and closes from the external Cancel button", async () => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  const pages = screen.getByLabelText("Phone apps");
  const scrollTo = vi.fn();
  Object.defineProperty(pages, "clientWidth", { configurable: true, value: 360 });
  Object.defineProperty(pages, "scrollTo", { configurable: true, value: scrollTo });

  fireEvent.touchStart(pages, {
    touches: [{ clientX: 300, clientY: 200 }],
    changedTouches: [{ clientX: 300, clientY: 200 }],
  });
  fireEvent.touchEnd(pages, {
    touches: [],
    changedTouches: [{ clientX: 80, clientY: 205 }],
  });
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 360 }));
  fireEvent.wheel(pages, { deltaX: -240 });
  fireEvent.wheel(pages, { deltaX: -240 });
  expect(scrollTo).toHaveBeenCalledTimes(2);
  expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));

  const cancel = screen.getByRole("button", { name: "Cancel and close phone" });
  expect(screen.getByRole("dialog")).toContainElement(cancel);
  expect(document.querySelector(".phone-screen")).not.toContainElement(cancel);
  expect(cancel).toHaveTextContent("Cancel");
  expect(cancel.querySelector("svg")).not.toBeNull();
  expect(document.querySelector(".phone-status-camera")).not.toBeNull();
  fireEvent.click(cancel);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
