import { createPreloadableLoader } from "@/lib/preloadable-loader";
import type { VenueSceneKind } from "@/lib/venue-scene-resolver";

const loaders = {
  civic: createPreloadableLoader(() =>
    import("@/components/3d/CivicServiceScene").then((m) => ({ default: m.CivicServiceScene })),
  ),
  bank: createPreloadableLoader(() =>
    import("@/components/3d/BankInteriorScene").then((m) => ({ default: m.BankInteriorScene })),
  ),
  transport: createPreloadableLoader(() =>
    import("@/components/3d/TransitParkScene").then((m) => ({ default: m.TransitParkScene })),
  ),
  healthcare: createPreloadableLoader(() =>
    import("@/components/3d/HealthcareScene").then((m) => ({ default: m.HealthcareScene })),
  ),
  workplace: createPreloadableLoader(() =>
    import("@/components/3d/WorkplaceScene").then((m) => ({ default: m.WorkplaceScene })),
  ),
  retail: createPreloadableLoader(() =>
    import("@/components/3d/RetailInteriorScene").then((m) => ({ default: m.RetailInteriorScene })),
  ),
  food: createPreloadableLoader(() =>
    import("@/components/3d/BukaInteriorScene").then((m) => ({ default: m.BukaInteriorScene })),
  ),
  market: createPreloadableLoader(() =>
    import("@/components/3d/MarketTradingScene").then((m) => ({ default: m.MarketTradingHall })),
  ),
  clinic: createPreloadableLoader(() =>
    import("./ClinicVenue").then((m) => ({ default: m.ClinicVenue })),
  ),
  mall: createPreloadableLoader(() =>
    import("./OsunMallVenue").then((m) => ({ default: m.OsunMallVenue })),
  ),
  worship: createPreloadableLoader(() =>
    import("./WorshipVenue").then((m) => ({ default: m.WorshipVenue })),
  ),
  campus: createPreloadableLoader(() =>
    import("./SchoolCampusVenue").then((m) => ({ default: m.SchoolCampusVenue })),
  ),
};

// Check coverage after inference so each lazy loader retains its component's props.
export const venueSceneLoaders = loaders satisfies Record<
  Exclude<VenueSceneKind, "environment" | "generic">,
  () => Promise<unknown>
>;
