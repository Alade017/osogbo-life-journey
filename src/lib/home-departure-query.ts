import type { QueryClient } from "@tanstack/react-query";
import { canonicalHomeOptions } from "./living-cost-service";

/** A cached presence flag alone cannot send a player to an unavailable house scene. */
export async function hasConfirmedHomeDeparture(
  queryClient: QueryClient,
  character: { id: string; inside_home_property_id: string | null },
): Promise<boolean> {
  if (!character.inside_home_property_id) return false;
  const home = await queryClient.fetchQuery({
    ...canonicalHomeOptions(character.id),
    staleTime: 0,
    retry: false,
  });
  if (home === null) return false;
  if (!home || typeof home !== "object" || Array.isArray(home)) throw new Error("HOME_UNAVAILABLE");
  if (
    !("playerPropertyId" in home) ||
    typeof home.playerPropertyId !== "string" ||
    !("propertyId" in home) ||
    typeof home.propertyId !== "string" ||
    !("houseTypeId" in home) ||
    typeof home.houseTypeId !== "string" ||
    !("name" in home) ||
    typeof home.name !== "string"
  )
    throw new Error("HOME_UNAVAILABLE");
  return home.playerPropertyId === character.inside_home_property_id;
}
