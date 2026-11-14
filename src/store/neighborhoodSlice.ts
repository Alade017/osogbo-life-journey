import type { QueryClient } from "@tanstack/react-query";
import type { NeedName, Needs } from "@/lib/life-simulation";
import type { ZoneActionOutcome, ZoneNpcSpec } from "@/game/neighborhood-interactions";
import { findZoneNpc } from "@/game/neighborhood-interactions";

export interface NeighborhoodInventoryEntry {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  slot?: "accessory" | "top" | "bottom" | "shoes";
  acquiredAt: string;
}

export interface NeighborhoodTransactionEntry {
  id: string;
  kind: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface NeighborhoodInteractionState {
  hoveredZoneId: string | null;
  pendingZoneId: string | null;
  activeZoneId: string | null;
  activeNpcId: string | null;
  lastActionToast: string | null;
  lastNpcTip: string | null;
  localInventory: readonly NeighborhoodInventoryEntry[];
  equippedAccessorySlug: string | null;
  localTransactions: readonly NeighborhoodTransactionEntry[];
  walletOffset: number;
  bankOffset: number;
  xpOffset: number;
  needOffsets: Partial<Record<NeedName, number>>;
}

export const initialNeighborhoodState: NeighborhoodInteractionState = {
  hoveredZoneId: null,
  pendingZoneId: null,
  activeZoneId: null,
  activeNpcId: null,
  lastActionToast: null,
  lastNpcTip: null,
  localInventory: [],
  equippedAccessorySlug: null,
  localTransactions: [],
  walletOffset: 0,
  bankOffset: 0,
  xpOffset: 0,
  needOffsets: {},
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

export const applyZoneOutcomeAction = (payload: {
  zoneTitle: string;
  outcome: ZoneActionOutcome;
  nowIso?: string;
}) => ({
  type: "neighborhood/applyOutcome" as const,
  payload,
});

export const recordNpcChatAction = (payload: {
  npc: ZoneNpcSpec;
  tip: string;
  socialBoost: number;
}) => ({
  type: "neighborhood/recordNpcChat" as const,
  payload,
});

export const equipLocalAccessoryAction = (payload: { slug: string | null }) => ({
  type: "neighborhood/equipAccessory" as const,
  payload,
});

export type NeighborhoodSliceAction =
  | ReturnType<typeof setHoveredZoneId>
  | ReturnType<typeof setPendingZoneId>
  | ReturnType<typeof openZoneInteraction>
  | ReturnType<typeof closeZoneInteraction>
  | ReturnType<typeof applyZoneOutcomeAction>
  | ReturnType<typeof recordNpcChatAction>
  | ReturnType<typeof equipLocalAccessoryAction>;

export function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

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
            ? (findZoneNpc(action.payload.npcId)?.greeting ?? null)
            : state.lastNpcTip,
      };
    case "neighborhood/closeInteraction":
      return {
        ...state,
        activeZoneId: null,
        activeNpcId: null,
      };
    case "neighborhood/applyOutcome": {
      const { zoneTitle, outcome, nowIso } = action.payload;
      const timestamp = nowIso ?? new Date().toISOString();
      const nextNeedOffsets: Partial<Record<NeedName, number>> = { ...state.needOffsets };
      if (outcome.needDeltas) {
        for (const [key, delta] of Object.entries(outcome.needDeltas)) {
          if (typeof delta === "number") {
            const needKey = key as NeedName;
            nextNeedOffsets[needKey] = (nextNeedOffsets[needKey] ?? 0) + delta;
          }
        }
      }

      let nextInventory = state.localInventory;
      if (outcome.craftItem) {
        const crafted = outcome.craftItem;
        const existingIndex = state.localInventory.findIndex(
          (entry) => entry.slug === crafted.slug,
        );
        if (existingIndex >= 0) {
          nextInventory = state.localInventory.map((entry, idx) =>
            idx === existingIndex
              ? { ...entry, quantity: entry.quantity + 1, acquiredAt: timestamp }
              : entry,
          );
        } else {
          nextInventory = [
            {
              id: `local-${crafted.slug}-${Date.now()}`,
              slug: crafted.slug,
              name: crafted.name,
              category: crafted.category,
              description: crafted.description,
              quantity: 1,
              ...(crafted.slot ? { slot: crafted.slot } : {}),
              acquiredAt: timestamp,
            },
            ...state.localInventory,
          ];
        }
      }

      const txEntry: NeighborhoodTransactionEntry | null =
        outcome.walletDelta !== 0 || (outcome.bankDelta ?? 0) !== 0
          ? {
              id: `zone-tx-${outcome.id}-${Date.now()}`,
              kind: outcome.walletDelta >= 0 ? "credit" : "debit",
              description: `${zoneTitle}: ${outcome.label}`,
              amount: outcome.walletDelta !== 0 ? outcome.walletDelta : (outcome.bankDelta ?? 0),
              created_at: timestamp,
            }
          : null;

      return {
        ...state,
        walletOffset: state.walletOffset + outcome.walletDelta,
        bankOffset: state.bankOffset + (outcome.bankDelta ?? 0),
        xpOffset: state.xpOffset + (outcome.xpGain ?? 0),
        needOffsets: nextNeedOffsets,
        localInventory: nextInventory,
        equippedAccessorySlug: outcome.equipSlot
          ? outcome.equipSlot.slug
          : state.equippedAccessorySlug,
        localTransactions: txEntry
          ? [txEntry, ...state.localTransactions].slice(0, 25)
          : state.localTransactions,
        lastActionToast: outcome.toastMessage,
      };
    }
    case "neighborhood/recordNpcChat": {
      const { tip, socialBoost } = action.payload;
      return {
        ...state,
        lastNpcTip: tip,
        needOffsets: {
          ...state.needOffsets,
          social: (state.needOffsets.social ?? 0) + socialBoost,
        },
      };
    }
    case "neighborhood/equipAccessory":
      return { ...state, equippedAccessorySlug: action.payload.slug };
  }
}

/**
 * Synchronizes a zone action outcome into TanStack Query caches (wallet, character needs/XP,
 * inventory, equipment, and recent transactions) so the HUD, PhoneBankApp, CityNeedsDock, and 3D
 * character reflect outcomes immediately alongside server-authoritative queries.
 */
export function syncZoneOutcomeToQueryCache(
  queryClient: QueryClient,
  zoneTitle: string,
  outcome: ZoneActionOutcome,
): void {
  const nowIso = new Date().toISOString();

  if (outcome.walletDelta !== 0 || (outcome.bankDelta ?? 0) !== 0) {
    queryClient.setQueryData<Record<string, unknown> | null>(["wallet"], (existing) => {
      if (!existing) {
        return {
          id: "local-wallet",
          balance: Math.max(0, 5000 + outcome.walletDelta),
          bank_balance: Math.max(0, 12000 + (outcome.bankDelta ?? 0)),
        };
      }
      const prevPocket = typeof existing["balance"] === "number" ? existing["balance"] : 0;
      const prevBank = typeof existing["bank_balance"] === "number" ? existing["bank_balance"] : 0;
      return {
        ...existing,
        balance: Math.max(0, prevPocket + outcome.walletDelta),
        bank_balance: Math.max(0, prevBank + (outcome.bankDelta ?? 0)),
      };
    });

    queryClient.setQueryData<Record<string, unknown>[]>(["transactions"], (existing) => {
      const entry = {
        id: `local-tx-${Date.now()}`,
        kind: outcome.walletDelta >= 0 ? "earning" : "purchase",
        description: `${zoneTitle} · ${outcome.label}`,
        amount: outcome.walletDelta !== 0 ? outcome.walletDelta : (outcome.bankDelta ?? 0),
        created_at: nowIso,
      };
      return existing ? [entry, ...existing].slice(0, 30) : [entry];
    });
  }

  if (outcome.needDeltas || outcome.xpGain) {
    queryClient.setQueryData<Record<string, unknown> | null>(["character"], (existing) => {
      if (!existing) return existing;
      const hungerDelta = outcome.needDeltas?.hunger ?? 0;
      const energyDelta = outcome.needDeltas?.energy ?? 0;
      const funDelta = outcome.needDeltas?.fun ?? 0;
      const socialDelta = outcome.needDeltas?.social ?? 0;
      const prevHunger = typeof existing["hunger"] === "number" ? existing["hunger"] : 30;
      const prevEnergy = typeof existing["energy"] === "number" ? existing["energy"] : 80;
      const prevHappiness = typeof existing["happiness"] === "number" ? existing["happiness"] : 75;
      const prevSocial = typeof existing["social"] === "number" ? existing["social"] : 70;
      const prevXp = typeof existing["xp"] === "number" ? existing["xp"] : 0;
      return {
        ...existing,
        // Note: character.hunger is fullness deficit (0 = full, 100 = starving), while simulation.needs.hunger is fullness.
        hunger: clampNeed(prevHunger - hungerDelta),
        energy: clampNeed(prevEnergy + energyDelta),
        happiness: clampNeed(prevHappiness + funDelta),
        social: clampNeed(prevSocial + socialDelta),
        xp: prevXp + (outcome.xpGain ?? 0),
      };
    });
  }

  if (outcome.craftItem) {
    const crafted = outcome.craftItem;
    queryClient.setQueryData<Record<string, unknown>[]>(["inventory"], (existing) => {
      const list = Array.isArray(existing) ? [...existing] : [];
      const idx = list.findIndex((row) => {
        const item = row["item"] as Record<string, unknown> | null | undefined;
        return item?.["slug"] === crafted.slug;
      });
      if (idx >= 0) {
        const current = list[idx]!;
        const qty = typeof current["quantity"] === "number" ? current["quantity"] : 1;
        list[idx] = { ...current, quantity: qty + 1, acquired_at: nowIso };
        return list;
      }
      return [
        {
          id: `local-inv-${crafted.slug}`,
          quantity: 1,
          acquired_at: nowIso,
          item: {
            id: `local-item-${crafted.slug}`,
            slug: crafted.slug,
            name: crafted.name,
            category: crafted.category,
            description: crafted.description,
          },
        },
        ...list,
      ];
    });
  }

  if (outcome.equipSlot) {
    const eq = outcome.equipSlot;
    queryClient.setQueryData<Record<string, unknown>[]>(["equipment"], (existing) => {
      const list = Array.isArray(existing) ? existing.filter((row) => row["slot"] !== eq.slot) : [];
      return [
        ...list,
        {
          id: `local-eq-${eq.slot}`,
          slot: eq.slot,
          item: {
            id: `local-item-${eq.slug}`,
            slug: eq.slug,
            name: eq.name,
          },
        },
      ];
    });
  }
}

export function syncNpcChatToQueryCache(queryClient: QueryClient, socialBoost = 10): void {
  queryClient.setQueryData<Record<string, unknown> | null>(["character"], (existing) => {
    if (!existing) return existing;
    const prevSocial = typeof existing["social"] === "number" ? existing["social"] : 70;
    const prevHappiness = typeof existing["happiness"] === "number" ? existing["happiness"] : 75;
    return {
      ...existing,
      social: clampNeed(prevSocial + socialBoost),
      happiness: clampNeed(prevHappiness + 4),
    };
  });
}

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
  needOffsets: Partial<Record<NeedName, number>>,
): Needs {
  const baseHunger = liveNeeds?.hunger ?? clampNeed(100 - (character?.hunger ?? 25));
  const baseEnergy = liveNeeds?.energy ?? clampNeed(character?.energy ?? 80);
  const baseHygiene = liveNeeds?.hygiene ?? 78;
  const baseBladder = liveNeeds?.bladder ?? 74;
  const baseFun = liveNeeds?.fun ?? clampNeed(character?.happiness ?? 72);
  const baseSocial = liveNeeds?.social ?? clampNeed(character?.social ?? 68);
  return {
    hunger: clampNeed(baseHunger + (needOffsets.hunger ?? 0)),
    energy: clampNeed(baseEnergy + (needOffsets.energy ?? 0)),
    hygiene: clampNeed(baseHygiene + (needOffsets.hygiene ?? 0)),
    bladder: clampNeed(baseBladder + (needOffsets.bladder ?? 0)),
    fun: clampNeed(baseFun + (needOffsets.fun ?? 0)),
    social: clampNeed(baseSocial + (needOffsets.social ?? 0)),
  };
}

export function loadPersistedNeighborhoodState(): NeighborhoodInteractionState {
  if (typeof window === "undefined") return initialNeighborhoodState;
  try {
    const raw = window.sessionStorage.getItem("osun:neighborhood:slice-offsets");
    if (!raw) return initialNeighborhoodState;
    const parsed = JSON.parse(raw) as Partial<NeighborhoodInteractionState>;
    return {
      ...initialNeighborhoodState,
      ...(typeof parsed.walletOffset === "number" ? { walletOffset: parsed.walletOffset } : {}),
      ...(typeof parsed.bankOffset === "number" ? { bankOffset: parsed.bankOffset } : {}),
      ...(typeof parsed.xpOffset === "number" ? { xpOffset: parsed.xpOffset } : {}),
      ...(parsed.needOffsets && typeof parsed.needOffsets === "object"
        ? { needOffsets: parsed.needOffsets }
        : {}),
      ...(Array.isArray(parsed.localInventory) ? { localInventory: parsed.localInventory } : {}),
      ...(typeof parsed.equippedAccessorySlug === "string" || parsed.equippedAccessorySlug === null
        ? { equippedAccessorySlug: parsed.equippedAccessorySlug }
        : {}),
      ...(Array.isArray(parsed.localTransactions)
        ? { localTransactions: parsed.localTransactions }
        : {}),
    };
  } catch {
    return initialNeighborhoodState;
  }
}

export function persistNeighborhoodState(state: NeighborhoodInteractionState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      "osun:neighborhood:slice-offsets",
      JSON.stringify({
        walletOffset: state.walletOffset,
        bankOffset: state.bankOffset,
        xpOffset: state.xpOffset,
        needOffsets: state.needOffsets,
        localInventory: state.localInventory,
        equippedAccessorySlug: state.equippedAccessorySlug,
        localTransactions: state.localTransactions,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}
