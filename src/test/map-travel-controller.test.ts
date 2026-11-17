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
const network = vi.hoisted(() => ({
  travel: vi.fn(),
  refresh: vi.fn(),
  navigate: vi.fn(),
  home: vi.fn(),
  locations: vi.fn(),
}));
vi.mock("@/lib/game", () => ({
  rpc: { travelToLocation: network.travel },
  q: {
    character: () => ({ queryKey: ["character"], queryFn: network.refresh }),
    locations: () => ({ queryKey: ["locations"], queryFn: network.locations }),
  },
}));
vi.mock("@/lib/living-cost-service", () => ({
  canonicalHomeOptions: (id: string) => ({
    queryKey: ["canonicalHousingHome", id],
    queryFn: network.home,
  }),
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  arrival.mockClear();
  network.locations
    .mockReset()
    .mockResolvedValue([{ id: "destination", slug: "general-hospital" }]);
  network.home.mockReset().mockResolvedValue({
    playerPropertyId: "home",
    propertyId: "property",
    houseTypeId: "bungalow",
    name: "Home",
  });
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
    expect(network.navigate).toHaveBeenCalledWith({
      to: "/location/$slug",
      params: { slug: "general-hospital" },
    });
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

it("travels to the selected destination when a stale home flag has no current home", async () => {
  network.home.mockResolvedValueOnce(null);
  const { result } = setup(true);
  await act(async () => {
    await result.current.confirm("destination", "danfo");
  });
  expect(network.travel).toHaveBeenCalledExactlyOnceWith({
    locationId: "destination",
    mode: "danfo",
  });
  expect(network.navigate).toHaveBeenCalledExactlyOnceWith({
    to: "/location/$slug",
    params: { slug: "general-hospital" },
  });
  expect(peekPendingDepartureFromHome()).toBeNull();
  expect(result.current.state.phase).toBe("arrived");
});
it("does not divert a trip to a different saved home", async () => {
  network.home.mockResolvedValueOnce({
    playerPropertyId: "other-home",
    propertyId: "property",
    houseTypeId: "bungalow",
    name: "Home",
  });
  const { result } = setup(true);
  await act(async () => {
    await result.current.confirm("destination", "walking");
  });
  expect(network.navigate).toHaveBeenCalledExactlyOnceWith({
    to: "/location/$slug",
    params: { slug: "general-hospital" },
  });
  expect(network.travel).toHaveBeenCalledOnce();
});
it.each(["offline", "malformed"])(
  "keeps %s home checks retryable without charging",
  async (kind) => {
    if (kind === "offline") network.home.mockRejectedValueOnce(new Error("offline"));
    else network.home.mockResolvedValueOnce({});
    const { result } = setup(true);
    await act(async () => {
      await result.current.confirm("destination", "danfo");
    });
    expect(network.travel).not.toHaveBeenCalled();
    expect(network.navigate).not.toHaveBeenCalled();
    expect(peekPendingDepartureFromHome()).toBeNull();
    expect(result.current.state.phase).toBe("submit-error");
    expect(result.current.state.error).toMatch(/home status/);
  },
);

it("refreshes cached home data before handing off a departure", async () => {
  network.home.mockResolvedValueOnce(null);
  const { result, queryClient } = setup(true);
  queryClient.setQueryData(["canonicalHousingHome", "character"], {
    playerPropertyId: "home",
    propertyId: "property",
    houseTypeId: "bungalow",
    name: "Old home",
  });
  await act(async () => {
    await result.current.confirm("destination", "walking");
  });
  expect(network.home).toHaveBeenCalledOnce();
  expect(network.navigate).toHaveBeenCalledExactlyOnceWith({
    to: "/location/$slug",
    params: { slug: "general-hospital" },
  });
});
it("ignores a home check that completes after the map unmounts", async () => {
  let finish!: (value: unknown) => void;
  network.home.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = setup(true);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.confirm("destination", "walking");
  });
  unmount();
  await act(async () => {
    finish(null);
    await pending;
  });
  expect(network.travel).not.toHaveBeenCalled();
  expect(network.navigate).not.toHaveBeenCalled();
});

it("retries a missing destination route without charging for travel again", async () => {
  network.locations.mockResolvedValueOnce([]);
  const { result } = setup();
  await act(async () => {
    await result.current.confirm("destination", "walking");
  });
  expect(network.navigate).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe("sync-error");
  await act(async () => {
    await result.current.retryArrival();
  });
  expect(network.travel).toHaveBeenCalledOnce();
  expect(network.navigate).toHaveBeenCalledWith({
    to: "/location/$slug",
    params: { slug: "general-hospital" },
  });
});
it("does not open the selected scene before the server confirms arrival", async () => {
  network.refresh.mockResolvedValueOnce({ current_location_id: "origin" });
  const { result } = setup();
  await act(async () => {
    await result.current.confirm("destination", "walking");
  });
  expect(network.navigate).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe("sync-error");
});
