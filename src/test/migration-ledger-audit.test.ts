// @vitest-environment node
import { describe, expect, it } from "vitest";
import { auditSupabaseLedger } from "../../scripts/migration-ledger-audit.mjs";

describe("Supabase migration ledger audit", () => {
  it("matches both legacy twelve-digit and current fourteen-digit versions", () => {
    expect(
      auditSupabaseLedger(
        ["202610170001_initial.sql", "20261103110815_history.sql"],
        [{ version: "202610170001" }, { version: "20261103110815" }],
      ),
    ).toEqual({ applied: 2, pending: [], unknown: [], issues: [] });
  });
  it("detects missing Supabase migrations independently of a healthy Drizzle ledger", () => {
    expect(auditSupabaseLedger(["20261103110815_history.sql"], []).pending).toEqual([
      "20261103110815_history.sql",
    ]);
  });
  it("reports unknown database history without attempting to repair it", () => {
    expect(auditSupabaseLedger([], [{ version: "20261103110815" }]).unknown).toEqual([
      "20261103110815",
    ]);
  });
  it("rejects duplicate versions, malformed filenames and a missing ledger", () => {
    expect(
      auditSupabaseLedger(
        ["20261103110815_first.sql", "20261103110815_second.sql", "bad.sql"],
        [],
        false,
      ).issues,
    ).toHaveLength(3);
  });
});
