# Phase 5.1 — messaging hardening

The existing phone messaging flow remains in place. This milestone bounds text-send payloads, adds a short burst limit to the existing database send function, and prevents offline preference intent from crossing account sessions.

## Implementation

- `message-api.server.ts` reads at most 16 KiB from the request stream before parsing JSON. Oversized declared or streamed payloads return HTTP 413. Validation rejects arrays and malformed destination UUIDs, while preserving the existing 1,000-character text rule, authentication, request-ID validation, and HTTP 429 rate-limit response.
- Local migration `20261027113217_messaging_hardening.sql` replaces the existing seven-argument text-send RPC. It preserves participant/friendship/block checks, same-thread quotes, replay protection, and service-role-only execution. The sender character lock serializes attempts. After replay detection, a trusted post-lock clock controls both five messages per ten seconds and twelve per minute; inserts use that same timestamp. A sender/time index supports the window checks. No voice endpoint changes were made.
- `thread-preferences.ts` partitions queues by account. Legacy entries with no owner are discarded, stored commands/durations/UUIDs are validated, and every send is bound to the intended account's token. A switch or sign-out stops a flush and preserves remaining entries. Overlapping flushes share one promise per account; entries added during a pending request survive completion. Network failures retain intent; server rejections remove rejected entries and report the error.
- `PlayerSocial` supplies its account identity for preference mutations and reconnect replay. A failed reconnect session check cannot create an unhandled rejection. Existing conversation, quote, pin, mute, styling, and voice UI are reused.

## Verification

- Focused acceptance: **45 tests passed across seven files**, including ten tests against real SQL definitions. Coverage includes outsider reads/sends/list/preferences, browser direct-write and privileged-RPC denial, same-thread/foreign-thread replies, replay protection, both rate windows and expiry, pin limits/unpin, mute ownership, streamed payload limits, account switches/sign-out, overlapping flushes, and quote confirmation/draft retention.
- TypeScript passes. Scoped lint passes for the new/changed library, test, and browser-script files. Including `PlayerSocial.tsx` reports its existing `no-explicit-any` error in the unrelated presence query; that line is unchanged.
- Game and public production builds pass. The game build required an unsandboxed retry after Nitro's existing `EPERM` user-profile `readlink` failure. The public JS remains 228.29 kB (71.03 kB gzip).
- The isolated browser fixture exercises the real `PlayerSocial`, messaging services, preference client, styles, and toast host at 375px, with synthetic auth/RPC/HTTP responses. It checks inbox, pin, mute, quoted send, rate-error draft retention, and horizontal overflow. It does not prove hosted authentication or database behavior.
- The final 375px browser fixture passes with the phone stylesheet/container loaded and no horizontal overflow; its screenshot was visually reviewed. Repository-wide lint remains at **335 errors and 12 warnings**, matching the pre-change baseline.
- Full suite: **699 passed / 1 failed across 137 files, zero skipped**, exit 1, 737.29 seconds. The sole failure is the existing `house-room-renderer.test.tsx:49` expectation that the default renderer is R3F; the application's existing default is PlayCanvas. No renderer files were changed. All messaging checks pass in this run.

Evidence is in `.smoke/messaging-{focused,typecheck,lint,global-lint,game-build,public-build,browser,full-tests}.log`; screenshot: `.smoke/messaging-375.png`. Re-run the focused suite with `npx.cmd vitest run src/test/message-api.test.ts src/test/thread-api.test.ts src/test/thread-preferences.test.ts src/test/player-social-service.test.ts src/test/player-social.test.tsx src/test/message-formatting.test.tsx src/test/messaging-database.test.ts --maxWorkers=1`. Browser fixture: `node scripts/messaging-browser-check.mjs` (installed Chrome/Edge required).

## Release boundaries

The migration is local and has not been applied to a hosted database. Apply only after verifying the target ledger contains the original social schema, formatting/voice read contracts, thread preferences, and `20261017155516_social_messaging_delivery.sql`. This migration intentionally requires the seven-argument send function contract already used by the API.

Before release, exercise authenticated participant/outsider sessions against the target RPC/API and RLS, test both rate windows and pin limits using independent database connections, and check a physical phone. PGlite uses one connection and cannot establish real lock contention behavior. No hosted SQL, deployments, commits, pushes, or history changes were performed.

Documentation references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), including function permissions and security-definer guidance. The changelog Markdown endpoint could not be read by the browsing tool; no changelog verification is claimed.
