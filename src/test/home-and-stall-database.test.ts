// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// A player may hold one home and one market stall at the same time.
// The fixture replays the real migration chain, the recorded live functions and the new migration.

let db: PGlite;
const player = "91111111-1111-4111-8111-111111111111";
const requestId = (n: number) => `93000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

async function asPlayer() {
  await db.query("select set_config('test.user_id',$1,false)", [player]);
}

async function listingId(slug: string) {
  return (
    await db.query<{ id: string }>("select id from public.game_properties where slug=$1", [slug])
  ).rows[0]!.id;
}

async function activeTenancies() {
  return (
    await db.query<{ kind: string; tenure: string; slug: string }>(
      `select tenancy.housing_kind as kind, tenancy.tenure, listing.slug
         from public.player_properties tenancy
         join public.game_properties listing on listing.id = tenancy.property_id
         join public.characters character on character.id = tenancy.character_id
        where character.user_id = $1 and tenancy.is_active
        order by tenancy.housing_kind, listing.slug`,
      [player],
    )
  ).rows;
}

async function balance() {
  return (
    await db.query<{ balance: number }>("select balance from public.wallets where user_id=$1", [
      player,
    ])
  ).rows[0]!.balance;
}

async function cycleFor(kind: "home" | "stall") {
  return (
    await db.query<{ id: string; status: string; amount_minor: number }>(
      `select rent.id, rent.status, rent.amount_minor
         from public.property_rent_cycles rent
         join public.player_properties tenancy on tenancy.id = rent.player_property_id
        where tenancy.user_id = $1 and tenancy.is_active and tenancy.housing_kind = $2
          and rent.status in ('current','due','grace','rescue')
        order by rent.due_at limit 1`,
      [player, kind],
    )
  ).rows[0];
}

async function deny(sql: string, params: unknown[], reason: string) {
  await db.exec("savepoint expected_failure");
  await expect(db.query(sql, params)).rejects.toThrow(reason);
  await db.exec("rollback to expected_failure;release expected_failure");
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create schema realtime;
    create table auth.users(id uuid primary key,email text,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function realtime.topic() returns text language sql stable as $$select ''::text$$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement)
      returns void language plpgsql as $$begin return;end$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);

  const migrationFiles = readdirSync("drizzle/migrations")
    .filter(
      (file) =>
        file.endsWith(".sql") &&
        !file.startsWith("0075_") &&
        !file.startsWith("0083_") &&
        !file.startsWith("0084_") &&
        file !== "0077_market_stall_rent_categories_sales.sql",
    )
    .sort();
  for (const file of migrationFiles) {
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/^\uFEFF/, ""));
  }
  for (const file of [
    "supabase/migrations/20261027104102_stall_passive_income.sql",
    "supabase/migrations/20261028143246_public_player_stall_discovery.sql",
    "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
    "supabase/migrations/20261111024351_shared_home_tenancy_tables.sql",
    "supabase/migrations/20261111024630_shared_home_join_leave.sql",
    "supabase/migrations/20261111025428_shared_home_placements.sql",
    "supabase/migrations/20261111025959_shared_home_tenant_space.sql",
  ]) {
    await db.exec(readFileSync(file, "utf8"));
  }
  await db.exec(`insert into auth.users(id) values ('${player}');
    insert into public.profiles(id,display_name) values ('${player}','Tenant');
    insert into public.jobs(slug,name,description,salary,energy_cost)
      values('housing-test-job','Test job','Test wage',10000,1)
      on conflict(slug) do update set salary=excluded.salary;
    insert into public.characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step)
      values('${player}','Tenant','female',22,'ambitious','housing-test-job','housing');
    insert into public.wallets(user_id,character_id,balance)
      select user_id,id,5000000 from public.characters where user_id='${player}';`);
  await db.exec(
    readFileSync("drizzle/migrations/0077_market_stall_rent_categories_sales.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261121234233_stall_stock_receipts.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261122210000_record_live_behaviour_functions.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261123040000_home_and_stall_together.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261123130000_retire_legacy_property_rent.sql", "utf8"),
  );
}, 240_000);

beforeEach(async () => {
  await db.exec("begin");
  await asPlayer();
});

afterEach(async () => {
  await db.exec("rollback;reset role;");
});

afterAll(async () => {
  await db?.close();
});

describe("home and market stall together", () => {
  it("holds a rented home and a rented stall at the same time, each tagged by kind", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(1),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(2)]);

    expect(await activeTenancies()).toEqual([
      { kind: "home", tenure: "rented", slug: "housing-shared-room" },
      { kind: "stall", tenure: "rented", slug: "oja-oba-market-stall" },
    ]);
  });

  it("still refuses a second stall while one is held", async () => {
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(3)]);
    await deny("select public.rent_market_stall($1::uuid)", [requestId(4)], "ALREADY_RENTING");
    expect(await activeTenancies()).toEqual([
      { kind: "stall", tenure: "rented", slug: "oja-oba-market-stall" },
    ]);
  });

  it("still refuses a second home while an owned home is held, even with a stall", async () => {
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(5)]);
    await db.query("select public.acquire_game_property($1,'owned')", [
      await listingId("garden-court-flat"),
    ]);
    await deny(
      "select public.housing_rent_property($1,$2,$3)",
      [player, await listingId("housing-shared-room"), requestId(6)],
      "ALREADY_RENTING",
    );
    expect((await activeTenancies()).map((row) => row.slug).sort()).toEqual([
      "garden-court-flat",
      "oja-oba-market-stall",
    ]);
  });

  it("switching the rented home leaves the rented stall in place", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(7),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(8)]);
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("garden-court-flat"),
      requestId(9),
    ]);

    expect(await activeTenancies()).toEqual([
      { kind: "home", tenure: "rented", slug: "garden-court-flat" },
      { kind: "stall", tenure: "rented", slug: "oja-oba-market-stall" },
    ]);
  });

  it("pays home rent and stall rent from their own cycles", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(10),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(11)]);
    // Every statement shares one transaction here, so now() is fixed. Backdate the period start so
    // the payment's next period does not collide with the one created when the rent started.
    await db.query(
      "update public.property_rent_cycles set due_at = now() - interval '1 hour', period_start_at = now() - interval '8 days' where status = 'current'",
    );
    const stall = await cycleFor("stall");
    const home = await cycleFor("home");
    const before = await balance();

    const paidHome = await db.query<{ result: { weeklyRentMinor: number } }>(
      "select public.pay_property_rent($1,$2) as result",
      [player, requestId(12)],
    );
    expect(paidHome.rows[0]?.result).toBeTruthy();
    expect(await balance()).toBe(before - home!.amount_minor);
    expect((await cycleFor("stall"))?.id).toBe(stall?.id);
    expect((await cycleFor("stall"))?.status).toBe("grace");

    await db.query("select public.pay_market_stall_rent($1::uuid)", [requestId(13)]);
    expect(await balance()).toBe(before - home!.amount_minor - stall!.amount_minor);
  });

  it("the home rent payment never pays a stall cycle", async () => {
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(14)]);
    await deny("select public.pay_property_rent($1,$2)", [player, requestId(15)], "NO_RENT_DUE");
  });

  it("the retired legacy collector bills nothing, even when its old due date has passed", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(16),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(17)]);
    const before = await balance();
    const result = await db.query<{ result: { retired: boolean; paid: number } }>(
      "select public.process_my_property_rent() as result",
    );

    expect(result.rows[0]?.result).toMatchObject({ retired: true, paid: 0 });
    expect(await balance()).toBe(before);
  });

  it("the legacy rent ledger and tenancy due date are gone", async () => {
    const ledger = await db.query<{ name: string | null }>(
      "select to_regclass('public.property_rent_ledger')::text as name",
    );
    const column = await db.query<{ count: number }>(
      "select count(*)::int as count from information_schema.columns where table_schema = 'public' and table_name = 'player_properties' and column_name = 'next_rent_due_at'",
    );
    expect(ledger.rows[0]?.name).toBeNull();
    expect(column.rows[0]?.count).toBe(0);
  });

  it("relief is per kind: a stall overdue offers the stall relief and never the home's", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(18),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(19)]);
    await db.query(
      `update public.property_rent_cycles rent
          set status = 'rescue', grace_ends_at = now() - interval '2 days', rescue_ends_at = now() + interval '1 day'
         from public.player_properties tenancy
        where tenancy.id = rent.player_property_id and tenancy.user_id = $1
          and tenancy.housing_kind = 'stall' and rent.status = 'current'`,
      [player],
    );
    const stall = await cycleFor("stall");
    expect(stall?.status).toBe("rescue");

    const homeRelief = await db.query<{ result: { loanOffer: unknown; jobOffer: unknown } }>(
      "select public.housing_relief_state($1,'home') as result",
      [player],
    );
    expect(homeRelief.rows[0]?.result).toMatchObject({ loanOffer: null, jobOffer: null });

    const stallRelief = await db.query<{ result: { loanOffer: { principalMinor: number } } }>(
      "select public.housing_relief_state($1,'stall') as result",
      [player],
    );
    expect(stallRelief.rows[0]?.result.loanOffer).toMatchObject({
      principalMinor: stall!.amount_minor,
    });

    await deny(
      "select public.resolve_property_overdue($1,'loan',$2,'home')",
      [player, requestId(20)],
      "OVERDUE_OPTION_UNAVAILABLE",
    );
    const resolved = await db.query<{ result: { status: string } }>(
      "select public.resolve_property_overdue($1,'loan',$2,'stall') as result",
      [player, requestId(21)],
    );
    expect(resolved.rows[0]?.result.status).toBe("paid");
  });

  it("a stall repossession ends only the stall and leaves the player where they are", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(22),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(23)]);
    const elsewhere = (
      await db.query<{ id: string }>(
        "select id from public.locations where slug <> 'city-centre' limit 1",
      )
    ).rows[0]!.id;
    await db.query("update public.characters set current_location_id = $1 where user_id = $2", [
      elsewhere,
      player,
    ]);
    await db.query(
      `update public.property_rent_cycles rent
          set status = 'rescue', grace_ends_at = now() - interval '5 days', rescue_ends_at = now() - interval '1 minute'
         from public.player_properties tenancy
        where tenancy.id = rent.player_property_id and tenancy.user_id = $1
          and tenancy.housing_kind = 'stall' and rent.status = 'current'`,
      [player],
    );
    await db.query("select public._advance_property_rent_cycles()");

    expect(await activeTenancies()).toEqual([
      { kind: "home", tenure: "rented", slug: "housing-shared-room" },
    ]);
    const location = await db.query<{ current_location_id: string }>(
      "select current_location_id from public.characters where user_id = $1",
      [player],
    );
    expect(location.rows[0]?.current_location_id).toBe(elsewhere);
  });

  it("a rent relief job is for the rental it names", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(27),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(28)]);
    await db.query(
      `update public.property_rent_cycles rent
          set status = 'rescue', grace_ends_at = now() - interval '2 days', rescue_ends_at = now() + interval '1 day'
         from public.player_properties tenancy
        where tenancy.id = rent.player_property_id and tenancy.user_id = $1
          and tenancy.housing_kind = 'stall' and rent.status = 'current'`,
      [player],
    );
    await deny(
      "select public.apply_rent_relief_hustle($1,$2,'home')",
      [player, requestId(29)],
      "RENT_RELIEF_UNAVAILABLE",
    );
    const applied = await db.query<{ result: { status: string } }>(
      "select public.apply_rent_relief_hustle($1,$2,'stall') as result",
      [player, requestId(30)],
    );
    expect(applied.rows[0]?.result.status).toBe("active");
  });

  it("joins a shared room while a stall is held, and not while a home is rented", async () => {
    const roomListing = await listingId("housing-shared-room");
    const unit = (
      await db.query<{ id: string }>(
        "insert into public.shared_home_units(game_property_id,label,capacity) values ($1,'Unit A',2) returning id",
        [roomListing],
      )
    ).rows[0]!.id;

    await db.query("select public.rent_market_stall($1::uuid)", [requestId(31)]);
    const joined = await db.query<{ result: { bedSlot: number } }>(
      "select public.shared_home_join($1,$2,$3) as result",
      [player, unit, requestId(32)],
    );
    expect(joined.rows[0]?.result.bedSlot).toBe(1);
    expect((await activeTenancies()).map((row) => row.kind)).toEqual(["home", "stall"]);
  });

  it("refuses a shared room join while a home is rented", async () => {
    const unit = (
      await db.query<{ id: string }>(
        "insert into public.shared_home_units(game_property_id,label,capacity) values ($1,'Unit B',2) returning id",
        [await listingId("housing-shared-room")],
      )
    ).rows[0]!.id;
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("garden-court-flat"),
      requestId(33),
    ]);
    await deny(
      "select public.shared_home_join($1,$2,$3)",
      [player, unit, requestId(34)],
      "ALREADY_RENTING",
    );
  });

  it("cancelling a rented home ends its rent and keeps the stall", async () => {
    await db.query("select public.housing_rent_property($1,$2,$3)", [
      player,
      await listingId("housing-shared-room"),
      requestId(24),
    ]);
    await db.query("select public.rent_market_stall($1::uuid)", [requestId(25)]);
    await db.query("select public.cancel_player_house($1)", [player]);

    expect(await activeTenancies()).toEqual([
      { kind: "stall", tenure: "rented", slug: "oja-oba-market-stall" },
    ]);
    await deny("select public.pay_property_rent($1,$2)", [player, requestId(26)], "NO_RENT_DUE");
  });
});
