# Persistent world renderer — first migration

## Ownership

The authenticated game layout owns `WorldSceneProvider` and `WorldSceneViewport` below the character/session providers. Renderer code is loaded lazily, and the viewport starts a renderer only after an audited scene registers. Its React portal target is a stable, externally owned DOM container; the registry moves that container between route slots without changing the portal target or unmounting Canvas.

Keeping the container inside the scene's existing DOM slot preserves clipping, dimensions, local stacking and the Canvas event wrapper. Updates to an already active scene never reinsert the DOM node. Leaving the final slot parks the container in a hidden, inert 1px host and sets rendering to `never`, while retaining the renderer. The nonzero measurement matters: R3F skips configuration at zero size, which could otherwise leave departed content mounted. Departed scene children, callbacks and anchor elements are not cached by the viewport. Logging out or changing character destroys the host normally.

Each scene owns a separate camera and a keyed content/error boundary. A scene failure clears its contents and exposes a retry; normal scene changes do not recreate Canvas. Concurrent secondary scenes retain standalone canvases until the primary slot leaves. The registry never makes two routes compete for the same renderer at once.

## Migrated surfaces

- The playable neighborhood (excluding camera-owning map overviews).
- Basic location/venue rendering, including props-driven workplace interiors.

Query, game-time and session providers remain above the host. Migrated scene content was checked for route-local providers. Callbacks and values continue to be supplied through props. This is an opt-in API, not a general context bridge: a scene with a provider outside its Canvas must explicitly move/bridge that provider before migration.

## Deliberately retained

Home's Canvas, local room/furniture providers, input handling and overlays are unchanged. Map overviews, shared `Scene` wrappers, specialized venue canvases, profile portraits and item previews remain standalone. Their migration requires separate checks for camera ownership and local context. Existing URLs, phone routing, career RPCs and multiplayer room lifetimes are unchanged.

This migration preserves a renderer/context; it does not promise persistent physics worlds, zero shader recompilation, or an unmounted world's gameplay state. Existing server checkpoints continue to own authoritative location/movement.

## Validation and remaining work

Lifecycle tests use a mocked Canvas to verify renderer identity across route changes/idle gaps, camera separation, shared context, concurrent previews, recovery, repeated updates and Strict Mode cleanup. Existing venue and neighborhood behavior is covered by the regression suite.

Real WebGL/browser verification is still required before treating this migration as visually verified: test resize, pointer capture, touch, camera transitions, clipping, overlays and context restoration on mobile and desktop. Rendering or frame-rate improvements have not been benchmarked.

Next: migrate Home's local providers and remaining primary scene wrappers, then add compatible URL-driven HUD state. Typed career presentation, schedules, prerequisites and transactional shift settlement remain separate later stages.
