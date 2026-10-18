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
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8"));
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
});
