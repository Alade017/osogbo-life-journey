import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { House, Pencil, WifiOff } from "lucide-react";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";
import type {
  HouseInventoryItem,
  HouseOutfit,
  HousePlacement,
  HouseSlot,
} from "@/components/game/housing/HouseRoomScene";
import { HouseRoom3D } from "@/components/game/housing/HouseRoom3D";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { homeFurnitureAction, homeFurnitureNeed } from "@/lib/home-furniture-actions";
import { ACTION_CATALOG } from "@/lib/life-simulation";
import { HousingReliefPanel } from "@/components/game/housing/HousingReliefPanel";
import { housingReliefQueryKey } from "@/lib/housing-relief-client";
import { HouseSceneSkeleton } from "@/components/game/loading-skeletons";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import housingData from "@/data/housing.json";
import { formatNaira, q } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import {
  houseStateQueryKey,
  subscribeToHouseStateChanges,
  updateHouseStateStore,
  type HouseRealtimeClient,
} from "@/lib/house-state-sync";
import { pageMeta } from "@/lib/seo";
import "@/components/game/housing/house-screen.css";

export const Route = createFileRoute("/_authenticated/_game/house")({
  head: () => pageMeta("Your home", "Visit your home, place furniture, and choose an outfit."),
  component: HousePage,
});

type HouseState = {
  house: null | {
    id: string;
    house_type_id: string;
    status: string;
    next_rent_due_at: string;
    house_type: {
      id: string;
      label: string;
      bedrooms: number;
      asset_key: string;
      slots: HouseSlot[];
      weekly_rent_minor: number;
    };
  };
  placements: HousePlacement[];
  outfit: HouseOutfit;
  inventory: HouseInventoryItem[];
};
type HouseStateSnapshot = { state: HouseState; source: "server" | "saved" };
type CanonicalHome = {
  propertyId: string;
  houseTypeId: string;
  name: string;
  imageUrl: string | null;
  district: string | null;
  tenure: string;
  status: string | null;
  dueAt: string | null;
  graceEndsAt: string | null;
  rescueEndsAt: string | null;
  weeklyRentMinor: number;
  accessoryBand: string;
};
type CatalogItem = {
  id: string;
  category: string;
  slot_type: string;
  art_key: string;
  price_minor: number;
  is_active: boolean;
};
const EMPTY_OUTFIT: HouseOutfit = {
  head: null,
  top: null,
  bottom: null,
  shoes: null,
  accessory: null,
};
const houseTypes = housingData as Array<{
  id: string;
  home_slots?: HouseSlot[];
  walkable_area?: {
    x: number;
    y: number;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
}>;
const CACHE_PREFIX = "osogbo-house-state-v1:";

function getBuyRequestKey(playerId: string, itemId: string, memory: Map<string, string>) {
  const storageKey = `${CACHE_PREFIX}buy-request:${playerId}:${itemId}`;
  let key = memory.get(storageKey);
  if (key) return key;
  try {
    key = localStorage.getItem(storageKey) ?? undefined;
  } catch {
    // Keep the retry key in memory if browser storage is unavailable.
  }
  key ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${Math.random()}`;
  memory.set(storageKey, key);
  try {
    localStorage.setItem(storageKey, key);
  } catch {
    /* Storage may be unavailable. */
  }
  return key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeHouseState(value: unknown): HouseState | null {
  if (!isRecord(value) || !("house" in value)) return null;
  const rawHouse = value["house"];
  let house: HouseState["house"] = null;
  if (rawHouse !== null) {
    if (!isRecord(rawHouse) || !isRecord(rawHouse["house_type"])) return null;
    const type = rawHouse["house_type"];
    if (
      typeof rawHouse["id"] !== "string" ||
      typeof rawHouse["house_type_id"] !== "string" ||
      typeof rawHouse["status"] !== "string" ||
      typeof rawHouse["next_rent_due_at"] !== "string" ||
      typeof type["id"] !== "string" ||
      typeof type["label"] !== "string" ||
      typeof type["asset_key"] !== "string"
    )
      return null;
    house = {
      id: rawHouse["id"],
      house_type_id: rawHouse["house_type_id"],
      status: rawHouse["status"],
      next_rent_due_at: rawHouse["next_rent_due_at"],
      house_type: {
        id: type["id"],
        label: type["label"],
        bedrooms: typeof type["bedrooms"] === "number" ? type["bedrooms"] : 1,
        asset_key: type["asset_key"],
        slots: Array.isArray(type["slots"]) ? (type["slots"] as HouseSlot[]) : [],
        weekly_rent_minor:
          typeof type["weekly_rent_minor"] === "number" ? type["weekly_rent_minor"] : 0,
      },
    };
  }
  const rawOutfit = isRecord(value["outfit"]) ? value["outfit"] : {};
  const outfit = Object.fromEntries(
    Object.keys(EMPTY_OUTFIT).map((slot) => [
      slot,
      typeof rawOutfit[slot] === "string" ? rawOutfit[slot] : null,
    ]),
  ) as HouseOutfit;
  return {
    house,
    placements: Array.isArray(value["placements"]) ? (value["placements"] as HousePlacement[]) : [],
    outfit,
    inventory: Array.isArray(value["inventory"])
      ? (value["inventory"] as HouseInventoryItem[])
      : [],
  };
}

function readSavedHouseState(characterId: string): HouseState | null {
  try {
    return normalizeHouseState(
      JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${characterId}`) ?? "null"),
    );
  } catch {
    return null;
  }
}

function houseLoadMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHORIZED") return "Your session expired. Sign in again to load your home.";
  if (code === "HOUSE_SETUP_REQUIRED")
    return "Your home needs the latest database update before it can load.";
  return "Your house could not be loaded. Check your connection and try again.";
}

function formatRentDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function normalizeCanonicalHome(value: unknown): CanonicalHome | null {
  if (!isRecord(value) || typeof value["propertyId"] !== "string") return null;
  if (typeof value["houseTypeId"] !== "string" || typeof value["name"] !== "string") return null;
  return {
    propertyId: value["propertyId"],
    houseTypeId: value["houseTypeId"],
    name: value["name"],
    imageUrl: typeof value["imageUrl"] === "string" ? value["imageUrl"] : null,
    district: typeof value["district"] === "string" ? value["district"] : null,
    tenure: typeof value["tenure"] === "string" ? value["tenure"] : "rented",
    status: typeof value["status"] === "string" ? value["status"] : null,
    dueAt: typeof value["dueAt"] === "string" ? value["dueAt"] : null,
    graceEndsAt: typeof value["graceEndsAt"] === "string" ? value["graceEndsAt"] : null,
    rescueEndsAt: typeof value["rescueEndsAt"] === "string" ? value["rescueEndsAt"] : null,
    weeklyRentMinor: typeof value["weeklyRentMinor"] === "number" ? value["weeklyRentMinor"] : 0,
    accessoryBand: typeof value["accessoryBand"] === "string" ? value["accessoryBand"] : "basic",
  };
}

function legacyHouseState(value: unknown): HouseState | null {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { home_items?: unknown }).home_items)
  )
    return null;
  const legacy = value as {
    home?: null | {
      id?: string;
      house_type_id?: string;
      next_rent_at?: string;
      moved_in_at?: string;
      house_types?: {
        id?: string;
        label?: string;
        bedrooms?: number;
        asset_key?: string;
        weekly_rent_minor?: number;
        slots?: HouseSlot[];
      };
    };
    home_items: Array<{
      id: string;
      item_id: string;
      slot_type: string;
      slot_id: string | null;
      placed: boolean;
      equipped: boolean;
    }>;
  };
  const home = legacy.home;
  if (!home) return { house: null, placements: [], outfit: EMPTY_OUTFIT, inventory: [] };
  const type = home.house_types;
  if (!home.id || !home.house_type_id || !type?.id || !type.label || !type.asset_key) return null;
  const slotAliases: Record<string, keyof HouseOutfit> = {
    hat: "head",
    head: "head",
    top: "top",
    bottom: "bottom",
    shoes: "shoes",
    accessory: "accessory",
  };
  const outfit: HouseOutfit = { ...EMPTY_OUTFIT };
  for (const item of legacy.home_items) {
    const slot = slotAliases[item.slot_type];
    if (item.equipped && slot) outfit[slot] = item.item_id;
  }
  const inventory: HouseInventoryItem[] = legacy.home_items.map((item) => {
    const wearableSlot = slotAliases[item.slot_type];
    return {
      id: item.id,
      item_id: item.item_id,
      category: wearableSlot
        ? wearableSlot === "accessory"
          ? "accessory"
          : "outfit"
        : "furniture",
      slot_type: wearableSlot ?? item.slot_type,
      art_key: item.item_id,
      price_minor: 0,
      quantity: 1,
    };
  });
  const placements: HousePlacement[] = legacy.home_items
    .filter((item) => item.placed)
    .map((item) => ({
      id: item.id,
      item_id: item.item_id,
      slot: item.slot_id ?? item.item_id,
      art_key: item.item_id,
      category: "furniture",
      slot_type: item.slot_type,
    }));
  return {
    house: {
      id: home.id,
      house_type_id: home.house_type_id,
      status: "active",
      next_rent_due_at: home.next_rent_at ?? home.moved_in_at ?? new Date().toISOString(),
      house_type: {
        id: type.id,
        label: type.label,
        bedrooms: type.bedrooms ?? 1,
        asset_key: type.asset_key,
        slots: type.slots ?? [],
        weekly_rent_minor: type.weekly_rent_minor ?? 0,
      },
    },
    placements,
    outfit,
    inventory,
  };
}

async function authorizedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
  });
}

export function HousePage({ homeRoute = false }: { homeRoute?: boolean }) {
  const queryClient = useQueryClient();
  const gameTime = useGameTime();
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [editing, setEditing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<HouseSlot | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<HousePlacement | null>(null);
  const [usingPlacementId, setUsingPlacementId] = useState<string | null>(null);
  const [activityError, setActivityError] = useState("");
  const [apiError, setApiError] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const buyRequestKeys = useRef(new Map<string, string>());

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setPlayerId(data.session?.user.id ?? null);
      if (data.session?.access_token) void supabase.realtime.setAuth(data.session.access_token);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setPlayerId(session?.user.id ?? null);
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshHouseState = useCallback(() => {
    if (!character?.id) return;
    void queryClient.invalidateQueries({ queryKey: houseStateQueryKey(character.id), exact: true });
  }, [character?.id, queryClient]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      refreshHouseState();
    };
    const goOffline = () => setOnline(false);
    const onFocus = () => refreshHouseState();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshHouseState();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshHouseState]);

  const stateQuery = useQuery({
    queryKey: character?.id
      ? houseStateQueryKey(character.id)
      : ["authoritativeHouseState", "none"],
    enabled: !!character?.id,
    retry: false,
    queryFn: async (): Promise<HouseStateSnapshot> => {
      let primaryError: Error | null = null;
      try {
        const response = await authorizedFetch("/api/house/state");
        const result = await response.json().catch(() => null);
        const normalized = normalizeHouseState(result);
        if (!response.ok || !normalized) {
          primaryError = new Error(
            response.ok
              ? "INVALID_HOUSE_STATE"
              : isRecord(result) &&
                  isRecord(result["error"]) &&
                  typeof result["error"]["code"] === "string"
                ? result["error"]["code"]
                : "HOUSE_SERVICE_UNAVAILABLE",
          );
        } else {
          try {
            localStorage.setItem(`${CACHE_PREFIX}${character!.id}`, JSON.stringify(normalized));
          } catch {
            /* Storage may be unavailable. */
          }
          return { state: normalized, source: "server" };
        }
      } catch (error) {
        primaryError = error instanceof Error ? error : new Error("HOUSE_SERVICE_UNAVAILABLE");
      }

      try {
        const legacyResponse = await authorizedFetch("/api/housing/home");
        const fallback = legacyHouseState(await legacyResponse.json().catch(() => null));
        if (legacyResponse.ok && fallback) {
          localStorage.setItem(`${CACHE_PREFIX}${character!.id}`, JSON.stringify(fallback));
          return { state: fallback, source: "server" };
        }
      } catch {
        // The saved snapshot below remains usable when either endpoint is unavailable.
      }

      const saved = readSavedHouseState(character!.id);
      if (saved) return { state: saved, source: "saved" };
      throw primaryError ?? new Error("HOUSE_SERVICE_UNAVAILABLE");
    },
  });
  const snapshot = stateQuery.data;
  const serverState = snapshot?.state;
  const usingSaved = snapshot?.source === "saved";
  const canonicalHomeQuery = useQuery({
    queryKey: ["canonicalHousingHome", character?.id],
    enabled: !!character?.id && online,
    staleTime: 15_000,
    queryFn: async () => {
      const response = await authorizedFetch("/api/housing/current-home");
      if (!response.ok) throw new Error("HOME_UNAVAILABLE");
      return normalizeCanonicalHome(await response.json().catch(() => null));
    },
  });

  useEffect(() => {
    if (!playerId) return;
    return subscribeToHouseStateChanges(
      supabase as unknown as HouseRealtimeClient,
      playerId,
      serverState?.house?.id ?? null,
      refreshHouseState,
    );
  }, [playerId, refreshHouseState, serverState?.house?.id]);
  const houseTypeId = serverState?.house?.house_type_id;
  const roomLayout = houseTypes.find((entry) => entry.id === houseTypeId);
  const slots = useMemo(() => {
    const local = roomLayout?.home_slots ?? [];
    const serverSlots = serverState?.house?.house_type.slots ?? [];
    return serverSlots.flatMap((serverSlot) => {
      const position = local.find(
        (slot) => slot.id === serverSlot.id && slot.slot_type === serverSlot.slot_type,
      );
      return position ? [{ ...serverSlot, ...position }] : [];
    });
  }, [roomLayout, serverState?.house?.house_type.slots]);

  const catalogQuery = useQuery({
    queryKey: ["houseCatalog"],
    enabled: !!serverState?.house,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id,category,slot_type,art_key,price_minor,is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data as CatalogItem[];
    },
    staleTime: 5 * 60_000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      itemId,
      slot,
    }: {
      action: "place" | "remove" | "equip" | "unequip" | "buy";
      itemId?: string;
      slot?: string;
    }) => {
      const paths = {
        place: "/api/house/place",
        remove: "/api/house/remove",
        equip: "/api/outfit/equip",
        unequip: "/api/outfit/unequip",
        buy: "/api/shop/buy",
      };
      const key =
        action === "buy" && itemId
          ? getBuyRequestKey(character?.id ?? "anonymous", itemId, buyRequestKeys.current)
          : undefined;
      const response = await authorizedFetch(paths[action], {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
        body: JSON.stringify(
          action === "remove" || action === "unequip"
            ? { slot }
            : action === "place"
              ? { itemId, slot }
              : { itemId },
        ),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (action === "buy" && itemId && response.status < 500) {
          const storageKey = `${CACHE_PREFIX}buy-request:${character?.id ?? "anonymous"}:${itemId}`;
          buyRequestKeys.current.delete(storageKey);
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* Storage may be unavailable. */
          }
        }
        throw new Error(result?.error?.code ?? "That change was not saved.");
      }
      const nextState = normalizeHouseState(result?.state);
      if (!nextState) throw new Error("The server returned an incomplete house update.");
      return nextState;
    },
    onSuccess: (state, variables) => {
      if (variables.action === "buy" && variables.itemId) {
        const storageKey = `${CACHE_PREFIX}buy-request:${character?.id ?? "anonymous"}:${variables.itemId}`;
        buyRequestKeys.current.delete(storageKey);
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Storage may be unavailable. */
        }
      }
      if (character?.id) {
        const serverSnapshot: HouseStateSnapshot = { state, source: "server" };
        updateHouseStateStore(queryClient, character.id, serverSnapshot);
      }
      try {
        if (character?.id)
          localStorage.setItem(`${CACHE_PREFIX}${character.id}`, JSON.stringify(state));
      } catch {
        /* Storage may be unavailable. */
      }
      void queryClient.invalidateQueries({ queryKey: q.wallet().queryKey });
      void queryClient.invalidateQueries({ queryKey: q.equipment().queryKey });
      setApiError("");
      if (variables.action === "buy") {
        toast.success("Item bought. Choose an open room slot to place it.");
      } else {
        setSelectedSlot(null);
        setSelectedPlacement(null);
      }
    },
    onError: (error: Error) => {
      const message = `Your change wasn’t saved. ${error.message.replaceAll("_", " ").toLowerCase()}.`;
      setApiError(message);
      toast.error(message);
      refreshHouseState();
    },
  });
  const cancelTenancy = useMutation({
    mutationFn: async () => {
      if (!playerId) throw new Error("Sign in again to manage your tenancy.");
      const cancelHouse = supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await cancelHouse("cancel_player_house", { p_user_id: playerId });
      if (error) throw new Error(error.message);
      if (!isRecord(data) || data["ok"] !== true)
        throw new Error("The server did not confirm the tenancy cancellation.");
      return data;
    },
    onSuccess: async () => {
      toast.success(
        "Your tenancy has ended. Your furniture remains in your inventory; rent and deposit are not refunded.",
      );
      refreshHouseState();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        queryClient.invalidateQueries({ queryKey: ["rentStatus"] }),
        queryClient.invalidateQueries({ queryKey: ["homeSave"] }),
        queryClient.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const payRentKey = useRef<string | null>(null);
  const payRent = useMutation({
    mutationFn: async () => {
      const key = payRentKey.current ?? crypto.randomUUID();
      payRentKey.current = key;
      const response = await authorizedFetch("/api/housing/pay-rent", {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          isRecord(result) &&
            isRecord(result["error"]) &&
            typeof result["error"]["reason"] === "string"
            ? result["error"]["reason"]
            : "Rent could not be paid. Try again.",
        );
      return result;
    },
    onSuccess: async () => {
      payRentKey.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
        queryClient.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        queryClient.invalidateQueries({ queryKey: ["housingMapProperties"] }),
        ...(character?.id
          ? [queryClient.invalidateQueries({ queryKey: housingReliefQueryKey(character.id) })]
          : []),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success("Rent paid. Your next due date is updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const placements = serverState?.placements ?? [];
  const inventory = serverState?.inventory ?? [];
  const outfit = serverState?.outfit ?? EMPTY_OUTFIT;
  const appearance = (
    character?.appearance && typeof character.appearance === "object" ? character.appearance : {}
  ) as Appearance;
  const isOffline = !online || usingSaved;
  const canonicalHome = canonicalHomeQuery.data;
  const rentStatus = canonicalHome?.status ?? serverState?.house?.status ?? "unknown";
  const rentDueAt = canonicalHome?.dueAt ?? serverState?.house?.next_rent_due_at;
  const isOverdue = rentStatus === "grace" || rentStatus === "rescue" || rentStatus === "overdue";
  const rentStatusLabel: Record<string, string> = {
    current: "Current",
    active: "Current",
    due: "Rent due",
    grace: "In grace period",
    rescue: "Overdue",
    overdue: "Overdue",
    owned: "Owned",
  };

  const requestAction = (args: Parameters<typeof actionMutation.mutate>[0]) => {
    if (isOffline || actionMutation.isPending) return;
    actionMutation.mutate(args);
  };
  const interactWithPlacement = async (placement: HousePlacement) => {
    const action = homeFurnitureAction(placement.item_id);
    if (!action || usingPlacementId || isOffline || !gameTime.ready || gameTime.busy) return;
    setUsingPlacementId(placement.id);
    setActivityError("");
    try {
      const active = gameTime.simulation.currentAction;
      if (active && active.actionId !== action) {
        throw new Error("Finish your current activity before using another accessory.");
      }
      const requestId = active?.requestId ?? crypto.randomUUID();
      if (!active) {
        const startError = await gameTime.start(action, requestId);
        if (startError) throw new Error(startError);
      }
      const completeError = await gameTime.complete(requestId, action);
      if (completeError) throw new Error(completeError);
      toast.success(ACTION_CATALOG[action].outcome);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "That activity could not be completed.";
      setActivityError(message);
      toast.error(message);
    } finally {
      setUsingPlacementId(null);
    }
  };
  if (characterLoading || (stateQuery.isLoading && !snapshot))
    return (
      <div className="house-page">
        <HouseSceneSkeleton />
      </div>
    );

  if (stateQuery.isError && !snapshot)
    return (
      <div className="house-page">
        <section className="house-error-card" role="alert">
          <p>{houseLoadMessage(stateQuery.error)}</p>
          <button type="button" onClick={() => void stateQuery.refetch()}>
            Try again
          </button>
        </section>
      </div>
    );

  if (!serverState?.house)
    return (
      <div className="house-page">
        <header className="house-page-header">
          <div>
            <p className="house-eyebrow">Your home</p>
            <h1>Make yourself at home</h1>
          </div>
          {!homeRoute && (
            <Link to="/home" search={{ visit: undefined }} className="house-header-link">
              Back to home
            </Link>
          )}
        </header>
        <section className="house-empty-card">
          <div className="house-empty-art">
            <House size={44} strokeWidth={1.5} />
          </div>
          <div>
            <h2>{canonicalHome ? "Your room is being prepared" : "You don’t have a place yet"}</h2>
            <p>
              {canonicalHome
                ? "Your rental is recorded, but the room is not ready to display. Refresh the page after the housing update is applied."
                : "Choose a home to get your own room and space for furniture."}
            </p>
            {canonicalHome ? (
              <button
                className="house-primary-button"
                type="button"
                onClick={() => void stateQuery.refetch()}
              >
                Refresh room
              </button>
            ) : (
              <Link className="house-primary-button" to="/properties">
                Find a place
              </Link>
            )}
          </div>
        </section>
      </div>
    );

  const house = serverState.house;
  return (
    <div className="house-page house-page-fill">
      <section
        className={`house-room-card${house.status === "overdue" ? " room-overdue" : ""}`}
        aria-label={`${house.house_type.label} room`}
      >
        <HouseRoom3D
          houseTypeId={house.house_type_id}
          accessoryBand={canonicalHome?.accessoryBand ?? "basic"}
          slots={slots}
          placements={placements}
          editMode={editing}
          onSelectPlacement={(placement) => {
            if (!editing) {
              void interactWithPlacement(placement);
              return;
            }
            setSelectedSlot(null);
            setSelectedPlacement(placement);
          }}
          onSelectSlot={(slot) => {
            setSelectedPlacement(null);
            setSelectedSlot(slot);
          }}
        />
      </section>
      {!editing && (
        <section className="house-needs-actions" aria-label="Use home accessories">
          <h2>Use your home</h2>
          <p>Tap a placed accessory to care for your character.</p>
          <div className="house-needs-action-list">
            {placements
              .filter((placement) => homeFurnitureAction(placement.item_id))
              .map((placement) => {
                const action = homeFurnitureAction(placement.item_id)!;
                const need = homeFurnitureNeed(placement.item_id);
                return (
                  <button
                    key={placement.id}
                    type="button"
                    className="house-needs-action"
                    disabled={isOffline || !gameTime.ready || gameTime.busy || !!usingPlacementId}
                    onClick={() => void interactWithPlacement(placement)}
                  >
                    <strong>
                      {usingPlacementId === placement.id ? "Using..." : ACTION_CATALOG[action].name}
                    </strong>
                    <span>
                      {need ? `${need} · ` : ""}
                      {placement.item_id.replaceAll("-", " ")}
                    </span>
                  </button>
                );
              })}
          </div>
          {!placements.some((placement) => homeFurnitureAction(placement.item_id)) && (
            <p>
              Place an owned bed, seat, stove, shower, toilet, television, or plant to unlock home
              activities.
            </p>
          )}
          {!gameTime.ready && !isOffline && <p role="status">Connecting character needs...</p>}
          {isOffline && <p role="status">Reconnect to use your accessories.</p>}
          {activityError && <p role="alert">{activityError}</p>}
        </section>
      )}
      <button
        className="house-edit-button house-edit-toggle"
        type="button"
        aria-pressed={editing}
        onClick={() => {
          setEditing((value) => !value);
          setSelectedPlacement(null);
          setSelectedSlot(null);
        }}
      >
        <Pencil size={16} /> {editing ? "Done" : "Shop & arrange"}
      </button>
      {editing && (
        <HouseEditSheets
          open
          offline={isOffline}
          pending={actionMutation.isPending}
          cash={wallet?.balance ?? null}
          inventory={inventory}
          catalog={catalogQuery.data ?? []}
          outfit={outfit}
          selectedSlot={selectedSlot}
          selectedPlacement={selectedPlacement}
          onClose={() => {
            setEditing(false);
            setSelectedSlot(null);
            setSelectedPlacement(null);
          }}
          onPlace={(itemId, slot) => requestAction({ action: "place", itemId, slot: slot.id })}
          onRemove={(placement) => requestAction({ action: "remove", slot: placement.slot })}
          onEquip={(itemId) => requestAction({ action: "equip", itemId })}
          onUnequip={(slot) => requestAction({ action: "unequip", slot })}
          onBuy={(itemId) => requestAction({ action: "buy", itemId })}
        />
      )}
    </div>
  );
}
