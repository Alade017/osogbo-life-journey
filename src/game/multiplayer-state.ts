import { schema, t } from "@colyseus/schema";

/** Public, transient player state shared by clients in one neighborhood room. */
export const NetworkPlayer = schema({
  characterId: t.string(),
  name: t.string(),
  gender: t.string(),
  appearance: t.string(),
  x: t.number(),
  y: t.number(),
  facing: t.string(),
});

export const NeighborhoodState = schema({
  players: t.map(NetworkPlayer),
});

export type NetworkPlayerSnapshot = {
  characterId: string;
  name: string;
  gender: string;
  appearance: string;
  x: number;
  y: number;
  facing: string;
};

export type MovementIntent = { x: number; y: number };
