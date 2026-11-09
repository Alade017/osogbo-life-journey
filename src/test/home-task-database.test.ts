// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "81111111-1111-4111-8111-111111111111";
let db: PGlite;

describe("connected home task database", () => {
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
    // Match the career harness: hosted-data cleanup 0075 cannot run on an empty fixture.
    for (const { tag } of journal.entries.filter(
      (entry: { tag: string }) =>
        entry.tag !== "0075_remove_orphaned_player_data" &&
        entry.tag !== "0077_market_stall_rent_categories_sales",
    )) {
      if (tag === "0083_studio_room_layout") {
        // The studio layout migration depends on x/y columns from this Supabase migration.
        await db.exec(
          readFileSync(
            "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
            "utf8",
          ),
        );
      }
      if (tag === "0085_house_floors") {
        // House floors serialize the placement rotation column introduced by this Supabase migration.
        await db.exec(
          readFileSync(
            "supabase/migrations/20261105080000_house_placement_rotation.sql",
            "utf8",
          ),
        );
      }
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^\uFEFF/, ""));
    }
    await db.exec(
      readFileSync("supabase/migrations/20261103175006_home_task_interactions.sql", "utf8"),
    );
    // Reproduce the hosted grant drift before applying the permission correction.
    await db.exec(
      "grant execute on function public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb) to public,anon",
    );
    await db.exec(
      readFileSync("supabase/migrations/20261104034408_secure_home_task_rpc.sql", "utf8"),
    );
    await db.query("insert into auth.users(id) values($1)", [userId]);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(
      "reset role; delete from public.profiles where id='" +
        userId +
        "'; delete from auth.users where id='" +
        userId +
        "';",
    );
    await db.query("insert into auth.users(id) values($1)", [userId]);
    await db.query("insert into public.profiles(id,display_name) values($1,'Tenant')", [userId]);
    await db.query(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('housing-test-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary",
    );
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,'Tenant','female',22,'ambitious','housing-test-job','housing')",
      [userId],
    );
    await db.query(
      "insert into public.wallets(user_id,character_id,balance) select $1,id,5000 from public.characters where user_id=$1",
      [userId],
    );
  });

  const session = "81111111-1111-4111-8111-111111111112";
  let revision = 0;
  async function command(
    kind: string,
    action: string | null = null,
    request: string | null = null,
  ) {
    const result = await db.query<{
      state: {
        revision: number;
        action: string | null;
        home_action_elapsed_seconds: number;
        home_action_duration_seconds: number;
        skills: Record<string, number>;
      };
    }>("select public.personal_simulation_command($1,$2,$3,$4,$5) as state", [
      session,
      revision,
      kind,
      action,
      request,
    ]);
    revision = result.rows[0]!.state.revision;
    return result.rows[0]!.state;
  }
  async function prepare() {
    revision = 0;
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    await db.query("update public.wallets set balance=1000000 where user_id=$1", [userId]);
    await db.query(
      "select public.acquire_game_property(id,'owned') from public.game_properties where slug='housing-shared-room'",
    );
    await db.query("select public.enter_player_home()");
    // Supply every furniture type through the fixture owner, never through the client role.
    await db.query(
      `insert into public.house_placements(player_house_id,item_id,slot)
      select h.id,ci.id,'task-test-'||ci.art_key from public.player_houses h cross join
      (select distinct on(art_key) id,art_key from public.content_items where art_key in ('bed','stove','shower','toilet','computer','plant','sofa','television') order by art_key,id) ci
      where h.player_id=$1 and h.status='active' on conflict do nothing`,
      [userId],
    );
    await command("open");
  }
  async function advance(seconds: number) {
    await db.query(
      "update public.character_simulations set heartbeat_at=now()-$1*interval '1 second' where user_id=$2",
      [seconds, userId],
    );
  }
  it("enforces duration, preserves elapsed on retry, grants exactly once and clears timing", async () => {
    await prepare();
    const start = await command("start", "read_bed", "read-once");
    expect(start.home_action_duration_seconds).toBe(15);
    await expect(command("complete", "read_bed", "read-once")).rejects.toThrow(/still in progress/);
    await advance(8);
    await command("tick");
    const retried = await command("start", "read_bed", "read-once");
    expect(retried.home_action_elapsed_seconds).toBeGreaterThanOrEqual(8);
    await advance(8);
    const result = await command("complete", "read_bed", "read-once");
    expect(result.skills["learning"]).toBe(5);
    expect(result.action).toBeNull();
    expect(result.home_action_duration_seconds).toBe(0);
    const replay = await command("complete", "read_bed", "read-once");
    expect(replay.skills["learning"]).toBe(5);
    await expect(command("complete", "nap", "read-once")).rejects.toThrow(/different activity/);
  }, 30000);
  it("cancels without benefits, rejects stale cancellation, and blocks completion afterwards", async () => {
    await prepare();
    await command("start", "educational_tv", "watch");
    await advance(10);
    await expect(command("interrupt", null, "stale")).rejects.toThrow(/does not match/);
    const cancelled = await command("interrupt", null, "watch");
    expect(cancelled.action).toBeNull();
    expect(cancelled.home_action_elapsed_seconds).toBe(0);
    expect(cancelled.skills["learning"]).toBeUndefined();
    await expect(command("complete", "educational_tv", "watch")).rejects.toThrow(/does not match/);
    const receipts = await db.query<{ count: number }>(
      "select count(*)::int as count from public.simulation_action_receipts where request_id='watch'",
    );
    expect(receipts.rows[0]!.count).toBe(0);
  }, 30000);
  it("does not credit disconnected or reopened time and validates placed furniture", async () => {
    await prepare();
    await command("start", "nap", "nap");
    await advance(40);
    expect((await command("tick")).home_action_elapsed_seconds).toBe(0);
    await advance(8);
    expect((await command("open")).home_action_elapsed_seconds).toBe(0);
    await command("interrupt", null, "nap");
    await db.query(
      "delete from public.house_placements where item_id in(select id from public.content_items where art_key='computer')",
    );
    await expect(command("start", "browse_computer", "missing")).rejects.toThrow(
      /Place a computer/,
    );
    await db.query("select public.leave_player_home()");
    await expect(command("start", "wash_hands", "outside")).rejects.toThrow(/Travel home/);
  }, 30000);
  it("prevents client writes to task timers and anonymous simulation calls", async () => {
    await prepare();
    const permission = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon','public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)','EXECUTE') as allowed",
    );
    expect(permission.rows[0]!.allowed).toBe(false);
    await db.exec("set role authenticated");
    try {
      await expect(
        db.query("update public.character_simulations set home_action_elapsed_seconds=30"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await db.query("select set_config('test.user_id','',false)");
    await expect(command("start", "nap", "anonymous")).rejects.toThrow(/Sign in/);
  }, 30_000);

  it("runs every additional accessory action with its declared duration", async () => {
    await prepare();
    for (const [action, seconds] of [
      ["nap", 30],
      ["read_bed", 15],
      ["wash_hands", 3],
      ["clean_toilet", 5],
      ["browse_computer", 8],
      ["prune_plant", 5],
      ["stretch_sofa", 5],
      ["educational_tv", 15],
    ] as const) {
      const started = await command("start", action, action);
      expect(started.home_action_duration_seconds).toBe(seconds);
      await command("interrupt", null, action);
    }
  }, 30000);
});
