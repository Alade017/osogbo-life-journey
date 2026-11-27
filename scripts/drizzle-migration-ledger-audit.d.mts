export function auditDrizzleLedger(
  journalEntries: unknown,
  databaseRows: unknown,
): {
  applied: number;
  appliedMigrations: string[];
  pending: any[];
  mismatches: Array<{
    tag: string;
    expectedHash: string;
    acceptedHashes: string[];
    actualHash: string;
    createdAt: number;
  }>;
  timestampWarnings: Array<{
    tag: string;
    expectedTimestamp: number;
    actualTimestamp: number;
    hash: string;
  }>;
  checksumMatches: Array<{
    tag: string;
    hash: string;
    checksumType: "raw" | "lf-normalized" | "identical" | "unspecified" | "unrecognized";
    timestampMatch: "exact" | "fallback";
  }>;
  unknown: any[];
  issues: string[];
};
