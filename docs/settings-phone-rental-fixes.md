# Settings, phone links and rental listing fixes

Date: 2026-11-01 (Africa/Lagos).

Game-page links to registered phone apps now open the existing PhoneLauncher rather than navigating the background page. Bottom navigation retains full-page navigation. External links, authentication routes, downloads, explicit new-tab targets and modified clicks retain browser behavior. Existing in-phone history and friend-visit search parameters are reused.

Audio controls remain visible during profile loading/failure. Until a profile is available, controls apply only to browser audio settings; the UI explains this and retains profile retry/error information. The game layout no longer writes muted preferences merely because the profile has not loaded. A master-volume control exposes previously hidden zero-volume state. Failed audio activation restores prior levels, and failed music previews display an unavailable state.

Rental catalogues load independently of wallet requests. A wallet failure leaves homes visible and offers a wallet retry; renting remains blocked until balance and server eligibility are confirmed. An empty catalogue now offers a real catalogue refresh instead of reporting a filter mismatch. Existing rental RPCs, eligibility rules, request receipts, prices and accounting are unchanged.

## Evidence and limits

- Initial browser request to `/settings` reached Login without console/network errors; the isolated browser had no authenticated session.
- A read-only check of the configured Supabase database found six active house types and populated catalogue associations. For one sampled existing character, both housing listing and eligibility projections returned six homes. The audio preference columns also exist. No hosted writes, rent attempt, migration or deployment was performed.
- A synthetic 375px browser fixture used the real Settings and Rentals components, local music assets and synthetic account responses. Audio controls rendered, music playback reported playing, and homes remained visible with a failed wallet response. The screenshot `.smoke/settings-rent-375.png` was visually inspected. Autoplay was explicitly permitted in the fixture; this does not establish ordinary browser gesture permissions, audible hardware output or authenticated player success.
- Focused regression coverage includes phone routing exceptions, audio volume and activation recovery, missing-profile controls, rental visibility during wallet loading/failure, rental submission, and existing housing SQL/API acceptance.
- Typechecking, scoped lint and the game production build passed. The build retains a large 3D chunk warning. No full-suite or physical-device acceptance is claimed.

These fixes do not complete the deferred milestone roadmap or establish that every reported player failure has the same cause. Account-specific authenticated verification remains necessary.
