import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMapTravelController } from "@/components/map/use-map-travel-controller";
import {
  peekPendingDepartureFromHome,
  takeDepartureFromHome,
  clearPendingDepartureFromHome,
} from "@/lib/home-departure";
const arrival = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: arrival } }));
const network = vi.hoisted(() => ({ travel: vi.fn(), refresh: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/game", () => ({
  rpc: { travelToLocation: network.travel },
  q: { character: () => ({ queryKey: ["character"], queryFn: network.refresh }) },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  arrival.mockClear();
  network.travel.mockReset().mockResolvedValue({});
  network.refresh.mockReset().mockResolvedValue({ current_location_id: "destination" });
  network.navigate.mockReset().mockResolvedValue(undefined);
  const pending = takeDepartureFromHome();
  if (pending) clearPendingDepartureFromHome(pending);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
function setup(insideHome = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const player = {
    id: "character",
    user_id: "account",
    inside_home_property_id: insideHome ? "home" : null,
  };
  const hook = renderHook(() =>
    useMapTravelController<{ id: string }>({
      character: player,
      queryClient,
      navigate: network.navigate,
    }),
  );
  act(() => hook.result.current.select({ id: "place" }));
  return { ...hook, queryClient };
}
describe("map travel transaction controller", () => {
  it("submits one trip even if confirmation is clicked twice before React updates", async () => {
    let finish!: (value: unknown) => void;
    network.travel.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = setup();
    await act(async () => {
      const first = result.current.confirm("destination", "danfo");
      const second = result.current.confirm("destination", "danfo");
      expect(network.travel).toHaveBeenCalledOnce();
      finish({});
      await Promise.all([first, second]);
    });
    expect(network.navigate).toHaveBeenCalledWith({ to: "/neighborhood" });
    expect(result.current.state.phase).toBe("arrived");
    expect(arrival).toHaveBeenCalledOnce();
  });
  it("retries only destination loading after an accepted trip fails to synchronise", async () => {
    network.refresh.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await act(async () => {
      await result.current.confirm("destination", "danfo");
    });
    expect(result.current.state.phase).toBe("sync-error");
    expect(arrival).not.toHaveBeenCalled();
    act(() => {
      result.current.close();
      result.current.select({ id: "another" });
    });
    expect(result.current.state.landmark?.id).toBe("place");
    await act(async () => {
      await result.current.confirm("destination", "danfo");
      await result.current.retryArrival();
    });
    expect(network.travel).toHaveBeenCalledOnce();
    expect(network.refresh).toHaveBeenCalledTimes(2);
    expect(result.current.state.phase).toBe("arrived");
  });
  it("treats cache-refresh failure after payment as a sync error, not a failed trip", async () => {
    const { result, queryClient } = setup();
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValueOnce(
      new Error("cache refresh failed"),
    );
    await act(async () => {
      await result.current.confirm("destination", "walking");
    });
    expect(result.current.state.phase).toBe("sync-error");
    expect(result.current.state.confirmedDestinationId).toBe("destination");
    await act(async () => {
      await result.current.retryArrival();
    });
    expect(network.travel).toHaveBeenCalledOnce();
    expect(result.current.state.phase).toBe("arrived");
  });
  it("keeps transport selection across tabs and clears it for a different place", () => {
    const { result } = setup();
    act(() => result.current.selectMode("keke"));
    act(() => result.current.setTab("details"));
    act(() => result.current.setTab("travel"));
    expect(result.current.state.mode).toBe("keke");
    act(() => result.current.select({ id: "other" }));
    expect(result.current.state.mode).toBeNull();
  });
  it("clears a failed home handoff and exposes a retryable error without submitting travel", async () => {
    network.navigate.mockRejectedValueOnce(new Error("route failed"));
    const { result } = setup(true);
    await act(async () => {
      await result.current.confirm("destination", "walking");
    });
    expect(network.travel).not.toHaveBeenCalled();
    expect(peekPendingDepartureFromHome()).toBeNull();
    expect(result.current.state.phase).toBe("submit-error");
    expect(result.current.state.error).toMatch(/home exit/);
  });
});
