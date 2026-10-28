# Phase 5.3 — player party invitations

Status: approved and implemented locally. See `phase-5-party-invitations-implementation.md` for validation and release boundaries.

## Source audit

The working tree was clean at owner commit `94ee5eb8`. Both the phone Party app and `/party` reuse `PartyExperience` in `routes/_authenticated/_game/party.tsx`. EventsTab already lists scheduled/live events, hosts events, and submits requirement contributions through `party-service.ts`.

Existing party tables contain events, requirements and fulfilments. Searches across the SQL migrations and application source found no party-invitation table, accepted guest-list table, or invitation RPC. NPC social “invite” actions are a separate local relationship mechanic and do not invite real accounts to these events.

`respond_to_event` validates a registered account, live event, saved venue presence and contribution eligibility before recording fulfilment. Host reputation counts actual registered contributors after the event. An invitation acceptance must not call this function, fulfil a requirement, count as attendance, add mood/reputation, or charge money.

The existing notifications table and phone/route notification views can display a server-created invitation notice. They are not an invitation state machine. The authoritative Accept/Decline controls belong in the shared Party experience, not in an independent phone implementation.

## Architecture and game loop

The host opens their scheduled/live event, chooses Invite player, and selects another real player through existing public-profile/friend lookup services. The server confirms the invitation. The recipient opens Party → Invitations, reviews the event title, host display name, venue and real-world Lagos time, and chooses Accept or Decline. Accepting adds one confirmed guest membership only after server validation. The host sees pending responses and accepted guests for that event.

Invitation response does not teleport anyone or replace the normal travel, venue-entry, contribution or reward loop. Public events retain their current participation rules; invitations are not a new admission requirement.

### Database and authorization

Add a local forward migration after the existing party and host-reputation migrations:

- Persist invitations uniquely by event and recipient account, with pending/accepted/declined state and trusted timestamps. Persist accepted guest memberships uniquely by event and guest account. Use registered account identity to prevent duplicate membership through character recreation; require a valid current character when accepting. Validate that the event still belongs to its original host character/account.
- Server-derived caller identity only. Sending requires the original registered host, a valid registered recipient with a character, a scheduled event whose end has not passed, and no block in either direction. Reject self-invites, unknown targets, cancelled/ended events and unauthorized hosts. Permit scheduled or currently live events; use server time after locking.
- Accept/Decline is recipient-only, transitions only pending invitations, and rechecks event state, host/recipient eligibility and blocks. Accept and guest insertion happen in one transaction. A repeated same decision returns confirmed state; an opposite decision after resolution is rejected. Decline creates no guest row. Do not allow reissuing a declined invitation in this milestone.
- Serialize send/respond operations on the event, then invitation, and any required character rows in a consistent order compatible with existing event-first contribution/reward locking. Recheck event state after waiting for locks. Exact duplicate sends return the existing invitation rather than creating another row or notice.
- Bound invitation spam: proposed maximum 50 distinct recipients per event and 20 new invitations per host account per minute, serialized server-side. Duplicate retries do not consume quota. These are proposed starting limits, not existing game rules.
- Use request UUIDs and durable receipts for send/respond so lost-response retries do not duplicate invitations, memberships or notices. Derive all notification content from trusted records; create at most one recipient notice per new invitation in the same transaction.
- Enable participant-scoped RLS as defense in depth, deny direct browser writes, and keep account-bearing invitation/guest rows off direct browser SELECT. Expose narrowly granted read RPCs with explicit projections: host can read their event's invitation statuses and guest display names; recipient can read their own invitations and confirmed membership. Outsiders cannot discover private invitations or guest lists. Return public event/character identifiers and display fields only, not account IDs or private profile data.
- Derive expired/cancelled display states from the event and server time on reads, without background jobs or read-side writes. Pending expired invitations cannot be accepted. Retain accepted membership history, but never label a cancelled event as attendable.

Keep existing event, contribution, mood, wallet and reputation function definitions unchanged. No historical migration edits or hosted SQL application.

### Shared UI and service

Add typed invitation service/parsers and small reusable host/recipient panels to PartyExperience. Use account-keyed queries and reset selection/pages after account changes. Reuse existing public player search and display-name conventions; do not create another player directory or expose account identifiers.

Show loading, empty, unavailable/retry, expired/cancelled, pending-confirmation and confirmed-response states. Disable mutations offline with no deferred queue, guard same-tick duplicate clicks, retain request IDs after ambiguous network errors, and refresh authoritative state before presenting success. Suppress late success toasts after unmount/account changes. Refresh visible online lists periodically and on focus; use bounded/paginated results rather than unbounded account history.

Invalidate relevant invitation/guest/notification queries only after confirmed mutations. A missing invitation migration must leave the existing event hosting and contribution UI usable. Reuse design tokens and support 375px phone layouts. Display times explicitly in Africa/Lagos, separate from simulated world time.

## Acceptance and delivery

- Real SQL: authorized host send; recipient accept/decline; outsider denial; self/blocked/anonymous/no-character denial; pending-only transitions; expired/cancelled rejection; duplicate sends/decisions and lost-response replay; unique membership; rate/event caps; participant projections and raw-table/direct-write restrictions.
- Verify acceptance inserts membership and resolves the invitation atomically, while decline/rejection does not insert membership. Simulate notification failure to confirm transaction rollback. Verify invitation reads do not write, and no invitation operation changes wallet, mood, contribution counts, fulfilments or host-reward eligibility.
- Exercise guest/account character-recreation behavior and event/character deletion paths explicitly; no accidental transfer of host authority. Independent-connection acceptance/send races remain a separate release check from single-connection SQL emulation.
- Service/UI tests: player selection, response states, offline/pending behavior, request-ID retry, account isolation and query refresh; shared phone/route integration and missing-migration isolation. Isolated 375px browser flow for host and recipient with synthetic responses, clearly distinguished from hosted authenticated testing.
- Re-run existing party/reward/clock/phone tests, TypeScript, scoped lint, game/public builds, diff checks, and the full suite. Report unrelated existing renderer/lint failures if reproduced.

Verify target migration prerequisites and exercise host, recipient and outsider authenticated sessions against the actual RPC/RLS before release. This plan authorizes no hosted SQL, production writes, deployments, commits, pushes or history changes. Phase 6 goals remain a separate milestone.
