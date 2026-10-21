import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

process.loadEnvFile(".env");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const tags = ["0066_house_essential_fixtures", "0067_starter_seat_activity_key"];
const migrations = tags.map((tag) => {
  const entry = journal.entries.find((candidate) => candidate.tag === tag);
  if (!entry) throw new Error(`Missing journal entry for ${tag}`);
  const content = readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  return {
    tag,
    when: entry.when,
    content,
    hash: createHash("sha256").update(content).digest("hex"),
  };
});

const connection = new URL(process.env.DATABASE_URL);
if (connection.hostname.endsWith(".pooler.supabase.com") && connection.port === "5432") {
  connection.port = "6543";
}
const sql = postgres(connection.toString(), { max: 1, connect_timeout: 15, prepare: false });

try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osogbo-house-essentials-migrations',0))`;
    const [prerequisite] = await tx`
      select hash from drizzle.__drizzle_migrations where created_at=1792350000006
    `;
    if (!prerequisite) throw new Error("Apply 0065_owned_homes_marketplace first");

    for (const migration of migrations) {
      const [existing] = await tx`
        select hash from drizzle.__drizzle_migrations where created_at=${migration.when}
      `;
      if (existing) {
        if (existing.hash !== migration.hash) {
          throw new Error(`Migration ledger checksum differs for ${migration.tag}`);
        }
        console.log(`Already applied ${migration.tag}`);
        continue;
      }
      await tx.unsafe(migration.content);
      await tx`
        insert into drizzle.__drizzle_migrations(hash,created_at)
        values(${migration.hash},${migration.when})
      `;
      console.log(`Applied ${migration.tag}`);
    }
    await tx`select pg_notify('pgrst','reload schema')`;
  });
  const ledger = await sql`
    select created_at from drizzle.__drizzle_migrations
    where created_at in (1792350000007,1792350000008)
    order by created_at
  `;
  const [seat] = await sql`
    select art_key from public.content_items where id='starter-seat'
  `;
  const [simulation] = await sql`
    select position('ci.art_key=furniture' in prosrc)>0 as uses_placed_furniture
    from pg_proc
    where oid='public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)'::regprocedure
  `;
  const [grantTrigger] = await sql`
    select count(*)::int as count from pg_trigger
    where tgname='grant_house_essentials_after_insert' and not tgisinternal
  `;
  if (
    ledger.length !== 2 ||
    seat?.art_key !== "sofa" ||
    !simulation?.uses_placed_furniture ||
    grantTrigger?.count !== 1
  ) {
    throw new Error("Housing migration verification did not match the expected schema");
  }
  console.log(
    "Verified housing migration ledger, starter seat, placement validation, and grant trigger",
  );
} catch (error) {
  console.error(`Housing migrations were not committed: ${error.code ?? error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
