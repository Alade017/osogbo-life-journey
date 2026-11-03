# Food Delivery Lifecycle

Food and ride requests remain charged only by the existing server-authoritative RPCs from Drizzle migration 0060. The dated Supabase migration adds delivery state to those tables and fails early if the Drizzle schema and its home/economy prerequisites are missing; it does not recreate or duplicate that schema.

New food orders start approved (`preparing`) with a short server-side delivery delay. Existing `requested` orders are approved and existing requested rides are assigned without changing wallets or transaction history. A food order advances through `pending`, `awaiting_response`, `approaching`, `package_waiting`, and `collected`. A courier can only be prompted or handed off while the authenticated character is inside their own active home. Choosing inside animates the courier into the room; choosing outside keeps them at the doorway. Packages retain their vendor and menu-item labels until their owner collects them.

The house calls `process_home_food_deliveries()` while the owner is home. Response, handoff, collection, and history reads are owner-scoped RPCs; the browser never updates order state directly. Ride requests are returned as `assigned`; no driver-arrival sequence is implied.

Focused local validation:

```powershell
npm.cmd test -- src/test/food-delivery-database.test.ts src/test/community-phone-apps.test.tsx src/test/home-food-delivery-panel.test.tsx src/test/house-room-renderer.test.tsx src/test/phone-community-database.test.ts
npm.cmd run typecheck
```

The PGlite test applies the dated migration against a prerequisite fixture and covers backfill, exact-once charges, home-only arrival, owner isolation, handoff, collection, and RPC grants. A hosted migration or deployment is not part of local implementation validation.
