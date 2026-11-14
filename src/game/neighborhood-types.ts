import type { AvatarAnimationState } from "@/components/game/Avatar";

export type NeighborhoodPlayerView = {
  sessionId: string;
  characterId: string;
  name: string;
  gender: string;
  appearance: string;
  equipment: string;
  x: number;
  y: number;
  facing: string;
  actionAnimation?: AvatarAnimationState;
};

export type NeighborhoodSceneHandle = {
  setPlayers: (players: readonly NeighborhoodPlayerView[]) => void;
  setZoom: (factor: number) => void;
  setFollow: (enabled: boolean) => void;
};
