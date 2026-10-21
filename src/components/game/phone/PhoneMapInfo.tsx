import { MapPin, Navigation, Sparkles, Star } from "lucide-react";
import townData from "@/data/osogbo-town.json";
import { useGameTime } from "@/components/game/GameTimeProvider";

type Place = (typeof townData.landmarks)[number];
const places = townData.landmarks as Place[];

function blocksAway(a: Place, b: Place) {
  return Math.abs(a.grid.x - b.grid.x) + Math.abs(a.grid.z - b.grid.z);
}

export function PhoneMapInfo() {
  const { simulation } = useGameTime();
  const here =
    places.find((p) => p.id === simulation.locationId || p.locationSlug === simulation.locationId) ??
    null;

  // Popular: most activities on offer. Replace with real visitor counts when the server has them.
  const popular = [...places]
    .sort((a, b) => (b.actions?.length ?? 0) - (a.actions?.length ?? 0))
    .slice(0, 5);

  // Next: nearest places to where the player is, or the first few if location is unknown.
  const next = places
    .filter((p) => p.id !== here?.id)
    .sort((a, b) => (here ? blocksAway(a, here) - blocksAway(b, here) : 0))
    .slice(0, 5);

  const youAreAt = here
    ? here.label
    : simulation.locationType === "home"
      ? "Home"
      : "On the streets";

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
        <Star size={14} aria-hidden="true" /> Popular places
      </h3>
      <ul className="phone-map-list">
        {popular.map((p) => (
          <li key={p.id}>
            <MapPin size={14} aria-hidden="true" />
            <span>{p.label}</span>
            <small>{p.actions?.length ?? 0} activities</small>
          </li>
        ))}
      </ul>

      <h3>
        <Sparkles size={14} aria-hidden="true" /> Places to go next
      </h3>
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