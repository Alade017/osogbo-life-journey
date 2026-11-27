import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { auditSupabaseLedger } from "./migration-ledger-audit.mjs";
import { auditDrizzleLedger } from "./drizzle-migration-ledger-audit.mjs";
import { getVerifiedLegacyChecksumHashes } from "./drizzle-legacy-checksum-aliases.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
let sql;
try {
  if (!url) throw new Error("DATABASE_URL is missing");
  sql = postgres(url, { max: 1, connect_timeout: 15 });
  await sql.begin(async (tx) => {
    const apply = process.argv.includes("--apply");
    if (apply)
      await tx`select pg_advisory_xact_lock(hashtextextended('osogbo-shared-hud-migration',0))`;
    else await tx`set transaction read only`;
    const [supabaseLedger] =
      await tx`select to_regclass('supabase_migrations.schema_migrations') is not null as present`;
    const supabaseRows = supabaseLedger.present
      ? await tx`select version from supabase_migrations.schema_migrations order by version`
      : [];
    const supabaseAudit = auditSupabaseLedger(
      readdirSync("supabase/migrations"),
      supabaseRows,
      supabaseLedger.present,
    );
    console.log(
      `Supabase ledger: ${supabaseAudit.applied} applied versions. Pending: ${supabaseAudit.pending.join(", ") || "none"}`,
    );
    console.log(`Unknown Supabase versions: ${supabaseAudit.unknown.join(", ") || "none"}`);
    for (const issue of supabaseAudit.issues) console.error(issue);
    const supabaseNeedsReview =
      supabaseAudit.pending.length > 0 ||
      supabaseAudit.unknown.length > 0 ||
      supabaseAudit.issues.length > 0;

    const ledger =
      await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    const journalMigrations = journal.entries.map((entry) => {
      const filePath = `drizzle/migrations/${entry.tag}.sql`;
      const rawContent = readFileSync(filePath, "utf8");
      const content = rawContent.replace(/\r\n?/g, "\n");
      const rawHash = createHash("sha256").update(rawContent, "utf8").digest("hex");
      const hash = createHash("sha256").update(content, "utf8").digest("hex");
      const legacyHashes = getVerifiedLegacyChecksumHashes(entry.tag, hash);
      return {
        ...entry,
        content,
        hash,
        rawHash,
        checksumHashes: { raw: rawHash, lfNormalized: hash },
        legacyHashes,
        acceptedHashes: [...new Set([rawHash, hash, ...legacyHashes])],
      };
    });
    const drizzleAudit = auditDrizzleLedger(journalMigrations, ledger);
    const mismatchTags = drizzleAudit.mismatches.map((mismatch) => mismatch.tag);

    console.log(
      `Drizzle ledger: ${drizzleAudit.applied} applied migrations. Pending: ${drizzleAudit.pending.map((entry) => entry.tag).join(", ") || "none"}`,
    );
    console.log(`Historical checksum differences: ${mismatchTags.join(", ") || "none"}`);
    for (const match of drizzleAudit.checksumMatches) {
      console.log(
        `Drizzle checksum match for ${match.tag}: ${match.checksumType}; timestamp=${match.timestampMatch}; hash=${match.hash}`,
      );
    }
    for (const warning of drizzleAudit.timestampWarnings) {
      console.warn(
        `Drizzle timestamp discrepancy for ${warning.tag}: journal=${warning.expectedTimestamp}, database=${warning.actualTimestamp}. Unique checksum confirms this migration is already applied; no ledger rewrite is performed.`,
      );
    }
    for (const mismatch of drizzleAudit.mismatches) {
      console.error(
        `Drizzle checksum mismatch for ${mismatch.tag} at ${mismatch.createdAt}: expected ${mismatch.expectedHash}, accepted ${mismatch.acceptedHashes.join(" or ")}, found ${mismatch.actualHash}`,
      );
    }
    for (const issue of drizzleAudit.issues) console.error(issue);
    if (drizzleAudit.unknown.length) {
      console.error(
        `Unknown Drizzle database rows: ${drizzleAudit.unknown.map((row) => row.created_at).join(", ")}`,
      );
    }

    const drizzleNeedsReview =
      drizzleAudit.issues.length > 0 ||
      drizzleAudit.unknown.length > 0 ||
      drizzleAudit.mismatches.length > 0;

    if (!apply) {
      if (supabaseNeedsReview || drizzleNeedsReview || drizzleAudit.pending.length)
        process.exitCode = 1;
      return;
    }
    if (supabaseNeedsReview)
      throw new Error(
        "Review Supabase migration history first. This script does not apply or reconcile Supabase migrations.",
      );
    if (drizzleAudit.issues.length || drizzleAudit.unknown.length)
      throw new Error(
        "Drizzle migration ledger is ambiguous or contains unknown history; manual review required",
      );

    const reviewed =
      process.argv.includes("--accept-advertisement-history") &&
      mismatchTags.length === 1 &&
      mismatchTags[0] === "0003_billboards_advertising";
    if (mismatchTags.length && !reviewed)
      throw new Error("Historical migration checksums differ; review before applying updates");
    if (reviewed) {
      const [fn] =
        await tx`select prosrc,prosecdef from pg_proc where oid='public.is_advertisement_admin()'::regprocedure`;
      if (
        !fn.prosecdef ||
        fn.prosrc.trim().replace(/\s+/g, " ") !==
          "select exists (select 1 from public.advertisement_admins where user_id = auth.uid())"
      )
        throw new Error(
          "Live advertisement administrator function differs from reviewed definition",
        );
      console.log(
        "Preserving reviewed advertisement migration history; it will not be replayed or rewritten.",
      );
    }
    for (const migration of drizzleAudit.pending) {
      await tx.unsafe(migration.content);
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.when})`;
      console.log(`Applied ${migration.tag} within transaction`);
    }
    await tx`notify pgrst, 'reload schema'`;
  });
  console.log(
    process.argv.includes("--apply")
      ? "Database transaction committed. Schema reload requested."
      : process.exitCode
        ? "Read-only migration check completed; review the reported differences. No changes made."
        : "Read-only migration check passed for both ledgers.",
  );
} catch (error) {
  console.error(
    error.code === "ERR_INVALID_URL"
      ? "Invalid DATABASE_URL"
      : String(error.message).replaceAll(url || "[unset]", "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await sql?.end();
}
