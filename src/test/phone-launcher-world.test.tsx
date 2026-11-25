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
vi.mock("@/components/game/CareerLifeApp", () => ({
  CareerLifeApp: () => <div>Career HUD content</div>,
}));
vi.mock("@/components/game/phone/CameraApp", () => ({
  default: () => <div>Camera app content</div>,
}));
vi.mock("@/components/game/phone/CityServicesApp", () => ({
  default: () => <div>City Services content</div>,
}));
vi.mock("@/components/game/phone/PropertyExchangeApp", () => ({
  default: () => <div>Property Exchange content</div>,
}));
vi.mock("@/components/game/phone/PhoneMapApp", () => ({
  PhoneMapApp: () => (
    <div>
      Map HUD content <a href="/map">Open full city map</a>
    </div>
  ),
}));
beforeEach(() => {
  state.href = "/jobs";
  vi.clearAllMocks();
});
afterEach(cleanup);

it("opens the Map directory in the phone and travels only on explicit map selection", async () => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Map" }));
  expect(await screen.findByText("Map HUD content")).toBeVisible();
  expect(state.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "Open full city map" }));
  expect(state.navigate).toHaveBeenCalledWith({ href: "/map" });
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

it("keeps the navigation out of the phone so the handset shows only the phone", async () => {
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
  expect(dialog.querySelector("nav")).toBeNull();
  expect(dialog.querySelector(".phone-dialog")).not.toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("groups launcher apps into pages of twenty and includes optional Shortcuts", () => {
  render(<PhoneLauncher shortcutEditor={<div>Editor</div>} />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));

  const pages = document.querySelectorAll(".phone-app-grid");
  expect(Array.from(pages, (page) => page.querySelectorAll(".phone-app").length)).toEqual([20, 11]);
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
  fireEvent.wheel(pages, { deltaX: 240 });
  fireEvent.wheel(pages, { deltaX: 240 });
  // Two pages: a further swipe clamps to the last page instead of moving past it.
  expect(scrollTo).toHaveBeenCalledTimes(2);
  expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 360 }));

  const cancel = screen.getByRole("button", { name: "Cancel and close phone" });
  expect(screen.getByRole("dialog")).toContainElement(cancel);
  expect(document.querySelector(".phone-screen")).not.toContainElement(cancel);
  expect(cancel).toHaveTextContent("Cancel");
  expect(cancel.querySelector("svg")).not.toBeNull();
  expect(document.querySelector(".phone-status-camera")).not.toBeNull();
  fireEvent.click(cancel);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("uses the dedicated native scroll layout when Settings opens inside the phone", () => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
  expect(document.querySelector(".phone-app-body--sx")).toBeInTheDocument();
});

it("restores a Career HUD request without leaving the underlying world", async () => {
  state.href = "/house?hud=jobs";
  render(<PhoneLauncher open requestedNavigation={{ app: "Career Life" }} />);
  expect(await screen.findByText("Career HUD content")).toBeVisible();
  expect(state.navigate).not.toHaveBeenCalled();
});

it("keeps the phone open on HUD-only URL changes and restores browser history selections", async () => {
  state.href = "/house?hud=jobs";
  const changed = vi.fn();
  const view = render(
    <PhoneLauncher open requestedNavigation={{ app: "Career Life" }} onOpenChange={changed} />,
  );
  await screen.findByText("Career HUD content");
  state.href = "/house?hud=map";
  view.rerender(<PhoneLauncher open requestedNavigation={{ app: "Map" }} onOpenChange={changed} />);
  expect(await screen.findByText("Map HUD content")).toBeVisible();
  expect(changed).not.toHaveBeenCalledWith(false);
  state.href = "/house?hud=jobs";
  view.rerender(
    <PhoneLauncher open requestedNavigation={{ app: "Career Life" }} onOpenChange={changed} />,
  );
  expect(await screen.findByText("Career HUD content")).toBeVisible();
  expect(state.navigate).not.toHaveBeenCalled();
});

it("publishes phone app and Back-to-apps changes to the URL owner", async () => {
  const selected = vi.fn();
  render(<PhoneLauncher open requestedNavigation={{ app: null }} onNavigationChange={selected} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Career Life" }));
  await screen.findByText("Career HUD content");
  expect(selected).toHaveBeenLastCalledWith({ app: "Career Life" });
  fireEvent.click(screen.getByRole("button", { name: "Back to apps" }));
  expect(selected).toHaveBeenLastCalledWith({ app: null });
});

it("opens the replacement City Services and Property Exchange apps from the launcher", async () => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Open City Services" }));
  expect(await screen.findByText("City Services content")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Back to apps" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Property Exchange" }));
  expect(await screen.findByText("Property Exchange content")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open Activities" })).toBeNull();
});

it("opens the Camera app from the launcher and from the global shortcut event", async () => {
  render(<PhoneLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Open in-game phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Camera" }));
  expect(await screen.findByText("Camera app content")).toBeVisible();
  fireEvent(window, new CustomEvent("osogbo-open-phone-app", { detail: { app: "Camera" } }));
  expect(await screen.findByText("Camera app content")).toBeVisible();
});
