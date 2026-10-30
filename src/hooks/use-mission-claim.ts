import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { q, rpc, formatNaira } from "@/lib/game";
import { missionSession, type PlayerMission } from "@/lib/mission-service";

export function useMissionClaim(userId: string, characterId: string) {
  const client = useQueryClient();
  const busy = useRef(false);
  const identity = useRef("");
  identity.current = `${userId}:${characterId}`;
  const alive = useRef(true);
  const [isPending, setPending] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function mutate(id: string) {
    if (busy.current || !characterId) return;
    if (!navigator.onLine) {
      toast.error("Connect to claim rewards. Nothing was queued.");
      return;
    }
    busy.current = true;
    setPending(true);
    const owner = `${userId}:${characterId}`;
    const current = () => alive.current && identity.current === owner;
    try {
      await missionSession(userId);
      // Verify that this claim belongs to the displayed current-character snapshot.
      const rows = await client.fetchQuery({
        ...q.missions(userId, characterId),
        staleTime: 0,
        networkMode: "always",
      });
      if (!current()) return;
      if (!navigator.onLine) throw new Error("Offline");
      if (!rows.some((m) => m.id === id && m.status === "completed"))
        throw new Error("Refresh Missions to check this reward.");
      const reward = await rpc.claimMission(id);
      await missionSession(userId);
      client.setQueryData<PlayerMission[]>(q.missions(userId, characterId).queryKey, (cached) =>
        (cached ?? rows).map((m) => (m.id === id ? { ...m, status: "claimed" } : m)),
      );
      if (current())
        toast.success(
          `Reward claimed: ${formatNaira(reward.money)}${reward.xp ? ` · +${reward.xp} XP` : ""}`,
        );
    } catch {
      // A response can be lost after commit. Read canonical state before offering another attempt.
      try {
        const rows = await client.fetchQuery({
          ...q.missions(userId, characterId),
          staleTime: 0,
          networkMode: "always",
        });
        if (current() && !rows.some((m) => m.id === id && m.status === "claimed"))
          toast.error("Reward not confirmed. Refresh Missions and try again.");
      } catch {
        if (current()) toast.error("Reward not confirmed. Reconnect and refresh Missions.");
      }
    } finally {
      await Promise.all(
        ["missions", "character", "wallet", "transactions", "notifications"].map((key) =>
          client.invalidateQueries({
            queryKey: key === "missions" ? [key, userId, characterId] : [key],
          }),
        ),
      );
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  return { isPending, mutate };
}
