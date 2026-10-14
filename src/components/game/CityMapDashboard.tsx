import { OsogboDistrictMap } from "@/components/game/OsogboDistrictMap";

export function CityMapDashboard() {
  return (
    <section className="city-map-dashboard is-world-map" aria-label="Osogbo district map">
      <OsogboDistrictMap />
    </section>
  );
}
