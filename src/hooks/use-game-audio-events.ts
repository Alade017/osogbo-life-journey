import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { playGameSound } from "@/lib/game-audio";
import { useMissions } from "@/hooks/use-missions";

/** Observe server character updates; never infer rewards from optimistic UI. */
export function useGameAudioEvents() {
  const { data: character } = useQuery(q.character());
  const { data: missions } = useMissions();
  const previous = useRef<{
    id: string;
    level: number;
    xp: number;
    health: number;
    energy: number;
  } | null>(null);
  const previousMissions = useRef<{ characterId: string; statuses: Map<string, string> } | null>(
    null,
  );
  useEffect(() => {
    if (!character) {
      previous.current = null;
      return;
    }
    const before = previous.current;
    if (before?.id === character.id) {
      if (character.level > before.level) playGameSound("level-up");
      else if (character.xp > before.xp) playGameSound("xp-gain");
      if (character.health - before.health >= 1) playGameSound("health-recharge");
      else if (character.energy - before.energy >= 1) playGameSound("energy-recharge");
    }
    previous.current = {
      id: character.id,
      level: character.level,
      xp: character.xp,
      health: character.health,
      energy: character.energy,
    };
  }, [character?.id, character?.level, character]);
  useEffect(() => {
    if (!character) {
      previousMissions.current = null;
      return;
    }
    if (!missions) return;
    const before = previousMissions.current;
    if (before?.characterId === character.id) {
      const completed = missions.some((mission) => {
        const old = before.statuses.get(mission.id);
        return (
          old !== undefined &&
          old !== "completed" &&
          old !== "claimed" &&
          mission.status === "completed"
        );
      });
      const rewarded = missions.some(
        (mission) =>
          before.statuses.has(mission.id) &&
          before.statuses.get(mission.id) !== "claimed" &&
          mission.status === "claimed",
      );
      if (completed) playGameSound("mission-complete");
      if (rewarded) playGameSound("reward");
    }
    previousMissions.current = {
      characterId: character.id,
      statuses: new Map(missions.map((mission) => [mission.id, mission.status])),
    };
  }, [character, missions]);
}
