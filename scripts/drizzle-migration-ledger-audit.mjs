/**
 * Reconcile Drizzle's timestamp/hash ledger without changing database history.
 *
 * Exact timestamps are authoritative when present. A unique checksum can
 * identify an already-applied migration when its timestamp differs, but the
 * discrepancy is surfaced for review. Raw and LF-normalized checksums are
 * accepted for compatibility with historical line-ending differences.
 * Ambiguous identities fail closed.
 */
export function auditDrizzleLedger(journalEntries, databaseRows) {
  const issues = [];
  const appliedMigrations = [];
  const pending = [];
  const mismatches = [];
  const timestampWarnings = [];
  const checksumMatches = [];
  const consumedRows = new Set();

  if (!Array.isArray(journalEntries) || !Array.isArray(databaseRows)) {
    return {
      applied: 0,
      appliedMigrations,
      pending,
      mismatches,
      timestampWarnings,
      checksumMatches,
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
    const acceptedHashes = Array.isArray(entry?.acceptedHashes) ? entry.acceptedHashes : [];
    const hashes = [
      ...new Set(
        [entry?.hash, ...acceptedHashes]
          .map((value) => String(value ?? "").toLowerCase())
          .filter((value) => /^[a-f0-9]{64}$/.test(value)),
      ),
    ];
    const legacyHashes = Array.isArray(entry?.legacyHashes)
      ? entry.legacyHashes.map((value) => String(value ?? "").toLowerCase())
      : [];
    const legacyHashesValid = legacyHashes.every((value) => /^[a-f0-9]{64}$/.test(value));
    const rawHash = String(entry?.checksumHashes?.raw ?? "").toLowerCase();
    const lfNormalizedHash = String(entry?.checksumHashes?.lfNormalized ?? "").toLowerCase();
    const checksumMetadataValid =
      !entry?.checksumHashes ||
      (/^[a-f0-9]{64}$/.test(rawHash) && /^[a-f0-9]{64}$/.test(lfNormalizedHash));

    if (
      !entry ||
      typeof entry.tag !== "string" ||
      !Number.isSafeInteger(Number(entry.when)) ||
      !/^[a-f0-9]{64}$/i.test(String(entry.hash ?? "")) ||
      hashes.length === 0 ||
      !legacyHashesValid ||
      !checksumMetadataValid
    ) {
      issues.push(`Invalid Drizzle journal migration entry: ${entry?.tag ?? "unknown"}`);
      continue;
    }

    const normalized = {
      ...entry,
      when: Number(entry.when),
      hash: String(entry.hash).toLowerCase(),
      acceptedHashes: hashes,
      legacyHashes,
      checksumHashes: entry.checksumHashes
        ? { raw: rawHash, lfNormalized: lfNormalizedHash }
        : null,
    };
    validEntries.push(normalized);
    addToIndex(journalTimestamps, normalized.when, normalized);
    for (const hash of normalized.acceptedHashes) addToIndex(journalHashes, hash, normalized);
  }

  for (const row of databaseRows) {
    const timestamp = Number(row?.created_at);
    const hash = String(row?.hash ?? "").toLowerCase();
    if (!Number.isSafeInteger(timestamp) || !/^[a-f0-9]{64}$/.test(hash)) {
      issues.push(
        `Invalid Drizzle database ledger row at timestamp ${row?.created_at ?? "unknown"}`,
      );
      continue;
    }
    const normalized = { ...row, created_at: timestamp, hash };
    validRows.push(normalized);
    addToIndex(databaseTimestamps, timestamp, normalized);
    addToIndex(databaseHashes, hash, normalized);
  }

  for (const [timestamp, entries] of journalTimestamps) {
    if (entries.length > 1) issues.push(`Duplicate Drizzle journal timestamp: ${timestamp}`);
  }
  for (const [hash, entries] of journalHashes) {
    if (new Set(entries).size > 1) issues.push(`Duplicate Drizzle journal checksum: ${hash}`);
  }
  for (const [timestamp, rows] of databaseTimestamps) {
    if (rows.length > 1) issues.push(`Duplicate Drizzle database timestamp: ${timestamp}`);
  }
  for (const [hash, rows] of databaseHashes) {
    if (rows.length > 1) issues.push(`Duplicate Drizzle database checksum: ${hash}`);
  }

  const getChecksumType = (entry, hash) => {
    if (entry.legacyHashes.includes(hash)) return "legacy-verified";
    if (!entry.checksumHashes) return "unspecified";
    if (entry.checksumHashes.raw === entry.checksumHashes.lfNormalized) {
      return hash === entry.checksumHashes.raw ? "identical" : "unrecognized";
    }
    if (hash === entry.checksumHashes.raw) return "raw";
    if (hash === entry.checksumHashes.lfNormalized) return "lf-normalized";
    return "unrecognized";
  };

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
      if (entry.acceptedHashes.includes(row.hash)) {
        appliedMigrations.push(entry.tag);
        checksumMatches.push({
          tag: entry.tag,
          hash: row.hash,
          checksumType: getChecksumType(entry, row.hash),
          timestampMatch: "exact",
        });
      } else {
        mismatches.push({
          tag: entry.tag,
          expectedHash: entry.hash,
          acceptedHashes: entry.acceptedHashes,
          actualHash: row.hash,
          createdAt: row.created_at,
        });
      }
      continue;
    }

    // Union aliases before matching so one database row cannot be counted twice.
    const candidateRows = new Set();
    for (const hash of entry.acceptedHashes) {
      for (const row of databaseHashes.get(hash) ?? []) {
        if (!consumedRows.has(row)) candidateRows.add(row);
      }
    }
    if (candidateRows.size === 0) {
      pending.push(entry);
      continue;
    }
    if (candidateRows.size > 1) {
      issues.push(`Ambiguous Drizzle checksum match for ${entry.tag}: multiple database rows`);
      continue;
    }
    if (candidateRows.size !== 1) continue;

    const row = [...candidateRows][0];
    const matchingJournalEntries = journalHashes.get(row.hash) ?? [];
    if (new Set(matchingJournalEntries).size !== 1 || matchingJournalEntries[0] !== entry) {
      continue;
    }

    consumedRows.add(row);
    appliedMigrations.push(entry.tag);
    checksumMatches.push({
      tag: entry.tag,
      hash: row.hash,
      checksumType: getChecksumType(entry, row.hash),
      timestampMatch: "fallback",
    });
    timestampWarnings.push({
      tag: entry.tag,
      expectedTimestamp: entry.when,
      actualTimestamp: row.created_at,
      hash: row.hash,
    });
  }

  const unknown = validRows.filter((row) => !consumedRows.has(row));

  return {
    applied: appliedMigrations.length,
    appliedMigrations,
    pending,
    mismatches,
    timestampWarnings,
    checksumMatches,
    unknown,
    issues,
  };
}
