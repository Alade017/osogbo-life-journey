import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, Sparkles } from "lucide-react";
import townData from "@/data/osogbo-town.json";
import { q } from "@/lib/game";
import { requestAvailableMapLandmarks } from "@/lib/map-api";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";

type Place = (typeof townData.landmarks)[number];
const places = townData.landmarks as Place[];

function blocksAway(a: Place, b: Place) {
  return Math.abs(a.grid.x - b.grid.x) + Math.abs(a.grid.z - b.grid.z);
}

export function PhoneMapInfo() {
  const character = useQuery(q.character());
  const locations = useQuery(q.locations());
  const available = useQuery({
    queryKey: ["mapAvailableLandmarks"],
    queryFn: requestAvailableMapLandmarks,
    staleTime: 60_000,
  });
  const location = locations.data?.find((row) => row.id === character.data?.current_location_id);
  const activePlaces = places.filter((place) => available.data?.includes(place.id));
  const here =
    activePlaces.find((place) => MAP_LANDMARK_LOCATION_SLUG[place.id] === location?.slug) ?? null;
  const next = activePlaces
    .filter((p) => p.id !== here?.id)
    .sort((a, b) => (here ? blocksAway(a, here) - blocksAway(b, here) : 0))
    .slice(0, 5);

  const youAreAt = here?.label ?? location?.name ?? "Location unavailable";

  return (
    <section className="phone-map-info" aria-label="Map overview">
      <article className="phone-map-card">
        <p className="phone-map-eyebrow">
          <Navigation size={13} aria-hidden="true" /> You are here
        </p>
        <strong>{youAreAt}</strong>
        {here && <small>{here.category}</small>}
      </article>

      <h3>
        <Sparkles size={14} aria-hidden="true" /> Places to go next
      </h3>
      {available.isPending && <p role="status">Loading available places...</p>}
      {available.isError && <p role="alert">Places are unavailable. Reconnect and try again.</p>}
      <ul className="phone-map-list">
        {next.map((p) => (
          <li key={p.id}>
            <MapPin size={14} aria-hidden="true" />
            <span>{p.label}</span>
            <small>{here ? `${blocksAway(p, here)} blocks` : p.category}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
