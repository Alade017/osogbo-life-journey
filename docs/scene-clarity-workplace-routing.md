# Scene clarity and workplace routing — first upgrade

This is the first implementation of stages 1–2 of the approved scene/career plan. It builds on the existing renderer, location registry and Colyseus movement authority. It does not complete all 20 design laws or the later career architecture stages.

## Implemented

- Shared device-quality limits now cover general scenes, venue previews and Home room canvases. Startup uses the conservative profile until capabilities are known; lighting omits contact shadows on the performance profile. Existing standard-scene DPR ceilings and non-refined shadow sizes are preserved.
- Usable venue fixtures share a quiet, static interaction ring. Selected fixtures use a stronger ring; workplace entrances use the same visual language. Markers do not intercept pointer events or request animation frames.
- Client walking and server career commutes share bounded A* planning, using the existing collision footprints and authored road/access-lane extents. Road corridors have lower traversal cost, but open courtyard access remains possible. Every step is checked along its length. A failed search returns no route, never a direct shortcut.
- Click-to-walk displays the validated route in the scene and refuses blocked destinations. Failed approaches clear pending interactions and Home-entry intent. Keyboard control still cancels automatic walking.
- Existing verified shift identity/location checks, transit quotes, fares, career RPCs and salary rules are unchanged.

## Routing scope

This iteration uses road-aware grid A*, not a new intersection-only district graph. Actual authored object/access-point coordinates remain the destinations. The server computes its own commute route; a client route preview does not prove attendance or authorize payment. Existing transit estimates remain server-backed; no new fixed fares are introduced.

## Next stages

1. Persistent authenticated world host with compatible URL/HUD routing and scene lifecycle recovery.
2. Typed career presentation state and richer job/location bindings, without duplicating authoritative wallet or qualification data.
3. Persisted schedules, outfit/certification gates and punctuality rules, including midnight boundaries and once-only missed-shift consequences.
4. Verified multiplayer arrival and transactional, replay-safe shift settlement.

Redux Toolkit and Rapier have not been added in this first upgrade. Character, prop-placement and physics rewrites are outside its scope.
