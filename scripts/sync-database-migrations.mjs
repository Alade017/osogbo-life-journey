import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { auditSupabaseLedger } from "./migration-ledger-audit.mjs";

process.loadEnvFile(".env");
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
    const pending = [];
    const mismatches = [];
    for (const entry of journal.entries) {
      const content = readFileSync(`drizzle/migrations/${entry.tag}.sql`, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      const existing = ledger.find((row) => Number(row.created_at) === entry.when);
      if (existing && existing.hash !== hash) mismatches.push(entry.tag);
      if (!existing) pending.push({ ...entry, content, hash });
    }
    if (
      ledger.some((row) => !journal.entries.some((entry) => entry.when === Number(row.created_at)))
    )
      throw new Error("Database has unknown migration history; manual review required");
    console.log(
      `Drizzle ledger: ${ledger.length} applied migrations. Pending: ${pending.map((p) => p.tag).join(", ") || "none"}`,
    );
    console.log(`Historical checksum differences: ${mismatches.join(", ") || "none"}`);
    if (!apply) {
      if (supabaseNeedsReview || pending.length || mismatches.length) process.exitCode = 1;
      return;
    }
    if (supabaseNeedsReview)
      throw new Error(
        "Review Supabase migration history first. This script does not apply or reconcile Supabase migrations.",
      );
    const reviewed =
      process.argv.includes("--accept-advertisement-history") &&
      mismatches.length === 1 &&
      mismatches[0] === "0003_billboards_advertising";
    if (mismatches.length && !reviewed)
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
    for (const migration of pending) {
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
