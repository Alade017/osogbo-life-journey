import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldSceneReady } from "@/components/3d/WorldSceneReady";
import { SchoolCampusScene } from "@/components/3d/SchoolCampusScene";
import { VenueVisitor } from "@/components/3d/VenueVisitor";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { CAMPUS_AREAS, campusArea } from "@/game/school-campus";
import { useCampusWalkthrough } from "@/hooks/use-campus-walkthrough";
import { VenueSceneBoundary } from "./VenueSceneBoundary";
import { WorldLoadingIndicator } from "./WorldLoadingIndicator";

/** Local scene tour. Education eligibility, fees and completion stay in education RPCs. */
export function SchoolCampusVenue({
  slug,
  locationName,
  immersive = false,
}: {
  slug: string;
  locationName: string;
  immersive?: boolean | undefined;
}) {
  const walk = useCampusWalkthrough(slug);
  const area = campusArea(walk.area);
  const heading = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const unavailable = useCallback(() => setStatus("fallback"), []);
  const ready = useCallback(
    () => setStatus((status) => (status === "loading" ? "ready" : status)),
    [],
  );
  useEffect(() => {
    const timer = window.setTimeout(
      () => setStatus((previous) => (previous === "loading" ? "fallback" : previous)),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section
      className={immersive ? "destination-venue-root" : "game-panel space-y-3 p-3 md:p-5"}
      aria-labelledby={heading}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{locationName}</p>
          <h2 id={heading} className="text-xl font-bold">
            {area.name}
          </h2>
        </div>
        <Link
          to="/education"
          className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          View courses
        </Link>
      </header>
      <div
        data-venue-toolbar
        role="group"
        aria-label="Campus areas"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {CAMPUS_AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={walk.area === item.id}
            disabled={walk.entering}
            onClick={() => {
              void walk.selectArea(item.id);
            }}
            className="shrink-0 rounded-lg border border-edge bg-card px-3 py-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {item.name}
          </button>
        ))}
      </div>
      <div
        data-venue-viewport
        className="relative h-[55svh] min-h-72 overflow-hidden rounded-lg border border-edge bg-muted"
      >
        {status !== "fallback" && (
          <VenueSceneBoundary resetKey={slug} onError={unavailable}>
            <WorldCanvas
              onSceneError={unavailable}
              shadows="percentage"
              frameloop="demand"
              dpr={[1, 1.25]}
              gl={{ antialias: false, powerPreference: "low-power" }}
              fallback={<p className="p-4">WebGL is unavailable. Use the campus controls below.</p>}
              aria-label="Interactive 3D school campus"
            >
              <WorldCamera
                width={area.width}
                depth={area.depth}
                stage
                target={[0, 1.2, 0]}
                zoom={1.35}
              />
              <WorldLighting size={Math.max(area.width, area.depth)} />
              <SchoolCampusScene
                area={walk.area}
                onAreaSelect={(id) => {
                  if (!walk.entering) void walk.selectArea(id);
                }}
                onWalkTo={(point) => {
                  void walk.walkTo(point);
                }}
              />
              <VenueVisitor position={walk.position} facing={walk.facing} walking={walk.walking} />
              <WorldSceneReady onReady={ready} />
            </WorldCanvas>
          </VenueSceneBoundary>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <WorldLoadingIndicator title="Opening the campus" detail="Preparing the grounds…" />
          </div>
        )}
        {status === "fallback" && (
          <p role="note" className="p-4">
            The 3D scene is unavailable on this device. Campus areas and courses remain available
            below.
          </p>
        )}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {walk.message}
      </p>
      <p className="text-sm">{area.detail}</p>
    </section>
  );
}
