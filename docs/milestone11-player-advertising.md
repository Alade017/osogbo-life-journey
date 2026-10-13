# Milestone 11 — Player billboard advertising

## Player flow

Open the in-game phone's Billboards app, choose an active city board, write an advertiser name, headline, and description, choose a visual theme and 7, 14, or 30 day term, then purchase with simulated wallet cash. The board's daily rate is fixed by size: ₦1,000 small, ₦2,500 medium, or ₦5,000 large. The server calculates and debits the total. A campaign starts immediately and expires using server timestamps. Other authenticated players can view active campaigns as read-only content; the owner can review their current and past campaign receipts in the phone app.

There are no external links or uploaded creative assets. Text is length-limited and rendered as escaped React text. Campaigns on a shared board rotate in the city display; player ads are shown before the existing admin campaign. These are virtual game Naira values, not real advertising purchases.

## Architecture

- `drizzle/migrations/0033_player_billboard_advertising.sql` adds an owner-scoped player campaign table, read policies, a market read RPC, and an exact-once purchase RPC. The RPC checks the board, accepted text/theme/term, wallet balance, and server price, then writes the wallet and existing transaction ledger atomically.
- `src/lib/advertising-service.ts` validates market data and sends purchase commands; the browser never writes wallet balances or ad rows directly.
- `src/components/game/BillboardAdApp.tsx` and `billboard-ad.css` provide the phone purchase flow and owner history.
- `src/components/game/CityBillboards.tsx` rotates currently running player campaigns alongside existing admin ads. The ad surface gives non-owners read access only.
- `src/components/game/PhoneLauncher.tsx`, `src/lib/game.ts`, Supabase types, the migration journal, and `src/test/business-database.test.ts` wire and verify the feature.

## Verification and boundary

The local PGlite test applies migrations in journal order and checks purchase price, wallet debit, replay protection, changed-input rejection, invalid duration rejection, cross-player read access, and denied direct edits. It does not establish behavior on the hosted Supabase project. Migration 0033 is local only; review and apply it to the main game database through the controlled deployment process. No database was altered remotely and no deployment was made as part of this work.
