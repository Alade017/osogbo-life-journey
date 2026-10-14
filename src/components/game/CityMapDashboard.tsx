import { lazy, Suspense } from "react";

const OsogboMap = lazy(() =>
  import("@/components/game/OsogboMap").then((module) => ({ default: module.OsogboMap })),
);

export function CityMapDashboard() {
  return (
    <main className="city-map-dashboard is-world-map">
      <Suspense
        fallback={
          <div className="city-map-loading" role="status">
            Loading Osogbo map…
          </div>
        }
      >
        <OsogboMap />
      </Suspense>
    </main>
  );
}
