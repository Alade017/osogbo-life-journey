# Milestone 10 — Player businesses and investments

This is the user-approved extension after the original Milestones 0–9. Milestone 9's outstanding hosted and device acceptance gates remain open.

## Gameplay and ownership

Earn simulated Naira → buy a catalog business → set bounded service prices → collect accrued earnings → offer shares → receive dividends. A second loop locks simulated funds in a fixed-term product until its server timestamp matures. These systems have no real-money value.

Each character may own one instance of each catalog business. Companies are not exclusive city properties. The catalog supplies virtual customer counts; no real player traffic or client-reported sales determine revenue. The owner retains at least 7,000 of 10,000 shares. Shares have a server-fixed price based on the catalog purchase price; this release has no investor resale or early fixed-term withdrawal.

Time is real elapsed server time, separate from personal simulation time. Explicit company collection requires an hour of accrual; offline earnings are capped at seven days. Actual price changes and share purchases automatically settle the earlier period at its old prices and holdings, then start a new accrual period. Saving identical prices is a no-op. Whole-Naira payouts round down; the owner receives the dividend rounding remainder. Fixed investments snapshot yield and term at opening, so product changes do not rewrite existing returns.

## Architecture and affected files

- `drizzle/migrations/0032_player_businesses_and_investments.sql`: catalogs, company ownership, shares, fixed investments, protected market reads and economy RPCs. The migration depends on the existing identity, wallet, transaction and request-receipt infrastructure.
- `src/lib/business-service.ts`: runtime validation and typed command adapter. No browser balance or ownership mutations.
- `src/lib/game.ts`: existing query/action entry points, market refresh and RPC delegation.
- `src/components/game/BusinessInvestmentApp.tsx` and `business-investment.css`: reusable phone/page UI, whole-amount validation, loading/retry states, holdings and unchanged-command retry.
- `src/routes/_authenticated/_game/businesses.tsx`, `wallet.tsx` and generated route tree: companies/investments page and Wallet entry. Existing uncommitted phone integration is preserved separately.
- `src/integrations/supabase/types.ts` and migration journal: business RPC declarations and ordered migration registration.

## Consistency and permissions

Purchase/investment receipts are scoped to the character and bind their request ID to the operation and original inputs. A lost response can be retried with the same command. Claims lock the owned investment/company; repeated fixed claims and premature company collection are rejected without a second payout.

Company mutations share one transaction-scoped advisory lock. Dividend settlement locks participating wallets in stable ID order; share transfer locks buyer/seller wallets in stable order. The shared company lock prevents competing company mutations from producing conflicting holdings or lock orders. It serializes company operations and should be measured before scaling to high concurrency. Existing unrelated economy RPCs are preserved.

The private settlement helper cannot be called by `public`, `anon` or `authenticated`; authorized security-definer RPCs invoke it. RLS protects individual holdings and fixed investments. The public authenticated company market exposes display identity and offered shares, not other players' wallets or fixed investments.

## Acceptance and verification

- Local PostgreSQL-compatible tests apply the journal in order and check insufficient funds, ownership, denied direct writes, exact-once debits, mismatched receipt inputs, old-price settlement, accrual cap, shareholder timing, conserved dividends and frozen investment terms.
- Competing purchase attempts in PGlite must not oversell shares. PGlite serializes access internally; this is not proof of concurrent transactions across hosted Postgres connections. Hosted lock/contention testing remains outstanding.
- Service tests cover malformed responses, offset timestamps, amounts, unchanged request IDs and rejected server outcomes.
- UI tests cover service-based purchase/retry, invalid amount controls, owner-offer filtering and load failures. Route matching includes `/businesses`.
- Run type checking, lint, full regression tests, production build and local preview. Record actual outcomes in `docs/release-qa.md`.

## Deployment and rollback boundary

The migration target is the main game Supabase project that owns characters, wallets and transactions (the project used by the game's Supabase client). Do not apply it to a separate multiplayer-only database that lacks that migration chain.

No hosted migration or deployment is authorized by this implementation approval. Apply 0032 only through a separately authorized controlled migration workflow, after confirming that the target ledger reaches 0031 and reviewing a backup. If an earlier draft of 0032 was already applied, do not overwrite its ledger or rerun this create-table migration; prepare a forward migration after inspecting the hosted schema.

Without 0032, the UI reports the RPC load failure and offers retry. Hosted two-account behavior, cross-device persistence, actual lock contention and mobile rendering remain release checks. Local tests/builds do not establish those results. Rollback the UI to the prior revision if necessary; preserve issued company/investment records and use a reviewed forward fix for a deployed database.
