import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/migrations/0060_phone_community_apps.sql"),
  "utf8",
);

describe("phone community app database contract", () => {
  it("creates durable records for every new phone app", () => {
    for (const table of [
      "town_events",
      "food_orders",
      "okada_ride_requests",
      "community_contributions",
      "town_news_posts",
      "player_course_plans",
      "npc_market_stalls",
      "player_stalls",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
  });

  it("keeps balance-changing actions inside retry-safe server functions", () => {
    expect(migration).toContain("request_food_delivery");
    expect(migration).toContain("request_okada_ride");
    expect(migration).toContain("contribute_to_community_fund");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("economy_request_results");
    expect(migration).toContain("for update");
  });

  it("enables row-level security and narrowly grants the app RPCs", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on function");
    expect(migration).toContain("grant execute on function");
  });
});
