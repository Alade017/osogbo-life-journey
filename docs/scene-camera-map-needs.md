# Scene camera, Map and needs usability

This is the first approved batch from the November 24 media review. It preserves the bank worlds, travel confirmation, balances, needs rules and server-owned activities.

## Bank camera

The former fit changed zoom using the lot dimensions while leaving the camera at the generic scene position. Large geometry could cross the near plane, and the fit used canvas space covered by the weather strip, bank header and controls.

The bank now computes conservative bounds from the actual transformed parts, fits those bounds inside the measured unobstructed viewport and moves the camera far enough back to contain the compound. HUD resizing and newly mounted messages trigger measurement. Reset view restores this fit; Follow character uses the moving actor position with a closer zoom. Area changes stop follow. Manual orbit and existing click-to-walk remain available. The generic map and Home cameras are unchanged.

## Destination selection

Phone Map entries link to the existing location detail/travel route. Entries present in the existing landmark-to-location mapping also offer Locate on map. Locations, fares, availability and confirmation remain under the existing data and travel flow. Tapping the Map dock while already on the city map closes the directory instead of opening it again; Map HUD behavior over other worlds is preserved.

## HUD and needs

Mobile destination services sit closer to the location header. Destination services and scene actions share a native details group so opening one closes the other in browsers supporting named details. Bank controls reserve space above the needs rail. The needs trigger displays a help hint and opens directly to the most urgent need's existing action. Following a Home/phone suggestion also clears the expanded-HUD state. No new need recovery, consumption, fare or payment rule is introduced.

## Validation scope

Projection tests cover both banks, all three areas, narrow phones, portrait phones, landscape phones and laptops, including clipping and HUD clearance. Component checks cover reset/follow, phone destination links, Map history and urgent-needs actions. Real WebGL, touch gestures and measured performance still require browser/device verification; the projection and component tests do not substitute for those checks.
