/**
 * Reconcile Drizzle's timestamp/hash ledger without changing database history.
 *
 * Exact timestamps are authoritative when present. A unique checksum can
 * identify an already-applied migration when its timestamp differs, but the
 * discrepancy is surfaced for review. Ambiguous identities fail closed.
 */
export function auditDrizzleLedger(journalEntries, databaseRows) {
  const issues = [];
  const appliedMigrations = [];
  const pending = [];
  const mismatches = [];
  const timestampWarnings = [];
  const consumedRows = new Set();

  if (!Array.isArray(journalEntries) || !Array.isArray(databaseRows)) {
    return {
      applied: 0,
      appliedMigrations,
      pending,
      mismatches,
      timestampWarnings,
      unknown: [],
      issues: ["Drizzle journal entries and database rows must be arrays"],
    };
  }

  const journalTimestamps = new Map();
  const journalHashes = new Map();
  const databaseTimestamps = new Map();
  const databaseHashes = new Map();
  const validEntries = [];
  const validRows = [];

  const addToIndex = (index, key, value) => {
    const values = index.get(key) ?? [];
    values.push(value);
    index.set(key, values);
  };

  for (const entry of journalEntries) {
    if (
      !entry ||
      typeof entry.tag !== "string" ||
      !Number.isSafeInteger(Number(entry.when)) ||
      !/^[a-f0-9]{64}$/i.test(String(entry.hash ?? ""))
    ) {
      issues.push(`Invalid Drizzle journal migration entry: ${entry?.tag ?? "unknown"}`);
      continue;
    }
    const normalized = { ...entry, when: Number(entry.when), hash: String(entry.hash).toLowerCase() };
    validEntries.push(normalized);
    addToIndex(journalTimestamps, normalized.when, normalized);
    addToIndex(journalHashes, normalized.hash, normalized);
  }

  for (const row of databaseRows) {
    const timestamp = Number(row?.created_at);
    const hash = String(row?.hash ?? "").toLowerCase();
    if (!Number.isSafeInteger(timestamp) || !/^[a-f0-9]{64}$/.test(hash)) {
      issues.push(`Invalid Drizzle database ledger row at timestamp ${row?.created_at ?? "unknown"}`);
      continue;
    }
    const normalized = { ...row, created_at: timestamp, hash };
    validRows.push(normalized);
    addToIndex(databaseTimestamps, timestamp, normalized);
    addToIndex(databaseHashes, hash, normalized);
  }

  for (const [timestamp, entries] of journalTimestamps) {
    if (entries.length > 1)
      issues.push(`Duplicate Drizzle journal timestamp: ${timestamp}`);
  }
  for (const [hash, entries] of journalHashes) {
    if (entries.length > 1)
      issues.push(`Duplicate Drizzle journal checksum: ${hash}`);
  }
  for (const [timestamp, rows] of databaseTimestamps) {
    if (rows.length > 1)
      issues.push(`Duplicate Drizzle database timestamp: ${timestamp}`);
  }
  for (const [hash, rows] of databaseHashes) {
    if (rows.length > 1)
      issues.push(`Duplicate Drizzle database checksum: ${hash}`);
  }

  for (const entry of validEntries) {
    const timestampMatches = databaseTimestamps.get(entry.when) ?? [];
    if (timestampMatches.length > 1) continue;

    if (timestampMatches.length === 1) {
      const row = timestampMatches[0];
      if (consumedRows.has(row)) {
        issues.push(`Drizzle database row matched more than once: ${entry.tag}`);
        continue;
      }
      consumedRows.add(row);
      if (row.hash === entry.hash) {
        appliedMigrations.push(entry.tag);
      } else {
        mismatches.push({
          tag: entry.tag,
          expectedHash: entry.hash,
          actualHash: row.hash,
          createdAt: row.created_at,
        });
      }
      continue;
    }

    // A checksum fallback is safe only when it is unique on both sides.
    const journalHashMatches = journalHashes.get(entry.hash) ?? [];
    const checksumMatches = (databaseHashes.get(entry.hash) ?? []).filter(
      (row) => !consumedRows.has(row),
    );
    if (journalHashMatches.length !== 1 || checksumMatches.length !== 1) {
      if (checksumMatches.length === 0) pending.push(entry);
      continue;
    }

    const row = checksumMatches[0];
    consumedRows.add(row);
    appliedMigrations.push(entry.tag);
    timestampWarnings.push({
      tag: entry.tag,
      expectedTimestamp: entry.when,
      actualTimestamp: row.created_at,
      hash: entry.hash,
    });
  }

  const unknown = validRows.filter((row) => !consumedRows.has(row));

  return {
    applied: appliedMigrations.length,
    appliedMigrations,
    pending,
    mismatches,
    timestampWarnings,
    unknown,
    issues,
  };
}
