# Phase 3.4: living-cost display

Date: 2026-10-25, Africa/Lagos. Status: proposed; implementation awaits approval. Baseline: `408c2541` (`implemented login streak`), clean working tree before this document.

## Verified findings

- `HomeDashboard.tsx` and `home-dashboard-view.css` place the status bar over a full-viewport room. There is no living-cost summary. Adding a permanent card would compete with room controls, especially at 375px.
- `house.tsx` already reads `/api/housing/current-home` using `['canonicalHousingHome', characterId]`. The authenticated server handler resolves the user from the bearer token and invokes `housing_current_home`. The client model includes tenure, weekly rent, due date, status and grace/rescue deadlines. Its current normalizer defaults missing rent to zero; a cost display must validate the raw amount rather than interpreting that fallback as free housing.
- `PhoneCommunityServices.tsx` reads `food_vendors` and `food_menu_items`. Migration `0060_phone_community_apps.sql` restricts reads to active rows; ordering additionally requires an active vendor and matching active menu item. A minimum must therefore join visible menu items to visible vendors. The inspected food-order RPC sums item price times quantity without a separate delivery surcharge. This is a catalog price, not evidence that ordering completes an eating action or restores needs.
- The phone okada service has its own configured flat booking charge. Map travel and client transport estimates are separate systems. `map-api.ts` exposes travel mutations, not a general read-only quote in the inspected contract. Do not invoke travel to obtain a price or present the phone booking charge as the map fare.
- `formatNaira` formats existing game currency directly; despite historical `_minor` field names, introducing a new divide-by-100 conversion would disagree with current displays.

These are repository findings. Hosted schema, live prices and authenticated gameplay have not been checked in this audit.

## Proposed architecture and game loop

Add a compact **Living costs** button alongside the home status controls. It opens an accessible dialog using existing UI components and design tokens. Keep the room full-screen, avoid room edit/navigation controls, and show this only on the player's own Home view. Opening the panel performs reads only; closing returns focus to the button.

The panel contains three independent rows:

1. **Housing:** validated weekly rent, tenure, server rent status and due date, with grace/rescue deadlines when present. Owned homes must not imply a rent debt; unknown or unsupported tenure/status must remain explicit. A successful no-home response shows no current home, while failed or malformed responses show unavailable. Link to existing housing management. Do not calculate arrears from weekly rent or infer rent-free status from missing data.
2. **Food:** “Menu items from [amount] each” from active items belonging to active vendors. Explain that selection and quantity determine the order total; direct the player to the existing Phone → Food Delivery app through plain navigation guidance. Do not add a new phone-launch event contract for this slice. Empty catalog and unavailable catalog have separate states. Never seed a fallback price into the UI.
3. **Transport:** “Cost depends on your destination and travel option,” with navigation to the existing travel interface. No numeric fare until the existing travel flow supplies the relevant information. No phone booking fee or client estimate is relabeled as a server map quote.

Supporting copy: budget for weekly housing and individual food/travel purchases; use existing jobs to earn cash and leave room for savings. No promised income, automatic purchases, new fees, reward changes or combined daily burn-rate estimate. Weekly rent, per-item food and per-trip travel are different periods and must not be added together.

## Data and failure handling

- Reuse the canonical housing query contract and key. Extract a small shared read/query helper if necessary so Home and HousePage do not make competing requests or disagree about cache shape. Preserve existing housing behavior; apply strict cost validation at the display boundary without replacing its saved-home fallback logic.
- Add a typed read-only cost service for active food vendors/menu items, selecting only required columns. Validate finite safe integer prices and vendor associations; reject malformed responses instead of showing zero. Use authenticated reads and existing RLS. No privileged browser key, new RPC, dependency or migration is expected.
- Scope private housing cache by the current character and prevent prior-account data appearing after sign-out/account change. Fetch only when the panel is open and the session/character is ready. Catalog data can use a distinct cost-summary query key to avoid changing the phone app's existing cache contracts.
- Revalidate on open/reconnect/focus while visible. Show loading, retryable failure and offline states separately for each source. Cached data must be clearly marked as previously loaded with a timestamp; it must not be represented as a newly verified price. Server mutations remain the final authority if prices change between reading and buying.
- Keep rent and food queries independent so one failed source does not hide the others or block the room. No optimistic wallet changes and no new simulation timer/provider.

## Expected files and acceptance

Expected additions: `LivingCostsSummary.tsx`, a small typed cost service/query helper, focused service/component tests and an implementation report. Expected edits: `HomeDashboard.tsx`, its CSS, minimal canonical-home query sharing in `house.tsx` if needed, and release QA documentation. Resolve exact navigation targets against the router before implementation. No MapCanvas, login-streak, shared-needs or simulation behavior change is planned.

After approval, verify:

- Correct weekly amounts, due dates/status, owned/no-home/malformed states; no missing-data zero; no private data on friend visits or after account changes.
- Active menu/vendor intersection, empty catalog, invalid amounts, independent failure/retry/offline/cached states and correct currency formatting.
- Opening, refreshing and closing the panel never invokes spending/travel RPCs or changes wallet/needs/rewards.
- Keyboard focus, accessible dialog name, focus restoration and 375px layout with room/status/edit controls reachable and no horizontal overflow.
- Focused tests, typecheck, scoped lint, production builds and the full regression suite. Report existing global lint debt separately. Browser fixtures prove only their exercised states; live authenticated pricing/RLS requires its own evidence.

## Approval boundary

Approve implementation of **Phase 3.4 only**, as the read-only home cost panel above. This document introduces no application changes, SQL, hosted writes, Git commits/pushes or deployment. Later phases remain deferred. This documentation-only turn runs `git diff --check`; historical Phase 3.3 test results are not new validation of this proposal.
