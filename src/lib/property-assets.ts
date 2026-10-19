import { supabase } from "@/integrations/supabase/client";

export type SaleListing = {
  id: string;
  name: string;
  description: string;
  property_type: string;
  house_type_id: string | null;
  purchase_price: number | null;
  image_url: string | null;
  level_required: number;
  metadata: { district?: string; bedrooms?: number; features?: string[] } | null;
};

export const DISTRICTS = [
  "Oja-Oba Starter District",
  "Isale-Osun Residential Area",
  "Alekuwodo Estate",
  "Dada Residential District",
  "Oke-Fia Premium District",
  "Hillcrest Luxury Estate",
  "Royal Crown Estate",
] as const;

export async function loadOwnedHouses(characterId: string) {
  const { data, error } = await supabase
    .from("player_properties")
    .select(
      "id,tenure,is_active,is_home,game_properties(id,name,description,property_type,house_type_id,image_url,metadata)",
    )
    .eq("is_active", true)
    .eq("character_id", characterId)
    .order("acquired_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
    id: string;
    tenure: "owned" | "rented";
    is_home: boolean;
    game_properties: SaleListing | null;
  }>;
}
