import type { Json } from "@/integrations/supabase/types";
import { estimateTrip, getAvailableTravelModes, type TravelMode } from "@/lib/transport-service";

type Destination = {
  id: string;
  is_active: boolean;
  travel_fare: number;
  travel_minutes: number;
  metadata: Json;
};
/** Quotes use the destination's persisted configuration, never a fabricated route price. */
export function neighborhoodTripEstimate(
  destination: Destination,
  currentLocationId: string | undefined,
  mode: TravelMode,
) {
  if (
    !destination.is_active ||
    !currentLocationId ||
    destination.id === currentLocationId ||
    !Number.isFinite(destination.travel_fare) ||
    destination.travel_fare < 0 ||
    !Number.isFinite(destination.travel_minutes) ||
    destination.travel_minutes < 0 ||
    !getAvailableTravelModes(destination.metadata).includes(mode)
  )
    return null;
  return estimateTrip(mode, destination.travel_fare, destination.travel_minutes);
}
