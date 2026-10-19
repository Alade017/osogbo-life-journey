import { Suspense, lazy } from "react";
import { LoaderCircle, MapPin } from "lucide-react";

const CityMapDashboard = lazy(() =>
  import("@/components/game/CityMapDashboard").then((m) => ({ default: m.CityMapDashboard }))
);

export function PhoneMapApp() {
  return (
    <div className="phone-sub-app phone-map-sub-app" role="region" aria-label="City Map">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
            <LoaderCircle className="h-6 w-6 animate-spin mb-2" />
            <p className="text-xs">Loading Osogbo map and districts...</p>
          </div>
        }
      >
        <div className="phone-map-container h-full w-full">
          <CityMapDashboard />
        </div>
      </Suspense>
    </div>
  );
}
export default PhoneMapApp;
