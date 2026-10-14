import { useMemo, useState } from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import mapData from "@/data/osogbo-map.json";

type SelectedPlace = { title: string; details: string };

export function CityMapDashboard() {
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const landmarks = useMemo(() => mapData.districts.flatMap((district) => district.landmarks), []);

  const handleDistrictSelect = (id: string) => {
    const district = mapData.districts.find((item) => item.id === id);
    if (district) setSelectedPlace({ title: district.name, details: district.description });
  };

  const handleLandmarkSelect = (id: string) => {
    const landmark = landmarks.find((item) => item.id === id);
    if (!landmark) return;
    const district = mapData.districts.find((item) =>
      item.landmarks.some((place) => place.id === landmark.id),
    );
    setSelectedPlace({
      title: landmark.label,
      details: `${landmark.category} · ${district?.name ?? "Osogbo"}`,
    });
  };

  return (
    <section className="city-map-dashboard is-world-map" aria-label="Osogbo district map">
      <div className="city-map-toolbar">
        {selectedPlace && (
          <p className="city-map-selection" aria-live="polite">
            <strong>{selectedPlace.title}</strong> · {selectedPlace.details}
          </p>
        )}
      </div>
      <MapCanvas onSelectDistrict={handleDistrictSelect} onSelectLandmark={handleLandmarkSelect} />
    </section>
  );
}
