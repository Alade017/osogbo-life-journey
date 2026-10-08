import type { CityLocationData } from "@/lib/location-service";
import { LocationInteractionPanel } from "@/components/game/LocationInteractionPanel";

function safeImageUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function LocationPopup({ location }: { location: CityLocationData }) {
  const imageUrl = safeImageUrl(location.image_url);

  return (
    <article className="location-popup-card">
      {imageUrl && <img className="location-popup-image" src={imageUrl} alt="" loading="lazy" />}
      <LocationInteractionPanel location={location} />
    </article>
  );
}
