import { Client } from "@colyseus/sdk";
import { supabase } from "@/integrations/supabase/client";

export type NeighborhoodRoom = Awaited<ReturnType<typeof joinNeighborhood>>;

export async function joinNeighborhood(locationId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in again to join the neighborhood.");

  const endpoint = import.meta.env["VITE_MULTIPLAYER_URL"] || "ws://127.0.0.1:2567";
  const client = new Client(endpoint);
  return client.joinOrCreate("neighborhood", { locationId, accessToken });
}
