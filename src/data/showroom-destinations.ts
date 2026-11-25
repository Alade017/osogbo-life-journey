/**
 * Frontend showroom definitions. Existing landmark identifiers remain unchanged.
 * These definitions do not grant travel access or enable transactions.
 * Use these definitions for commercial venue presentation, not authoritative location data.
 */
export const showroomDestinations = {
  "fuel-station": {
    name: "Osun Motors",
    description: "Personal and commercial vehicle showroom",
    departments: ["personal-cars", "suvs-and-pickups", "commercial-vehicles"],
    mode: "replacement",
  },
  "cinema-event-hall": {
    name: "Exotic Motors Gallery",
    description: "Luxury and performance vehicle showroom",
    departments: ["luxury-cars", "supercars"],
    mode: "replacement",
  },
  "post-office-cafe": {
    name: "Electronics World",
    description: "Television and home electronics showroom",
    departments: ["televisions", "home-electronics"],
    mode: "replacement",
  },
  "harvest-tech-hub": {
    name: "Harvest Tech Store & Hub",
    description: "Computer showroom alongside the existing workplace",
    departments: ["laptops", "desktops"],
    mode: "additional",
  },
} as const;

export type ShowroomLandmarkId = keyof typeof showroomDestinations;

export function getShowroomDestination(id: string) {
  return Object.prototype.hasOwnProperty.call(showroomDestinations, id)
    ? showroomDestinations[id as ShowroomLandmarkId]
    : undefined;
}
