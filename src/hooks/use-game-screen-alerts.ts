import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { useMissions } from "@/hooks/use-missions";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";

type MissionSnapshot = {
  progress: number;
  status: string;
  title: string;
  target: number;
};

export function useGameScreenAlerts() {
  const { simulation, ready } = useGameTime();
  const { data: missions, characterId } = useMissions();
  const previousNeeds = useRef<{ characterId: string; values: typeof simulation.needs } | null>(
    null,
  );
  const previousMissions = useRef<{
    characterId: string;
    values: Map<string, MissionSnapshot>;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;

    const currentCharacterId = simulation.character.id;
    const previous = previousNeeds.current;
    if (!previous || previous.characterId !== currentCharacterId) {
      previousNeeds.current = { characterId: currentCharacterId, values: simulation.needs };
      return;
    }

    const criticalNeeds = NEED_NAMES.filter(
      (name) =>
        statusForNeed(name, previous.values[name]) !== "critical" &&
        statusForNeed(name, simulation.needs[name]) === "critical",
    ).map((name) => NEED_RULES[name].label);

    if (criticalNeeds.length) {
      toast.warning(`Critical needs: ${criticalNeeds.join(", ")}`);
    }
    previousNeeds.current = { characterId: currentCharacterId, values: simulation.needs };
  }, [ready, simulation.character.id, simulation.needs]);

  useEffect(() => {
    if (!characterId || !missions) {
      previousMissions.current = null;
      return;
    }

    const current = new Map(
      missions.map((playerMission) => [
        playerMission.id,
        {
          progress: playerMission.progress,
          status: playerMission.status,
          title: playerMission.mission?.title ?? "Mission",
          target: playerMission.mission?.target ?? 1,
        },
      ]),
    );
    const previous = previousMissions.current;

    if (previous?.characterId === characterId) {
      for (const [id, mission] of current) {
        const before = previous.values.get(id);
        if (!before) continue;

        if (mission.status === "completed" && before.status !== "completed") {
          toast.success(`Mission complete: ${mission.title}`);
        } else if (mission.status === "in_progress" && mission.progress > before.progress) {
          toast.message(
            `${mission.title}: ${Math.min(mission.progress, mission.target)}/${mission.target}`,
          );
        }
      }
    }

    previousMissions.current = { characterId, values: current };
  }, [characterId, missions]);
}
