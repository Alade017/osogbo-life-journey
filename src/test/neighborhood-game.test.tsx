import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NeighborhoodGame } from "@/components/game/NeighborhoodGame";
import type { NeighborhoodBridge } from "@/game/neighborhood-scene";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  create: vi.fn(),
  lock: vi.fn(),
  restore: vi.fn(),
  destroy: vi.fn(),
  reconnect: vi.fn(),
  navigate: vi.fn(),
  character: {
    id: "ade",
    current_location_id: "olaiya",
    world_x: 7,
    world_y: 6,
    world_position_revision: 3,
  },
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"], queryFn: async () => mocks.character }),
    locations: () => ({
      queryKey: ["locations"],
      queryFn: async () => [
        { id: "olaiya", slug: "city-centre", name: "Olaiya", map_x: 50, map_y: 50 },
      ],
    }),
  },
  rpc: { savePlayerWorldPosition: mocks.save },
}));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({ reconnect: mocks.reconnect }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/game/neighborhood-scene", () => ({ createNeighborhoodGame: mocks.create }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.character = {
    id: "ade",
    current_location_id: "olaiya",
    world_x: 7,
    world_y: 6,
    world_position_revision: 3,
  };
  mocks.create.mockReturnValue({
    game: { destroy: mocks.destroy },
    scene: {
      lock: mocks.lock,
      restore: mocks.restore,
      setTouch: vi.fn(),
      zoom: vi.fn(),
      interact: vi.fn(),
    },
  });
});
afterEach(cleanup);
async function start() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <NeighborhoodGame />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mocks.create).toHaveBeenCalled());
  return mocks.create.mock.calls[0]![1] as NeighborhoodBridge;
}
describe("Phaser to React checkpoint bridge", () => {
  it("commits stopped movement through the trusted RPC and updates the revision", async () => {
    const bridge = await start();
    mocks.save.mockImplementation(async () => {
      mocks.character = { ...mocks.character, world_x: 7.5, world_position_revision: 4 };
      return { revision: 4 };
    });
    await act(async () => {
      expect(await bridge.saveCheckpoint({ x: 7.5, y: 6 })).toBe(true);
    });
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        worldX: 7.5,
        expectedRevision: 3,
        buildingSlug: null,
        requestId: expect.any(String),
      }),
    );
    expect(mocks.lock).toHaveBeenCalledWith(true);
    expect(mocks.restore).toHaveBeenLastCalledWith({ x: 7.5, y: 6 });
    expect(mocks.reconnect).toHaveBeenCalled();
  });
  it("rolls back rejected movement to the refreshed authoritative checkpoint", async () => {
    const bridge = await start();
    mocks.save.mockImplementation(async () => {
      mocks.character = { ...mocks.character, world_x: 6.8, world_position_revision: 4 };
      throw new Error("Your city position changed.");
    });
    await act(async () => {
      expect(await bridge.saveCheckpoint({ x: 7.5, y: 6 })).toBe(false);
    });
    expect(mocks.restore).toHaveBeenLastCalledWith({ x: 6.8, y: 6 });
    expect(screen.getByRole("status")).toHaveTextContent("Your city position changed.");
  });
  it("destroys the scene on unmount and does not save an unchanged position", async () => {
    const bridge = await start();
    expect(await bridge.saveCheckpoint({ x: 7, y: 6 })).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    cleanup();
    expect(mocks.destroy).toHaveBeenCalledWith(true);
  });
});
