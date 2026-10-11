import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { playGameSound } from "@/lib/game-audio";

/** Observe server character updates; never infer rewards from optimistic UI. */
export function useGameAudioEvents() {
  const { data: character } = useQuery(q.character());
  const previous = useRef<{ id: string; level: number } | null>(null);
  useEffect(() => {
    if (!character) {
      previous.current = null;
      return;
    }
    if (previous.current?.id === character.id && character.level > previous.current.level) {
      playGameSound("level-up");
    }
    previous.current = { id: character.id, level: character.level };
  }, [character?.id, character?.level, character]);
}
