import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { previewLandmarks } from "@/components/game/entry-town-preview";
import "@/components/map/map-canvas.css";
import "@/components/map/map-ui.css";
import "@/components/map/map-hud.css";

// Load the same 3D town used by the playable map, without blocking the entry screen.
const TownSurface3D = lazy(() =>
  import("@/components/map/R3FTownSurface").then((module) => ({
    default: module.R3FTownSurface,
  })),
);

type Props = {
  focusLandmarkId?: string | null;
  focusLabel?: string | null;
  activeSlugs?: ReadonlySet<string> | null;
};

type BoundaryProps = { children: ReactNode; onUnavailable: () => void };
type BoundaryState = { failed: boolean };

class PreviewErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("The landing-page town preview failed to load.", error);
    this.props.onUnavailable();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
        {status !== "unavailable" && (
          <PreviewErrorBoundary onUnavailable={handleUnavailable}>
            <Suspense
              fallback={
                <div className="entry-world-loading" role="status" aria-label="Loading the town preview">
                  <span className="entry-world-loading-sun" />
                  <span className="entry-world-loading-hill entry-world-loading-hill-back" />
                  <span className="entry-world-loading-hill entry-world-loading-hill-front" />
                  <span className="entry-world-loading-label">Preparing your town…</span>
                </div>
              }
            >
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
            </Suspense>
          </PreviewErrorBoundary>
        )}
        {status === "unavailable" && (
          <div className="entry-world-unavailable" role="status">
            <span className="entry-world-unavailable-mark" aria-hidden="true">OSUN</span>
            <strong>Your town is waiting.</strong>
            <span>The 3D preview isn't available in this browser, but you can still enter the game.</span>
          </div>
        )}
      </div>
      <figcaption id="entry-world-caption">{caption}</figcaption>
    </figure>
  );
}
