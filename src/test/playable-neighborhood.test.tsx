import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayableNeighborhood } from "@/components/game/PlayableNeighborhood";
import type { NeighborhoodSceneHandle } from "@/game/neighborhood-types";
import { toWorld } from "@/game/neighborhood-model";

const state = vi.hoisted(() => ({
  location: "city",
  join: vi.fn(),
  rpc: vi.fn(),
  scene: vi.fn(),
  homeReads: 0,
  currentAction: null as { animation: string } | null,
  gameTime: { minute: 0, hour: 8, day: 1, weekday: 0 },
  npcRows: [] as Array<{ id: string }>,
  placeRows: [] as Array<{ location_id: string; category: string }>,
  shopRows: [] as Array<{ shop: { location_id: string } }>,
  jobRows: [] as Array<{ is_available: boolean; location_id: string }>,
  position: null as { x: number; y: number } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/game", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game")>();
  return {
    ...actual,
    q: {
      ...actual.q,
      character: () => ({
        queryKey: ["character"],
        queryFn: async () => ({ id: "player", current_location_id: state.location }),
      }),
      locations: () => ({
        queryKey: ["locations"],
        queryFn: async () => [
          {
            id: "city",
            name: "Olaiya",
            slug: "city-centre",
            type: "residential",
            map_x: 0,
            map_y: 0,
            is_active: true,
          },
          {
            id: "market",
            name: "Oja-Oba Market",
            slug: "oja-oba",
            type: "market",
            map_x: 0,
            map_y: 0,
            is_active: true,
          },
          {
            id: "school",
            name: "Student District",
            slug: "student-district",
            type: "education",
            map_x: 0,
            map_y: 0,
            is_active: true,
          },
          {
            id: "landmark",
            name: "Osogbo Central Mosque",
            slug: "osogbo-central-mosque",
            type: "landmark",
            map_x: 0,
            map_y: 0,
            is_active: true,
          },
        ],
      }),
      npcs: () => ({ queryKey: ["npcs"], queryFn: async () => state.npcRows }),
      places: () => ({ queryKey: ["places"], queryFn: async () => state.placeRows }),
      shopItems: () => ({ queryKey: ["shopItems"], queryFn: async () => state.shopRows }),
      jobs: () => ({ queryKey: ["jobs"], queryFn: async () => state.jobRows }),
    },
  };
});
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
  useGameTime: () => ({
    simulation: { currentAction: state.currentAction, gameTime: state.gameTime },
  }),
}));
vi.mock("@/routes/_authenticated/_game/jobs", () => ({
  JobsPage: () => <div>Workplace opportunities</div>,
}));
vi.mock("@/components/game/phone/PhoneBankApp", () => ({
  PhoneBankApp: () => <div>Bank services</div>,
}));
vi.mock("@/components/game/LocationVenueScene", () => ({
  LocationVenueScene: () => <div>Venue interior</div>,
}));
vi.mock("@/routes/_authenticated/_game/market", () => ({
  MarketPage: () => <div>Market offers</div>,
}));
vi.mock("@/components/game/PlayerMovementControls", () => ({
  PlayerMovementControls: () => <div>Movement controls</div>,
}));
vi.mock("@/components/game/R3FNeighborhoodSurface", () => ({
  R3FNeighborhoodSurface: (props: {
    district: { area: { slug: string }; origin: { x: number; y: number } };
    homeTypeId: string | null;
    players: readonly unknown[];
    npcs: readonly unknown[];
    interactionTargets: readonly { id: string }[];
    onSelectTarget: (targetId: string) => void;
    onNpcArrive: (npcId: string, x: number, y: number) => void;
    onScene: (handle: NeighborhoodSceneHandle | null) => void;
  }) => {
    state.scene({
      area: props.district.area,
      areaOrigin: props.district.origin,
      homeTypeId: props.homeTypeId,
      npcs: props.npcs,
      interactionTargets: props.interactionTargets,
      onSelectTarget: props.onSelectTarget,
      onNpcArrive: props.onNpcArrive,
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

// NPCs are only talkable once they have walked to their destination; the 3D
// scene reports that through onNpcArrive, so the test reports it the same way.
// The player then stands at that destination, as it would after walking there.
async function settleNpcsAtDestination(joined: ReturnType<typeof room>) {
  const scene = state.scene.mock.lastCall?.[0] as
    | {
        npcs: readonly { id: string; targetX: number; targetY: number }[];
        areaOrigin: { x: number; y: number };
        onNpcArrive: (npcId: string, x: number, y: number) => void;
      }
    | undefined;
  if (!scene) return;
  for (const npc of scene.npcs) {
    await act(async () => scene.onNpcArrive(npc.id, npc.targetX, npc.targetY));
  }
  const npc = scene.npcs[0];
  if (!npc) return;
  const spot = toWorld({ x: npc.targetX, y: npc.targetY }, scene.areaOrigin);
  const player = joined.state.players.get(joined.sessionId)!;
  player.x = spot.x;
  player.y = spot.y;
  await act(async () => joined.listeners.publish?.());
}

function room(location: string) {
  const listeners: { publish?: () => void; leave?: (code: number) => void } = {};
  const market = location === "market";
  const player = {
    characterId: "player",
    name: market ? "Market resident" : "Olaiya resident",
    gender: "female",
    appearance: "{}",
    equipment: "[]",
    x: state.position?.x ?? (market ? 4.21875 : 7),
    y: state.position?.y ?? (market ? 4.15625 : 6),
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
    onMessage: vi.fn(),
    leave: vi.fn(async () => {}),
    listeners,
  };
}
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.location = "city";
  state.homeReads = 0;
  state.gameTime = { minute: 0, hour: 8, day: 1, weekday: 0 };
  state.npcRows = [];
  state.placeRows = [];
  state.shopRows = [];
  state.jobRows = [];
  state.position = null;
  state.rpc.mockResolvedValue({ data: null, error: null });
  state.currentAction = null;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  state.join.mockImplementation(async (id: string) => room(id));
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.useRealTimers();
});
const show = () =>
  render(
    <QueryClientProvider client={client}>
      <PlayableNeighborhood />
    </QueryClientProvider>,
  );
function primeLocationQueries() {
  client.setQueryDefaults(["character"], { staleTime: Infinity });
  client.setQueryData(["character"], {
    id: "player",
    current_location_id: state.location,
  });
  client.setQueryData(
    ["locations"],
    [
      { id: "city", slug: "city-centre", map_x: 0, map_y: 0, is_active: true },
      { id: "market", slug: "oja-oba", map_x: 0, map_y: 0, is_active: true },
      { id: "school", slug: "student-district", map_x: 0, map_y: 0, is_active: true },
      {
        id: "landmark",
        slug: "osogbo-central-mosque",
        map_x: 0,
        map_y: 0,
        is_active: true,
      },
      { id: "closed", slug: "closed-place", map_x: 0, map_y: 0, is_active: false },
    ],
  );
}
async function changeLocation(location: string) {
  state.location = location;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["character"] });
  });
}

it("loads Oja-Oba's confirmed room and correct origin without fetching or exposing a personal home", async () => {
  state.location = "market";
  show();
  await screen.findByText(/Tap the ground to walk/);
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

it("offers shop interactions only when real local shop offers are configured", async () => {
  state.location = "market";
  state.position = { x: 1.90625, y: 4.15625 };
  state.shopRows = [{ shop: { location_id: "market" } }];
  show();
  await screen.findByRole("button", { name: /Interact with Oja-Oba Market/i });
  await act(async () => {
    screen.getByRole("button", { name: /Interact with Oja-Oba Market/i }).click();
  });
  await screen.findByRole("button", { name: "Browse local shop offers" });
  screen.getByRole("button", { name: "Browse local shop offers" }).click();
  await screen.findByText("Market offers");
});

it("does not offer fake business interactions for decorative buildings", async () => {
  state.location = "market";
  state.position = { x: 1.90625, y: 4.15625 };
  show();
  await screen.findByText("R3F neighbourhood");
  expect(
    screen.queryByRole("button", { name: /Interact with Oja-Oba Market/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Browse local shop offers/i }),
  ).not.toBeInTheDocument();
});

it("places and talks to a scheduled NPC through the server-authoritative interaction RPC", async () => {
  state.location = "market";
  state.position = { x: 1.96875, y: 5.75 };
  state.gameTime = { minute: 0, hour: 17, day: 1, weekday: 0 };
  state.npcRows = [{ id: "npc-adeola" }];
  const joined = room("market");
  state.join.mockImplementation(async () => joined);
  state.rpc.mockResolvedValue({
    data: { event_id: "event-1", accepted: true, message: "You greet Adeola.", duplicate: false },
    error: null,
  });
  show();
  await screen.findByText("R3F neighbourhood");
  await settleNpcsAtDestination(joined);
  await screen.findByRole("button", { name: "Talk with Adeola Akinyemi" });
  expect(state.scene.mock.lastCall?.[0].npcs).toEqual([
    expect.objectContaining({ id: "npc-adeola", name: "Adeola Akinyemi" }),
  ]);
  await act(async () => {
    screen.getByRole("button", { name: "Talk with Adeola Akinyemi" }).click();
  });
  await act(async () => {
    screen.getByRole("button", { name: "Say hello" }).click();
  });
  await screen.findByText("You greet Adeola.");
  expect(state.rpc).toHaveBeenCalledWith(
    "interact_with_npc",
    expect.objectContaining({ p_npc_id: "npc-adeola", p_action: "greet" }),
  );
});

it("opens an NPC conversation from a 3D target only when the player is within interaction range", async () => {
  state.location = "market";
  state.position = { x: 1.96875, y: 5.75 };
  state.gameTime = { minute: 0, hour: 17, day: 1, weekday: 0 };
  state.npcRows = [{ id: "npc-adeola" }];
  const joined = room("market");
  state.join.mockImplementation(async () => joined);
  show();
  await screen.findByText("R3F neighbourhood");
  await settleNpcsAtDestination(joined);
  const sceneProps = state.scene.mock.lastCall?.[0];
  expect(sceneProps?.interactionTargets).toEqual([
    expect.objectContaining({ id: "npc-adeola", kind: "npc" }),
  ]);
  await act(async () => sceneProps?.onSelectTarget("npc-adeola"));
  await screen.findByRole("button", { name: "Say hello" });
});

it("does not allow a distant NPC target to bypass the proximity gate", async () => {
  state.location = "market";
  state.position = { x: 7, y: 6 };
  state.gameTime = { minute: 0, hour: 17, day: 1, weekday: 0 };
  state.npcRows = [{ id: "npc-adeola" }];
  show();
  await screen.findByText("R3F neighbourhood");
  const sceneProps = state.scene.mock.lastCall?.[0];
  await act(async () => sceneProps?.onSelectTarget("npc-adeola"));
  expect(screen.queryByRole("button", { name: "Say hello" })).not.toBeInTheDocument();
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

it("does not join inactive locations", async () => {
  state.location = "closed";
  show();
  await screen.findByText(/not available|could not be resolved/i);
  expect(state.join).not.toHaveBeenCalled();
  expect(state.scene).not.toHaveBeenCalled();
});

it("joins a mapped city-world blueprint beyond the two authored districts", async () => {
  state.location = "school";
  show();
  await screen.findByText(/Tap the ground to walk/);
  expect(state.join).toHaveBeenCalledWith("school");
  expect(state.scene.mock.lastCall?.[0].area.slug).toBe("student-district");
  expect(state.scene.mock.lastCall?.[0].area.roads.length).toBeGreaterThan(2);
});

it("waits for the initial authoritative room state before publishing players", async () => {
  state.location = "market";
  const pending = room("market");
  const initialPlayers = pending.state.players;
  Object.defineProperty(pending, "state", { value: {}, configurable: true });
  state.join.mockResolvedValue(pending);
  show();
  await waitFor(() => expect(pending.listeners.publish).toBeDefined());
  expect(screen.queryByText(/Tap the ground to walk/)).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  Object.defineProperty(pending, "state", {
    value: { players: initialPlayers },
    configurable: true,
  });
  act(() => pending.listeners.publish?.());
  await screen.findByText(/Tap the ground to walk/);
  await screen.findByText("R3F neighbourhood");
});

it("adds only the confirmed local activity animation to the scene player snapshot", async () => {
  state.location = "market";
  state.currentAction = { animation: "socializing" };
  show();
  await screen.findByText(/Tap the ground to walk/);
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
  await screen.findByText(/Tap the ground to walk/);
  await screen.findByText("R3F neighbourhood");
  const late = room("city");
  await act(async () => {
    finish!(late);
  });
  expect(late.leave).toHaveBeenCalledOnce();
  expect(state.scene.mock.lastCall?.[0]).toMatchObject({ area: { slug: "oja-oba" } });
});

it("reports a bounded timeout when joining never resolves", async () => {
  vi.useFakeTimers();
  primeLocationQueries();
  state.join.mockReturnValue(new Promise(() => {}));
  show();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(state.join).toHaveBeenCalledWith("city");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });
  expect(screen.queryByRole("button", { name: "Retry connection" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Connected ·/)).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_500);
  });
  expect(state.join).toHaveBeenCalledTimes(2);
});

it("closes a room that never publishes its initial authoritative state", async () => {
  vi.useFakeTimers();
  const pending = room("market");
  Object.defineProperty(pending, "state", { value: {}, configurable: true });
  state.location = "market";
  primeLocationQueries();
  state.join.mockResolvedValue(pending);
  show();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(pending.listeners.publish).toBeDefined();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(pending.leave).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_500);
  });
  expect(state.join).toHaveBeenCalledTimes(2);
});
