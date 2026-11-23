// Types for the plain-JS migration audits, so TypeScript tests can import them.
export function auditSupabaseLedger(files: unknown, rows: unknown, ledgerPresent?: boolean): any;
export function auditDrizzleLedger(journalEntries: unknown, databaseRows: unknown): {
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
