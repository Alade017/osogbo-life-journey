import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { previewLandmarks } from "@/components/game/entry-town-preview";
import "@/components/map/map-canvas.css";
import "@/components/map/map-ui.css";
import "@/components/map/map-hud.css";

// The 3D town is loaded only when the landing page shows it.
const TownSurface3D = lazy(() =>
  import("@/components/map/R3FTownSurface").then((module) => ({
    default: module.R3FTownSurface,
  })),
);

type Props = {
  /** Landmark id of the returning player's last stop. Null shows the whole town. */
  focusLandmarkId?: string | null;
  focusLabel?: string | null;
  /** Slugs of active locations. Null shows every landmark in the town. */
  activeSlugs?: ReadonlySet<string> | null;
};

/** The live 3D town from the city map, shown as a non-interactive preview. */
export function EntryTownPreview({
  focusLandmarkId = null,
  focusLabel = null,
  activeSlugs = null,
}: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const places = useMemo(
    () =>
      previewLandmarks(activeSlugs).map((place) => ({
        id: place.id,
        label: place.label,
        category: place.category,
        grid: place.grid,
      })),
    [activeSlugs],
  );
  const handleReady = useCallback(() => setStatus("ready"), []);
  const handleUnavailable = useCallback(() => setStatus("unavailable"), []);
  const noop = useCallback(() => {}, []);
  const caption =
    focusLandmarkId && focusLabel
      ? `Your last stop: ${focusLabel}.`
      : "A glimpse of the fictional town you can explore.";

  return (
    <figure className="entry-world" aria-labelledby="entry-world-caption">
      <div className="entry-world-stage" aria-label="Preview of the Osogbo town">
        <Suspense fallback={null}>
          {status !== "unavailable" && (
            <TownSurface3D
              places={places}
              properties={undefined}
              playerLocation={null}
              billboardMarkers={[]}
              searchTarget={focusLandmarkId}
              focusCloseUp
              onSelectLandmark={noop}
              onSelectDistrict={noop}
              onSelectBillboard={undefined}
              eventChips={[]}
              onReady={handleReady}
              onUnavailable={handleUnavailable}
            />
          )}
        </Suspense>
        {status === "loading" && (
          <p className="entry-world-status" role="status">
            Loading the town…
          </p>
        )}
        {status === "unavailable" && (
          <p className="entry-world-status" role="status">
            The 3D town could not start on this device.
          </p>
        )}
      </div>
      <figcaption id="entry-world-caption">{caption}</figcaption>
    </figure>
  );
}
