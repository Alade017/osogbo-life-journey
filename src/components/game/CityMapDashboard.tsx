import { lazy, Suspense, useState, type ReactNode } from "react";

const OsogboMap = lazy(() =>
  import("@/components/game/OsogboMap").then((module) => ({ default: module.OsogboMap })),
);

export function CityMapDashboard({ children }: { children: ReactNode }) {
  const [view, setView] = useState<"atlas" | "neighborhood">("atlas");
  return (
    <div className={`city-map-dashboard is-${view}`}>
      <div className="city-map-mode-switch" role="group" aria-label="Map view">
        <button type="button" aria-pressed={view === "atlas"} onClick={() => setView("atlas")}>
          City atlas
        </button>
        <button
          type="button"
          aria-pressed={view === "neighborhood"}
          onClick={() => setView("neighborhood")}
        >
          3D neighborhood
        </button>
      </div>
      <main className={`city-map-world is-${view}`}>
        {view === "atlas" ? (
          <Suspense
            fallback={
              <div className="city-map-loading" role="status">
                Loading city map…
              </div>
            }
          >
            <OsogboMap />
          </Suspense>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
