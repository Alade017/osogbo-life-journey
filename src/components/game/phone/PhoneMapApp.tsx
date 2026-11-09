import { Link } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import town from "@/data/osogbo-town.json";

function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Places in town the player can explore, listed by name. The full city map opens from here. */
export function PhoneMapApp() {
  const places = [...town.landmarks].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="phone-local-app" aria-label="Places to explore">
      <header>
        <MapPinned aria-hidden="true" />
        <span>
          <strong>Map</strong>
          <small>Places you can explore in town</small>
        </span>
      </header>
      <div className="phone-local-list">
        {places.map((place) => (
          <div className="phone-local-card" key={place.id}>
            <div>
              <small>{categoryLabel(place.category)}</small>
              <strong>{place.label}</strong>
            </div>
            <Link to="/map">Open map</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
export default PhoneMapApp;
