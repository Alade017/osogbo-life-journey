import { createHmac, timingSafeEqual } from "node:crypto";

export type NeighborhoodInteractionClaims = {
  userId: string;
  characterId: string;
  locationId: string;
  landmarkId: string;
  actionId: string;
  requestId: string;
  roomSessionId: string;
  issuedAt: number;
  expiresAt: number;
};

export type ExpectedNeighborhoodInteraction = Pick<
  NeighborhoodInteractionClaims,
  "userId" | "landmarkId" | "actionId" | "requestId"
>;

const TOKEN_TTL_SECONDS = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSecret(secret: string) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("INTERACTION_AUTH_NOT_CONFIGURED");
  }
}

function isClaims(value: unknown): value is NeighborhoodInteractionClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Record<string, unknown>;
  return (
    claims["v"] === 1 &&
    typeof claims["userId"] === "string" &&
    UUID_PATTERN.test(claims["userId"]) &&
    typeof claims["characterId"] === "string" &&
    UUID_PATTERN.test(claims["characterId"]) &&
    typeof claims["locationId"] === "string" &&
    UUID_PATTERN.test(claims["locationId"]) &&
    typeof claims["landmarkId"] === "string" &&
    SLUG_PATTERN.test(claims["landmarkId"]) &&
    typeof claims["actionId"] === "string" &&
    SLUG_PATTERN.test(claims["actionId"]) &&
    typeof claims["requestId"] === "string" &&
    UUID_PATTERN.test(claims["requestId"]) &&
    typeof claims["roomSessionId"] === "string" &&
    claims["roomSessionId"].length > 0 &&
    typeof claims["issuedAt"] === "number" &&
    Number.isInteger(claims["issuedAt"]) &&
    typeof claims["expiresAt"] === "number" &&
    Number.isInteger(claims["expiresAt"])
  );
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createNeighborhoodInteractionAuthorization(
  input: Omit<NeighborhoodInteractionClaims, "issuedAt" | "expiresAt">,
  secret: string,
  nowMs = Date.now(),
) {
  assertSecret(secret);
  const issuedAt = Math.floor(nowMs / 1000);
  const claims = {
    v: 1,
    ...input,
    issuedAt,
    expiresAt: issuedAt + TOKEN_TTL_SECONDS,
  };
  if (!isClaims(claims)) throw new Error("INTERACTION_AUTH_INVALID");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signed = signature(payload, secret).toString("base64url");
  return {
    token: `${payload}.${signed}`,
    expiresAt: claims.expiresAt * 1000,
  };
}

export function verifyNeighborhoodInteractionAuthorization(
  token: string,
  expected: ExpectedNeighborhoodInteraction,
  secret: string,
  nowMs = Date.now(),
): NeighborhoodInteractionClaims {
  assertSecret(secret);
  if (typeof token !== "string" || token.length > 4_096) {
    throw new Error("INTERACTION_AUTH_INVALID");
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("INTERACTION_AUTH_INVALID");
  }
  const payload = parts[0]!;
  const encodedSignature = parts[1]!;
  let supplied: Buffer;
  try {
    supplied = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new Error("INTERACTION_AUTH_INVALID");
  }
  const expectedSignature = signature(payload, secret);
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    throw new Error("INTERACTION_AUTH_INVALID");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("INTERACTION_AUTH_INVALID");
  }
  if (!isClaims(parsed)) throw new Error("INTERACTION_AUTH_INVALID");
  const now = Math.floor(nowMs / 1000);
  if (
    parsed.issuedAt > now + 5 ||
    parsed.expiresAt <= now ||
    parsed.expiresAt - parsed.issuedAt !== TOKEN_TTL_SECONDS
  ) {
    throw new Error("INTERACTION_AUTH_EXPIRED");
  }
  if (
    parsed.userId !== expected.userId ||
    parsed.landmarkId !== expected.landmarkId ||
    parsed.actionId !== expected.actionId ||
    parsed.requestId !== expected.requestId
  ) {
    throw new Error("INTERACTION_AUTH_INVALID");
  }
  return parsed;
}
