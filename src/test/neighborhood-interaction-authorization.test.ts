import { describe, expect, it } from "vitest";
import {
  createNeighborhoodInteractionAuthorization,
  verifyNeighborhoodInteractionAuthorization,
} from "../../multiplayer/interaction-authorization.ts";
import { requestNeighborhoodInteractionAuthorization } from "@/lib/multiplayer-service";

const secret = "test-only-secret-with-at-least-32-bytes";
const claims = {
  userId: "11111111-1111-4111-8111-111111111111",
  characterId: "22222222-2222-4222-8222-222222222222",
  locationId: "33333333-3333-4333-8333-333333333333",
  landmarkId: "cedar-bank",
  actionId: "cedar-budgeting",
  requestId: "44444444-4444-4444-8444-444444444444",
  roomSessionId: "colyseus-session-123",
};

describe("neighborhood interaction authorization client bridge", () => {
  function makeRoom() {
    const listeners = new Map<string, (payload: unknown) => void>();
    const sent: Array<{ type: string; payload: unknown }> = [];
    const leaveHandlers: Array<() => void> = [];
    const room = {
      onMessage: (type: string, callback: (payload: unknown) => void) => listeners.set(type, callback),
      onLeave: (callback: () => void) => leaveHandlers.push(callback),
      send: (type: string, payload: unknown) => sent.push({ type, payload }),
    };
    return { room: room as never, listeners, sent, leave: () => leaveHandlers.forEach((handler) => handler()) };
  }

  it("accepts only an authorization matching the pending landmark and action", async () => {
    const { room, listeners, sent } = makeRoom();
    const pending = requestNeighborhoodInteractionAuthorization(room, {
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
    });
    expect(sent).toHaveLength(1);
    listeners.get("interaction-authorization")?.({
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
      token: "signed-token",
      expiresAt: Date.now() + 10_000,
    });
    await expect(pending).resolves.toMatchObject({
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
    });
  });

  it("rejects pending authorization immediately when the room disconnects", async () => {
    const { room, leave } = makeRoom();
    const pending = requestNeighborhoodInteractionAuthorization(room, {
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
    });
    leave();
    await expect(pending).rejects.toThrow("NEIGHBORHOOD_DISCONNECTED");
  });

  it("rejects new authorization requests after the room has disconnected", async () => {
    const { room, leave, sent } = makeRoom();
    const pending = requestNeighborhoodInteractionAuthorization(room, {
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
    });
    leave();
    await expect(pending).rejects.toThrow("NEIGHBORHOOD_DISCONNECTED");
    await expect(
      requestNeighborhoodInteractionAuthorization(room, {
        requestId: "55555555-5555-4555-8555-555555555555",
        landmarkId: claims.landmarkId,
        actionId: claims.actionId,
      }),
    ).rejects.toThrow("NEIGHBORHOOD_DISCONNECTED");
    expect(sent).toHaveLength(1);
  });

  it("rejects a response for a different landmark or action", async () => {
    const { room, listeners } = makeRoom();
    const pending = requestNeighborhoodInteractionAuthorization(room, {
      requestId: claims.requestId,
      landmarkId: claims.landmarkId,
      actionId: claims.actionId,
    });
    listeners.get("interaction-authorization")?.({
      requestId: claims.requestId,
      landmarkId: "different-landmark",
      actionId: claims.actionId,
      token: "signed-token",
      expiresAt: Date.now() + 10_000,
    });
    await expect(pending).rejects.toThrow("INTERACTION_AUTH_INVALID");
  });
});

describe("neighborhood interaction authorization", () => {
  it("signs short-lived request-bound authorization claims", () => {
    const now = 1_800_000_000_000;
    const signed = createNeighborhoodInteractionAuthorization(claims, secret, now);
    const verified = verifyNeighborhoodInteractionAuthorization(
      signed.token,
      claims,
      secret,
      now + 1_000,
    );
    expect(verified).toMatchObject({
      ...claims,
      issuedAt: Math.floor(now / 1000),
      expiresAt: Math.floor(now / 1000) + 20,
    });
    expect(signed.expiresAt).toBe((Math.floor(now / 1000) + 20) * 1000);
  });

  it("rejects tampered tokens and mismatched request IDs", () => {
    const signed = createNeighborhoodInteractionAuthorization(claims, secret, 1_800_000_000_000);
    expect(() =>
      verifyNeighborhoodInteractionAuthorization(
        `${signed.token.slice(0, -1)}x`,
        claims,
        secret,
        1_800_000_001_000,
      ),
    ).toThrow("INTERACTION_AUTH_INVALID");
    expect(() =>
      verifyNeighborhoodInteractionAuthorization(
        signed.token,
        { ...claims, requestId: "55555555-5555-4555-8555-555555555555" },
        secret,
        1_800_000_001_000,
      ),
    ).toThrow("INTERACTION_AUTH_INVALID");
  });

  it("rejects expired tokens and undersized secrets", () => {
    const signed = createNeighborhoodInteractionAuthorization(claims, secret, 1_800_000_000_000);
    expect(() =>
      verifyNeighborhoodInteractionAuthorization(
        signed.token,
        claims,
        secret,
        1_800_000_021_000,
      ),
    ).toThrow("INTERACTION_AUTH_EXPIRED");
    expect(() =>
      createNeighborhoodInteractionAuthorization(claims, "too-short", 1_800_000_000_000),
    ).toThrow("INTERACTION_AUTH_NOT_CONFIGURED");
  });
});
