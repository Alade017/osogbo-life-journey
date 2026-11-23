import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Restart only this loading screen's queries, including a hung first request. */
export async function retryLoadingQueries(client: QueryClient, keys: readonly QueryKey[]) {
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey, exact: true })));
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey, exact: true })));
}
