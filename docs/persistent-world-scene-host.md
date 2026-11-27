# Persistent world renderer — first migration

## Ownership

The authenticated game layout owns `WorldSceneProvider` and `WorldSceneViewport` below the character/session providers. Renderer code is loaded lazily, and the viewport starts a renderer only after an audited scene registers. Its React portal target is a stable, externally owned DOM container; the registry moves that container between route slots without changing the portal target or unmounting Canvas.

Keeping the container inside the scene's existing DOM slot preserves clipping, dimensions, local stacking and the Canvas event wrapper. Updates to an already active scene never reinsert the DOM node. Leaving the final slot parks the container in a hidden, inert 1px host and sets rendering to `never`, while retaining the renderer. The nonzero measurement matters: R3F skips configuration at zero size, which could otherwise leave departed content mounted. Departed scene children, callbacks and anchor elements are not cached by the viewport. Logging out or changing character destroys the host normally.

Each scene owns a separate camera and a keyed content/error boundary. A scene failure clears its contents and exposes a retry; normal scene changes do not recreate Canvas. Concurrent secondary scenes retain standalone canvases until the primary slot leaves. The registry never makes two routes compete for the same renderer at once.

## Migrated surfaces

- The playable neighborhood (excluding camera-owning map overviews).
- Basic location/venue rendering, including props-driven workplace interiors.
- Home room rendering, with its overlay and furniture providers carried inside the registered scene content (follow-up migration).
- Clinic, school-campus and residential-compound scenes, retaining their existing `WorldCamera`, interaction props and DOM controls.

Query, game-time and session providers remain above the host. Migrated scene content was checked for route-local providers. Callbacks and values continue to be supplied through props. This is an opt-in API, not a general context bridge: a scene with a provider outside its Canvas must explicitly move/bridge that provider before migration.

## Deliberately retained

Home's local providers now travel inside its scene content; its controls, camera settings, layout and overlay DOM are preserved. Map overviews, shared `Scene` wrappers, mall/street and worship venue canvases, profile portraits and item previews remain standalone. Their migration requires separate checks for camera ownership and local context. Existing URLs, phone routing, career RPCs and multiplayer room lifetimes are unchanged.

This migration preserves a renderer/context; it does not promise persistent physics worlds, zero shader recompilation, or an unmounted world's gameplay state. Existing server checkpoints continue to own authoritative location/movement.

## Validation and remaining work

Lifecycle tests use a mocked Canvas to verify renderer identity across route changes/idle gaps, camera separation, shared context, concurrent previews, recovery, repeated updates and Strict Mode cleanup. Existing venue and neighborhood behavior is covered by the regression suite.

Real WebGL/browser verification is still required before treating this migration as visually verified: test resize, pointer capture, touch, camera transitions, clipping, overlays and context restoration on mobile and desktop. Rendering or frame-rate improvements have not been benchmarked.

Home's provider migration and URL-driven phone/career/map-directory/inventory state are covered in home-renderer-url-hud.md. Next: audit remaining primary scene wrappers and map-overview ownership. Typed career presentation, schedules, prerequisites and transactional shift settlement remain separate later stages.

## Specialized venue readiness

Clinic, campus and compound register with `WorldCanvas`. Their cameras are still framed by `WorldCamera`; each registration receives a separate perspective camera. Scene geometry-cache providers already live inside the scene components. Walkthrough values and callbacks are passed through props, and clinic services and confirmed Home entry retain their existing server-guarded actions outside the renderer.

`WorldSceneReady` reports content mounting inside the renderer, replacing the specialized venues' `onCreated` readiness handlers. Canvas creation happens only once, so it cannot indicate that a later destination mounted. The existing basic venue also uses this shared readiness component. This signal does not measure a painted GPU frame or asset completion outside the mounted subtree.

Each migrated specialized venue forwards `onSceneError` into its existing unavailable state. A boundary outside a registered slot cannot catch exceptions inside the host's R3F root; the explicit callback keeps accessible controls available after a scene failure. Existing five-second loading timeouts remain in place.

Integration tests render the actual three venue components under the host with mocked Canvas and scene geometry. They verify per-venue readiness without `onCreated`, separate camera ownership, renderer identity across transitions, and usable fallback controls after each venue fails. Real WebGL verification remains outstanding.
