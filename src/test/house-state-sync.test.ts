import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  houseStateQueryKey,
  subscribeToHouseStateChanges,
  updateHouseStateStore,
  type HouseRealtimeClient,
} from "@/lib/house-state-sync";

function fakeRealtimeClient() {
  const subscriptions: Array<{
    type: string;
    filter: { table?: string; filter?: string; event?: string; schema?: string };
    callback: (payload: unknown) => void;
  }> = [];
  const removed: unknown[] = [];
  const channel = {
    on: vi.fn(
      (
        type: string,
        filter: { table?: string; filter?: string; event?: string; schema?: string },
        callback: (payload: unknown) => void,
      ) => {
        subscriptions.push({ type, filter, callback });
        return channel;
      },
    ),
    subscribe: vi.fn(() => channel),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn((value: unknown) => {
      removed.push(value);
    }),
  } as unknown as HouseRealtimeClient;
  return { client, subscriptions, removed, channel };
}

describe("canonical house state synchronization", () => {
  it("writes successful purchase and equip responses into the shared query store", () => {
    const client = new QueryClient();
    const playerId = "player-1";
    const responseState = {
      house: { id: "house-1" },
      inventory: [{ item_id: "linen-shirt", quantity: 1 }],
      outfit: { head: null, top: "linen-shirt", bottom: null, shoes: null, accessory: null },
      placements: [{ id: "placement-1", item_id: "sofa", slot: "seat" }],
    };

    updateHouseStateStore(client, playerId, { state: responseState, source: "server" });

    expect(client.getQueryData(houseStateQueryKey(playerId))).toEqual({
      state: responseState,
      source: "server",
    });
    client.clear();
  });

  it("shows a shirt bought elsewhere and a sofa removed elsewhere without a reload", async () => {
    const realtime = fakeRealtimeClient();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const playerId = "player-1";
    const queryKey = houseStateQueryKey(playerId);
    let serverState = {
      house: { id: "house-1" },
      inventory: [] as Array<{ item_id: string; quantity: number }>,
      outfit: {
        head: null,
        top: null as string | null,
        bottom: null,
        shoes: null,
        accessory: null,
      },
      placements: [{ id: "sofa-placement", item_id: "sofa", slot: "seat" }],
    };
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => ({ state: serverState, source: "server" as const }),
    });
    const stopObserving = observer.subscribe(() => undefined);
    await observer.refetch();
    const refresh = () => void queryClient.invalidateQueries({ queryKey, exact: true });
    const removeSubscription = subscribeToHouseStateChanges(
      realtime.client,
      playerId,
      "house-1",
      refresh,
    );

    expect(realtime.client.channel).toHaveBeenCalledWith(`house-state:${playerId}`, {
      config: { private: true },
    });
    expect(realtime.subscriptions).toEqual([
      {
        type: "postgres_changes",
        filter: {
          event: "*",
          schema: "public",
          table: "player_items",
          filter: "player_id=eq.player-1",
        },
        callback: expect.any(Function),
      },
      {
        type: "postgres_changes",
        filter: {
          event: "*",
          schema: "public",
          table: "player_outfit",
          filter: "player_id=eq.player-1",
        },
        callback: expect.any(Function),
      },
      {
        type: "broadcast",
        filter: { event: "house-state-change" },
        callback: expect.any(Function),
      },
    ]);

    // A buy/equip in another tab changes these server rows. The house tab refetches state.
    serverState = {
      ...serverState,
      inventory: [{ item_id: "linen-shirt", quantity: 1 }],
      outfit: { ...serverState.outfit, top: "linen-shirt" },
    };
    realtime.subscriptions[0]?.callback({ eventType: "INSERT" });
    await vi.waitFor(
      () =>
        expect(
          queryClient.getQueryData<{ state: typeof serverState }>(queryKey)?.state.outfit.top,
        ).toBe("linen-shirt"),
      { timeout: 3000 },
    );

    // Removing the sofa in the other tab is reflected through its placement DELETE event.
    serverState = { ...serverState, placements: [] };
    realtime.subscriptions[2]?.callback({ eventType: "DELETE" });
    await vi.waitFor(
      () =>
        expect(
          queryClient.getQueryData<{ state: typeof serverState }>(queryKey)?.state.placements,
        ).toEqual([]),
      { timeout: 3000 },
    );

    removeSubscription();
    stopObserving();
    expect(realtime.client.removeChannel).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
