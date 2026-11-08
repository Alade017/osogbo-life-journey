import { describe, expect, it } from "vitest";
import {
  createNeighborhoodInteractionAuthorization,
  verifyNeighborhoodInteractionAuthorization,
} from "../../multiplayer/interaction-authorization.ts";

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
