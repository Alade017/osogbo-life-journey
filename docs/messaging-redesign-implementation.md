# Messaging interaction and audio-player redesign

Approved scope: the messaging UI milestone, including gesture actions and WhatsApp-inspired audio-message playback. Existing settings/routing/rental changes in the working tree were preserved.

## Delivered behavior

- Message bubbles no longer display Reply, Star and Report text on every message. Click, long-press, right-click or Enter/Space opens an accessible action dialog. Report opens the existing report confirmation flow; it does not immediately submit a report.
- Swipe right to reply; double-click or double-tap to star/unstar. Horizontal movement is distinguished from vertical scrolling, cancelled gestures clear pending actions, and playback controls/links are excluded. Stars retain their existing device-local storage and character scope.
- Inbox heading, conversation hover/focus treatment, message bubbles and thread header use existing design tokens. Existing search, unread/pinned conversations, message history virtualization and composer behavior remain.
- Audio messages have a circular play/pause control, decorative waveform progress, elapsed/total time, seek control, 1×/1.5×/2× playback and microphone marker. The waveform is a decorative timeline, not decoded amplitude data. Seeking is disabled until metadata loads.
- Existing authenticated signed-URL loading is retained. Duplicate playback starts are guarded, only one existing player is active, and an unmounted player cannot start after a pending URL request resolves. Recording/upload/server behavior is unchanged.

## Validation

- 23 distinct tests across five focused files passed across the focused runs, including message gestures, voice playback, private-message sending, report-menu selection, formatting and recorder-state regressions. One existing private-conversation test timed out waiting for initial inbox data during a loaded run; all nine social tests subsequently passed unchanged in isolation.
- Typecheck passed. Scoped lint for the new gesture component, voice player and changed tests passed. Including `PlayerSocial.tsx` reports its pre-existing friend-presence `no-explicit-any` error; no repository-wide lint pass is claimed.
- A 375px synthetic browser fixture confirmed rendered double-click starring, voice controls, absence of inline message-action text, no horizontal overflow, 44px composer controls and no console/network errors. Screenshot `.smoke/messaging-375.png` was visually inspected. This is not authenticated hosted messaging, physical-device gesture or signed-URL playback acceptance.
- The game production build passed on retry after fixture completion. The first attempt failed because browser-fixture cleanup removed `public/phone-ui-check.html` while Nitro copied assets. The existing large 3D chunk warning remains. Final gesture rerun: four tests passed after adding pointer capture for swipes that finish outside a bubble. `git diff --check` passed.

No migrations, hosted database writes, deployment or Git publication were performed. Venue schedules, exploration rewards and lifestyle achievements are separate remaining roadmap stages.
