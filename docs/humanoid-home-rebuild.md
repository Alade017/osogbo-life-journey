# Humanoid and home interaction update

The old body generator and surface-joining implementation are replaced with a continuous low-poly anatomical surface. Male and female bodies keep the existing 18 bone names, saved appearance choices, clothing sockets and animation API. Geometry is cached by body, build and hair. Detailed braided-hair variants stay below 8,000 triangles across all body builds.

The home toolbar's last door/wall button is now Lucide `RefreshCcwDot`. It rearranges currently placed owned items, preserving inventory and placement identities. The planner uses each home's actual walls, doors, rooms, stairs and furniture footprints; beds, bathroom fittings, cooking appliances and gym equipment use their designated rooms when available. Wall art stays on the back wall. A crowded home returns an error without saving partial changes. Full-wall settings remain accessible in Arrange mode.

`POST /api/house/rearrange` authenticates the request and obtains furniture from the server. Migration `0104_house_rearrange` adds a service-role-only RPC that locks the home, compares the original snapshot and applies every move together. Another tab's changes produce `LAYOUT_CHANGED`. Apply the paired Supabase migration `20261118024000_house_rearrange.sql` through the normal migration workflow before deploying this feature. Do not run both migration copies against the same database.

Home scenes allow a total 180-degree horizontal swipe outside editing. The complete player hierarchy is mounted only while the server confirms home presence. Confirmed leave/travel results update the character cache immediately. Returning home spawns at the entrance, opens the door and walks inside with the animation visible; blocked entrances report the obstruction. Clothing, carried items and the shadow leave with the player.

Validation includes closed-surface topology across male/female builds, real rig frame playback for every pose, animation deformation coverage, clothing bindings, all six house layouts, correct room types, database ownership/concurrency/atomicity checks, presence/travel database tests and camera controls. Production builds and affected-file lint pass. Global typechecking retains existing repository diagnostics without new diagnostic signatures.

The character preview is an offline render of the actual source meshes, not a live browser capture. Signed-in mobile WebGL interaction and the production migration have not been verified/applied in this workspace.

## Nightclub dance animation

Both bodies now support `animation="dance"` on `WorldCharacter`. The two-second in-place groove blends hip sway, torso counter-rotation, alternating arm gestures, knee bends and foot taps on the existing rig, without adding polygons or moving the player through the world. Walking overrides dancing and returning to `idle` blends back to rest. Reduced motion holds a static pose. The sprite fallback also supports dancing; its atlas remains below 4096 pixels tall and its cache key includes clip definitions.

The future nightclub should set this presentation state from its approved player activity. This update adds animation support only; it does not create a nightclub, simulation rewards, entry fees or a dance action in the server catalog.
