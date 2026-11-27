// @vitest-environment node
import { describe, expect, it } from "vitest";
import { auditDrizzleLedger } from "../../scripts/drizzle-migration-ledger-audit.mjs";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const migration = (overrides = {}) => ({
  tag: "0091_mini_game_hardening",
  when: 1794463201000,
  hash: hashA,
  ...overrides,
});
const row = (overrides = {}) => ({
  created_at: 1794463201000,
  hash: hashA,
  ...overrides,
});

describe("Drizzle migration ledger audit", () => {
  it("recognizes an exact timestamp and checksum match", () => {
    const result = auditDrizzleLedger([migration()], [row()]);
    expect(result.applied).toBe(1);
    expect(result.appliedMigrations).toEqual(["0091_mini_game_hardening"]);
    expect(result.pending).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("recognizes a unique checksum when the production timestamp differs", () => {
    const result = auditDrizzleLedger([migration()], [row({ created_at: 1794463200001 })]);
    expect(result.applied).toBe(1);
    expect(result.pending).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.timestampWarnings).toEqual([
      {
        tag: "0091_mini_game_hardening",
        expectedTimestamp: 1794463201000,
        actualTimestamp: 1794463200001,
        hash: hashA,
      },
    ]);
  });

  it("does not replay a migration when its timestamp matches but checksum differs", () => {
    const result = auditDrizzleLedger([migration()], [row({ hash: hashB })]);
    expect(result.applied).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.mismatches).toHaveLength(1);
    expect(result.unknown).toEqual([]);
  });

  it("rejects duplicate production timestamps", () => {
    const result = auditDrizzleLedger([migration()], [row(), row({ hash: hashB })]);
    expect(result.issues).toContain("Duplicate Drizzle database timestamp: 1794463201000");
    expect(result.applied).toBe(0);
    expect(result.unknown).toHaveLength(2);
  });

  it("rejects duplicate production checksums as ambiguous", () => {
    const result = auditDrizzleLedger(
      [migration()],
      [row({ created_at: 1794463200001 }), row({ created_at: 1794463200002 })],
    );
    expect(result.issues).toContain(`Duplicate Drizzle database checksum: ${hashA}`);
    expect(result.applied).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.unknown).toHaveLength(2);
  });

  it("keeps a genuinely unapplied migration pending", () => {
    const result = auditDrizzleLedger([migration()], []);
    expect(result.pending.map((entry) => entry.tag)).toEqual(["0091_mini_game_hardening"]);
    expect(result.unknown).toEqual([]);
  });

  it("reports unexplained production rows as unknown", () => {
    const result = auditDrizzleLedger([], [row()]);
    expect(result.unknown).toHaveLength(1);
  });

  it("rejects duplicate journal timestamps and checksums", () => {
    const result = auditDrizzleLedger(
      [migration(), migration({ tag: "0092_another_migration" })],
      [],
    );
    expect(result.issues).toContain("Duplicate Drizzle journal timestamp: 1794463201000");
    expect(result.issues).toContain(`Duplicate Drizzle journal checksum: ${hashA}`);
  });

  it("accepts the raw file checksum when it matches the exact production timestamp", () => {
    const result = auditDrizzleLedger(
      [migration({ acceptedHashes: [hashA, hashB] })],
      [row({ hash: hashB })],
    );
    expect(result.applied).toBe(1);
    expect(result.pending).toEqual([]);
    expect(result.mismatches).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it("accepts a unique raw checksum when the production timestamp differs", () => {
    const result = auditDrizzleLedger(
      [migration({ acceptedHashes: [hashA, hashB] })],
      [row({ created_at: 1794463200001, hash: hashB })],
    );
    expect(result.applied).toBe(1);
    expect(result.pending).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.timestampWarnings).toHaveLength(1);
    expect(result.timestampWarnings[0]?.hash).toBe(hashB);
  });

  it("reports a genuine mismatch when neither accepted checksum matches", () => {
    const result = auditDrizzleLedger(
      [migration({ acceptedHashes: [hashA, hashB] })],
      [row({ hash: hashC })],
    );
    expect(result.applied).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.mismatches).toEqual([
      {
        tag: "0091_mini_game_hardening",
        expectedHash: hashA,
        acceptedHashes: [hashA, hashB],
        actualHash: hashC,
        createdAt: 1794463201000,
      },
    ]);
  });

  it("fails closed when raw and normalized aliases match different production rows", () => {
    const result = auditDrizzleLedger(
      [migration({ acceptedHashes: [hashA, hashB] })],
      [
        row({ created_at: 1794463200001, hash: hashA }),
        row({ created_at: 1794463200002, hash: hashB }),
      ],
    );
    expect(result.applied).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.timestampWarnings).toEqual([]);
    expect(result.unknown).toHaveLength(2);
  });

  it("reports an explicit raw checksum match at the exact timestamp", () => {
    const result = auditDrizzleLedger(
      [migration({
        acceptedHashes: [hashA, hashB],
        checksumHashes: { raw: hashB, lfNormalized: hashA },
      })],
      [row({ hash: hashB })],
    );
    expect(result.checksumMatches).toEqual([
      {
        tag: "0091_mini_game_hardening",
        hash: hashB,
        checksumType: "raw",
        timestampMatch: "exact",
      },
    ]);
  });

  it("reports an explicit LF-normalized checksum match at the exact timestamp", () => {
    const result = auditDrizzleLedger(
      [migration({
        acceptedHashes: [hashA, hashB],
        checksumHashes: { raw: hashB, lfNormalized: hashA },
      })],
      [row({ hash: hashA })],
    );
    expect(result.checksumMatches).toEqual([
      {
        tag: "0091_mini_game_hardening",
        hash: hashA,
        checksumType: "lf-normalized",
        timestampMatch: "exact",
      },
    ]);
  });

  it("reports checksum representation separately from timestamp fallback", () => {
    const result = auditDrizzleLedger(
      [migration({
        acceptedHashes: [hashA, hashB],
        checksumHashes: { raw: hashB, lfNormalized: hashA },
      })],
      [row({ created_at: 1794463200001, hash: hashB })],
    );
    expect(result.checksumMatches).toEqual([
      {
        tag: "0091_mini_game_hardening",
        hash: hashB,
        checksumType: "raw",
        timestampMatch: "fallback",
      },
    ]);
    expect(result.timestampWarnings).toHaveLength(1);
  });

  it("does not guess checksum representation when explicit metadata is absent", () => {
    const result = auditDrizzleLedger(
      [migration({ acceptedHashes: [hashA, hashB] })],
      [row({ hash: hashB })],
    );
    expect(result.checksumMatches[0]?.checksumType).toBe("unspecified");
  });

});
