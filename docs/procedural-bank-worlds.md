# Procedural Cedar and Meridian banks

The bank rebuild uses the supplied **Osun Commercial Bank Environment & Technical Specification** while retaining the game's existing `cedar-bank` and `meridian-bank` identities, saved location IDs and bank RPCs.

## Shared architecture, distinct branches

`src/game/bank-world-layout.ts` owns dimensions, solid parts, fixtures, entrances, standing slots and signs. `ProceduralBankArchitecture` batches repeated geometry by material. `BankLobbyScene` keeps one Canvas mounted while switching between the courtyard, hall and first-floor cutaway. An upper-floor cutaway is normalized to ground height for its camera; the exterior still shows the two physical storeys and 4.5 m floor division.

The revised interior is 30 × 27 m (810 m² per floor), enlarged from 26 × 24 m (624 m²). Furniture keeps its existing dimensions. The matching exterior footprint and 50 × 40 m compound preserve room for parking, side paths and the exterior ATM gallery. Dimensions supersede the original specification in response to the requested larger interiors.

| Section         | Cedar                                                                                                      | Meridian                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Identity        | Emerald, warm timber and cream                                                                             | Navy, pale stone and glass                                   |
| Frontage        | Central timber portico, stepped parapet and symmetrical entrance                                           | Navy entrance frame, projecting glass wing and offset canopy |
| Courtyard       | 8 parking bays                                                                                             | 10 parking bays                                              |
| Teller line     | 5 windows                                                                                                  | 6 windows                                                    |
| Staircase       | Left side                                                                                                  | Right side                                                   |
| Customer care   | Four aligned cubicles                                                                                      | Four staggered cubicles                                      |
| Shared compound | 50 × 40 m, five exterior ATMs, CCTV details, gate/security booth, power annex, shaded walkway and bollards | Same functions with the branch's own palette and placement   |

Exterior refinements include side-elevation windows and sill bands, downpipes, inset roof decks and parapets, tilted solar modules, separate entrance/ATM canopies, open gate geometry, parking stripes outside the utility annex, kerbed side paths, lighting columns and rounded planters/trees. Box, cylinder and faceted-sphere shapes remain instanced by material and shape.

The ground floor includes the security vestibule, metal-detector frame, waiting chairs, writing/forms table, queue-service kiosk, screened teller windows, cash trays, workstations and counting/POS props. Upstairs includes account desks, a meeting/advisory room, manager desk and a blocked vault/server section. Linked chairs, stanchions, lights, workstations and bollards share instanced material batches rather than allocating a separate draw per prop.

The old bank hall and ATM GLBs, imported-mesh fitting/collision helpers and asset-specific tests were removed. Embedded venue callers reuse the same hall geometry within their previous bounds. No bank model loader, external texture or font download remains.

## Connected behavior

- Confirmed arrival opens the hall directly. A 1.5-second visual security scan opens the inner glass door; the outer door remains closed. This is presentation, not a new server security guarantee or a complete mantrap simulation.
- Click/tap a visible service, door or staircase to walk to its accessible approach point. `E` activates a nearby fixture. Accessible buttons expose the same actions.
- Rendered solid parts generate the clearance grid. Routes use the existing sampled grid walker; blocked routes do not fall back to straight-line movement. Staff and real online visitors receive separate clear positions in the hall.
- Door and staircase approaches change the viewed bank area. Stair transitions switch floor cutaways after approach; continuous vertical stair-climbing physics is not implemented.
- ATM/teller/customer-care selections open the existing bank service drawer after arrival. Opening the drawer cancels pending scene movement. Transactions, balances, account eligibility and online presence remain server-owned.
- Real branch presence currently has no authoritative floor coordinates. Other players are represented only in the hall; the rebuild does not fabricate upstairs/courtyard multiplayer poses.

## Specification boundaries

The scene does **not** add client-only financial rules. Posted hours, ATM daily caps, transfer fees, card upgrades, Platinum queue skipping, new loan/investment products, salary gates, random network/cash events and timed queue allocation require their own server-backed implementation. The queue kiosk currently opens the existing teller workflow; it does not invent a ticket number or queue wait.

The named Dell OptiPlex/HP EliteBook model entries were not found in the checked-out catalog. All bank desks reuse the same procedural workstation builder; no branded asset support is claimed. The architecture is grouped into a small fixed set of material batches plus signage/doors. Actual total draw calls and mobile FPS, including avatars and other application renderers, require live WebGL profiling; the specification's 120-draw target is not claimed as measured.

## Validation

Navigation tests check all active fixtures and floor transitions for both branches, branch differences, finite geometry, vault exclusion and the advisory-room doorway. Existing bank travel, account, drawer and server interaction checks remain in place. Typecheck, lint, production build and the full suite are run before publication.

Live GPU rendering, touch orbit and device performance remain unverified in this environment. No production deployment or merge is part of this change.
