# Reference-inspired world presentation

Approved direction: the four house, cooker and street screenshots supplied on 3 November 2026. They guide composition and interaction, not imported artwork or another game's economy.

## House and accessories

- Elevated, fixed cutaway framing replaces the previous front-facing stage camera. Responsive framing includes the diagonal room width.
- Existing owned placements, room partitions, interior colours and free placement remain intact. Furniture is not granted or inserted by the visual layer.
- Accessories have no floating task text. Clicking their geometry opens an accessible, dismissible bottom sheet with catalogue-derived duration, cost and benefits. Keyboard controls stay hidden until focused.
- Walls are shorter in the normal view and collapse further while editing. Editing uses a higher camera angle centred on the floor. The catalogue sits beside the house on desktop and below it on phones.
- Cooker cards offer Jollof rice, Indomie & egg, and plantain & beans as meal preferences. All invoke the same existing cooking action with the same rules. Preferences are not persisted recipes, inventory items or distinct reward paths.
- Shop and Go outside use clean white pill controls; existing sleep, offline and error controls remain available.

## Character and streets

- `WorldCharacter` renders the same saved appearance indoors and outdoors, including skin, clothing, hair, body settings and supported equipment indicators. It uses our own geometry and the existing avatar palette constants.
- Activity and movement presentation uses a bounded 15fps invalidation timer and respects reduced motion. Network positions and action authority remain unchanged.
- Streets gain instanced sidewalk geometry, recognizable benches, bins, lamps and signs, detailed shopfronts, and short place labels. Building footprints continue to use the existing shared collision contract.
- Town and house routes remain full-page views; the phone does not own their canvases.

## Ownership boundaries

No database, migration, RPC, pricing, reward or travel-rule changes are part of this adaptation. Existing economy and simulation services remain authoritative. Newer interior colours were explicitly preserved by the owner; character colours come from saved appearance settings.

## Verification

Focused component and parser tests cover meal selection, action availability, duplicate-submit prevention, closing, malformed snapshots and saved appearance fields. The isolated browser fixture checks rendering at 375px and 1280px, shared characters, camera targets, styled task labels, cooker-panel interaction, pointer selection, returning-drag suppression and scene cleanup. It uses synthetic data and software rendering; it does not establish authenticated gameplay, hosted permissions or physical Android performance.

Final local results: 44 focused tests passed; typecheck, scoped lint, production build and whitespace checks passed. The browser fixture passed at both widths, including equal saved character colours indoors/outdoors and visible dialog/label styling. Logs are `.smoke/reference-adaptation-tests.log`, `.smoke/reference-adaptation-typecheck-final.log`, `.smoke/reference-adaptation-lint.log`, `.smoke/reference-adaptation-build.log` and `.smoke/reference-adaptation-final-browser.log`.

Preview artifacts: `.smoke/world-accessory-375.png`, `.smoke/world-restyle-house-1280.png` and `.smoke/world-restyle-neighborhood-1280.png`.
