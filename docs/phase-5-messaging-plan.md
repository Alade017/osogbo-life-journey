# Phase 5.1 — existing phone messaging hardening

Status: approved and implemented locally. See `phase-5-messaging-implementation.md` for validation and release boundaries.

## Source audit

The existing phone already opens `PlayerSocial` for Messages. It provides a conversation list and detail view, text composition, quoted replies, and pin/mute controls. `player-social-service.ts` sends through the authenticated message API; reads use `get_social_messages`. `party-service.ts` remains the separate party gameplay service.

Existing database infrastructure includes participant-only conversation/message read policies, friendship and block checks on private sends, same-channel/thread reply validation, request-ID replay protection, three pinned chats per account, and server-calculated mute durations. The delivery migration serializes sends using the sender character lock and preference changes using the account lock. No replacement messaging schema or parallel phone app is needed.

Verified gaps:

- The message API checks the trimmed text length only after unrestricted `request.json()` parsing. It has no application-level byte limit for the entire payload and does not validate destination UUID syntax.
- The current delivery SQL permits 12 messages per minute but has no short burst window. Keep that existing sustained limit and add the requested five-message/ten-second burst limit.
- The offline thread-action queue uses one local-storage key without an account owner. Reconnect flushes queued actions using the current session token. Database membership still gates each action, but queued intent can cross an account switch, including accounts that share a conversation.
- Current thread API concurrency coverage uses a JavaScript lock stub. It does not prove database concurrency. Existing shared-HUD SQL tests cover pin limits, mute expiry, blocking, and quoted messages; dedicated messaging coverage should exercise the delivery migration and negative access paths explicitly.

These are source findings, not claims about a hosted project's migration state. Existing voice functionality belongs to the current application; this milestone adds no voice functionality.

## Architecture and game loop

Keep the current loop: open Messages, select an authorized conversation, compose text or choose Reply, send through the existing API/RPC, and refresh the conversation and inbox. Pin and mute remain preferences on that same conversation. Server confirmation determines persistence; client state cannot grant membership or bypass limits.

1. Bound message request bodies to 16 KiB while reading the stream, including absent or misleading Content-Length headers. Reject oversized requests with HTTP 413 before parsing JSON. Keep the 1,000-character text rule, reject malformed destinations and arrays, and preserve existing API/error contracts for valid requests.
2. Add a local forward migration updating the existing text-send function. Preserve its signature, idempotency replay, friendship/block checks, quote validation, and service-role-only execution. Enforce both five sends per ten seconds and the existing twelve per minute after the sender lock; use a trusted clock captured after lock acquisition. Keep replay requests exempt from consuming another send. Do not change voice endpoints or their policy.
3. Make offline preference intent account-owned. Resolve and verify the current account before enqueue/send/flush; partition storage by account, discard legacy ownerless entries, validate stored commands/durations/IDs, and stop a flush if the session changes. Do not move entries between accounts. Preserve existing offline pin/mute behavior for the same account.
4. Add focused regression coverage using the real SQL definitions and the existing client/API seams. Extend UI coverage only where needed for text reply, preference confirmation/error, and account switching; reuse existing styling and phone navigation.

No new economy rewards, party invitation behavior, discovery feature, messaging provider, or voice implementation is included.

## Validation and delivery boundaries

- API: authentication failure, bounded chunked payloads, malformed/oversized input, exact text boundary, UUID validation, rate-limit HTTP mapping, and quoted-message forwarding.
- Database: authorized send/read/list; outsider denial for reads, sends and preferences; direct-write and privileged-RPC denial; same-thread quotes and rejected foreign-thread quotes; duplicate request replay; both rate windows and expiry; pin cap/unpin; own mute durations and isolation. Exercise the new migration after its prerequisites.
- Queue: account A's actions never execute using account B's session, including a session change during flush; invalid legacy/stored actions are discarded; same-account reconnect remains functional.
- Phone: existing conversation/send/reply/pin/mute flows, error feedback, and 375px layout. A fixture browser check is separate from authenticated hosted verification.
- Run focused tests, TypeScript, scoped lint, game/public builds, diff checks, then the full test suite. Report unrelated failures explicitly.

Local SQL emulation cannot establish cross-connection lock behavior. Hosted migration application, authenticated multi-account checks, real concurrent sends/pins, and physical-device testing remain separate release checks. This proposal authorizes no hosted SQL, deployment, commits, pushes, or history changes.
