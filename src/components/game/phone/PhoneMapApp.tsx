import { Suspense, lazy } from "react";
import { LoaderCircle } from "lucide-react";
import { PhoneMapInfo } from "@/components/game/phone/PhoneMapInfo";

const CityMapDashboard = lazy(() =>
  import("@/components/game/CityMapDashboard").then((m) => ({ default: m.CityMapDashboard })),
);

export function PhoneMapApp() {
  return (
    <div className="phone-sub-app phone-map-sub-app" role="region" aria-label="City Map">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
            <LoaderCircle className="mb-2 h-6 w-6 animate-spin" />
            <p className="text-xs">Loading Osogbo map and districts...</p>
          </div>
        }
      >
        <div className="phone-map-container">
          <CityMapDashboard />
        </div>
      </Suspense>
      <PhoneMapInfo />
    </div>
  );
}
export default PhoneMapApp;