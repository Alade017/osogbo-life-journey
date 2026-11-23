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
    actualHash: string;
    createdAt: number;
  }>;
  timestampWarnings: Array<{
    tag: string;
    expectedTimestamp: number;
    actualTimestamp: number;
    hash: string;
  }>;
  unknown: any[];
  issues: string[];
};
