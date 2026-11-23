# Home renderer migration and URL-driven HUD

This continuation is stacked on the persistent host in PR #154. It does not add career schedules, wage logic, physics, Redux, or new database authority.

## Home

Home now registers with the existing retained renderer. Its room-overlay and furniture-palette providers are carried inside the scene content rather than remaining outside Canvas, so their values reach the host's R3F root. Home owns a memoized perspective camera with its original position, field of view and clipping planes. The existing room controls, actor state, keyboard accessory controls, layout and overlay DOM remain in place. Outside a host, the same component still uses a standalone canvas.

## URL contract

| Search | Presentation |
| --- | --- |
| `hud=jobs` | Career Life in the existing phone |
| `hud=map` | Existing phone places directory, with a link to the full city map |
| `hud=phone` | Phone launcher |
| `hud=inventory` | Existing inventory overlay |
| `hud=phone&phoneApp=Messages` | Specific phone app |
| `phoneSearch=...` | Encoded in-app search, where applicable |

The URL is the source of truth for overlay visibility. Existing route search (including friend visits), pathname and fragment are preserved. HUD-only changes are excluded from the phone's world-travel detection, and Back/Forward restores the requested panel. Closing a panel replaces its HUD query state. Internal app navigation retains its existing history when the URL acknowledges the same selection; external history changes reconcile selection without stale app-history entries.

Normal Career/Map dock clicks use HUD queries. Their actual `/jobs` and `/map` hrefs remain valid for bookmarks, direct requests and modified/new-tab clicks. The Map HUD is a directory, not a replacement 3D city map: the full-map link still opens `/map`. Existing phone Map tiles retain their full-page behavior. No URL parameter performs home entry, shift clock-in, payment or travel on its own.

## Validation boundary

Tests cover the URL contract, malformed values, preserved route parameters, real TanStack Router Back/Forward without world-page remounts, legacy routes, phone selection/reconciliation and scene-local providers carried through the persistent renderer. Renderer lifecycle tests mock Canvas. Real WebGL verification of Home's pointer/touch controls, camera, overlays and layout is still required before merging this draft stack.

Remaining: audit shared/specialized scene wrappers and map overview ownership, then add typed career presentation state and server-authoritative schedule/prerequisite upgrades. Shift-summary modal URLs are not introduced here.
