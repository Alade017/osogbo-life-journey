import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cityEventOptions,
  cityEventsForDistrict,
  cityEventsKey,
  cityEventTransitions,
  getCityEvents,
  joinCityEventOccurrence,
  parseCityEvents,
  parseCityEventJoin,
  type CityEventSnapshot,
} from "@/lib/city-event-service";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const snapshot: CityEventSnapshot = {
  serverTime: "2026-10-28T08:00:00Z",
  events: [
    {
      occurrenceId: "11111111-1111-4111-8111-111111111111",
      id: "market-day",
      title: "Town Market Day",
      description: "Meet neighbours.",
      locationSlug: "town-market",
      locationName: "Town Market",
      landmarkId: "town-market",
      districtId: "market-quarter",
      startsAt: "2026-10-28T08:00:00Z",
      endsAt: "2026-10-28T15:00:00Z",
      status: "active",
      joined: false,
    },
  ],
};
beforeEach(() => vi.clearAllMocks());
describe("city event service", () => {
  it("validates server schedules and rejects duplicate, malformed or expired occurrences", () => {
    expect(parseCityEvents(snapshot)).toEqual(snapshot);
    for (const bad of [
      null,
      { ...snapshot, events: [snapshot.events[0], snapshot.events[0]] },
      ...[
        { status: "invented" },
        { joined: "yes" },
        { endsAt: snapshot.serverTime },
        { startsAt: "invalid" },
        { startsAt: "2026-10-29T08:00:00Z" },
      ].map((p) => ({ ...snapshot, events: [{ ...snapshot.events[0], ...p }] })),
    ])
      expect(() => parseCityEvents(bad)).toThrow(/invalid city events/);
  });
  it("rejects unconfirmed join payloads rather than marking attendance locally", () => {
    expect(parseCityEventJoin({ joined: true, duplicate: false })).toEqual({
      joined: true,
      duplicate: false,
    });
    for (const bad of [
      null,
      {},
      { joined: false, duplicate: false },
      { joined: true, duplicate: "yes" },
    ])
      expect(() => parseCityEventJoin(bad)).toThrow();
  });
  it("matches explicit districts rather than unrelated venue slugs", () => {
    expect(cityEventsForDistrict(snapshot.events, "market-quarter")).toHaveLength(1);
    expect(cityEventsForDistrict(snapshot.events, "town-market")).toHaveLength(0);
    expect(
      cityEventsForDistrict([{ ...snapshot.events[0]!, status: "cancelled" }], "market-quarter"),
    ).toHaveLength(0);
  });
  it("announces occurrence changes once and detects weather/expiry closures", () => {
    const active = snapshot.events[0]!;
    const upcoming = { ...active, status: "upcoming" as const };
    expect(cityEventTransitions([upcoming], [active]).started).toEqual([active]);
    expect(cityEventTransitions([active], [{ ...active }])).toEqual({ started: [], ended: [] });
    expect(cityEventTransitions([active], [{ ...active, status: "cancelled" }]).ended).toEqual([
      active,
    ]);
    expect(cityEventTransitions([active], []).ended).toEqual([active]);
    expect(
      cityEventTransitions([active], [{ ...active, occurrenceId: "new-week" }]).started,
    ).toHaveLength(1);
  });
  it("scopes personalized caches and refreshes at the nearest server boundary", () => {
    expect(cityEventsKey("a", "one")).not.toEqual(cityEventsKey("b", "one"));
    expect(cityEventsKey("a", "one")).not.toEqual(cityEventsKey("a", "two"));
    expect(cityEventOptions("", "").enabled).toBe(false);
    const interval = cityEventOptions("a", "one").refetchInterval;
    if (typeof interval !== "function") throw Error("Expected boundary refresh");
    const query = {
      state: {
        data: { ...snapshot, events: [{ ...snapshot.events[0]!, endsAt: "2026-10-28T08:00:02Z" }] },
        dataUpdatedAt: Date.now(),
      },
    } as Parameters<typeof interval>[0];
    expect(Number(interval(query))).toBeGreaterThanOrEqual(1000);
    expect(Number(interval(query))).toBeLessThanOrEqual(2000);
  });
  it("reads snapshots, pins joins to an occurrence and preserves server rejection", async () => {
    rpc.mockResolvedValueOnce({ data: snapshot, error: null });
    expect(await getCityEvents()).toEqual(snapshot);
    expect(rpc).toHaveBeenCalledWith("get_city_events");
    rpc.mockResolvedValueOnce({ data: { joined: true, duplicate: false }, error: null });
    await joinCityEventOccurrence(snapshot.events[0]!.occurrenceId);
    expect(rpc).toHaveBeenLastCalledWith("join_city_event_occurrence", {
      p_occurrence_id: snapshot.events[0]!.occurrenceId,
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This event is not active" } });
    await expect(joinCityEventOccurrence("expired")).rejects.toThrow(/not active/);
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "schema details" },
    });
    await expect(getCityEvents()).rejects.toThrow(
      "City events are not available yet. Try again later.",
    );
  });
});
