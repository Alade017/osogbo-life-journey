import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { q } from "@/lib/game";

export function useMissions() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data: character } = useQuery(q.character());
  const characterId = character?.user_id === user.id ? character.id : "";
  const query = useQuery(q.missions(user.id, characterId));
  return { ...query, userId: user.id, characterId };
}
