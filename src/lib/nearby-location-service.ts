import type { CityLocationData } from "@/lib/location-service";
import type { VirtualPosition } from "@/lib/player-movement";

export const DEFAULT_INTERACTION_RADIUS_METERS = 50;
export const MAX_INTERACTION_RADIUS_METERS = 5000;
const EARTH_RADIUS_METERS = 6_371_008.8;

export type NearbyLocation = {
  location: CityLocationData;
  distanceMeters: number;
  meetsLevelRequirement: boolean;
};

export type NearbyLocationTransition = {
  type: "entered" | "left";
  location: CityLocationData;
  distanceMeters: number;
};

export function haversineDistanceMeters(a: VirtualPosition, b: VirtualPosition): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const startLatitude = radians(a.latitude);
  const endLatitude = radians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function findNearbyLocations(
  position: VirtualPosition,
  locations: readonly CityLocationData[],
  playerLevel = 0,
): NearbyLocation[] {
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return [];
  return locations
    .filter(
      (location) =>
        location.is_active &&
        typeof location.latitude === "number" &&
        Number.isFinite(location.latitude) &&
        location.latitude >= -90 &&
        location.latitude <= 90 &&
        typeof location.longitude === "number" &&
        Number.isFinite(location.longitude) &&
        location.longitude >= -180 &&
        location.longitude <= 180,
    )
    .map((location) => ({
      location,
      distanceMeters: haversineDistanceMeters(position, {
        latitude: location.latitude!,
        longitude: location.longitude!,
      }),
      meetsLevelRequirement: playerLevel >= location.level_required,
    }))
    .filter(({ location, distanceMeters }) => {
      const configuredRadius = location.interaction_radius_m;
      const radius =
        Number.isFinite(configuredRadius) && configuredRadius > 0
          ? Math.min(configuredRadius, MAX_INTERACTION_RADIUS_METERS)
          : DEFAULT_INTERACTION_RADIUS_METERS;
      return distanceMeters <= radius;
    })
    .sort((first, second) => first.distanceMeters - second.distanceMeters);
}

export function proximityQueryBounds(latitude: number, longitude: number) {
  // Anchor by ~220 m cells so each short movement does not issue a new location query.
  const centerLatitude = Math.round(latitude * 500) / 500;
  const centerLongitude = Math.round(longitude * 500) / 500;
  const paddingMeters = MAX_INTERACTION_RADIUS_METERS + 250;
  const latitudePadding = paddingMeters / 110_574;
  const longitudePadding =
    paddingMeters / (111_320 * Math.max(0.1, Math.cos((centerLatitude * Math.PI) / 180)));
  return {
    north: Math.min(90, centerLatitude + latitudePadding),
    south: Math.max(-90, centerLatitude - latitudePadding),
    east: Math.min(180, centerLongitude + longitudePadding),
    west: Math.max(-180, centerLongitude - longitudePadding),
  };
}

export class NearbyLocationTracker {
  private nearby = new Map<string, NearbyLocation>();

  update(nextLocations: readonly NearbyLocation[]): NearbyLocationTransition[] {
    const next = new Map(nextLocations.map((item) => [item.location.id, item]));
    const transitions: NearbyLocationTransition[] = [];
    next.forEach((item, id) => {
      if (!this.nearby.has(id)) {
        transitions.push({
          type: "entered",
          location: item.location,
          distanceMeters: item.distanceMeters,
        });
      }
    });
    this.nearby.forEach((item, id) => {
      if (!next.has(id)) {
        transitions.push({
          type: "left",
          location: item.location,
          distanceMeters: item.distanceMeters,
        });
      }
    });
    this.nearby = next;
    return transitions;
  }
}

export type LocationInteractionRequest = {
  location: CityLocationData;
  distanceMeters: number;
};
const transitionListeners = new Set<(transition: NearbyLocationTransition) => void>();
const interactionListeners = new Set<(request: LocationInteractionRequest) => void>();

export function subscribeNearbyLocationTransitions(
  listener: (transition: NearbyLocationTransition) => void,
) {
  transitionListeners.add(listener);
  return () => {
    transitionListeners.delete(listener);
  };
}

export function publishNearbyLocationTransition(transition: NearbyLocationTransition) {
  transitionListeners.forEach((listener) => listener(transition));
}

export function subscribeLocationInteractionRequests(
  listener: (request: LocationInteractionRequest) => void,
) {
  interactionListeners.add(listener);
  return () => {
    interactionListeners.delete(listener);
  };
}

export function requestLocationInteraction(request: LocationInteractionRequest) {
  interactionListeners.forEach((listener) => listener(request));
}
