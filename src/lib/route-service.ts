export type MapCoordinates = { latitude: number; longitude: number };
export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [longitude: number, latitude: number][];
};

type OsrmRouteResponse = {
  code?: unknown;
  routes?: {
    distance?: unknown;
    duration?: unknown;
    geometry?: { type?: unknown; coordinates?: unknown };
  }[];
};

export function hasValidCoordinates(value: unknown): value is MapCoordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point["latitude"] === "number" &&
    Number.isFinite(point["latitude"]) &&
    point["latitude"] >= -90 &&
    point["latitude"] <= 90 &&
    typeof point["longitude"] === "number" &&
    Number.isFinite(point["longitude"]) &&
    point["longitude"] >= -180 &&
    point["longitude"] <= 180
  );
}

export function parseOsrmRoute(payload: unknown): DrivingRoute {
  if (!payload || typeof payload !== "object") throw new Error("Route response was invalid.");
  const response = payload as OsrmRouteResponse;
  const route = response.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (
    response.code !== "Ok" ||
    typeof route?.distance !== "number" ||
    !Number.isFinite(route.distance) ||
    route.distance < 0 ||
    typeof route.duration !== "number" ||
    !Number.isFinite(route.duration) ||
    route.duration < 0 ||
    route.geometry?.type !== "LineString" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    throw new Error("A street route is not available for these locations.");
  }

  const validCoordinates = coordinates.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === "number" &&
      Number.isFinite(point[0]) &&
      point[0] >= -180 &&
      point[0] <= 180 &&
      typeof point[1] === "number" &&
      Number.isFinite(point[1]) &&
      point[1] >= -90 &&
      point[1] <= 90,
  );
  if (!validCoordinates) throw new Error("Route geometry contained invalid coordinates.");

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    coordinates: coordinates as [number, number][],
  };
}

export async function getDrivingRoute(
  origin: MapCoordinates,
  destination: MapCoordinates,
  signal?: AbortSignal,
): Promise<DrivingRoute> {
  if (!hasValidCoordinates(origin) || !hasValidCoordinates(destination)) {
    throw new Error("Mapped coordinates are required to calculate a street route.");
  }

  const configuredBase = import.meta.env["VITE_ROUTING_BASE_URL"]?.trim();
  const baseUrl = (configuredBase || "https://router.project-osrm.org").replace(/\/$/, "");
  const url = new URL(
    `/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
    baseUrl,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const response = await fetch(url, {
    ...(signal ? { signal } : {}),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Route service returned ${response.status}.`);
  return parseOsrmRoute((await response.json()) as unknown);
}
