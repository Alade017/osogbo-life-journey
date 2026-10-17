import { Client } from "@colyseus/sdk";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT_REFRESH_EVENT } from "@/lib/equipment-service";

export type NeighborhoodRoom = Awaited<ReturnType<typeof joinNeighborhood>>;

export async function joinNeighborhood(locationId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in again to join the neighborhood.");

  const configuredEndpoints = import.meta.env["VITE_MULTIPLAYER_URL"]
    ?.split(",")
    .map((endpoint: string) => endpoint.trim())
    .filter(Boolean);
  const endpoints = configuredEndpoints?.length ? configuredEndpoints : ["ws://127.0.0.1:2567"];
  const startIndex = Math.floor(Math.random() * endpoints.length);
  let lastError: unknown;

  for (let offset = 0; offset < endpoints.length; offset += 1) {
    const endpoint = endpoints[(startIndex + offset) % endpoints.length];
    if (!endpoint) continue;

    try {
      const client = new Client(endpoint);
      const room = await client.joinOrCreate("neighborhood", { locationId, accessToken });
      const refreshEquipment = () => room.send("refresh-equipment");
      window.addEventListener(EQUIPMENT_REFRESH_EVENT, refreshEquipment);
      room.onLeave(() => window.removeEventListener(EQUIPMENT_REFRESH_EVENT, refreshEquipment));
      return room;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No multiplayer server endpoint is configured.");
}
