import postgres from "postgres";
process.loadEnvFile(".env");
let sql;
try {
  sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
  console.log(
    "Business security:",
    JSON.stringify(
      await sql`select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname in ('business_catalog','player_companies','player_company_shares','fixed_investment_products','player_fixed_investments') order by relname`,
    ),
  );
  console.log(
    "Personal clock and home actions:",
    JSON.stringify(
      await sql`select position('elapsed*s.speed/60' in prosrc)>0 as real_minute_rate,position('furniture' in prosrc)>0 as home_actions from pg_proc where oid='public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)'::regprocedure`,
    ),
  );
  console.log(
    "Migration ledger:",
    JSON.stringify(
      await sql`select hash,created_at from drizzle.__drizzle_migrations order by created_at`,
    ),
  );
  console.log("Clock:", JSON.stringify(await sql`select public.world_clock()`));
  console.log(
    "Simulation security:",
    JSON.stringify(
      await sql`select relname,relrowsecurity from pg_class where oid in ('public.character_simulations'::regclass,'public.simulation_action_receipts'::regclass,'public.city_event_participation'::regclass)`,
    ),
  );
  console.log(
    JSON.stringify(
      await sql`select schemaname,tablename from pg_tables where schemaname in ('public','drizzle','supabase_migrations') order by schemaname,tablename`,
    ),
  );
  console.log(
    JSON.stringify(
      await sql`select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`,
    ),
  );
} catch (error) {
  console.error(
    error.code === "ERR_INVALID_URL"
      ? "Invalid DATABASE_URL"
      : String(error.message).replaceAll(process.env.DATABASE_URL || "[unset]", "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await sql?.end();
}
