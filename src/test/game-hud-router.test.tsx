import { GameMobileNav } from "@/components/game/GameMobileNav";
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vitest";
import { useGameHud } from "@/hooks/use-game-hud";
import { parseGameHudSearch } from "@/lib/game-hud-search";

afterEach(cleanup);
function fixture(initial: string) {
  const mounted = vi.fn(),
    departed = vi.fn();
  function World() {
    useEffect(() => {
      mounted();
      return departed;
    }, []);
    return <p>Home world remains mounted</p>;
  }
  function Layout() {
    const hud = useGameHud();
    const href = useRouterState({ select: (state) => state.location.href });
    return (
      <>
        <output data-testid="href">{href}</output>
        <output data-testid="panel">
          {hud.inventoryOpen
            ? "inventory"
            : hud.phoneOpen
              ? (hud.phoneRequest.app ?? "phone")
              : "closed"}
        </output>
        <GameMobileNav
          onHudOpen={hud.openHud}
          onNavigate={() => hud.setPhoneOpen(false)}
        />
        <button onClick={() => hud.setPhoneOpen(false)}>Close phone</button>
        <Outlet />
      </>
    );
  }
  const root = createRootRoute({ validateSearch: parseGameHudSearch, component: Layout });
  const house = createRoute({ getParentRoute: () => root, path: "/house", component: World });
  const jobs = createRoute({
    getParentRoute: () => root,
    path: "/jobs",
    component: () => <p>Legacy jobs page</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      house,
      jobs,
      createRoute({
        getParentRoute: () => root,
        path: "/map",
        component: () => <p>City map world</p>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [initial] }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  return { router, mounted, departed };
}

it("closes the directory instead of reopening it when Map is tapped on the city map", async () => {
  fixture("/map?hud=map");
  await screen.findByText("City map world");
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  await waitFor(() => expect(screen.getByTestId("panel")).toHaveTextContent("closed"));
  expect(screen.getByTestId("href")).toHaveTextContent("/map");
  expect(screen.getByText("City map world")).toBeVisible();
});

it("opens HUDs and follows Back/Forward without remounting the world route", async () => {
  const { router, mounted, departed } = fixture("/house?floor=1#bed");
  await screen.findByText("Home world remains mounted");
  // Career Life is a page link now (see be8a6d8b), so only the Map HUD is opened from here.
  expect(screen.getByRole("link", { name: "Career Life" })).toHaveAttribute("href", "/jobs");
  expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  await waitFor(() => expect(screen.getByTestId("panel")).toHaveTextContent("Map"));
  expect(screen.getByTestId("href")).toHaveTextContent("/house?floor=1&hud=map#bed");
  await act(async () => router.history.back());
  await waitFor(() => expect(screen.getByTestId("panel")).toHaveTextContent("closed"));
  await act(async () => router.history.forward());
  await waitFor(() => expect(screen.getByTestId("panel")).toHaveTextContent("Map"));
  expect(screen.queryByRole("button", { name: "Open inventory" })).not.toBeInTheDocument();
  expect(mounted).toHaveBeenCalledOnce();
  expect(departed).not.toHaveBeenCalled();
});

it("supports direct HUD links and still allows legacy full-page navigation", async () => {
  const { router, mounted, departed } = fixture("/house?hud=jobs");
  await screen.findByText("Home world remains mounted");
  expect(screen.getByTestId("panel")).toHaveTextContent("Career Life");
  fireEvent.click(screen.getByRole("button", { name: "Close phone" }));
  await waitFor(() => expect(screen.getByTestId("panel")).toHaveTextContent("closed"));
  expect(mounted).toHaveBeenCalledOnce();
  await act(async () => {
    await router.navigate({ href: "/jobs" });
  });
  await screen.findByText("Legacy jobs page");
  expect(departed).toHaveBeenCalledOnce();
});
