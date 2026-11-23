import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { retryLoadingQueries } from "@/lib/query-retry";

it("restarts a hung initial request without refreshing unrelated active queries", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let finishOriginal!: (value: string) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishOriginal = resolve;
        }),
    )
    .mockResolvedValue("recovered");
  const other = vi.fn().mockResolvedValue("keep");
  const loading = new QueryObserver(client, { queryKey: ["page", "loading"], queryFn: load });
  const sibling = new QueryObserver(client, { queryKey: ["page", "sibling"], queryFn: other });
  const unsubscribe = loading.subscribe(() => {});
  const unsubscribeOther = sibling.subscribe(() => {});
  try {
    await client.ensureQueryData({ queryKey: ["page", "sibling"], queryFn: other });
    expect(load).toHaveBeenCalledOnce();
    await retryLoadingQueries(client, [["page", "loading"]]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledOnce();
    expect(client.getQueryData(["page", "loading"])).toBe("recovered");
    finishOriginal("stale result");
    await Promise.resolve();
    expect(client.getQueryData(["page", "loading"])).toBe("recovered");
  } finally {
    unsubscribe();
    unsubscribeOther();
    client.clear();
  }
});

it("does not fetch unrelated data when no query keys are supplied", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await retryLoadingQueries(client, []);
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});
