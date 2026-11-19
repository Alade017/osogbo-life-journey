# Adire crafting

The City Centre dye vats and folding racks offer a server-backed crafting panel and a shared materials counter. The existing market RPCs buy cotton, dye and thread and sell finished cloth. Opening a zone, viewing a recipe or selecting an NPC tip grants nothing.

| Station                  | Materials per piece       | Real-time duration | Output               | Materials cost | Sale price |
| ------------------------ | ------------------------- | ------------------ | -------------------- | -------------- | ---------- |
| Indigo dye vats          | 2 cotton, 1 dye, 1 thread | 90 seconds         | Indigo Adire wrapper | ₦1,300         | ₦1,600     |
| Drying and folding racks | 1 cotton, 1 dye, 1 thread | 60 seconds         | Indigo Adire scarf   | ₦800           | ₦1,000     |

Prices and recipes come from the database. The counter uses game-time opening hours, 08:00–20:00. Crafting continues in real time while away. Finished pieces are sellable inventory items; wearing them on the character is not implemented by this feature. There is no extra cash charge, cash bonus, XP reward or new crafting animation.

`my_adire_crafting` returns server time, recipe quotes, owned material counts and recent jobs. `start_adire_craft` locks the owning character, verifies the unchanged quote, validates all materials and output capacity, consumes the inputs, and saves an output snapshot atomically. One unclaimed job is allowed per character. No client-provided price, duration or output is accepted.

`collect_adire_craft` checks ownership, server time, station identity, district and outside-home presence. It checks output capacity again and inserts inventory and records collection in one transaction. Full inventory leaves the job collectible after space is freed. Repeated collection returns the same receipt without another reward. Existing character locks serialize purchases, crafting and collection.

Start requests persist their nonce and quote in browser storage before submission. Uncertain responses retain that request for recovery. Saved jobs also serve as receipts. Cache failures never cause automatic replacement requests. Collection retries always use the same server job ID. The countdown is only an estimate from the latest server timestamp; the server decides readiness.

Location validation currently uses the saved district and home presence. Station IDs are checked, but precise avatar coordinates are not validated server-side; the existing neighborhood approach flow positions the avatar. Do not claim this as authoritative multiplayer proximity enforcement.

Apply migration `0107_adire_crafting.sql` with the repository's database migration process, or its identical Supabase counterpart `20261118133000_adire_crafting.sql`, using the migration path configured for the deployment. Do not apply both manually to the same database. This adds item/shop seeds, three RLS-protected tables, catalogue/start/collect RPCs and grants. There is no browser fallback if the migration is missing. Regenerate Supabase database types after applying it to the hosted database.

Local coverage executes the actual migration against the historical database fixture and exercises the existing purchase and sale RPCs, time gating, ingredient atomicity, retry receipts, ownership, location checks, stack limits, output snapshots and rollback. Panel tests cover explicit submission, durable recovery, missing materials, server-relative countdowns and collection retries. Hosted migration execution and authenticated mobile interactions require deployment verification.
