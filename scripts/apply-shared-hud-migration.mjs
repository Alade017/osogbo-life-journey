import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Set DATABASE_URL to the development database migration connection before applying this migration.",
  );
  process.exit(1);
}
const migration = readFileSync(
  new URL("../drizzle/migrations/0024_shared_hud_simulation.sql", import.meta.url),
  "utf8",
);
const hash = createHash("sha256").update(migration).digest("hex");
let sql;
try {
  sql = postgres(url, { max: 1, connect_timeout: 15 });
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osogbo-shared-hud-migration',0))`;
    const [state] = await tx`select to_regclass('public.character_simulations') as applied,
      to_regprocedure('public.travel_to_location(uuid,text)') as prerequisite`;
    if (!state.prerequisite)
      throw new Error("Apply migrations through 0023 before this migration.");
    if (state.applied)
      throw new Error(
        "Simulation tables already exist. Verify the existing migration instead of applying it twice.",
      );
    await tx.unsafe(migration);
    const [ledger] = await tx`select to_regclass('drizzle.__drizzle_migrations') as table_name`;
    if (ledger.table_name)
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${hash},1791594000003)`;
    await tx`notify pgrst, 'reload schema'`;
  });
  console.log("Shared HUD migration applied and committed. Supabase schema reload requested.");
} catch (error) {
  const message =
    error.code === "ERR_INVALID_URL"
      ? "DATABASE_URL is invalid. URL-encode the database password."
      : String(error.message).replaceAll(url, "[redacted connection]");
  console.error(`Migration was not committed: ${message}`);
  process.exitCode = 1;
} finally {
  await sql?.end();
}
