// @vitest-environment node
import { describe, expect, it } from "vitest";
import { auditDrizzleLedger } from "../../scripts/drizzle-migration-ledger-audit.mjs";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
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
});
