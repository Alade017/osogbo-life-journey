# Olaiya foundation and full-page worlds

2 November 2026. Implements the approved Phase 2 scope in `master-map-architecture-plan.md`, with the owner's explicit full-page routing constraint.

## Full-page world navigation

- `/map`, `/neighborhood`, `/house`, `/home` (including `?visit=`), and `/location/<slug>` bypass phone-app routing.
- The Home and Map launcher buttons close the phone and navigate to their real routes. External phone-app requests for Home, House, Map, Neighborhood or Neighbourhood follow the same rule.
- Links inside phone apps preserve the full world destination, query and fragment. Programmatic navigation to a world route also dismisses an open phone.
- The phone launcher no longer imports or mounts the house renderer, friend-home renderer or embedded city-map app. The legacy `PhoneMapApp` entry point contains only a full-page link.
- Career Life, Education, Messages and other ordinary apps retain their existing phone behavior. Property/rental listings remain apps; rendering an actual home is full-page only.

## Shared foundation

`neighborhood-geometry.ts` defines the existing projection, inverse projection, depth helper, 80-unit tile baseline and exact building/obstacle footprint adapters. The renderer and authoritative movement model now consume the same rectangle definitions. Existing movement bounds, saved-coordinate scale, room authority and collision extents remain unchanged. The visible interactive-building footprint now matches those existing authoritative extents.

`neighborhood-navigation.ts` supplies offline authoring checks. It flood-fills the existing scene using actual player occupancy rules and checks approach reachability for all authored Olaiya interaction anchors. It also checks connected components of authored road surfaces, including bounded access lanes. It does not add client-controlled runtime movement or a second navigation authority. Tests reject blocked spawns, deliberately sealed approaches and isolated road segments.

The city overview builds terrain and static district/building artwork once. Place/property/billboard marker layers update when their display data changes; a player-marker update retains terrain and unchanged marker objects. Tap activation uses the existing six-pixel/500ms gesture policy and remembers drags that return to their starting point.

The neighborhood reference scene preserves the owner's ongoing road/compound/path edits, with shared projection/footprints, roof seams and ground-contact shadows. A pooled-canvas bug found in browser review is fixed: a neighborhood canvas reused after the overview no longer retains its FIT height/margins. This matters when moving between the full-page world routes.

## Validation

- 40 distinct focused tests passed across the runs: 35 in the seven-file foundation/navigation/dashboard run, four additional launcher integration tests, and one additional road-connectivity regression in the final five-test foundation rerun.
- The separate launcher/navigation run passed 12 assertions. Launcher integration covers buttons, external neighborhood/friend-home requests, closing after programmatic navigation and absence of an embedded world canvas.
- Whole-project typecheck and scoped lint passed after the foundation changes. Logs: `.smoke/world-foundation-typecheck-verified.log`, `.smoke/world-foundation-lint-verified.log` and `.smoke/world-foundation-connectivity-lint.log`. The last source check also runs against the final connectivity addition.
- `git diff --check` passed. The production build passed with exit 0; process-status evidence is captured in `.smoke/world-foundation-build-verified.log`. Existing large-chunk/plugin-timing warnings remain.
- `node scripts/world-foundation-browser-check.mjs` exercises the actual Phaser renderers with synthetic player data at 375px and 1280px. It verifies retained terrain/markers, drag suppression, canvas cleanup, follow target and full-height neighborhood canvas after overview teardown. Screenshots: `.smoke/world-foundation-375.png` and `.smoke/world-foundation-1280.png`.
- The recorded 375px headless run sampled 60 frames with approximately 34.7ms median / 40.6ms p95 and 31 top-level scene objects. This is a local synthetic baseline, not a performance improvement claim or Android acceptance result.

## Boundaries and next review

The reference uses existing modular procedural artwork; it is not the completed semi-realistic production asset kit. Production-art approval, other districts, additional venue entrance actions, authenticated two-account room checks, actual Android performance and coordinated release validation remain open. The next district/asset phase is not implicitly implemented here.

No database migration or SQL was applied, and no commit, push, PR, room-server rollout or deployment was performed. The pure collision refactor preserves current extents; the owner's separate layout changes still require the frontend and movement server to use the same area version when released.
