import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { cityEventOptions } from "@/lib/city-event-service";

export function useCityEvents() {
  const character = useQuery(q.character());
  return useQuery(cityEventOptions(character.data?.user_id ?? "", character.data?.id ?? ""));
}
