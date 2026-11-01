// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const migration = "supabase/migrations/20261101175731_separate_audio_preferences.sql";
let db: PGlite;

describe("audio preference schema migration", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      create table public.profiles (
        id uuid primary key,
        sound_enabled boolean not null default true
      );
      grant select, update on public.profiles to authenticated;
      alter table public.profiles enable row level security;
      create policy "own profile select" on public.profiles
        for select to authenticated using (id = auth.uid());
      create policy "own profile update" on public.profiles
        for update to authenticated using (id = auth.uid())
        with check (id = auth.uid());
      insert into public.profiles(id, sound_enabled)
      values ('${ownerId}', true), ('${otherId}', false);
    `);
    await db.exec(readFileSync(migration, "utf8"));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("backfills existing preferences and remains safe to apply twice", async () => {
    await db.exec(readFileSync(migration, "utf8"));
    const result = await db.query<{
      id: string;
      music_enabled: boolean;
      effects_enabled: boolean;
    }>("select id, music_enabled, effects_enabled from public.profiles order by id");

    expect(result.rows).toEqual([
      { id: ownerId, music_enabled: true, effects_enabled: true },
      { id: otherId, music_enabled: false, effects_enabled: false },
    ]);
  });

  it("allows an authenticated player to persist only their own audio settings", async () => {
    await db.exec(
      `set role authenticated; select set_config('test.user_id', '${ownerId}', false);`,
    );
    await db.query(
      "update public.profiles set music_enabled = false, effects_enabled = true, sound_enabled = true where id = $1",
      [ownerId],
    );

    const ownRows = await db.query<{ id: string }>("select id from public.profiles");
    const saved = await db.query<{
      music_enabled: boolean;
      effects_enabled: boolean;
      sound_enabled: boolean;
    }>("select music_enabled, effects_enabled, sound_enabled from public.profiles where id = $1", [
      ownerId,
    ]);
    expect(ownRows.rows).toEqual([{ id: ownerId }]);
    expect(saved.rows).toEqual([
      { music_enabled: false, effects_enabled: true, sound_enabled: true },
    ]);
  });
});
