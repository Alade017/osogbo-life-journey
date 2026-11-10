import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { q } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { beginTransition, endTransition } from "@/lib/outside-transition";

/**
 * Every route into the house goes through the server's enter_player_home first, so the
 * character is marked inside before the house screen opens. Without this, the room shows
 * but the character is still outside, and accessories are disabled.
 */
export async function enterHomeFromAnywhere(queryClient: QueryClient): Promise<boolean> {
  beginTransition("entering", "Heading to your door", 3);
  try {
    const { data, error } = await supabase.rpc("enter_player_home");
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object")
      throw new Error("The server did not confirm your home. Try again.");
    await queryClient.invalidateQueries({ queryKey: q.character().queryKey });
    return true;
  } catch (error) {
    endTransition();
    toast.error(error instanceof Error ? error.message : "Your home could not be opened.");
    return false;
  }
}
