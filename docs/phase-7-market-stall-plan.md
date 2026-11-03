# Phase 7 — rentable market stalls and player sales

Status: architecture proposal only. This document is the Phase 7 approval gate. No SQL, application code, migration, or hosted database has been changed for this phase.

## Decisions and verified baseline

| Decision | Approved value |
| --- | --- |
| Stall model | Replace free-save access; all usable player stalls require an active rental |
| Weekly rent | ₦2,000, first week paid when renting |
| Purchase price / deposit | None; rent only |
| Active rentals | One active rental per character, using the existing housing rule |
| Stall category choices | Existing five `GOODS_CATEGORIES` |
| Listings per stall | 20 distinct items |
| Owner-set price range | 1× to 5× the server-derived NPC buy-price reference |
| Seller fee | None; the seller receives the full listed amount |
| Rent viability assumption | Six weekly sales at about ₦500 listed price and ₦250 contribution per unit, plus the full ₦700 passive-income cap |

The current Market app saves a free `player_stalls` row with a name, free-text `goods` value, and open flag. That row is the stall profile, not a property lease. Phase 4.3 separately accrues ₦10 per eligible server hour, capped at ₦100 per Africa/Lagos earning day; at most ₦700 across the current and previous six earning dates is claimable. Phase 5.2 exposes open stalls through `get_public_player_stalls`. The current discovery projection and owner reads must remain private and bounded.

Housing already uses `game_properties` as its catalogue, `player_properties` as the tenancy record, and `property_rent_cycles` as the weekly rent state. The existing active-rental constraint is character-wide. Housing payment and overdue flows create seven-day cycles, allow three days of grace, then provide the existing rescue window and loan/job choices before repossession. This plan reuses those records and paths rather than creating a second rent ledger. The existing property type constraint must be extended to accept `market_stall`.

## A. Rentable market stalls

### Rental and rent-state authority

Add one active catalogue listing to `game_properties`, with `property_type = 'market_stall'`, a stable slug such as `oja-oba-market-stall`, the existing Oja-Oba location, `rent_price = 2000`, and `rent_period_days = 7`. All players rent this reusable listing; it is not an exclusive physical stall reservation.

Renting creates a normal active `player_properties` row with `tenure = 'rented'` and a matching `property_rent_cycles` row. The rental row plus its current rent-cycle row are the single source of truth for whether the stall lease is in good standing. Do not add a competing `is_rented`, rent balance, or due-date authority to `player_stalls`. The existing unique active-rental-per-character rule applies, so a player cannot hold a rented home and a rented market stall at the same time. Owned homes remain governed by their existing rules.

There is no acquisition price or deposit. The rent RPC charges ₦2,000 for the first week, creates the tenancy and rent cycle, and writes the existing wallet transaction in the same transaction. The function takes only a request UUID, derives the registered account and current character from the authenticated session, and returns a stable receipt on replay. A different operation or changed input may not reuse that receipt.

Subsequent weeks use the housing rent-payment RPC/path and its existing request receipts and transaction ledger. The same due, grace, rescue, loan/job relief and repossession lifecycle applies: a seven-day paid period; three days of grace after its due time; the existing rescue window after grace; and repossession at the existing rescue deadline. Do not fork rent settlement or relief behavior for stalls. The rent line in `/property` displays the lease amount, next due time, and current lifecycle state; the Market rent action displays first-week cost and failure/retry states.

### Existing free stalls and save gate

The migration does not silently debit players or grant a free rental. Preserve saved stall names and category text; migrate their category and close every pre-existing free stall. Before closing an enrolled open stall, settle its existing Phase 4.3 accrual through the migration transition so already-earned, unexpired income is not erased. Existing income receipts and day caps remain intact. A player must explicitly rent and pay the first week before the stall can be opened or used.

Keep the `save_player_stall(text,text,boolean)` RPC signature. In a new forward migration, replace its implementation so it resolves identity from the session, verifies an active rented `market_stall` tenancy and an in-good-standing rent cycle, validates the requested category, then updates the owner's existing stall profile. A save cannot create or reopen an unleased stall. Owner reads remain owner-only; browser writes stay revoked.

At the rent due time, the stall is logically closed immediately: it is excluded from discovery, cannot be saved open, cannot sell or buy stock, and earns no further passive income. The existing lazy rent-cycle advancement materializes the due/overdue state and closes `player_stalls.is_open`; income settlement is capped at the lease due timestamp so a delayed cycle refresh cannot extend earnings. Paying the overdue cycle restores the lease but does not silently reopen the stall; the owner explicitly opens it again through Save. Repossession makes the tenancy inactive and the stall closed, stops passive accrual and sales, and requires a new rent transaction before use. Already-settled, unexpired Phase 4.3 income remains claimable.

The eligibility rule must be shared by save, discovery, income, stock management and purchase RPCs. Checking only the saved `is_open` flag is insufficient because it can be stale between rent-cycle advancement calls.

## B. Validated stall categories

Add a server-owned `stall_categories` table with stable category IDs and labels. Seed the five currently selectable categories from `GOODS_CATEGORIES`: `fabrics` (Adire & Ankara Fabrics), `groceries` (Fresh Market Produce), `phones` (Phone Care & Accessories), `hospitality` (Street Food & Cold Drinks), and `crafts` (Handcrafted Beads & Art). Add a reserved `general` / “Other goods” fallback for migrated unknown or ambiguous legacy values; it is not a sixth normal choice in My Stall, but it can be filtered in the public directory.

Add a `stall_category` foreign-key column to `player_stalls`. Backfill exact normalized current labels and explicit aliases/keywords to their matching IDs: fabric/adire/ankara/textile; produce/grocery/fruit/yam/pepper; phone/electronic/accessory/repair; food/drink/hospitality; and craft/art/bead. Unknown or ambiguous legacy text maps to `general`. Keep the old `goods` text during this release for compatibility and auditability; it is no longer the category authority. New successful saves write the canonical category label there for older readers, while the new category ID remains the source of truth.

The existing save RPC signature is preserved. Its `p_goods` argument now accepts a known category ID (and, for compatibility, an exact canonical category label), not arbitrary free text; invalid values are rejected server-side. The client sends IDs from the existing five-option picker.

Extend `get_public_player_stalls` to return the category ID/label and accept an optional category filter. Filtering occurs in SQL before keyset pagination. The RPC continues to require a registered authenticated account, excludes the caller's own stall, includes only open stalls with an eligible current lease, and returns only the established public projection plus category fields. Update the typed service and strict parser for the new shape, and add “All”, the five existing category chips, and “Other” to `PublicStallDirectory`. Category filtering must not expose raw stall rows or additional owner data.

## C. Player-to-player sales

### Stock ownership and owner operations

Add `stall_items` with a stable item-row ID, `player_stalls` foreign key, `inventory_items` foreign key, positive unit price, nonnegative available quantity, the server-derived NPC reference price used to validate the listing, and timestamps. Enforce one row per stall/item and the database bounds for price, quantity, and item count. Each stall may have at most 20 distinct listings.

Owners stock only items they already hold. The add-stock RPC transfers the requested quantity from their `player_inventory` row into the stall's stock; it does not mint items. Increasing stock likewise requires inventory. Reducing stock or removing a listing returns its unsold quantity to the owner's inventory. Every stock mutation derives the owner from the session, requires a valid rented/open stall, locks the relevant inventory/listing records, and checks the 20-listing limit. Owners may set prices from 1× through 5× the current server-derived NPC buy-price reference; the client-supplied price is only a request, validated and stored by the owner RPC. Persist the reference used for the listing so a later catalog price edit does not silently reprice an existing item. Listings with no valid positive NPC reference cannot be stocked.

Visitors see stock and the stored server price through a read-only owner-filtered/public-stock RPC. Visitor cards have “View stock” and “Buy” actions. They cannot invoke owner stock operations, edit a price or change stock. My Stall exposes add stock, quantity adjustment, price change and remove controls with server errors surfaced to the owner.

### Atomic purchase and receipts

The purchase RPC accepts exactly a request UUID, a stall-item UUID and a quantity. It never accepts a price, buyer/seller/account ID, wallet balance, or inventory item ID from the buyer. It verifies the caller is a registered account with a character, the stall is open and currently rented, seller and buyer differ, quantity is valid, and the row still has sufficient stock. It reads the stored item and price from the locked `stall_items` row.

In one database transaction it:

1. Checks the character-scoped economy receipt and rejects reuse of a request ID for different operation/inputs.
2. Locks the relevant buyer/seller characters in stable ID order, then locks the stall-item row `FOR UPDATE`; it revalidates the open lease and available quantity after acquiring the lock.
3. Locks buyer and seller wallet rows in stable wallet-ID order, matching the existing company share-transfer wallet discipline. It verifies funds and buyer inventory capacity.
4. Debits buyer cash and credits seller cash by the full stored price × quantity (no seller fee); updates wallet income/expense totals; decrements stock; and adds the items to the buyer's existing inventory.
5. Inserts buyer-expense and seller-income rows into `transactions`, with stable categories, item/quantity/price metadata, and the request UUID; stores the immutable purchase receipt.

The row lock prevents overselling: a competing checkout waits, rechecks stock, then either purchases the remaining quantity or returns a clear “stock changed / not enough stock” error. Insufficient funds, a full inventory stack, a closed/unrented stall, or exhausted stock rolls back every write. Repeating the same request UUID and inputs returns the original receipt without a second debit, credit, inventory grant, transaction, or stock decrement. Reusing the UUID with different inputs returns an idempotency conflict.

The seller receives the full sale amount immediately in their wallet. This is sales revenue and is distinct from Phase 4.3 passive stall income. Sales do not modify the passive-income day ledger or its cap. Existing wallet transaction history shows the buyer's spend in red and seller's income in green via the existing kind/category conventions.

### Economy check

The current passive policy provides at most **₦700 per seven retained Lagos earning days**, or **₦100/day** after ten eligible open hours in each earning day. It cannot cover the approved **₦2,000 weekly rent** by itself: the shortfall is **₦1,300/week** even at the full cap.

Using the owner-confirmed illustrative sales assumption, six items per week at about ₦500 listed price and ₦250 contribution per unit produce about **₦1,500/week** in item contribution; adding the full passive cap gives **₦2,200/week**, only **₦200 above rent**. Six sales/week is therefore the minimum viable target under that assumption when the passive cap is reached. Without passive income, eight such sales/week are needed to cover rent. These are planning assumptions, not measured marketplace telemetry or guaranteed earnings. Sales volume and passive eligibility are uncertain, so the plan should communicate that rent is a recurring risk and that sales proceeds are gross seller receipts; actual net contribution depends on how the owner obtained each item.

## Files and migration boundaries

Implementation remains gated on approval of this plan. Do not modify historical migration files, including Drizzle `0032` / `0060` or any existing file in `supabase/migrations`. Create only new dated forward Supabase migrations, using the repository's migration tooling. PGlite tests should apply the new feature migrations after the existing Drizzle baseline and the Phase 4.3/5.2 migrations, following the existing stall database tests; do not duplicate or rewrite historical schema files.

Proposed new migrations, in implementation order:

1. Market-stall rental catalogue/type, RLS/constraints and legacy-stall closure with passive-income settlement.
2. Category table/backfill, `player_stalls.stall_category`, and validated save/discovery RPC replacements.
3. UUID-only first-week stall-rent RPC and receipt.
4. `stall_items`, RLS, owner stock RPCs, price bounds and inventory transfer/return logic.
5. Atomic buyer/seller purchase RPC, wallet receipts and transaction records.
6. Housing-cycle integration for stall due closure, income cutoff, overdue relief, and repossession.

Expected application/test surfaces:

- `src/components/game/phone/PhoneMarketApp.tsx`: rent entry, category picker and My Stall stock controls; retain City Shops and NPC stalls.
- `src/components/game/phone/PublicStallDirectory.tsx`: category filters, view-stock and buy flow.
- `src/components/game/StallIncomePanel.tsx` and `src/lib/stall-income-service.ts`: show rent-gated eligibility, close/cutoff states and preserve existing passive claim behavior.
- `src/lib/public-stall-service.ts`: strict category/stock/purchase parsing and safe RPC adapters; add typed rent/stock/purchase service functions (new service file if separation is clearer).
- `src/routes/_authenticated/_game/property.tsx`: current stall rent-cycle line alongside existing assets; use canonical tenancy/rent data.
- `src/integrations/supabase/types.ts`: new tables and RPC signatures, without unsafe casts in new service code.
- New focused PGlite database tests, service tests, component tests, and an isolated 375px browser check based on `scripts/stall-discovery-browser-check.mjs`.

Preserve the existing account privacy boundary, City Shops, NPC market, public directory pagination, Phase 4.3 rate/cap/retention, and existing wallet/housing behavior. Preserve all unrelated uncommitted changes in the worktree.

## Test and verification plan

- PGlite/database acceptance: market listing and `market_stall` property-type constraints; one active rental; rent-only debit and transaction; idempotent rent replay; save requires the caller's active stall tenancy; direct browser writes and cross-owner reads are denied; category IDs/labels validate and legacy mappings/fallback are correct.
- Rent lifecycle: weekly due date, three-day grace, loan/job relief, payment extension, overdue closure, passive income cutoff at the due timestamp, and repossession closing the stall and disabling sales until a new rent.
- Sales database checks: 20-listing limit; server-derived NPC reference and min/max price; stock transfer from/to inventory; invalid owner/visitor operations; exact-once purchase receipt; changed-input replay conflict; buyer and seller wallet/transaction effects; buyer inventory; rollback on insufficient funds/capacity; closed/expired lease; exhausted stock.
- Oversell test: two purchase attempts against the same finite stock row and assert the committed quantity never goes below zero and total granted items never exceeds initial stock. PGlite runs sequentially and cannot prove hosted Postgres contention; independent-connection/hosted tests remain required.
- Service/component checks: malformed RPC responses, stable retry UUID, no client-authoritative price, loading/error/empty states, owner-vs-visitor controls, category filter, unavailable/closed stall checkout, stock-runout message, rent and wallet refresh, and preserved Market behavior.
- Browser: isolated 375px Market and directory check using the existing stall-discovery fixture pattern; cover rent, category chips, owner stock, visitor stock and purchase states, with no horizontal overflow.
- Run focused tests, `npm run typecheck`, scoped lint, game build, `git diff --check`, and the focused browser script. Run relevant full regression tests as time permits. Keep the known pre-existing `house-room-renderer.test.tsx:49` renderer-default failure visible; do not change its expectation as part of this feature.
- Report exact test counts/build results and separately identify unverified concurrency. PGlite is not proof of multi-connection behavior. No hosted database changes, deployment, commit, or push are included.

## Approval boundary

This is **Step 1 only**. Please approve or request changes to this plan before implementation. After approval, implement the listed migrations and UI in stages, validate each stage, and stop at any further approval gate you specify. No code or SQL for this feature has been written yet.
