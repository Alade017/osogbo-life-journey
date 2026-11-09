import { describe, expect, it, vi } from "vitest";
import { createNeighborhoodPlaceActionHandler } from "@/lib/neighborhood-place-action.server";
import { createNeighborhoodInteractionAuthorization } from "../../multiplayer/interaction-authorization.ts";

const secret = "test-only-secret-with-at-least-32-bytes";
const requestId = "44444444-4444-4444-8444-444444444444";
const claims = {
  userId: "11111111-1111-4111-8111-111111111111",
  characterId: "22222222-2222-4222-8222-222222222222",
  locationId: "33333333-3333-4333-8333-333333333333",
  landmarkId: "cedar-bank",
  actionId: "cedar-budgeting",
  requestId,
  roomSessionId: "colyseus-session-123",
};

function signedToken() {
  return createNeighborhoodInteractionAuthorization(claims, secret, Date.now()).token;
}

function makeHandler(overrides: Record<string, unknown> = {}) {
  const dependencies = {
    authenticate: vi.fn(async () => claims.userId),
    verifyCharacter: vi.fn(async () => ({ isAdult: true })),
    verifyLandmarkAction: vi.fn(async () => {}),
    perform: vi.fn(async () => ({ action_id: claims.actionId })),
    logAgeCheck: vi.fn(async () => {}),
    secret: () => secret,
    ...overrides,
  };
  return { handler: createNeighborhoodPlaceActionHandler(dependencies as never), dependencies };
}

function makeRequest(token: string, body: unknown = {
  landmarkId: claims.landmarkId,
  actionId: claims.actionId,
}) {
  return new Request("https://game.example/api/neighborhood/action", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
      "X-Neighborhood-Authorization": token,
    },
    body: JSON.stringify(body),
  });
}

describe("neighborhood place action endpoint", () => {
  it("requires a valid room authorization and invokes the existing authoritative action", async () => {
    const { handler, dependencies } = makeHandler();
    const response = await handler(makeRequest(signedToken()));
    expect(response.status).toBe(200);
    expect(dependencies.verifyCharacter).toHaveBeenCalledWith(
      claims.userId, claims.characterId, claims.locationId,
    );
    expect(dependencies.verifyLandmarkAction).toHaveBeenCalledWith(
      claims.userId, claims.landmarkId, claims.actionId, true,
    );
    expect(dependencies.perform).toHaveBeenCalledWith(
      claims.userId,
      claims.landmarkId,
      claims.actionId,
      requestId,
      claims.characterId,
    );
  });

  it("rejects missing or mismatched authorization without performing an action", async () => {
    const { handler, dependencies } = makeHandler();
    const response = await handler(makeRequest("invalid-token"));
    expect(response.status).toBe(403);
    expect(dependencies.perform).not.toHaveBeenCalled();
  });

  it("rejects changed character location before action execution", async () => {
    const { handler, dependencies } = makeHandler({
      verifyCharacter: vi.fn(async () => { throw new Error("CHARACTER_LOCATION_CHANGED"); }),
    });
    const response = await handler(makeRequest(signedToken()));
    expect(response.status).toBe(409);
    expect(dependencies.perform).not.toHaveBeenCalled();
  });

  it("rejects an underage character before checking or executing an adult venue action", async () => {
    const { handler, dependencies } = makeHandler({
      verifyCharacter: vi.fn(async () => ({ isAdult: false })),
      verifyLandmarkAction: vi.fn(async (_userId, _landmarkId, _actionId, isAdult) => {
        if (!isAdult) throw new Error("AGE_RESTRICTED");
      }),
    });
    const response = await handler(makeRequest(signedToken()));
    expect(response.status).toBe(403);
    expect(dependencies.logAgeCheck).toHaveBeenCalledWith(claims.userId, claims.landmarkId);
    expect(dependencies.perform).not.toHaveBeenCalled();
  });

  it("records an age restriction without allowing the action to run", async () => {
    const { handler, dependencies } = makeHandler({
      verifyLandmarkAction: vi.fn(async () => { throw new Error("AGE_RESTRICTED"); }),
    });
    const response = await handler(makeRequest(signedToken()));
    expect(response.status).toBe(403);
    expect(dependencies.logAgeCheck).toHaveBeenCalledWith(claims.userId, claims.landmarkId);
    expect(dependencies.perform).not.toHaveBeenCalled();
  });

  it("rejects an action absent from the database allow-list", async () => {
    const { handler, dependencies } = makeHandler({
      verifyLandmarkAction: vi.fn(async () => { throw new Error("UNKNOWN_ACTION"); }),
    });
    const response = await handler(makeRequest(signedToken()));
    expect(response.status).toBe(404);
    expect(dependencies.perform).not.toHaveBeenCalled();
  });
});
