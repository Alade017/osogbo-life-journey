import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
const migrations = [
  ["0055_unified_property_housing", 1791940000019],
  ["0056_housing_accessories_and_rent_relief", 1791940000020],
  ["0057_reconcile_housing_accessories_and_rent_relief", 1791940000021],
].map(([tag, createdAt]) => {
  const content = readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  return { tag, createdAt, content, hash: createHash("sha256").update(content).digest("hex") };
});

if (!url) throw new Error("DATABASE_URL is missing");
const sql = postgres(url, { max: 1, connect_timeout: 15 });

try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osun-life-housing-reconciliation',0))`;
    const [state] = await tx`
      select
        to_regclass('public.game_properties') is not null as game_properties,
        to_regclass('public.player_properties') is not null as player_properties,
        to_regclass('public.property_rent_cycles') is not null as rent_cycles,
        to_regclass('public.player_home_accessory_sets') is not null as accessory_sets,
        to_regclass('public.player_side_hustles') is not null as side_hustles,
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='game_properties' and column_name='house_type_id') as house_type_link,
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='house_types' and column_name='starter_accessories') as starter_accessories
    `;
    if (!Object.values(state).every(Boolean)) {
      throw new Error(
        "Housing schema prerequisites are incomplete; reconciliation was not applied.",
      );
    }

    await tx.unsafe(migrations[2].content);

    for (const migration of migrations) {
      const [existing] = await tx`
        select hash from drizzle.__drizzle_migrations where created_at=${migration.createdAt}
      `;
      if (existing && existing.hash !== migration.hash) {
        throw new Error(`Migration ledger checksum differs for ${migration.tag}.`);
      }
      if (!existing) {
        await tx`
          insert into drizzle.__drizzle_migrations(hash,created_at)
          values(${migration.hash},${migration.createdAt})
        `;
      }
    }
    await tx`notify pgrst, 'reload schema'`;
  });
  console.log("Housing migrations reconciled and schema reload requested.");
} catch (error) {
  const message = String(error.message ?? error).replaceAll(url, "[redacted connection]");
  console.error(`Housing migration reconciliation was not committed: ${message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
