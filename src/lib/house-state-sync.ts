import type { QueryClient } from "@tanstack/react-query";

export const houseStateQueryKey = (playerId: string) =>
  ["authoritativeHouseState", playerId] as const;

export function updateHouseStateStore<T>(client: QueryClient, playerId: string, snapshot: T) {
  client.setQueryData(houseStateQueryKey(playerId), snapshot);
}

type HouseTable = "player_items" | "player_outfit";
type ChangeFilter = {
  event: "*";
  schema: "public";
  table: HouseTable;
  filter: string;
};
type HouseRealtimeChannel = {
  on(
    type: "postgres_changes",
    filter: ChangeFilter,
    callback: (payload: unknown) => void,
  ): HouseRealtimeChannel;
  on(
    type: "broadcast",
    filter: { event: string },
    callback: (payload: unknown) => void,
  ): HouseRealtimeChannel;
  subscribe: () => HouseRealtimeChannel;
};
export type HouseRealtimeClient = {
  channel: (name: string, options?: { config: { private: boolean } }) => HouseRealtimeChannel;
  removeChannel: (channel: HouseRealtimeChannel) => Promise<unknown> | unknown;
};

/** Changes to these owner-scoped rows invalidate the single canonical house-state query. */
export function subscribeToHouseStateChanges(
  client: HouseRealtimeClient,
  playerId: string,
  houseId: string | null,
  onChange: () => void,
) {
  let channel = client
    .channel(`house-state:${playerId}`, { config: { private: true } })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_items", filter: `player_id=eq.${playerId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_outfit", filter: `player_id=eq.${playerId}` },
      onChange,
    );

  // Placement removals are DELETE events, which Postgres Changes cannot safely row-filter.
  // The database sends these on a private channel authorized for this player's topic.
  if (houseId) channel = channel.on("broadcast", { event: "house-state-change" }, onChange);

  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
