import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

process.loadEnvFile(".env");

const tags = [
  "0033_player_billboard_advertising",
  "0043_social_rent_and_investment_actions",
  "0048_friend_alerts_and_presence",
  "0049_phone_market_and_careers",
  "0050_osun_life_brand",
  "0053_voice_notes",
];
const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const migrations = tags.map((tag) => {
  const entry = journal.entries.find((candidate) => candidate.tag === tag);
  if (!entry) throw new Error(`Missing journal entry for ${tag}`);
  const content = readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  return { ...entry, tag, content, hash: createHash("sha256").update(content).digest("hex") };
});

function compatibleSql(tag, source) {
  if (tag === "0049_phone_market_and_careers") {
    return source
      .replace("create table public.player_status_posts", "create table if not exists public.player_status_posts")
      .replace(
        "create index player_status_posts_active_idx",
        "create index if not exists player_status_posts_active_idx",
      )
      .replace(
        "create policy player_status_friends_read on public.player_status_posts",
        "drop policy if exists player_status_friends_read on public.player_status_posts;\ncreate policy player_status_friends_read on public.player_status_posts",
      );
  }
  if (tag === "0053_voice_notes") {
    return source
      .replaceAll("alter table public.social_messages add column ", "alter table public.social_messages add column if not exists ")
      .replace("create index social_messages_reply", "create index if not exists social_messages_reply")
      .replace(
        "alter table public.social_messages add constraint social_message_voice_shape",
        "alter table public.social_messages drop constraint if exists social_message_voice_shape;\nalter table public.social_messages add constraint social_message_voice_shape",
      )
      .replace("create table public.social_message_stars", "create table if not exists public.social_message_stars")
      .replace(
        "create policy social_message_stars_owner_read on public.social_message_stars",
        "drop policy if exists social_message_stars_owner_read on public.social_message_stars;\ncreate policy social_message_stars_owner_read on public.social_message_stars",
      )
      .replace(
        "drop function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid);",
        "drop function if exists public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid);",
      )
      .replace(
        "create function public.send_social_message_as_user(",
        "create or replace function public.send_social_message_as_user(",
      );
  }
  return source;
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });

try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('osun-life-compatible-pending-migrations',0))`;
    for (const migration of migrations) {
      const [existing] = await tx`
        select hash from drizzle.__drizzle_migrations where created_at=${migration.when}
      `;
      if (existing && existing.hash !== migration.hash)
        throw new Error(`Migration ledger checksum differs for ${migration.tag}.`);
      if (!existing) {
        await tx.unsafe(compatibleSql(migration.tag, migration.content));
        await tx`
          insert into drizzle.__drizzle_migrations(hash,created_at)
          values(${migration.hash},${migration.when})
        `;
        console.log(`Applied ${migration.tag}`);
      }
    }
    await tx`notify pgrst, 'reload schema'`;
  });
  console.log("Compatible pending migrations committed and schema reload requested.");
} catch (error) {
  console.error(`Compatible migrations were not committed: ${String(error.message ?? error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
