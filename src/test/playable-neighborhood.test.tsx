import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayableNeighborhood } from "@/components/game/PlayableNeighborhood";
import type { PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";

const state = vi.hoisted(() => ({
  location: "city",
  join: vi.fn(),
  rpc: vi.fn(),
  scene: vi.fn(),
  homeReads: 0,
  currentAction: null as { animation: string } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => ({ id: "player", current_location_id: state.location }),
    }),
    locations: () => ({
      queryKey: ["locations"],
      queryFn: async () => [
        { id: "city", slug: "city-centre", map_x: 0, map_y: 0 },
        { id: "market", slug: "oja-oba", map_x: 0, map_y: 0 },
        { id: "school", slug: "student-district", map_x: 0, map_y: 0 },
      ],
    }),
  },
}));
vi.mock("@/lib/living-cost-service", () => ({
  canonicalHomeOptions: () => ({
    queryKey: ["canonicalHome"],
    queryFn: async () => {
      state.homeReads++;
      return { houseTypeId: "bungalow" };
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("@/lib/multiplayer-service", () => ({ joinNeighborhood: state.join }));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({ simulation: { currentAction: state.currentAction } }),
}));
vi.mock("@/components/game/PlayerMovementControls", () => ({
  PlayerMovementControls: () => <div>Movement controls</div>,
}));
vi.mock("@/components/game/R3FNeighborhoodSurface", () => ({
  R3FNeighborhoodSurface: (props: {
    district: { area: { slug: string }; origin: { x: number; y: number } };
    homeTypeId: string | null;
    players: readonly unknown[];
    onScene: (handle: PhaserNeighborhoodHandle | null) => void;
  }) => {
    state.scene({
      area: props.district.area,
      areaOrigin: props.district.origin,
      homeTypeId: props.homeTypeId,
      playersRef: { current: props.players },
    });
    const { onScene } = props;
    useEffect(() => {
      onScene({ setPlayers: vi.fn(), setFollow: vi.fn(), setZoom: vi.fn() });
      return () => onScene(null);
    }, [onScene]);
    return <div>R3F neighbourhood</div>;
  },
}));

function room(location: string) {
  const listeners: { publish?: () => void; leave?: (code: number) => void } = {};
  const market = location === "market";
  const player = {
    characterId: "player",
    name: market ? "Market resident" : "Olaiya resident",
    gender: "female",
    appearance: "{}",
    equipment: "[]",
    x: market ? 4.21875 : 7,
    y: market ? 4.15625 : 6,
    facing: "south",
  };
  return {
    sessionId: location,
    state: { players: new Map([[location, player]]) },
    onStateChange: (fn: () => void) => {
      listeners.publish = fn;
    },
    onLeave: (fn: (code: number) => void) => {
      listeners.leave = fn;
    },
    send: vi.fn(),
    leave: vi.fn(async () => {}),
    listeners,
  };
}
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.location = "city";
  state.homeReads = 0;
  state.currentAction = null;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  state.join.mockImplementation(async (id: string) => room(id));
});
afterEach(() => {
  cleanup();
  client.clear();
});
const show = () =>
  render(
    <QueryClientProvider client={client}>
      <PlayableNeighborhood />
    </QueryClientProvider>,
  );
async function changeLocation(location: string) {
  state.location = location;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["character"] });
  });
}

it("loads Oja-Oba's confirmed room and correct origin without fetching or exposing a personal home", async () => {
  state.location = "market";
  show();
  await screen.findByText("Movement controls");
  await screen.findByText("R3F neighbourhood");
  expect(state.join).toHaveBeenCalledWith("market");
  expect(screen.getByRole("heading", { name: "Oja-Oba Market neighbourhood" })).toBeInTheDocument();
  expect(state.scene.mock.lastCall?.[0]).toMatchObject({
    area: { slug: "oja-oba" },
    areaOrigin: { x: 3, y: 5 },
    homeTypeId: null,
  });
  expect(state.homeReads).toBe(0);
  expect(screen.queryByRole("button", { name: /Enter your home/ })).not.toBeInTheDocument();
  expect(state.rpc).not.toHaveBeenCalled();
});

it("leaves the old room and ignores its late state events when changing districts", async () => {
  const old = room("city");
  state.join.mockImplementation(async (id: string) => (id === "city" ? old : room(id)));
  show();
  await screen.findByRole("button", { name: /Enter your home/ });
  await changeLocation("market");
  await waitFor(() =>
    expect(state.scene.mock.lastCall?.[0]).toMatchObject({
      area: { slug: "oja-oba" },
      homeTypeId: null,
    }),
  );
  expect(old.leave).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: /Enter your home/ })).not.toBeInTheDocument();
  const latestCount = state.scene.mock.calls.length;
  act(() => old.listeners.publish?.());
  expect(state.scene.mock.calls.length).toBe(latestCount);
});

it("does not join unsupported locations", async () => {
  state.location = "school";
  show();
  await screen.findByText("This district is not available for walking yet.");
  expect(state.join).not.toHaveBeenCalled();
  expect(state.scene).not.toHaveBeenCalled();
});

it("waits for the initial authoritative room state before publishing players", async () => {
  state.location = "market";
  const pending = room("market");
  const initialPlayers = pending.state.players;
  Object.defineProperty(pending, "state", { value: {}, configurable: true });
  state.join.mockResolvedValue(pending);
  show();
  await waitFor(() => expect(pending.listeners.publish).toBeDefined());
  expect(screen.queryByText("Movement controls")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  Object.defineProperty(pending, "state", {
    value: { players: initialPlayers },
    configurable: true,
  });
  act(() => pending.listeners.publish?.());
  await screen.findByText("Movement controls");
  await screen.findByText("R3F neighbourhood");
});

it("adds only the confirmed local activity animation to the scene player snapshot", async () => {
  state.location = "market";
  state.currentAction = { animation: "socializing" };
  show();
  await screen.findByText("Movement controls");
  await screen.findByText("R3F neighbourhood");

  const players = state.scene.mock.lastCall?.[0].playersRef.current;
  expect(players).toEqual([
    expect.objectContaining({ sessionId: "market", actionAnimation: "talk" }),
  ]);
});

it("disposes a room whose join completes after navigation to another district", async () => {
  let finish: ((value: ReturnType<typeof room>) => void) | undefined;
  state.join.mockImplementation((id: string) =>
    id === "city"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(room(id)),
  );
  show();
  await waitFor(() => expect(state.join).toHaveBeenCalledWith("city"));
  await changeLocation("market");
  await screen.findByText("Movement controls");
  await screen.findByText("R3F neighbourhood");
  const late = room("city");
  await act(async () => {
    finish!(late);
  });
  expect(late.leave).toHaveBeenCalledOnce();
  expect(state.scene.mock.lastCall?.[0]).toMatchObject({ area: { slug: "oja-oba" } });
});
