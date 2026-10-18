import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

process.loadEnvFile(".env");

const verifiedMarkers = {
  "0034_osogbo_real_places_and_map": "select exists(select 1 from public.locations where slug='osun-mall') as ok",
  "0035_fictional_world_map": "select exists(select 1 from public.locations where metadata->>'origin'='fictional') as ok",
  "0036_map_age_restrictions": "select to_regprocedure('public._assert_map_destination_age(uuid,uuid)') is not null as ok",
  "0037_map_api_travel": "select to_regclass('public.map_districts') is not null as ok",
  "0038_housing_onboarding": "select to_regclass('public.player_homes') is not null as ok",
  "0039_mission_reward_claim": "select to_regprocedure('public.claim_mission(uuid)') is not null as ok",
  "0040_weekly_housing": "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='income_band') as ok",
  "0041_server_house_inventory": "select to_regclass('public.content_items') is not null as ok",
  "0042_private_house_state_broadcast": "select to_regprocedure('public.broadcast_player_house_placement_change()') is not null as ok",
  "0044_map_place_actions": "select to_regprocedure('public.perform_map_place_action(uuid,text,text,uuid,jsonb)') is not null as ok",
  "0045_resume_personal_clock_after_logout": "select to_regprocedure('public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)') is not null as ok",
  "0046_fictional_town_map_venues": "select exists(select 1 from public.locations where slug='civic-court') as ok",
  "0047_username_accounts": "select to_regclass('public.username_accounts') is not null as ok",
  "0051_message_formatting": "select to_regprocedure('public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid,uuid)') is not null as ok",
  "0052_thread_preferences": "select to_regclass('public.thread_prefs') is not null as ok",
  "0054_dashboard_pins": "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='dashboard_pins') as ok",
};

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const migrations = journal.entries
  .filter((entry) => entry.tag in verifiedMarkers)
  .map((entry) => {
    const content = readFileSync(`drizzle/migrations/${entry.tag}.sql`, "utf8");
    return {
      ...entry,
      content,
      hash: createHash("sha256").update(content).digest("hex"),
      marker: verifiedMarkers[entry.tag],
    };
  });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });

try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osun-life-drizzle-ledger-backfill',0))`;
    for (const migration of migrations) {
      const [marker] = await tx.unsafe(migration.marker);
      if (!marker.ok) throw new Error(`Live schema marker is missing for ${migration.tag}.`);
      const [existing] = await tx`
        select hash from drizzle.__drizzle_migrations where created_at=${migration.when}
      `;
      if (existing && existing.hash !== migration.hash) {
        throw new Error(`Migration ledger checksum differs for ${migration.tag}.`);
      }
      if (!existing) {
        await tx`
          insert into drizzle.__drizzle_migrations(hash,created_at)
          values(${migration.hash},${migration.when})
        `;
      }
    }
  });
  console.log(`Backfilled ${migrations.length} verified Drizzle ledger entries.`);
} catch (error) {
  console.error(`Ledger backfill was not committed: ${String(error.message ?? error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
