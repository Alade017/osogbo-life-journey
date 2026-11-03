/** Compare Supabase versions independently of the Drizzle timestamp/hash ledger. */
export function auditSupabaseLedger(files, rows, ledgerPresent = true) {
  const versions = new Map();
  const issues = [];
  for (const file of files.filter((file) => file.endsWith(".sql"))) {
    const match = /^(\d{12,14})_(.+)\.sql$/.exec(file);
    if (!match) {
      issues.push(`Invalid Supabase migration filename: ${file}`);
      continue;
    }
    if (versions.has(match[1])) issues.push(`Duplicate Supabase version: ${match[1]}`);
    versions.set(match[1], file);
  }
  if (!ledgerPresent) issues.push("Supabase migration ledger is missing");
  const applied = new Set(rows.map((row) => String(row.version)));
  const unknown = [...applied].filter((version) => !versions.has(version)).sort();
  const pending = [...versions]
    .filter(([version]) => !applied.has(version))
    .map(([, file]) => file)
    .sort();
  return { applied: applied.size, pending, unknown, issues };
}
