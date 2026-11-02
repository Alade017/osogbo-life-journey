# Career Life and Education

Career Life replaces the Jobs launcher label and bottom-navigation label while retaining `/jobs` and the legacy `Jobs` phone-app alias. Overview shows the current role, recorded earnings, completed shifts, and workplaces; Opportunities retains existing job applications and work controls; Work history lists current/past employment plus paginated activity and payments; Learning embeds Education.

Education uses the existing course catalogue, campus-visit requirement, wallet and energy checks, and authoritative `complete_education_course` action. All, Saved, and Completed collections support course/provider search. Bookmarks persist for the current character in the existing `player_course_plans` table and can be removed independently of course completion. Saving never enrolls the player or spends money.

## Database

Local migration: `supabase/migrations/20261101232845_career_life_and_saved_courses.sql`. Requires the existing course-plan (Drizzle 0060) and career-progression (0076) schema. It has not been applied to hosted Supabase by this implementation.

- `set_saved_course(text, boolean)` derives ownership from authenticated identity, validates courses, serializes per-character/course requests, and accepts an explicit desired state for safe retries. It preserves existing bookmarks.
- `get_career_life_summary()` aggregates all retained employment counters and all income transactions categorised `job` or `career_shift`; it does not infer earnings from current salaries or truncate totals to the latest 30 shifts.
- `player_career_events` records future joins, departures, and promotions through a protected employment trigger. Browser access is read-only and protected by owner RLS. Existing job/employment/wallet RPCs remain authoritative.
- `get_career_life_history(integer)` returns 20 display records plus one pagination sentinel, combining role events and historical job/career payments. New activity can shift offset pages; refresh or return to the first page for the newest records.

Employment records are unique per character/workplace, so repeated employment shares a record. Existing first-hired and last-worked dates remain available, but past departure/promotion dates are not invented. Detailed role events start when this migration is applied. Income totals reflect retained transaction history; they do not reconstruct deleted records. Saving remains separate from the existing instant enroll-and-complete game loop.

## Validation

- 28 distinct focused tests passed across career-learning UI, the real migration in PGlite, existing career progression/promotion/rules, and phone navigation (27 in the combined run, followed by the final eight-test database run after adding the payment-label regression).
- SQL coverage includes save/unsave retry behavior, no payment/progression side effects, other-player isolation, direct-write denial, anonymous denial, role-event recording, retained employment, full metrics beyond page limits, and history pagination.
- Synthetic 375px browser fixture passed metrics, timeline, navigation, save/bookmark collection, touch-target and horizontal-overflow checks. Run `node scripts/career-learning-browser-check.mjs`; screenshot: `.smoke/career-learning-375.png`. These fixtures do not establish hosted Supabase or authenticated multiplayer behavior.
- Whole-project type checking currently reports unrelated errors in `PlayableNeighborhood.tsx` and `phaser-neighborhood.ts`; no Career Life/Education errors were reported.
- Scoped ESLint passed for the changed Career Life/Education components, routes, service, tests, navigation, and browser fixture. Scoped `git diff --check` passed.
- Production client and SSR bundles compiled. The final Nitro build is blocked by unrelated Phaser default-import errors in the current map/neighborhood work. The first sandboxed attempt also encountered the Windows user-profile `readlink` permission error; the unrestricted retry reached the Phaser errors.

Hosted migration/RLS verification and signed-in gameplay against that hosted schema remain pending. Local PGlite tests use one connection and do not verify independent-connection contention.
