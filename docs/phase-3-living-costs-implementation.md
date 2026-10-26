# Phase 3.4 implementation and validation

Date: 2026-10-26, Africa/Lagos. The owner approved `phase-3-living-costs-plan.md`. Implementation is present in the owner's `5e2fa353` commit; this continuation completes validation and documentation. No later feature milestone is included.

## Delivered behavior

Home has an accessible Living costs button beside notifications and the wallet. Its dialog displays validated weekly rent, status, Lagos due dates and grace/rescue deadlines; owned and no-home states are distinct. The food row shows the minimum catalog item price among active items belonging to active vendors. Transport links to the existing map without inventing a general fare. Housing management links to `/properties`, which uses the current route/phone shell.

Queries run when the panel is open and online. Housing and food failures are independent and retryable. Cached values are labeled with their previously loaded Lagos timestamp when offline, refreshing or after a failed refresh. Missing/malformed rent never becomes a zero-price fallback. No private cost panel is mounted on the friend-home route. Character-scoped housing and user-scoped catalog keys isolate cached data; the component is remounted when the player changes.

The canonical housing query is shared with HousePage, with separate observer parsers. Existing mutation invalidations still target the same key. The new service selects only required active food catalog columns using the existing authenticated client and RLS. Existing game currency formatting is retained without a new unit conversion.

### Existing housing endpoint behavior

The panel performs no spending/travel mutations. However, the existing authenticated `/api/housing/current-home` GET invokes `housing_current_home`, whose SQL calls `_advance_property_rent_cycles()`. Reading the endpoint can therefore advance existing server rent-cycle state. This pre-existing behavior is preserved; “read-only panel” does not mean this legacy endpoint is transactionally free of writes. No additional fees, purchases, wallet updates, needs changes or rewards were introduced by the UI.

## Files

- `src/lib/living-cost-service.ts`: shared canonical housing query, validated cost parsing and active menu/vendor reads.
- `src/components/game/LivingCostsSummary.tsx`: dialog, source states, retries, timestamps and navigation.
- `src/components/game/HomeDashboard.tsx`, `home-dashboard-view.css`: compact trigger and responsive styling.
- `src/routes/_authenticated/_game/house.tsx`: shared query options with existing normalization retained through `select`.
- `src/test/living-cost-service.test.ts`, `living-costs.test.tsx`: data, read boundary, dialog, offline, retry, owned-home and cache-isolation checks.
- `scripts/living-cost-browser-check.mjs`: isolated 375px real-component/style fixture with synthetic data and no hosted connection.
- This report, the approved plan and `release-qa.md`: scope and verification record.

## Validation evidence

The continuation's typecheck, scoped ESLint, game build and public build passed. Final focused cost checks: **27 tests across two files passed**, exit 0 (13.14 seconds). The added offline test initially left TanStack Query's global online manager offline after unmount; its cleanup now explicitly restores that manager. The cache-isolation test passes after this correction. Final review also tightened tenure validation to reject arrays and guarded explicit refreshes until both account and character IDs are ready; both have focused coverage.

The previous full suite completed with **583 passed / 1 failed, 126 files**. The continuation's full run completed with **587 passed / 2 failed, 127 files**, exit 1 (733.08 seconds). It ran the cache-isolation test before its cleanup correction; that failure is resolved in the final focused rerun above. Its other failure is the existing renderer test expecting an R3F default while the owner's `house-room-contract.ts` change defaults to PlayCanvas. The renderer contract is preserved. The full run predates the final two focused boundary cases and validation guards; no aggregate green-suite claim is made. An additional full rerun was not performed after those small, directly tested corrections.

The real browser fixture passed at **375 × 812**, with no horizontal overflow or external requests: rent and menu prices, cached offline labels, no offline request, close/reopen and focus restoration. It recorded one housing GET and no spending/travel request. Screenshot: `.smoke/living-cost-375.png`. An earlier run failed the focus check; the harness now waits for focus restoration and enables browser focus emulation. No production dialog change was needed. These synthetic states do not prove authenticated gameplay, real room-control interaction, hosted prices, RLS or phone hardware performance.

Implementation-time global lint: **329 errors / 12 warnings** in existing source. Scoped lint is separate evidence and does not imply the repository-wide command passes. Logs are under `.smoke/living-cost-*.log` and are ignored local artifacts.

## Security, migration and release boundaries

No SQL migration or dependency was added. Existing bearer-token verification, RLS and authoritative purchase/travel RPCs remain responsible for identity, eligibility and charged prices. The displayed menu minimum is informational and may change before purchase. No secret/admin key is imported into the new browser module. No hosted schema/data writes, deployment, Git commit/push or history rewrite were performed by this work.

Live authenticated pricing/ownership, hosted schema prerequisites, actual device performance and complete room/phone interaction remain unverified. Later milestones and renderer adoption work remain outside this approval. The renderer test mismatch is an owner decision about the separate renderer change, not a reason to silently revert it or update its test expectations in this slice.
