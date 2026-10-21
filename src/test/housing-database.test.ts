// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "81111111-1111-4111-8111-111111111111";
let db: PGlite;

describe("housing onboarding database actions", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key); create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries)
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^\uFEFF/, ""));
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

  it("buys a house once, persists ownership, and switches the active room", async () => {
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      await db.query("update public.wallets set balance=1000000 where user_id=$1", [userId]);
      const firstListing = await db.query<{ id: string }>(
        "select id from public.game_properties where slug='housing-shared-room'",
      );
      const secondListing = await db.query<{ id: string }>(
        "select id from public.game_properties where slug='garden-court-flat'",
      );
      const firstId = firstListing.rows[0]!.id;
      const secondId = secondListing.rows[0]!.id;
      await db.query("select public.acquire_game_property($1,'owned')", [firstId]);
      const balanceAfterFirst = await db.query<{ balance: number }>(
        "select balance from public.wallets where user_id=$1",
        [userId],
      );
      await expect(
        db.query("select public.acquire_game_property($1,'owned')", [firstId]),
      ).rejects.toThrow("ALREADY_OWNED");
      const balanceAfterDuplicate = await db.query<{ balance: number }>(
        "select balance from public.wallets where user_id=$1",
        [userId],
      );
      expect(balanceAfterDuplicate.rows[0]?.balance).toBe(balanceAfterFirst.rows[0]?.balance);
      await db.query("select public.acquire_game_property($1,'owned')", [secondId]);
      const assets = await db.query<{ id: string; is_home: boolean; property_id: string }>(
        "select id,is_home,property_id from public.player_properties where user_id=$1 and is_active and tenure='owned' order by acquired_at,id",
        [userId],
      );
      expect(assets.rows).toHaveLength(2);
      const selected = assets.rows.find((row) => !row.is_home)!;
      await db.query("select public.set_active_property_home($1)", [selected.id]);
      const home = await db.query<{
        result: { propertyId: string; tenure: string; imageUrl: string };
      }>("select public.housing_current_home($1) as result", [userId]);
      expect(home.rows[0]?.result).toMatchObject({
        tenure: "owned",
        propertyId: selected.property_id,
      });
      expect(home.rows[0]?.result.imageUrl).toMatch(/\.webp$/);
      const active = await db.query<{ count: number }>(
        "select count(*)::int as count from public.player_houses where player_id=$1 and status='active'",
        [userId],
      );
      expect(active.rows[0]?.count).toBe(1);
      const room = await db.query<{ result: { house: { house_type_id: string } } }>(
        "select public.get_house_state($1) as result",
        [userId],
      );
      expect(room.rows[0]?.result.house).toBeTruthy();
      await expect(db.query("select public.cancel_player_house($1)", [userId])).rejects.toThrow(
        "OWNED_HOME_CANNOT_BE_CANCELLED",
      );
    } finally {
      await db.query("select set_config('test.user_id','',false)");
    }
  });

  it("enters the selected home through travel, uses placed furniture, and leaves safely", async () => {
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      await db.query("update public.wallets set balance=1000000 where user_id=$1", [userId]);
      const listing = await db.query<{ id: string; location_id: string }>(
        "select id,location_id from public.game_properties where slug='housing-shared-room'",
      );
      await db.query("select public.acquire_game_property($1,'owned')", [listing.rows[0]!.id]);
      const owned = await db.query<{ id: string }>(
        "select id from public.player_properties where user_id=$1 and is_home",
        [userId],
      );
      const selectedHomeId = owned.rows[0]!.id;
      await db.query("update public.characters set energy=20 where user_id=$1", [userId]);
      const session = "81111111-1111-4111-8111-111111111112";
      let revision = 0;
      const command = async (kind: string, action?: string, request?: string) => {
        const result = await db.query<{
          state: { revision: number; needs: Record<string, number>; action: string | null };
        }>("select public.personal_simulation_command($1,$2,$3,$4,$5) as state", [
          session,
          revision,
          kind,
          action ?? null,
          request ?? null,
        ]);
        revision = result.rows[0]!.state.revision;
        return result.rows[0]!.state;
      };
      await command("open");
      await expect(command("start", "sleep", "outside-bed")).rejects.toThrow(/Travel home/);
      const entered = await db.query<{
        result: { playerPropertyId: string; locationId: string; trip: unknown };
      }>("select public.enter_player_home() as result");
      expect(entered.rows[0]!.result).toMatchObject({
        playerPropertyId: selectedHomeId,
        locationId: listing.rows[0]!.location_id,
      });
      const location = await db.query<{
        current_location_id: string;
        inside_home_property_id: string;
      }>(
        "select current_location_id,inside_home_property_id from public.characters where user_id=$1",
        [userId],
      );
      expect(location.rows[0]).toMatchObject({
        current_location_id: listing.rows[0]!.location_id,
        inside_home_property_id: selectedHomeId,
      });
      const again = await db.query<{ result: { trip: unknown } }>(
        "select public.enter_player_home() as result",
      );
      expect(again.rows[0]!.result.trip).toBeNull();
      const before = await command("open");
      await command("start", "sleep", "home-bed");
      await expect(command("complete", "sleep", "wrong-request")).rejects.toThrow();
      const after = await command("complete", "sleep", "home-bed");
      expect(after.needs["energy"]).toBeGreaterThan(before.needs["energy"]!);
      const duplicate = await command("complete", "sleep", "home-bed");
      expect(duplicate.needs["energy"]).toBe(after.needs["energy"]);
      await expect(command("start", "sleep", "cooldown-bed")).rejects.toThrow(/cooling down/);
      for (const [action, request] of [
        ["cook", "home-stove"],
        ["shower", "home-shower"],
        ["toilet", "home-toilet"],
        ["watch_tv", "home-tv"],
        ["relax_sofa", "home-seat"],
      ]) {
        await command("start", action, request);
        await command("complete", action, request);
      }
      const left = await db.query<{ result: { locationId: string } }>(
        "select public.leave_player_home() as result",
      );
      expect(left.rows[0]!.result.locationId).toBe(listing.rows[0]!.location_id);
      await expect(command("start", "cook", "outside-stove")).rejects.toThrow(/Travel home/);
      await db.query("select public.enter_player_home()");
      await db.query(
        "update public.characters set current_location_id=(select id from public.locations where slug='city-centre') where user_id=$1",
        [userId],
      );
      const afterTravel = await db.query<{ inside_home_property_id: string | null }>(
        "select inside_home_property_id from public.characters where user_id=$1",
        [userId],
      );
      expect(afterTravel.rows[0]!.inside_home_property_id).toBeNull();
      await expect(command("start", "cook", "after-travel")).rejects.toThrow(/Travel home/);
    } finally {
      await db.query("select set_config('test.user_id','',false)");
    }
  });

  it("rejects furniture from another player's room and direct home-presence writes", async () => {
    const guestId = "82222222-2222-4222-8222-222222222222";
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      const listing = await db.query<{ id: string }>(
        "select id from public.game_properties where slug='housing-shared-room'",
      );
      await db.query(
        `insert into public.player_properties(user_id,character_id,property_id,tenure)
         select $1,id,$2,'owned' from public.characters where user_id=$1`,
        [userId, listing.rows[0]!.id],
      );
      await db.query("insert into auth.users(id) values($1)", [guestId]);
      await db.query("insert into public.profiles(id,display_name) values($1,'Guest')", [guestId]);
      await db.query(
        "insert into public.characters(user_id,name,gender,age,personality) values($1,'Guest','female',22,'ambitious')",
        [guestId],
      );
      await db.query(
        `insert into public.player_properties(user_id,character_id,property_id,tenure)
         select $1,id,$2,'owned' from public.characters where user_id=$1`,
        [guestId, listing.rows[0]!.id],
      );
      await db.query(
        `delete from public.house_placements where item_id='starter-bed' and player_house_id in
          (select id from public.player_houses where player_id=$1)`,
        [guestId],
      );
      await db.query("select set_config('test.user_id',$1,false)", [guestId]);
      await db.query("select public.enter_player_home()");
      const session = "82222222-2222-4222-8222-222222222223";
      const opened = await db.query<{ state: { revision: number } }>(
        "select public.personal_simulation_command($1,0,'open') as state",
        [session],
      );
      await expect(
        db.query("select public.personal_simulation_command($1,$2,'start','sleep','other-bed')", [
          session,
          opened.rows[0]!.state.revision,
        ]),
      ).rejects.toThrow(/Place a bed/);
      await db.exec("set role authenticated");
      await expect(
        db.query("update public.characters set inside_home_property_id=null where user_id=$1", [
          guestId,
        ]),
      ).rejects.toThrow(/permission/);
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('test.user_id','',false)");
      await db.query("delete from public.profiles where id=$1", [guestId]);
      await db.query("delete from auth.users where id=$1", [guestId]);
    }
  });

  it("shows a purchased Royal Crown home on the map", async () => {
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      await db.query("update public.wallets set balance=3000000 where user_id=$1", [userId]);
      const listing = await db.query<{ id: string }>(
        "select id from public.game_properties where slug='housing-royal-crown-duplex'",
      );
      const propertyId = listing.rows[0]!.id;
      await db.query("select public.acquire_game_property($1,'owned')", [propertyId]);
      const markers = await db.query<{
        result: { propertyId: string; status: string; label: string }[];
      }>("select public.housing_map_properties($1) as result", [userId]);
      expect(markers.rows[0]?.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ propertyId, status: "owned", label: "Royal Crown Duplex" }),
        ]),
      );
    } finally {
      await db.query("select set_config('test.user_id','',false)");
    }
  });

  it("keeps room furniture when buying the house being rented", async () => {
    const listing = await db.query<{ id: string }>(
      "select id from public.game_properties where slug='housing-shared-room'",
    );
    const propertyId = listing.rows[0]!.id;
    await db.query("update public.wallets set balance=500000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      propertyId,
      "812f4de0-1990-45e4-a056-56f32052a19b",
    ]);
    await db.query("select public.house_place($1,'starter-bed','bed')", [userId]);
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      await db.query("select public.acquire_game_property($1,'owned')", [propertyId]);
      const room = await db.query<{ result: { placements: { item_id: string }[] } }>(
        "select public.get_house_state($1) as result",
        [userId],
      );
      expect(room.rows[0]?.result.placements).toEqual(
        expect.arrayContaining([expect.objectContaining({ item_id: "starter-bed" })]),
      );
      const home = await db.query<{ result: { tenure: string; dueAt: string | null } }>(
        "select public.housing_current_home($1) as result",
        [userId],
      );
      expect(home.rows[0]?.result).toMatchObject({ tenure: "owned", dueAt: null });
      const openCycles = await db.query<{ count: number }>(
        "select count(*)::int as count from public.property_rent_cycles where character_id=(select id from public.characters where user_id=$1) and status in ('current','due','grace','rescue')",
        [userId],
      );
      expect(openCycles.rows[0]?.count).toBe(0);
    } finally {
      await db.query("select set_config('test.user_id','',false)");
    }
  });

  it("repossesses an expired rental without ending a separately owned Home", async () => {
    const rented = await db.query<{ id: string }>(
      "select id from public.game_properties where slug='housing-shared-room'",
    );
    const owned = await db.query<{ id: string }>(
      "select id from public.game_properties where slug='garden-court-flat'",
    );
    await db.query("update public.wallets set balance=500000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      rented.rows[0]!.id,
      "a122eaca-b47d-4661-b23f-5d0bc658bf41",
    ]);
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    try {
      await db.query("select public.acquire_game_property($1,'owned')", [owned.rows[0]!.id]);
      await db.query(
        "update public.characters set current_location_id=(select id from public.locations where slug='residential') where user_id=$1",
        [userId],
      );
      await db.query(
        "update public.property_rent_cycles set status='rescue',rescue_ends_at=now()-interval '1 minute' where character_id=(select id from public.characters where user_id=$1) and status='current'",
        [userId],
      );
      await db.query("select public._advance_property_rent_cycles()");
      const home = await db.query<{ result: { tenure: string; propertyId: string } }>(
        "select public.housing_current_home($1) as result",
        [userId],
      );
      expect(home.rows[0]?.result).toMatchObject({
        tenure: "owned",
        propertyId: owned.rows[0]!.id,
      });
      const room = await db.query<{ result: { house: { status: string } } }>(
        "select public.get_house_state($1) as result",
        [userId],
      );
      expect(room.rows[0]?.result.house.status).toBe("active");
      const location = await db.query<{ slug: string }>(
        "select location.slug from public.characters character join public.locations location on location.id=character.current_location_id where character.user_id=$1",
        [userId],
      );
      expect(location.rows[0]?.slug).toBe("residential");
    } finally {
      await db.query("select set_config('test.user_id','',false)");
    }
  });

  it("computes eligibility from authoritative cash and 20 shifts of job pay", async () => {
    const result = await db.query<{
      result: { monthly_income: number; houses: { id: string; eligible: boolean }[] };
    }>("select public.housing_eligible_houses($1) as result", [userId]);
    expect(result.rows[0]?.result.monthly_income).toBe(200000);
    expect(
      result.rows[0]?.result.houses.find((house) => house.id === "studio-flat")?.eligible,
    ).toBe(false);
  });

  it("creates the home, charges rent and deposit once, and returns the same receipt on retry", async () => {
    const key = "housing-idempotency-key-0001";
    const first = await db.query<{ result: Record<string, unknown> }>(
      "select public.housing_choose($1,'single-room',$2) as result",
      [userId, key],
    );
    const second = await db.query<{ result: Record<string, unknown> }>(
      "select public.housing_choose($1,'single-room',$2) as result",
      [userId, key],
    );
    expect(second.rows[0]?.result).toEqual(first.rows[0]?.result);
    const wallet = await db.query<{ balance: number }>(
      "select balance from public.wallets where user_id=$1",
      [userId],
    );
    const homes = await db.query<{ count: number }>(
      "select count(*)::int as count from public.player_homes where user_id=$1",
      [userId],
    );
    const charges = await db.query<{ count: number }>(
      "select count(*)::int as count from public.transactions where user_id=$1 and category in ('housing_deposit','housing_rent')",
      [userId],
    );
    const step = await db.query<{ onboarding_step: string }>(
      "select onboarding_step from public.characters where user_id=$1",
      [userId],
    );
    const ledger = await db.query<{ category: string; amount: number; balance_after: number }>(
      "select category,amount,balance_after from public.transactions where user_id=$1 and category in ('housing_deposit','housing_rent') order by created_at,category",
      [userId],
    );
    expect(wallet.rows[0]?.balance).toBe(2000);
    expect(homes.rows[0]?.count).toBe(1);
    expect(charges.rows[0]?.count).toBe(2);
    expect(step.rows[0]?.onboarding_step).toBe("done");
    expect(ledger.rows).toEqual([
      { category: "housing_deposit", amount: 1500, balance_after: 3500 },
      { category: "housing_rent", amount: 1500, balance_after: 2000 },
    ]);
  });

  it("lets a player skip housing and return later to complete a paid rental", async () => {
    await db.query("select public.housing_defer($1)", [userId]);
    const skipped = await db.query<{
      onboarding_step: string;
      homes: number;
    }>(
      "select c.onboarding_step,(select count(*)::int from public.player_homes h where h.character_id=c.id) as homes from public.characters c where c.user_id=$1",
      [userId],
    );
    expect(skipped.rows[0]).toEqual({ onboarding_step: "done", homes: 0 });

    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.exec("set role service_role");
    const eligibility = await db.query<{
      result: { houses: { id: string; eligible: boolean }[] };
    }>("select public.housing_eligible_houses($1) as result", [userId]);
    expect(
      eligibility.rows[0]?.result.houses.find((house) => house.id === "shared-room")?.eligible,
    ).toBe(true);

    const rental = await db.query<{
      result: { home: { house_type_id: string }; onboarding_step: string };
    }>("select public.housing_rent($1,'shared-room','housing-return-flow-key-0001') as result", [
      userId,
    ]);
    await db.exec("reset role");
    expect(rental.rows[0]?.result.home.house_type_id).toBe("shared-room");
    expect(rental.rows[0]?.result.onboarding_step).toBe("done");
  });

  it("rechecks the rent ratio when choosing, even if the client asks directly", async () => {
    await db.query("update public.jobs set salary=100 where slug='housing-test-job'");
    await expect(
      db.query("select public.housing_choose($1,'shared-room','housing-rent-recheck-0001')", [
        userId,
      ]),
    ).rejects.toThrow(/RENT_TOO_HIGH/);
  });

  it("makes placement and removal retries idempotent", async () => {
    await db.query("select public.housing_choose($1,'single-room','housing-item-move-in-0001')", [
      userId,
    ]);
    const key = "housing-item-remove-retry-01";
    const first = await db.query<{ result: unknown }>(
      "select public.home_item_mutate($1,'remove','starter-bed',null,$2) as result",
      [userId, key],
    );
    const retry = await db.query<{ result: unknown }>(
      "select public.home_item_mutate($1,'remove','starter-bed',null,$2) as result",
      [userId, key],
    );
    expect(retry.rows[0]?.result).toEqual(first.rows[0]?.result);
    const item = await db.query<{ placed: boolean }>(
      "select placed from public.home_items where character_id=(select id from public.characters where user_id=$1) and item_id='starter-bed'",
      [userId],
    );
    expect(item.rows[0]?.placed).toBe(false);
  });

  it("rejects placing furniture the player does not own and records the rejection", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent($1,'shared-room','house-place-no-ownership-0001')", [
      userId,
    ]);
    await db.query(
      "insert into public.content_items(id,category,slot_type,art_key,price_minor) values('test-sofa','furniture','seat','sofa',900) on conflict(id) do update set category=excluded.category,slot_type=excluded.slot_type",
    );

    const result = await db.query<{ result: { ok: boolean; code: string } }>(
      "select public.house_place($1,'test-sofa','seat') as result",
      [userId],
    );
    const audit = await db.query<{ count: number }>(
      "select count(*)::int as count from public.game_action_audit where player_id=$1 and action='house.place' and outcome='rejected' and error_code='NOT_OWNED'",
      [userId],
    );
    expect(result.rows[0]?.result).toEqual({ ok: false, code: "NOT_OWNED" });
    expect(audit.rows[0]?.count).toBe(1);
  });

  it("rejects placing an owned sofa in a bed slot", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent($1,'shared-room','house-place-slot-check-0001')", [
      userId,
    ]);
    await db.query(
      "insert into public.content_items(id,category,slot_type,art_key,price_minor) values('test-sofa','furniture','seat','sofa',900) on conflict(id) do update set category=excluded.category,slot_type=excluded.slot_type",
    );
    await db.query(
      "insert into public.player_items(player_id,item_id,source) values($1,'test-sofa','gift')",
      [userId],
    );

    const result = await db.query<{ result: { ok: boolean; code: string } }>(
      "select public.house_place($1,'test-sofa','bed') as result",
      [userId],
    );
    expect(result.rows[0]?.result).toEqual({ ok: false, code: "SLOT_MISMATCH" });
  });

  it("charges a repeated shop purchase with the same key only once", async () => {
    await db.query(
      "insert into public.content_items(id,category,slot_type,art_key,price_minor) values('test-lamp','furniture','light','test-lamp',500) on conflict(id) do update set price_minor=excluded.price_minor",
    );
    const key = "house-shop-buy-repeat-0001";
    const first = await db.query<{ result: { ok: boolean; charged_minor: number } }>(
      "select public.shop_buy($1,'test-lamp',$2) as result",
      [userId, key],
    );
    const retry = await db.query<{ result: { ok: boolean; charged_minor: number } }>(
      "select public.shop_buy($1,'test-lamp',$2) as result",
      [userId, key],
    );
    const wallet = await db.query<{ balance: number }>(
      "select balance from public.wallets where user_id=$1",
      [userId],
    );
    const charges = await db.query<{ count: number }>(
      "select count(*)::int as count from public.transactions where user_id=$1 and metadata->>'idempotency_key'=$2",
      [userId, key],
    );
    expect(first.rows[0]?.result.charged_minor).toBe(500);
    expect(retry.rows[0]?.result).toEqual(first.rows[0]?.result);
    expect(wallet.rows[0]?.balance).toBe(4500);
    expect(charges.rows[0]?.count).toBe(1);
  });

  it("rejects a new rent request while the player already rents a house", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent($1,'shared-room','house-first-rent-current-0001')", [
      userId,
    ]);
    const retry = await db.query<{ result: { ok: boolean; code: string } }>(
      "select public.housing_rent($1,'single-room','house-second-rent-current-01') as result",
      [userId],
    );
    const audit = await db.query<{ count: number }>(
      "select count(*)::int as count from public.game_action_audit where player_id=$1 and action='housing.rent' and outcome='rejected' and error_code='ALREADY_RENTING'",
      [userId],
    );
    expect(retry.rows[0]?.result).toEqual({ ok: false, code: "ALREADY_RENTING" });
    expect(audit.rows[0]?.count).toBe(1);
  });

  it("ends a tenancy after the seven-day grace period and keeps furniture in inventory", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent($1,'shared-room','house-overdue-rent-grace-0001')", [
      userId,
    ]);
    await db.query(
      "update public.player_houses set next_rent_due_at=now()-interval '8 days' where player_id=$1",
      [userId],
    );
    await db.query(
      "update public.property_rent_cycles set due_at=now()-interval '8 days',grace_ends_at=now()-interval '5 days',rescue_ends_at=now()-interval '4 days' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );

    const state = await db.query<{
      result: { house: unknown; placements: unknown[]; inventory: { item_id: string }[] };
    }>("select public.get_house_state($1) as result", [userId]);
    const ended = await db.query<{ status: string }>(
      "select status from public.player_houses where player_id=$1 order by created_at desc limit 1",
      [userId],
    );
    expect(state.rows[0]?.result.house).toBeNull();
    expect(state.rows[0]?.result.placements).toHaveLength(0);
    expect(state.rows[0]?.result.inventory.map((item) => item.item_id)).toEqual(
      expect.arrayContaining(["starter-bed", "starter-light", "starter-seat"]),
    );
    expect(ended.rows[0]?.status).toBe("ended");
  });

  it("mirrors a legacy rental into the canonical property and rent cycle without another charge", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent($1,'shared-room','legacy-canonical-mirror-001')", [
      userId,
    ]);
    const state = await db.query<{ homes: number; cycles: number; charges: number }>(
      "select (select count(*)::int from public.player_properties p where p.user_id=$1 and p.is_active) as homes,(select count(*)::int from public.property_rent_cycles c join public.player_properties p on p.id=c.player_property_id where p.user_id=$1 and c.status='current') as cycles,(select count(*)::int from public.transactions t where t.user_id=$1 and t.category='housing_rent') as charges",
      [userId],
    );
    expect(state.rows[0]).toEqual({ homes: 1, cycles: 1, charges: 1 });
  });

  it("lists every canonical house type and rents exactly one property through the unified model", async () => {
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    const listings = await db.query<{
      result: { propertyId: string; houseTypeId: string; available: boolean }[];
    }>("select public.housing_property_listings($1) as result", [userId]);
    expect(listings.rows[0]?.result).toHaveLength(6);
    const sharedRoom = listings.rows[0]?.result.find(
      (listing) => listing.houseTypeId === "shared-room",
    );
    expect(sharedRoom?.available).toBe(true);

    const rented = await db.query<{
      result: { propertyId: string; status: string; accessoryBand: string };
    }>("select public.housing_rent_property($1,$2,$3) as result", [
      userId,
      sharedRoom!.propertyId,
      "1f10c784-9835-4b03-aee2-d631ce868001",
    ]);
    expect(rented.rows[0]?.result).toMatchObject({
      propertyId: sharedRoom!.propertyId,
      status: "current",
      accessoryBand: "basic",
    });
    await expect(
      db.query("select public.housing_rent_property($1,$2,$3)", [
        userId,
        listings.rows[0]?.result.find((listing) => listing.houseTypeId === "single-room")!
          .propertyId,
        "1f10c784-9835-4b03-aee2-d631ce868001",
      ]),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    await expect(
      db.query("select public.housing_rent_property($1,$2,$3)", [
        userId,
        listings.rows[0]?.result.find((listing) => listing.houseTypeId === "single-room")!
          .propertyId,
        "1f10c784-9835-4b03-aee2-d631ce868002",
      ]),
    ).rejects.toThrow(/ALREADY_RENTING/);
  });

  it("pays the active cycle and records the next weekly due date server-side", async () => {
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    const listing = await db.query<{ result: { propertyId: string }[] }>(
      "select public.housing_property_listings($1) as result",
      [userId],
    );
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      listing.rows[0]!.result[0]!.propertyId,
      "1f10c784-9835-4b03-aee2-d631ce868003",
    ]);
    await db.query(
      "update public.property_rent_cycles set due_at=now()-interval '1 minute', grace_ends_at=now()+interval '3 days', rescue_ends_at=now()+interval '4 days' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    const paid = await db.query<{
      result: { status: string; weeklyRentMinor: number; walletBalance: number };
    }>("select public.pay_property_rent($1,$2) as result", [
      userId,
      "1f10c784-9835-4b03-aee2-d631ce868004",
    ]);
    expect(paid.rows[0]?.result.status).toBe("current");
    expect(paid.rows[0]?.result.weeklyRentMinor).toBeGreaterThan(0);
    const cycles = await db.query<{ current: number; paid: number }>(
      "select count(*) filter (where status='current')::int as current,count(*) filter (where status='paid')::int as paid from public.property_rent_cycles where character_id=(select id from public.characters where user_id=$1)",
      [userId],
    );
    expect(cycles.rows[0]).toEqual({ current: 1, paid: 1 });
  });

  it("offers a four-instalment rescue loan after grace and revokes an ignored rescue", async () => {
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    const listing = await db.query<{ result: { propertyId: string }[] }>(
      "select public.housing_property_listings($1) as result",
      [userId],
    );
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      listing.rows[0]!.result[0]!.propertyId,
      "1f10c784-9835-4b03-aee2-d631ce868005",
    ]);
    await db.query(
      "update public.property_rent_cycles set status='rescue',due_at=now()-interval '4 days',grace_ends_at=now()-interval '1 day',rescue_ends_at=now()+interval '1 day' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    const loan = await db.query<{
      result: { option: string; status: string; instalmentsTotal: number };
    }>("select public.resolve_property_overdue($1,'loan',$2) as result", [
      userId,
      "1f10c784-9835-4b03-aee2-d631ce868006",
    ]);
    expect(loan.rows[0]?.result).toMatchObject({
      option: "loan",
      status: "paid",
      instalmentsTotal: 4,
    });
    const continued = await db.query<{ current: number; loans: number }>(
      "select (select count(*)::int from public.property_rent_cycles where character_id=(select id from public.characters where user_id=$1) and status='current') as current,(select count(*)::int from public.property_rent_rescue_loans where character_id=(select id from public.characters where user_id=$1) and status='open') as loans",
      [userId],
    );
    expect(continued.rows[0]).toEqual({ current: 1, loans: 1 });

    await db.query(
      "update public.property_rent_cycles set status='rescue',rescue_ends_at=now()-interval '1 minute' where character_id=(select id from public.characters where user_id=$1) and status='paid'",
      [userId],
    );
    await db.query("select public._advance_property_rent_cycles()");
    const active = await db.query<{ count: number }>(
      "select count(*)::int as count from public.player_properties where character_id=(select id from public.characters where user_id=$1) and is_active",
      [userId],
    );
    expect(active.rows[0]?.count).toBe(0);
  });

  it("quotes relief from the server, pays shift earnings, and saves a keep choice only after rent is paid", async () => {
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    const listing = await db.query<{ result: { propertyId: string }[] }>(
      "select public.housing_property_listings($1) as result",
      [userId],
    );
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      listing.rows[0]!.result[0]!.propertyId,
      "72fa62bd-3d79-43e6-9db1-620208201001",
    ]);
    await db.query(
      "update public.property_rent_cycles set status='rescue',due_at=now()-interval '4 days',grace_ends_at=now()-interval '1 day',rescue_ends_at=now()+interval '1 day' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    const before = await db.query<{
      result: { loanOffer: { instalmentsTotal: number }; jobOffer: { shiftsTotal: number } };
    }>("select public.housing_relief_state($1) as result", [userId]);
    expect(before.rows[0]?.result.loanOffer.instalmentsTotal).toBe(4);
    expect(before.rows[0]?.result.jobOffer.shiftsTotal).toBe(3);
    const job = await db.query<{ result: { id: string } }>(
      "select public.resolve_property_overdue($1,'job',$2) as result",
      [userId, "72fa62bd-3d79-43e6-9db1-620208201002"],
    );
    const jobId = job.rows[0]!.result.id;
    await expect(
      db.query("select public.confirm_rent_relief_hustle($1,$2,$3)", [
        userId,
        jobId,
        "72fa62bd-3d79-43e6-9db1-620208201003",
      ]),
    ).rejects.toThrow(/RENT_NOT_PAID/);
    await db.query("update public.wallets set balance=0 where user_id=$1", [userId]);
    const shift = await db.query<{ result: { earnedMinor: number; shiftsCompleted: number } }>(
      "select public.complete_rent_relief_shift($1,$2,$3) as result",
      [userId, jobId, "72fa62bd-3d79-43e6-9db1-620208201004"],
    );
    expect(shift.rows[0]?.result).toMatchObject({ shiftsCompleted: 1 });
    expect(shift.rows[0]?.result.earnedMinor).toBeGreaterThan(0);
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    await db.query("select public.pay_property_rent($1,$2)", [
      userId,
      "72fa62bd-3d79-43e6-9db1-620208201005",
    ]);
    const kept = await db.query<{ result: { id: string; keepConfirmedAt: string } }>(
      "select public.confirm_rent_relief_hustle($1,$2,$3) as result",
      [userId, jobId, "72fa62bd-3d79-43e6-9db1-620208201006"],
    );
    expect(kept.rows[0]?.result.id).toBe(jobId);
    expect(kept.rows[0]?.result.keepConfirmedAt).toBeTruthy();
    const after = await db.query<{
      result: { hustles: { id: string; rentPaid: boolean; keepConfirmedAt: string }[] };
    }>("select public.housing_relief_state($1) as result", [userId]);
    expect(after.rows[0]?.result.hustles[0]).toMatchObject({ id: jobId, rentPaid: true });
    expect(after.rows[0]?.result.hustles[0]?.keepConfirmedAt).toBeTruthy();
  });

  it("shows repossession until acknowledged and rejects another player's acknowledgment", async () => {
    const otherUserId = "8f4b82c4-a3b4-41ef-b823-05df2f171a10";
    await db.query("insert into auth.users(id) values($1)", [otherUserId]);
    await db.query("insert into public.profiles(id,display_name) values($1,'Other tenant')", [
      otherUserId,
    ]);
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,'Other','male',22,'ambitious','housing-test-job','done')",
      [otherUserId],
    );
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    const listing = await db.query<{ result: { propertyId: string }[] }>(
      "select public.housing_property_listings($1) as result",
      [userId],
    );
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      listing.rows[0]!.result[0]!.propertyId,
      "72fa62bd-3d79-43e6-9db1-620208201007",
    ]);
    await db.query(
      "update public.property_rent_cycles set status='rescue',due_at=now()-interval '5 days',grace_ends_at=now()-interval '2 days',rescue_ends_at=now()-interval '1 day' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    const state = await db.query<{
      result: { notice: { cycleId: string; houseName: string; repossessedAt: string } };
    }>("select public.housing_relief_state($1) as result", [userId]);
    const notice = state.rows[0]!.result.notice;
    expect(notice.houseName).toBeTruthy();
    expect(notice.repossessedAt).toBeTruthy();
    const housing = await db.query<{ active: number; location: string }>(
      "select (select count(*)::int from public.player_properties where character_id=c.id and is_active) as active,l.slug as location from public.characters c join public.locations l on l.id=c.current_location_id where c.user_id=$1",
      [userId],
    );
    expect(housing.rows[0]).toEqual({ active: 0, location: "city-centre" });
    await expect(
      db.query("select public.ack_housing_repossession($1,$2)", [otherUserId, notice.cycleId]),
    ).rejects.toThrow(/REPOSSESSION_NOTICE_NOT_FOUND/);
    await db.query("select public.ack_housing_repossession($1,$2)", [userId, notice.cycleId]);
    const after = await db.query<{ result: { notice: null } }>(
      "select public.housing_relief_state($1) as result",
      [userId],
    );
    expect(after.rows[0]?.result.notice).toBeNull();
    const grants = await db.query<{ player_execute: boolean; server_execute: boolean }>(
      "select has_function_privilege('authenticated','public.housing_relief_state(uuid)','execute') as player_execute,has_function_privilege('service_role','public.housing_relief_state(uuid)','execute') as server_execute",
    );
    expect(grants.rows[0]).toEqual({ player_execute: false, server_execute: true });
    await db.query("delete from public.profiles where id=$1", [otherUserId]);
    await db.query("delete from auth.users where id=$1", [otherUserId]);
  });

  it("offers a side-hustle only after grace and keeps retries idempotent", async () => {
    await db.query("update public.wallets set balance=20000 where user_id=$1", [userId]);
    const listing = await db.query<{ result: { propertyId: string }[] }>(
      "select public.housing_property_listings($1) as result",
      [userId],
    );
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      listing.rows[0]!.result[0]!.propertyId,
      "1f10c784-9835-4b03-aee2-d631ce868007",
    ]);
    await db.query(
      "update public.property_rent_cycles set due_at=now()-interval '1 day',grace_ends_at=now()+interval '2 days',rescue_ends_at=now()+interval '3 days' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    await expect(
      db.query("select public.resolve_property_overdue($1,'job',$2)", [
        userId,
        "1f10c784-9835-4b03-aee2-d631ce868008",
      ]),
    ).rejects.toThrow(/OVERDUE_OPTION_UNAVAILABLE/);
    await db.query(
      "update public.property_rent_cycles set grace_ends_at=now()-interval '1 minute' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    const first = await db.query<{ result: { option: string; status: string } }>(
      "select public.resolve_property_overdue($1,'job',$2) as result",
      [userId, "1f10c784-9835-4b03-aee2-d631ce868008"],
    );
    const retry = await db.query<{ result: { option: string; status: string } }>(
      "select public.resolve_property_overdue($1,'job',$2) as result",
      [userId, "1f10c784-9835-4b03-aee2-d631ce868008"],
    );
    expect(first.rows[0]?.result).toMatchObject({ option: "job", status: "active" });
    expect(retry.rows[0]?.result).toEqual(first.rows[0]?.result);
    const hustles = await db.query<{ count: number }>(
      "select count(*)::int as count from public.player_side_hustles where character_id=(select id from public.characters where user_id=$1)",
      [userId],
    );
    expect(hustles.rows[0]?.count).toBe(1);
  });

  it("keeps canonical tables read-only to players and server RPCs callable by service_role", async () => {
    const grants = await db.query<{
      can_read: boolean;
      can_write: boolean;
      can_place: boolean;
      can_buy: boolean;
    }>(
      "select has_table_privilege('authenticated','public.player_houses','select') as can_read, has_table_privilege('authenticated','public.player_houses','insert,update,delete') as can_write, has_function_privilege('service_role','public.house_place(uuid,text,text)','execute') as can_place, has_function_privilege('service_role','public.shop_buy(uuid,text,text)','execute') as can_buy",
    );
    expect(grants.rows[0]).toEqual({
      can_read: true,
      can_write: false,
      can_place: true,
      can_buy: true,
    });
  });

  it("opens a furniture room for a canonical rental and keeps placement after another read", async () => {
    const listing = await db.query<{ id: string }>(
      "select id from public.game_properties where slug='housing-shared-room'",
    );
    const propertyId = listing.rows[0]?.id;
    expect(propertyId).toBeDefined();
    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      propertyId,
      "c1437ab8-54dc-481c-8713-50c87ac52901",
    ]);
    const home = await db.query<{ result: { houseTypeId: string; status: string } }>(
      "select public.housing_current_home($1) as result",
      [userId],
    );
    expect(home.rows[0]?.result).toMatchObject({ houseTypeId: "shared-room", status: "current" });
    const room = await db.query<{ result: { house: { house_type_id: string } } }>(
      "select public.get_house_state($1) as result",
      [userId],
    );
    expect(room.rows[0]?.result.house.house_type_id).toBe("shared-room");
    const defaultRoom = await db.query<{
      result: { placements: { item_id: string; slot: string }[] };
    }>("select public.get_house_state($1) as result", [userId]);
    expect(defaultRoom.rows[0]?.result.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "starter-bed", slot: "bed" }),
        expect.objectContaining({ item_id: "shower", slot: "bathroom-shower" }),
        expect.objectContaining({ item_id: "toilet", slot: "bathroom" }),
        expect.objectContaining({ item_id: "stove", slot: "kitchen" }),
      ]),
    );
    await db.query(
      "update public.house_placements set item_id='computer' where player_house_id=(select id from public.player_houses where player_id=$1 and status='active') and slot='device'",
      [userId],
    );
    await db.query(
      "select public._grant_house_essentials(id) from public.player_houses where player_id=$1 and status='active'",
      [userId],
    );
    const afterRefresh = await db.query<{
      result: { placements: { item_id: string; slot: string }[] };
    }>("select public.get_house_state($1) as result", [userId]);
    expect(afterRefresh.rows[0]?.result.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "starter-bed", slot: "bed" }),
        expect.objectContaining({ item_id: "computer", slot: "device" }),
      ]),
    );
  });

  it("reports vacant, current, rent due, and overdue housing markers from server rent state", async () => {
    const listing = await db.query<{ id: string }>(
      "select id from public.game_properties where slug='housing-shared-room'",
    );
    const propertyId = listing.rows[0]?.id;
    const readMarkers = async () => {
      const result = await db.query<{
        markers: { propertyId: string; status: string; gridX: number; gridZ: number }[];
      }>("select public.housing_map_properties($1) as markers", [userId]);
      return result.rows[0]?.markers ?? [];
    };
    const initial = await readMarkers();
    expect(initial).toHaveLength(7);
    expect(initial.every((marker) => marker.status === "vacant")).toBe(true);
    expect(initial.find((marker) => marker.propertyId === propertyId)).toMatchObject({
      gridX: 1,
      gridZ: 1,
    });

    await db.query("update public.wallets set balance=10000 where user_id=$1", [userId]);
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      userId,
      propertyId,
      "7babd5af-4a39-4adb-b885-a9dedfd70701",
    ]);
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "current",
    );

    await db.query(
      "update public.property_rent_cycles set due_at=now()-interval '1 minute', grace_ends_at=now()+interval '1 day', rescue_ends_at=now()+interval '2 days' where character_id=(select id from public.characters where user_id=$1) and status='current'",
      [userId],
    );
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "rent_due",
    );

    await db.query(
      "update public.property_rent_cycles set grace_ends_at=now()-interval '1 minute', rescue_ends_at=now()+interval '1 day' where character_id=(select id from public.characters where user_id=$1) and status='grace'",
      [userId],
    );
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "overdue",
    );

    await db.query("select public.pay_property_rent($1,$2)", [
      userId,
      "c4c75334-3457-4391-b794-133f319d53c9",
    ]);
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "current",
    );
    await db.query(
      "update public.player_properties set tenure='owned', lease_ends_at=null where property_id=$1 and is_active",
      [propertyId],
    );
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "owned",
    );
    await db.query("update public.player_properties set is_active=false where property_id=$1", [
      propertyId,
    ]);
    expect((await readMarkers()).find((marker) => marker.propertyId === propertyId)?.status).toBe(
      "vacant",
    );
    const grants = await db.query<{ player_execute: boolean; server_execute: boolean }>(
      "select has_function_privilege('authenticated','public.housing_map_properties(uuid)','execute') as player_execute, has_function_privilege('service_role','public.housing_map_properties(uuid)','execute') as server_execute",
    );
    expect(grants.rows[0]).toEqual({ player_execute: false, server_execute: true });
  });
});
