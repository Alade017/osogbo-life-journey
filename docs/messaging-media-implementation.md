# Chat composer, attachments and player profile cards

Implemented the approved messaging milestone locally, preserving the earlier working-tree changes.

## Player behavior

- Removed the explanatory footer beneath Messages. Chat rows now separate the avatar/profile control from the conversation control and retain virtualization, unread badges, search and thread actions.
- The padded composer contains the text box, emoji, attachment, camera, voice recorder and Send controls. Existing recording gestures and draft/reply behavior remain.
- The camera asks for video permission only on activation, offers capture/preview/cancel and a photo-picker fallback, and stops tracks on dismissal/unmount or a late permission response. Per-attempt guards reject old permission/capture results after reopening and prevent duplicate camera starts. Physical-camera behavior is not established by synthetic tests.
- Attachments support JPEG, PNG, WebP and PDF files up to 10 MiB. Selection opens a preview before sending. A failed send retains the same file/request receipt for explicit retry; there is no offline upload queue.
- Clicking an avatar opens a profile card inside the phone. It shows character name, avatar, level and relationship. Background images and active statuses are available only to the owner and current friends; reciprocal blocks make the card unavailable. Owners can preview/save or remove their background through Messages settings.

## Authority and storage

Local migration: `supabase/migrations/20261101222456_messaging_media_and_profile_covers.sql`, generated with Supabase CLI. It requires the social/status/voice baseline and the messaging-hardening function. Review the target ledger and mixed migration chains before deployment; do not use a blanket reset or assume every local migration is deployed.

`social_media_uploads` stores server-generated immutable object paths, content hashes, request receipts and message associations. `social_profile_covers` selects the owner's active cover. Both tables deny browser access. The private `social-media-v1` bucket has a restrictive browser policy so a broad existing permissive storage policy cannot expose its objects.

The server authenticates the caller, bounds the streamed multipart body, checks file size and MIME signature, and reserves an upload through a service-only RPC. Reservation binds the owner, purpose, thread, filename, MIME type, size and SHA-256 digest to the request ID. New reservations are limited to 20 per character/server hour. Object uploads never overwrite existing bytes. Finalization rechecks access, calls the existing message-send function with its rate limits, and records the metadata in the same database transaction. Ambiguous final responses never trigger object deletion.

Attachment history is added through `get_social_messages_with_media`, which delegates to existing history authorization and enforces reciprocal block/thread access. Existing clients still see the attachment filename as ordinary message text. New clients fall back to the old history RPC only when the new function is absent, preserving text-chat availability before deployment.

Opening an attachment authenticates and rechecks access before issuing a 60-second signed URL. PDFs are signed for download. Profile output is explicitly allowlisted at the API boundary; it excludes email, wallet, exact location, needs and internal storage-path fields. Client results are checked against the current account before display, and caches are scoped by character/target.

No hosted migration, bucket creation, storage write, deployment or Git publication was performed. File sharing and background persistence need this migration and server deployment before hosted use. Existing deployment prerequisites and authenticated owner/friend/outsider sessions must be exercised there. Signed links already issued can remain valid for their short expiry after access is removed. Abandoned uploads and superseded private cover objects are retained; automated storage-retention cleanup is not part of this milestone.

## Validation boundaries

Local SQL checks use the existing migration baseline in ephemeral PGlite plus a storage-schema fixture. They test actual SQL authorization, receipts, rollback, rate limits and grants; they do not reproduce independent PostgreSQL connections or hosted Storage service behavior.

The 375px browser fixture uses real messaging components with synthetic account responses. It verifies avatar/profile activation, permitted status rendering, footer removal, recorder/composer containment, five 44px controls and no horizontal overflow. Run `node scripts/chat-media-browser-check.mjs`. The final rerun passed against the current stylesheet; screenshot `.smoke/chat-media-375.png` was visually inspected. It does not prove physical camera capture, microphone permissions, live upload/download delivery or real-device accessibility.

## Final local results

- Nine-file focused run: **41 passed, zero skipped**. Includes eight real-SQL checks, API/storage authorization and retry cases, client account-switch checks, chat sending, voice playback and gesture regressions. Final camera suite: **7 passed**, adding two distinct lifecycle cases for **43 distinct passing tests** across the validation runs. The cancel/reopen case was also rerun individually after strengthening its portal-dismissal assertion and passed; six other cases were excluded by that diagnostic filter.
- An earlier loaded run timed out in the existing private-conversation test; the final 41-test run passed it unchanged. Final test evidence: `.smoke/chat-media-final-tests.log` and `.smoke/chat-media-camera-tests.log`.
- Final `npm.cmd run typecheck` passed; evidence `.smoke/chat-media-typecheck.log`.
- Scoped ESLint reports only the pre-existing friend-presence `no-explicit-any` error in `PlayerSocial.tsx`. New components, services, server routes, tests and browser script have no other scoped lint findings. Evidence `.smoke/chat-media-lint.log`.
- Final `npm.cmd run build` passed outside the sandbox after Nitro's initial user-profile `readlink` permission failure. The final build includes the camera lifecycle guard. Existing large 3D chunk warnings remain.
- `git diff --check` passed. No full-suite, global-lint or public-build pass is claimed for this milestone.

The new API routes regenerated `src/routeTree.gen.ts`. `src/styles.css` changed concurrently during the task and was left untouched by this implementation; earlier local settings/routing/rental changes were preserved.
