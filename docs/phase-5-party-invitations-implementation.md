# Phase 5.3 — player party invitations

Party hosts can invite real players through existing public-player search. Recipients have an Invitations tab in the shared Party experience, with Accept/Decline controls. Accepted accounts get exactly one guest membership. Invitation acceptance does not fulfil requirements, count as attendance, travel, or change money, mood or reputation.

## Server implementation

Local migration `20261028151428_party_invitations.sql` requires the existing party-life, club/activity and host-reputation migrations. It adds:

- Account-unique invitations per event, with pending/accepted/declined state and trusted timestamps.
- Guest memberships unique by event/account, linked to the invitation. The acceptance-time character reference can become null after character deletion; the account membership remains unique.
- Durable account/request UUID receipts bound to exact operation payloads. Receipts survive character/event deletion; replay returns the earlier historical confirmation without recreating rows. Reusing a request UUID for different input is rejected.
- Participant/owner SELECT policies as defense in depth. Raw invitation, guest and receipt tables have no browser read/write grants; service-role administration remains available. Narrow RPC projections return display fields and public identifiers, never account IDs.

`party_invitation_action` validates its discriminated send/respond input and derives the caller from Auth. Only the original registered host can send; only the intended registered recipient can respond. Both need valid current characters. New transitions require an uncancelled event whose end has not passed and no player block in either direction. Scheduled and live events are supported. An exact retry or same confirmed decision cannot add another guest; an opposite decision after resolution is rejected. Sending again to an already resolved recipient returns that existing status without reissuing or notifying again.

Lock order is request receipt advisory lock, event row, host quota advisory lock for sends, invitation row, then character rows in UUID order. Time is captured after the locks. The existing party contribution and reward functions are unchanged. Sends are limited to 50 distinct recipients per event and 20 new invitations per host account per minute. The quota counts durable creation receipts, so deleting a host character/event does not reset the account's recent send limit. Duplicate sends do not consume another invitation slot or new-send quota.

New invitations and their single recipient notification commit together. Accepting inserts membership and resolves the invitation in one transaction; failure of either write rolls back both. Decline inserts no membership. The existing notification views show a notice directing the recipient to Party → Invitations.

`get_party_invitations` is a STABLE read RPC with registered-character gating. Incoming pages contain only the recipient's own invitations. Host event pages require original-host ownership. It uses deterministic UUID keyset paging, 20 rows by default and at most 50, with explicit cancellation/end phases and response eligibility derived from trusted time and current records. Reads never write. Host controls are attached to the existing visible event cards; recipients can see retained accepted/declined history in their inbox. Deleting an event or original host character removes its invitations and guest rows; receipts remain historical confirmations.

## Client and shared UI

`party-invitation-service.ts` validates pages, state consistency, public fields, UUIDs and confirmations. It checks account identity before/after requests. `PartyInvitations.tsx` supplies lazy host controls, existing player lookup, paged recipient/host lists, visible/online polling, focus/manual refresh, and Lagos display times. The shared route adds the Invitations tab, which the phone app inherits.

Mutations are disabled offline and never deferred. A synchronous guard blocks duplicate clicks. Ambiguous responses retain the same request UUID and intent for explicit retry. A refreshed canonical snapshot can recover a committed response without a duplicate success toast. Only validated RPC confirmations update cached rows; if a subsequent list refresh fails, a confirmed acceptance remains visibly confirmed rather than becoming an actionable pending card. Unmount guards suppress late success. Confirmed operations refresh account-scoped invitation queries and the existing notifications query. Missing invitation infrastructure leaves the existing Party tabs/hosting/contribution flow usable.

## Validation

- Final focused suite: **66 tests passed across eight files**, including 17 real-SQL checks and nine new panel checks. The final confirmed-cache/wallet-fixture regression run also passed all 26 database/UI tests.
- SQL checks include sender/recipient/outsider permissions, both block directions, registered identity/current characters, live/scheduled/expired/cancelled events, duplicate sends and decisions, opposite-decision rejection, receipt binding, rate/event limits, paging, notification rollback, membership-write rollback, account recreation, deletion, raw-table denial and defensive RLS. Concrete wallets are seeded; invitation operations leave balances, character stats, mood, fulfilments, requirements and reward eligibility unchanged.
- The isolated 375px browser fixture exercises the real shared Party route, invitation panels and invitation service, with synthetic auth/RPC responses and substituted venue/activity/reward/multiplayer providers. It covers host lookup/send, pending confirmation, recipient inbox, offline blocking, pending acceptance, confirmed membership, decline and unavailable invitation reads while Clubs remains usable. It does not prove authenticated hosted gameplay, real notification delivery, or multiplayer behavior.
- TypeScript, scoped lint, game/public production builds and diff checks pass. Nitro required an unsandboxed retry after its existing user-profile `readlink` restriction. The public JS remains 228.29 kB (71.03 kB gzip). Repository-wide lint remains **335 errors and 12 warnings**, matching the baseline.
- The final 375px fixture passes after tab-spacing and confirmed-response recovery changes, with no horizontal overflow; its screenshot was visually reviewed. All four tab labels fit with the existing 44px minimum touch height.
- Full-suite outcome is recorded below when complete.

Focused command: `npx.cmd vitest run src/test/party-invitations-database.test.ts src/test/party-invitation-service.test.ts src/test/party-invitations.test.tsx src/test/party-rewards-database.test.ts src/test/party-reward-service.test.ts src/test/party-host-results.test.tsx src/test/party-event-clock.test.tsx src/test/phone-party-app.test.tsx --maxWorkers=1`.

Browser fixture: `node scripts/party-invitations-browser-check.mjs` (installed Chrome/Edge required). Evidence: `.smoke/party-invitations-{database,client,focused,final-regressions,typecheck,lint,global-lint,game-build,public-build,browser,full-tests}.log` and `.smoke/party-invitations-375.png`.

## Release boundaries

No hosted migration, production write, deployment, commit or push was performed. Verify the target baseline/ledger before applying the local migration. Exercise host, recipient and outsider authenticated sessions against actual RPC/RLS, verify notification delivery, and test physical phones. PGlite has one connection: real cross-connection send/response/deletion races remain release checks. Receipt replays confirm historical success; they never restore a deleted party or character.

Official guidance checked: [Supabase database functions](https://supabase.com/docs/guides/database/functions). The browsing tool could not read the changelog Markdown endpoint, so no changelog verification is claimed.
