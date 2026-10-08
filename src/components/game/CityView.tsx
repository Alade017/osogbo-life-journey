import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BusFront, MapPin, Store } from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import { CityBillboards } from "@/components/game/CityBillboards";
import { q, type Character, type Location } from "@/lib/game";

const LANDMARKS = [
  { label: "OJA OBA MARKET", className: "scene-market" },
  { label: "CITY SHOPS", className: "scene-shop" },
  { label: "MOTOR PARK", className: "scene-park" },
] as const;

export function CityView({
  character,
  location,
  locations,
}: {
  character: Character;
  location?: Location | undefined;
  locations: Location[];
}) {
  const { data: billboards } = useQuery(q.billboards());
  const stageBillboardLocation = billboards?.[0]?.location_id;
  const orderedLocations = [...locations].sort((a, b) => {
    if (a.id === character.current_location_id) return -1;
    if (b.id === character.current_location_id) return 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <section className="city-view" aria-label="Osogbo city scene">
      <div className="city-view-head">
        <div>
          <p className="city-eyebrow">
            <span className="city-live-dot" /> YOUR CITY, TODAY
          </p>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {location?.name ?? "Osogbo City Centre"}
          </h1>
          <p className="mt-1 max-w-lg text-sm text-white/65">
            {location?.tagline ?? "The city is waking up around you."}
          </p>
        </div>
        <Link to="/map" className="city-map-link">
          <span>Open city map</span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="city-stage">
        <div className="stage-sky" />
        <div className="stage-haze" />
        <div className="stage-sun" />
        <div className="stage-hill stage-hill-back" />
        <div className="stage-hill stage-hill-front" />
        <div className="stage-tree tree-one">
          <span />
          <i />
        </div>
        <div className="stage-tree tree-two">
          <span />
          <i />
        </div>
        <div className="stage-buildings">
          {LANDMARKS.map((landmark) => (
            <div className={`scene-building ${landmark.className}`} key={landmark.label}>
              <span className="building-roof" />
              <span className="building-sign">{landmark.label}</span>
              <span className="building-windows">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
        <div className="stage-road">
          <span className="road-marking" />
          <span className="road-marking road-marking-two" />
        </div>
        <div className="stage-bus" aria-label="Yellow city minibus">
          <BusFront className="h-8 w-8" />
          <span>OSOGBO</span>
        </div>
        <div className="stage-stall">
          <Store className="h-4 w-4" />
          <span>FRESH FOOD</span>
          <i />
        </div>

        <div className="stage-character" aria-label={`${character.name}'s customized character`}>
          <span className="character-shadow" />
          <span className="character-speech">E kaaro!</span>
          <div className="character-figure bob">
            <Avatar
              appearance={character.appearance as object}
              gender={character.gender}
              size={112}
            />
          </div>
          <span className="character-nameplate">{character.name}</span>
        </div>

        <div className="scene-location-strip" aria-label="Nearby districts">
          {orderedLocations.slice(0, 5).map((item, index) => {
            const isCurrent = item.id === character.current_location_id;
            return (
              <Link
                key={item.id}
                to="/location/$slug"
                params={{ slug: item.slug }}
                className={`scene-location-pin ${isCurrent ? "scene-location-current" : ""}`}
                style={{ "--pin-order": index } as React.CSSProperties}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>{item.name}</span>
                {isCurrent && <small>YOU ARE HERE</small>}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="city-nearby" aria-label="Explore districts">
        {orderedLocations.slice(0, 4).map((item) => (
          <LocationCard
            key={item.id}
            location={item}
            current={item.id === character.current_location_id}
          />
        ))}
        {locations.length > 4 && (
          <Link to="/map" className="nearby-more">
            + {locations.length - 4} districts
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {stageBillboardLocation && (
        <div className="city-billboard">
          <p className="city-eyebrow">SEEN AROUND TOWN</p>
          <CityBillboards locationId={stageBillboardLocation} />
        </div>
      )}
    </section>
  );
}

export function LocationCard({ location, current }: { location: Location; current: boolean }) {
  return (
    <Link
      to="/location/$slug"
      params={{ slug: location.slug }}
      className={`location-card ${current ? "location-card-current" : ""}`}
    >
      <span className="location-card-index">{String(location.sort_order).padStart(2, "0")}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-white">{location.name}</span>
        <span className="mt-0.5 block truncate text-[10px] text-white/50">
          {current ? "You are here" : location.tagline}
        </span>
      </span>
      <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/45" />
    </Link>
  );
}
