import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261123150000_character_creation_clothing_defaults.sql",
  "utf8",
);

it("stores new characters dressed and locks footwear and headwear to their defaults", () => {
  expect(migration).toContain("array['skin','hair','hairColor','outfit','bottoms']");
  expect(migration).toContain("jsonb_build_object('shoes',0,'headwear',0,'clothed',true)");
  expect(migration).not.toContain("array['skin','hair','hairColor','outfit','bottoms','shoes','headwear']");
});
