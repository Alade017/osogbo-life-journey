import { describe, expect, it } from "vitest";
import { createMapApiHandlers } from "@/lib/map-api.server";

const playerId = "player-8b2c4d";
const landmarkId = "oja-oba-market";
const idempotencyKey = "request-key-00000001";

function request(key = idempotencyKey, id = landmarkId) {
  return new Request("http://localhost/api/map/travel", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-access-token",
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ destination_landmark_id: id }),
  });
}

describe("map travel API", () => {
  it("blocks an under-18 player and logs the failed check without birth-date data", async () => {
    const audit: { playerId: string; landmarkId: string }[] = [];
    const handlers = createMapApiHandlers({
      authenticate: async () => playerId,
      startTravel: async () => {
        throw new Error("AGE_RESTRICTED");
      },
      getLandmark: async () => {
        throw new Error("AGE_RESTRICTED");
      },
      logAgeCheck: async (checkedPlayerId, checkedLandmarkId) => {
        audit.push({ playerId: checkedPlayerId, landmarkId: checkedLandmarkId });
      },
    });

    const response = await handlers.postTravel(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "AGE_RESTRICTED" } });
    expect(audit).toEqual([{ playerId, landmarkId }]);
  });

  it("reuses the idempotency receipt after an offline retry without charging twice", async () => {
    let balance = 1_000;
    let charges = 0;
    const receipts = new Map<string, unknown>();
    const handlers = createMapApiHandlers({
      authenticate: async () => playerId,
      startTravel: async (_userId, id, key) => {
        const previous = receipts.get(key);
        if (previous) return previous;
        balance -= 250;
        charges += 1;
        const result = {
          travel_id: "trip-1",
          landmark_id: id,
          fare: 250,
          travel_minutes: 12,
          arrival_at: "2026-10-14T10:12:00+00:00",
          status: "travelling",
        };
        receipts.set(key, result);
        return result;
      },
      getLandmark: async () => ({}),
      logAgeCheck: async () => {},
    });

    const first = await handlers.postTravel(request());
    const retry = await handlers.postTravel(request());
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await first.json()).toEqual(await retry.json());
    expect(balance).toBe(750);
    expect(charges).toBe(1);
  });

  it("returns UNKNOWN_LANDMARK for a stale landmark id", async () => {
    const handlers = createMapApiHandlers({
      authenticate: async () => playerId,
      startTravel: async () => {
        throw new Error("UNKNOWN_LANDMARK");
      },
      getLandmark: async () => {
        throw new Error("UNKNOWN_LANDMARK");
      },
      logAgeCheck: async () => {},
    });

    const response = await handlers.postTravel(request(idempotencyKey, "old-map-place"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "UNKNOWN_LANDMARK" } });
  });
});
