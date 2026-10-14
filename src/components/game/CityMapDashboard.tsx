import { useState } from "react";
import { OsogboMapSvg, type MapDistrict } from "@/components/map/OsogboMap.svg";

export function CityMapDashboard() {
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<MapDistrict | null>(null);

  return (
    <section className="city-map-dashboard is-world-map" aria-label="Osogbo district map">
      <div className="city-map-toolbar">
        <button
          className="city-map-label-toggle"
          type="button"
          aria-pressed={labelsVisible}
          onClick={() => setLabelsVisible((visible) => !visible)}
        >
          {labelsVisible ? "Hide landmark labels" : "Show landmark labels"}
        </button>
        {selectedDistrict && (
          <p className="city-map-selection" aria-live="polite">
            {selectedDistrict.name} · {selectedDistrict.description}
          </p>
        )}
      </div>
      <OsogboMapSvg
        labelsVisible={labelsVisible}
        selectedDistrictId={selectedDistrict?.id}
        onDistrictSelect={setSelectedDistrict}
      />
    </section>
  );
}
