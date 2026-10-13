import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";

process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
let sql;
try {
  if (!url) throw new Error("DATABASE_URL is missing");
  sql = postgres(url, { max: 1, connect_timeout: 15 });
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osogbo-shared-hud-migration',0))`;
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
      `Verified ${ledger.length} applied migrations. Pending: ${pending.map((p) => p.tag).join(", ") || "none"}`,
    );
    console.log(`Historical checksum differences: ${mismatches.join(", ") || "none"}`);
    if (!process.argv.includes("--apply")) return;
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
      : "Read-only migration check completed.",
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
