import { describe, expect, it } from "vitest";
// The deployment script is also imported here to exercise its pure validation helpers.
// @ts-expect-error JavaScript CLI helpers do not require application type declarations.
import { auditMigrationJournal, safeEndpoint } from "../../scripts/release-readiness-check.mjs";

describe("read-only release checks", () => {
  const entry = { idx: 0, when: 1, tag: "0000_initial" };
  it("accepts registered migrations", () => {
    expect(auditMigrationJournal([entry], ["0000_initial.sql"])).toEqual([]);
  });
  it("detects missing and unregistered files", () => {
    expect(auditMigrationJournal([entry], ["0001_other.sql"])).toHaveLength(2);
  });
  it("detects duplicate tags, invalid indices and timestamps", () => {
    expect(auditMigrationJournal([entry, entry], ["0000_initial.sql"])).toHaveLength(3);
  });
  it("converts websocket hosts for HTTP probes", () => {
    expect(safeEndpoint("wss://example.com").origin).toBe("https://example.com");
  });
  it("rejects sensitive or unsupported endpoint inputs", () => {
    for (const url of [
      "https://user:password@example.com",
      "https://example.com?token=x",
      "file:///tmp/a",
    ])
      expect(() => safeEndpoint(url)).toThrow();
  });
});
