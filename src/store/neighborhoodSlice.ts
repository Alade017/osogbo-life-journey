import type { Needs } from "@/lib/life-simulation";
import type { ZoneNpcSpec } from "@/game/neighborhood-interactions";
import { clampNeed as clampSimulationNeed } from "@/lib/life-simulation";

export interface NeighborhoodInteractionState {
  hoveredZoneId: string | null;
  pendingZoneId: string | null;
  activeZoneId: string | null;
  activeNpcId: string | null;
  lastNpcTip: string | null;
}

export const initialNeighborhoodState: NeighborhoodInteractionState = {
  hoveredZoneId: null,
  pendingZoneId: null,
  activeZoneId: null,
  activeNpcId: null,
  lastNpcTip: null,
};

export const setHoveredZoneId = (payload: string | null) => ({
  type: "neighborhood/hoverZone" as const,
  payload,
});

export const setPendingZoneId = (payload: string | null) => ({
  type: "neighborhood/pendingZone" as const,
  payload,
});

export const openZoneInteraction = (payload: {
  zoneId?: string | null;
  npcId?: string | null;
}) => ({
  type: "neighborhood/openInteraction" as const,
  payload,
});

export const closeZoneInteraction = () => ({
  type: "neighborhood/closeInteraction" as const,
});

export const recordNpcChatAction = (payload: { npc: ZoneNpcSpec; tip: string }) => ({
  type: "neighborhood/recordNpcChat" as const,
  payload,
});

export type NeighborhoodSliceAction =
  | ReturnType<typeof setHoveredZoneId>
  | ReturnType<typeof setPendingZoneId>
  | ReturnType<typeof openZoneInteraction>
  | ReturnType<typeof closeZoneInteraction>
  | ReturnType<typeof recordNpcChatAction>;

export function neighborhoodReducer(
  state: NeighborhoodInteractionState,
  action: NeighborhoodSliceAction,
): NeighborhoodInteractionState {
  switch (action.type) {
    case "neighborhood/hoverZone":
      return state.hoveredZoneId === action.payload
        ? state
        : { ...state, hoveredZoneId: action.payload };
    case "neighborhood/pendingZone":
      return { ...state, pendingZoneId: action.payload };
    case "neighborhood/openInteraction":
      return {
        ...state,
        pendingZoneId: null,
        activeZoneId: action.payload.zoneId ?? null,
        activeNpcId: action.payload.npcId ?? null,
        lastNpcTip:
          action.payload.npcId && state.activeNpcId !== action.payload.npcId
            ? (action.payload.npcId ? state.lastNpcTip : null)
            : state.lastNpcTip,
      };
    case "neighborhood/closeInteraction":
      return { ...state, activeZoneId: null, activeNpcId: null };
    case "neighborhood/recordNpcChat":
      return { ...state, lastNpcTip: action.payload.tip };
  }
}

/** Derive HUD needs from authoritative character/simulation state only. */
export function effectiveNeedsFromCharacter(
  character:
    | {
        hunger?: number | null;
        energy?: number | null;
        happiness?: number | null;
        social?: number | null;
      }
    | null
    | undefined,
  liveNeeds: Needs | undefined,
): Needs {
  return {
    hunger: liveNeeds?.hunger ?? clampNeed(100 - (character?.hunger ?? 25)),
    energy: liveNeeds?.energy ?? clampNeed(character?.energy ?? 80),
    hygiene: liveNeeds?.hygiene ?? 78,
    bladder: liveNeeds?.bladder ?? 74,
    fun: liveNeeds?.fun ?? clampNeed(character?.happiness ?? 72),
    social: liveNeeds?.social ?? clampNeed(character?.social ?? 68),
  };
}

function clampNeed(value: number): number {
  return clampSimulationNeed(value);
}
