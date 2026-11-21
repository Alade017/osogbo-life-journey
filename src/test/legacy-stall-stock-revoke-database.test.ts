// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";

const migration = "supabase/migrations/20261122010000_revoke_legacy_stall_stock.sql";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    -- Stub with the live signature. Supabase grants execute to PUBLIC by default.
    create function public.manage_my_stall_stock(p_action text, p_item_id uuid, p_quantity integer, p_price_minor bigint)
    returns jsonb language sql as $$ select '{}'::jsonb $$;
    grant execute on function public.manage_my_stall_stock(text,uuid,integer,bigint) to anon, authenticated, service_role;
  `);
  await db.exec(readFileSync(migration, "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

it("closes the four-argument stock overload to browser roles and keeps it for the owner", async () => {
  const { rows } = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(
    `select has_function_privilege('anon','public.manage_my_stall_stock(text,uuid,integer,bigint)','EXECUTE') as anon,
            has_function_privilege('authenticated','public.manage_my_stall_stock(text,uuid,integer,bigint)','EXECUTE') as authenticated,
            has_function_privilege('service_role','public.manage_my_stall_stock(text,uuid,integer,bigint)','EXECUTE') as service`,
  );
  expect(rows[0]).toEqual({ anon: false, authenticated: false, service: true });
});
