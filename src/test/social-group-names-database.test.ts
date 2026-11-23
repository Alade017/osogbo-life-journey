// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "b1111111-1111-4111-8111-111111111111";
const ownerCharacterId = "b2222222-2222-4222-8222-222222222222";
const friendUserId = "b3333333-3333-4333-8333-333333333333";
const friendCharacterId = "b4444444-4444-4444-8444-444444444444";
let db: PGlite;
let namesAfterDedupe: string[] = [];

type Outcome = { ok: true; result: unknown } | { ok: false; message: string };

async function asOwner(sql: string, params: unknown[] = []): Promise<Outcome> {
  await db.query("select set_config('test.user_id',$1,false)", [ownerUserId]);
  try {
    const { rows } = await db.query<{ result: unknown }>(sql, params);
    return { ok: true, result: rows[0]?.result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

describe("unique social group names", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key, is_anonymous boolean not null default false); create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries.filter(
      (entry: { tag: string }) =>
        ![
          "0075_remove_orphaned_player_data",
          "0077_market_stall_rent_categories_sales",
          "0079_free_house_placement",
        ].includes(entry.tag),
    ))
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^\uFEFF/, ""));
    await db.exec(
      readFileSync(
        "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
        "utf8",
      ),
    );
    await db.exec(readFileSync("drizzle/migrations/0079_free_house_placement.sql", "utf8"));
    await db.exec("drop function if exists public.house_place_free(uuid, text, numeric, numeric);");

    // Two groups already share a name in production, so the dedupe must keep both.
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('group-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','group-job','housing')",
        [characterId, userId, name],
      );
    }
    await db.query(
      "insert into public.player_friendships(first_character_id,second_character_id) values($1,$2)",
      [ownerCharacterId, friendCharacterId],
    );
    await db.query(
      `insert into public.social_groups(name, created_by_character_id, created_at) values
        ('GEE BOYS', $1, '2026-11-22 20:41:02+00'),
        ('GEE BOYS', $1, '2026-11-22 21:30:00+00')`,
      [ownerCharacterId],
    );

    await db.exec(
      readFileSync(
        "supabase/migrations/20261123120000_unique_social_group_names.sql",
        "utf8",
      ).replace(/^\uFEFF/, ""),
    );
    const { rows } = await db.query<{ name: string }>(
      "select name from public.social_groups order by created_at",
    );
    namesAfterDedupe = rows.map((row) => row.name);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role;
      delete from public.social_group_members; delete from public.social_groups;`);
  });

  it("keeps the oldest duplicate's name and numbers the later copy", () => {
    expect(namesAfterDedupe).toEqual(["GEE BOYS", "GEE BOYS 2"]);
  });

  it("refuses a create whose name matches an existing group, ignoring case and spaces", async () => {
    await db.exec(
      "insert into public.social_groups(name, created_by_character_id) values('Market crew', '" +
        ownerCharacterId +
        "')",
    );
    const taken = await asOwner("select public.create_social_group($1,$2::uuid[]) as result", [
      " market CREW ",
      [friendCharacterId],
    ]);
    expect(taken).toMatchObject({
      ok: false,
      message: expect.stringContaining("GROUP_NAME_TAKEN"),
    });
  });

  it("allows a new name and still refuses a second copy of it", async () => {
    const created = await asOwner("select public.create_social_group($1,$2::uuid[]) as result", [
      "Fresh crew",
      [friendCharacterId],
    ]);
    expect(created.ok).toBe(true);
    await expect(
      db.exec(
        "insert into public.social_groups(name, created_by_character_id) values('  FRESH crew  ', '" +
          ownerCharacterId +
          "')",
      ),
    ).rejects.toThrow(/social_groups_name_unique/);
  });
});
