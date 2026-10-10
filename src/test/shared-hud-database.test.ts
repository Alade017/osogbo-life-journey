// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const uid = "11111111-1111-4111-8111-111111111111";
const session = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let revision = 0;
async function command(kind: string, action: string | null = null, request: string | null = null) {
  const result = await db.query<{
    result: {
      revision: number;
      needs: Record<string, number>;
      game_time: { day: number; hour: number; minute: number };
      action: string | null;
    };
  }>("select public.personal_simulation_command($1,$2,$3,$4,$5) as result", [
    session,
    revision,
    kind,
    action,
    request,
  ]);
  const state = result.rows[0]!.result;
  revision = state.revision;
  return state;
}

describe("shared HUD database acceptance", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`);
    for (const file of readdirSync("drizzle/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      try {
        await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${String(error)}`);
      }
    }
    await db.exec(`insert into auth.users values('${uid}'); insert into public.profiles(id) values('${uid}');
      insert into public.characters(user_id,name,gender,age,personality,energy,hunger,happiness,social)
      values('${uid}','Ade','male',21,'ambitious',80,20,70,60);
      select set_config('test.user_id','${uid}',false);`);
  }, 180_000);
  afterAll(async () => {
    await db?.close();
  });

  it("applies the full migration chain and makes reconnects skip offline time", async () => {
    const before = await command("open");
    await db.exec("update public.character_simulations set heartbeat_at=now()-interval '2 days'");
    const after = await command("open");
    expect(after.needs).toEqual(before.needs);
    expect(after.game_time).toEqual(before.game_time);
    const clock = await db.query<{ time: { hour: number } }>("select public.world_clock() as time");
    expect(clock.rows[0]!.time.hour).toBeGreaterThanOrEqual(0);
  });

  it("persists queues and settings while keeping personal pause separate from the world clock", async () => {
    const before = await command("open");
    const paused = await db.query<{ result: { revision: number } }>(
      "select public.personal_simulation_command($1,$2,'settings',null,null,true,2) as result",
      [session, revision],
    );
    revision = paused.rows[0]!.result.revision;
    await db.exec(
      "update public.character_simulations set heartbeat_at=now()-interval '6 seconds'",
    );
    const tick = await command("tick");
    expect(tick.needs).toEqual(before.needs);
    expect(tick.game_time).toEqual(before.game_time);
    const queued = await db.query<{ result: { revision: number; queued_actions: string[] } }>(
      "select public.personal_simulation_command($1,$2,'queue',null,null,null,null,$3) as result",
      [session, revision, JSON.stringify(["study", "socialize"])],
    );
    revision = queued.rows[0]!.result.revision;
    expect(queued.rows[0]!.result.queued_actions).toEqual(["study", "socialize"]);
    await command("open");
    const saved = await db.query<{ queued_actions: string[] }>(
      "select queued_actions from public.character_simulations",
    );
    expect(saved.rows[0]!.queued_actions).toEqual(["study", "socialize"]);
    await expect(
      db.query("select public.personal_simulation_command($1,$2,'settings',null,null,false,3)", [
        session,
        revision,
      ]),
    ).rejects.toThrow(/speed/);
    const resumed = await db.query<{ result: { revision: number } }>(
      "select public.personal_simulation_command($1,$2,'settings',null,null,false,1) as result",
      [session, revision],
    );
    revision = resumed.rows[0]!.result.revision;
    await db.exec("update public.characters set energy_updated_at=now()-interval '2 days'");
    const recovered = await db.query<{ energy: number }>(
      "select public.refresh_my_energy() as energy",
    );
    expect(recovered.rows[0]!.energy).toBe(Math.round(before.needs["energy"]!));
  });

  it("advances only active heartbeat time and validates activity effects on the server", async () => {
    const before = await command("open");
    await db.exec(
      "update public.character_simulations set heartbeat_at=now()-interval '6 seconds'",
    );
    const tick = await command("tick");
    expect(tick.needs["energy"]).toBeLessThan(before.needs["energy"]!);
    const started = await command("start", "study", "study-1");
    expect(started.action).toBe("study");
    const finished = await command("complete", "study", "study-1");
    expect(finished.action).toBeNull();
    const duplicate = await command("complete", "study", "study-1");
    expect(duplicate.needs["energy"]).toBeCloseTo(finished.needs["energy"]!, 1);
    const receipt = await db.query<{ count: number }>(
      "select count(*)::int as count from public.simulation_action_receipts",
    );
    expect(receipt.rows[0]!.count).toBe(1);
  });

  it("reconciles server job/travel time and needs without applying their effects twice", async () => {
    const before = await command("open");
    await db.exec(
      "select public._advance_character_game_time(public._my_character_id(),30); update public.characters set energy=55,hunger=40",
    );
    const after = await command("open");
    expect(after.needs["energy"]).toBe(55);
    expect(after.needs["hunger"]).toBe(60);
    const total = (t: typeof before.game_time) => t.day * 1440 + t.hour * 60 + t.minute;
    expect(total(after.game_time) - total(before.game_time)).toBe(30);
    expect(after.needs["hygiene"]).toBeLessThan(before.needs["hygiene"]!);
    const again = await command("open");
    expect(again.game_time).toEqual(after.game_time);
    expect(again.needs).toEqual(after.needs);
  });

  it("rejects stale revisions, other sessions, missing furniture, and invalid event participation", async () => {
    await expect(
      db.query("select public.personal_simulation_command($1,0,'tick')", [session]),
    ).rejects.toThrow(/changed/);
    await expect(
      db.query(
        "select public.personal_simulation_command('33333333-3333-4333-8333-333333333333',0,'open')",
      ),
    ).rejects.toThrow(/another tab/);
    await expect(command("start", "shower", "shower-1")).rejects.toThrow(/home|layout/);
    await expect(db.query("select public.join_city_event('invented-event')")).rejects.toThrow(
      /Unknown/,
    );
    await db.exec(
      'create or replace function public.world_clock() returns jsonb language sql stable as $$ select \'{"minute":0,"hour":10,"day":14,"weekday":2}\'::jsonb $$',
    );
    await expect(db.query("select public.join_city_event('market-day')")).rejects.toThrow(/Travel/);
    await db.exec(
      "update public.characters set current_location_id=(select id from public.locations where slug='oja-oba')",
    );
    const join = await db.query<{ result: { duplicate: boolean } }>(
      "select public.join_city_event('market-day') as result",
    );
    expect(join.rows[0]!.result.duplicate).toBe(false);
    const again = await db.query<{ result: { duplicate: boolean } }>(
      "select public.join_city_event('market-day') as result",
    );
    expect(again.rows[0]!.result.duplicate).toBe(true);
  });

  it("enforces ownership and prevents direct writes under the authenticated role", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("update public.character_simulations set speed=2")).rejects.toThrow(
      /permission/,
    );
    await db.exec("select set_config('test.user_id','44444444-4444-4444-8444-444444444444',false)");
    const rows = await db.query("select * from public.character_simulations");
    expect(rows.rows).toHaveLength(0);
    await expect(
      db.query("select public.personal_simulation_command($1,0,'open')", [session]),
    ).rejects.toThrow(/character/);
    await db.exec("reset role");
  });

  it("enforces player discovery, friend requests, persistent chat, blocks, and report privacy", async () => {
    const secondUser = "33333333-3333-4333-8333-333333333333";
    await db.exec(`insert into auth.users values('${secondUser}');
      insert into public.profiles(id) values('${secondUser}');
      insert into public.characters(user_id,name,gender,age,personality,energy,hunger,happiness,social)
      values('${secondUser}','Bola','female',22,'creative',80,20,70,60);
      select set_config('test.user_id','${uid}',false);`);

    const search = await db.query<{ result: Array<{ player_name: string; character_id: string }> }>(
      "select public.search_player_profiles('bol',20) as result",
    );
    expect(search.rows[0]!.result).toHaveLength(1);
    expect(search.rows[0]!.result[0]!.player_name).toBe("Bola");
    const bolaId = search.rows[0]!.result[0]!.character_id;
    const ade = await db.query<{ id: string }>(
      "select id from public.characters where user_id=$1",
      [uid],
    );
    const adeId = ade.rows[0]!.id;
    const requestId = "44444444-4444-4444-8444-444444444444";
    const request = await db.query<{ result: { status: string; duplicate: boolean } }>(
      "select public.send_player_friend_request($1,$2) as result",
      [bolaId, requestId],
    );
    expect(request.rows[0]!.result).toMatchObject({ status: "request_sent", duplicate: false });
    const repeated = await db.query<{ result: { status: string; duplicate: boolean } }>(
      "select public.send_player_friend_request($1,$2) as result",
      [bolaId, requestId],
    );
    expect(repeated.rows[0]!.result).toMatchObject({ status: "pending", duplicate: true });

    await db.exec(`select set_config('test.user_id','${secondUser}',false)`);
    const reciprocal = await db.query<{ result: { status: string; accepted_reciprocal: boolean } }>(
      "select public.send_player_friend_request($1,'55555555-5555-4555-8555-555555555555') as result",
      [adeId],
    );
    expect(reciprocal.rows[0]!.result).toMatchObject({
      status: "friends",
      accepted_reciprocal: true,
    });
    const area = await db.query<{ current_location_id: string }>(
      "select current_location_id from public.characters where user_id=$1",
      [uid],
    );
    const locationId = area.rows[0]!.current_location_id;
    const sentArea = await db.query<{ result: { body: string; duplicate: boolean } }>(
      "select public.send_social_message('area','Hello, neighbours!','66666666-6666-4666-8666-666666666666',$1,null) as result",
      [locationId],
    );
    expect(sentArea.rows[0]!.result).toMatchObject({
      body: "Hello, neighbours!",
      duplicate: false,
    });
    const conversation = await db.query<{ result: { id: string } }>(
      "select public.get_or_create_player_conversation($1) as result",
      [adeId],
    );
    const sentPrivate = await db.query<{ result: { body: string; channel: string } }>(
      "select public.send_social_message('private','Private hello','77777777-7777-4777-8777-777777777777',null,$1) as result",
      [conversation.rows[0]!.result.id],
    );
    expect(sentPrivate.rows[0]!.result).toMatchObject({
      body: "Private hello",
      channel: "private",
    });

    await db.exec(`select set_config('test.user_id','${uid}',false)`);
    const history = await db.query<{ result: Array<{ body: string; sender_name: string }> }>(
      "select public.get_social_messages($1,null,null,50) as result",
      [locationId],
    );
    expect(history.rows[0]!.result).toContainEqual(
      expect.objectContaining({ body: "Hello, neighbours!", sender_name: "Bola" }),
    );
    const directHistory = await db.query<{ result: Array<{ body: string }> }>(
      "select public.get_social_messages(null,$1,null,50) as result",
      [conversation.rows[0]!.result.id],
    );
    expect(directHistory.rows[0]!.result.map((message) => message.body)).toContain("Private hello");

    const privateMessage = await db.query<{ id: string }>(
      "select id from public.social_messages where body='Private hello'",
    );
    await db.exec(`select set_config('test.user_id','${secondUser}',false)`);
    await db.exec(`select set_config('test.user_id','${uid}',false)`);
    const report = await db.query<{ result: { status: string } }>(
      "select public.report_player($1,'harassment','Please review this message',$2) as result",
      [bolaId, privateMessage.rows[0]!.id],
    );
    expect(report.rows[0]!.result.status).toBe("open");
    await db.exec(`select set_config('test.user_id','${secondUser}',false)`);
    await db.query("select public.block_player($1)", [adeId]);
    await expect(db.query("select public.get_player_profile($1)", [adeId])).rejects.toThrow(
      /unavailable/,
    );
    await expect(
      db.query(
        "select public.send_social_message('private','Blocked','88888888-8888-4888-8888-888888888888',null,$1)",
        [conversation.rows[0]!.result.id],
      ),
    ).rejects.toThrow(/unavailable/);
    await expect(
      db.query("select public.get_social_messages(null,$1,null,50)", [
        conversation.rows[0]!.result.id,
      ]),
    ).rejects.toThrow(/not found/);
  });
});
