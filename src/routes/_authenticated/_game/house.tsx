import { useHouseMovement } from "@/hooks/use-house-movement";
import {
  findRoomPath,
  placementPoint,
  packagePoint,
  roomObstacles,
  type RoomPoint,
  placementsOverlappingWalls,
  runHouseStairTransition,
} from "@/game/house-navigation";
import {
  HOUSE_GRID_STEP,
  HOUSE_ROOM_SIZE,
  draftStartFor,
  firstFreeHouseGridCell,
  houseDoorThreshold,
  houseStairs,
  isHouseGridCellOccupied,
  snapToHouseGrid,
  firstFreeBackWallCell,
  isWallArtKind,
  snapToBackWall,
  type DraftMove,
} from "@/components/game/housing/house-room-contract";
import { HousePlacementBar } from "@/components/game/housing/HousePlacementBar";
import {
  arrangementWarnings,
  guideFor,
  houseDoorPercentX,
} from "@/components/game/housing/house-arrangement-guide";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  House,
  Sunrise,
  WifiOff,
  RefreshCcwDot,
  DoorOpen,
  LoaderCircle,
  Lightbulb,
  LightbulbOff,
} from "lucide-react";
import { fetchHouseLight, setHouseLight } from "@/lib/house-light";
import { fetchHouseWalls, setHouseWalls } from "@/lib/house-walls";
import {
  houseWallsDefaultClosed,
  houseRoomViews,
  roomViewContains,
  WHOLE_HOME_LABEL,
} from "@/components/game/housing/house-room-contract";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";
import { HouseCatalogue } from "@/components/game/housing/HouseCatalogue";
import { HomeFoodDeliveryPanel } from "@/components/game/housing/HomeFoodDeliveryPanel";
import type {
  HouseInventoryItem,
  HouseOutfit,
  HousePlacement,
  HouseSlot,
} from "@/components/game/housing/HouseRoomScene";
import { HomeAccessoryPanel } from "@/components/game/housing/HomeAccessoryPanel";
import { DrawerSheet } from "@/components/game/housing/DrawerSheet";
import { drawerAction, fetchDrawerState, storableRows } from "@/lib/drawer";
import { HouseRoomRenderer } from "@/components/game/housing/HouseRoomRenderer";
import { useGameTime } from "@/components/game/GameTimeProvider";
import {
  beginTransition,
  completeTransitionStep,
  endTransition,
  useOutsideTransition,
} from "@/lib/outside-transition";
import { homeFurnitureAction, homeFurnitureActions } from "@/lib/home-furniture-actions";

/** Length of the door swing, matching the door animation in the room. */
const DOOR_SWING_MS = 650;
import { foodDeliveryService } from "@/lib/food-delivery-service";
import { ACTION_CATALOG, type LifeActionId } from "@/lib/life-simulation";
import { HousingReliefPanel } from "@/components/game/housing/HousingReliefPanel";
import { housingReliefQueryKey } from "@/lib/housing-relief-client";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import { HouseSceneSkeleton } from "@/components/game/loading-skeletons";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import housingData from "@/data/housing.json";
import { avatarAnimationForActivity } from "@/game/character-animation";
import { formatNaira, q, rpc } from "@/lib/game";
import {
  runHomeDepartureAfterWalk,
  takeDepartureFromHomeWhenReady,
  type HomeDeparture,
} from "@/lib/home-departure";
import { supabase } from "@/integrations/supabase/client";
import {
  houseStateQueryKey,
  subscribeToHouseStateChanges,
  updateHouseStateStore,
  type HouseRealtimeClient,
} from "@/lib/house-state-sync";
import { pageMeta } from "@/lib/seo";
import "@/components/game/housing/house-screen.css";
import "@/components/game/housing/house-light-switch.css";
import "@/components/game/housing/house-floor-label.css";
import "@/components/game/housing/house-room-view.css";

/** Seconds of sleep for a full rest. */
const SLEEP_FULL_REST_SECONDS = 120;

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
type HouseStateSnapshot = { state: HouseState; source: "server" };
type CanonicalHome = {
  propertyId: string;
  playerPropertyId: string;
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
/** Art key of the drawer furniture: tapping it opens the drawer instead of an accessory panel. */
const DRAWER_ART_KEY = "drawer";
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
// v2: v1 snapshots could show an out-of-date layout, so they are never read again.
const CACHE_PREFIX = "osogbo-house-state-v2:";

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
  if (
    !isRecord(value) ||
    typeof value["propertyId"] !== "string" ||
    typeof value["playerPropertyId"] !== "string"
  )
    return null;
  if (typeof value["houseTypeId"] !== "string" || typeof value["name"] !== "string") return null;
  return {
    propertyId: value["propertyId"],
    playerPropertyId: value["playerPropertyId"],
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
      x: number;
      y: number;
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
      x: item.x,
      y: item.y,
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const gameTime = useGameTime();
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [editing, setEditing] = useState(false);
  // Catalogue: open panel, and an owned item waiting to appear so it can be moved.
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<{ itemId: string; knownIds: string[] } | null>(
    null,
  );
  const [selectedPlacement, setSelectedPlacement] = useState<HousePlacement | null>(null);
  // Placement mode: the item being moved, shown at its draft grid cell until placed or cancelled.
  const [draftMove, setDraftMove] = useState<DraftMove | null>(null);
  const [previewMove, setPreviewMove] = useState<{
    placementId: string;
    x: number;
    y: number;
  } | null>(null);
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
          return { state: normalized, source: "server" };
        }
      } catch (error) {
        primaryError = error instanceof Error ? error : new Error("HOUSE_SERVICE_UNAVAILABLE");
      }

      try {
        const legacyResponse = await authorizedFetch("/api/housing/home");
        const fallback = legacyHouseState(await legacyResponse.json().catch(() => null));
        if (legacyResponse.ok && fallback) {
          return { state: fallback, source: "server" };
        }
      } catch {
        // The server is the only source of truth; a failure below is shown to the player.
      }

      throw primaryError ?? new Error("HOUSE_SERVICE_UNAVAILABLE");
    },
  });
  const snapshot = stateQuery.data;
  const serverState = snapshot?.state;
  const canonicalHomeQuery = useQuery({
    ...canonicalHomeOptions(character?.id),
    enabled: !!character?.id && online,
    select: normalizeCanonicalHome,
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
  const singleRoom = (serverState?.house?.house_type.bedrooms ?? 1) <= 1;
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
      fromSlot,
      x,
      y,
      floor,
      rotation,
    }: {
      action: "place" | "move" | "remove" | "equip" | "unequip" | "buy" | "rotate";
      itemId?: string;
      slot?: string;
      fromSlot?: string;
      x?: number;
      y?: number;
      floor?: number;
      rotation?: number;
    }) => {
      const paths = {
        place: "/api/house/place",
        move: "/api/house/move",
        rotate: "/api/house/rotate",
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
            : action === "move"
              ? { fromSlot, x, y }
              : action === "rotate"
                ? { fromSlot, rotation }
                : action === "place"
                  ? x !== undefined && y !== undefined
                    ? { itemId, x, y, floor: floor ?? 0 }
                    : { itemId, slot }
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
      setPreviewMove(null);
      if (variables.action === "move" || variables.action === "rotate") {
        setSelectedPlacement((current) =>
          current ? (state.placements.find((item) => item.id === current.id) ?? null) : current,
        );
      }
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
      void queryClient.invalidateQueries({ queryKey: q.wallet().queryKey });
      void queryClient.invalidateQueries({ queryKey: q.equipment().queryKey });
      setApiError("");
      if (variables.action === "buy") {
        toast.success("Item bought.");
      } else if (variables.action === "move") {
        toast.success("Accessory moved.");
      } else if (variables.action === "rotate") {
        toast.success("Accessory turned.");
      } else {
        setSelectedPlacement(null);
      }
    },
    onError: (error: Error) => {
      setPreviewMove(null);
      const message = `Your change wasn’t saved. ${error.message.replaceAll("_", " ").toLowerCase()}.`;
      setApiError(message);
      toast.error(message);
      refreshHouseState();
    },
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

  const canonicalHome = canonicalHomeQuery.data;
  const isInsideHome =
    !!canonicalHome && character?.inside_home_property_id === canonicalHome.playerPropertyId;
  const homePresence = useMutation({
    // Entering from outside starts the door walk; the effect below plays it once the page sees it.
    onMutate: (command) => {
      if (command === "enter_player_home") beginTransition("entering", "Heading to your door", 3);
    },
    mutationFn: async (command: "enter_player_home" | "leave_player_home") => {
      const { data, error } = await supabase.rpc(command);
      if (error) throw new Error(error.message);
      if (
        !isRecord(data) ||
        typeof data["locationId"] !== "string" ||
        (command === "enter_player_home" && typeof data["playerPropertyId"] !== "string")
      )
        throw new Error("The server did not confirm your location. Try again.");
      return data;
    },
    onSuccess: async (data, command) => {
      // Apply the confirmed RPC result immediately; a failed refetch must not leave a ghost at home.
      queryClient.setQueryData(q.character().queryKey, (previous: typeof character) =>
        previous
          ? {
              ...previous,
              current_location_id: data["locationId"] as string,
              inside_home_property_id:
                command === "enter_player_home"
                  ? typeof data["playerPropertyId"] === "string"
                    ? data["playerPropertyId"]
                    : previous.inside_home_property_id
                  : null,
            }
          : previous,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: q.character().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
      ]);
      setActivityError("");
      toast.success(command === "enter_player_home" ? "You're home." : "You went outside.");
    },
    onError: (error: Error, command) => {
      if (command === "enter_player_home") endTransition();
      setActivityError(error.message);
      toast.error(error.message);
    },
  });

  const placements = serverState?.placements ?? [];
  const scenePlacements = previewMove
    ? placements.map((placement) =>
        placement.id === previewMove.placementId
          ? { ...placement, x: previewMove.x, y: previewMove.y }
          : placement,
      )
    : placements;
  const [roomWidth, roomDepth] =
    HOUSE_ROOM_SIZE[serverState?.house?.house_type_id ?? "shared-room"] ??
    HOUSE_ROOM_SIZE["shared-room"]!;
  const movement = useHouseMovement(serverState?.house?.id ?? "none", [0, 0.06, roomDepth * 0.18]);
  // The room view shows one room close up. It follows the character until a room or the whole home is picked.
  const [activeFloor, setActiveFloor] = useState<0 | 1>(0);
  const [climbingStairs, setClimbingStairs] = useState(false);
  const roomViews = serverState?.house
    ? houseRoomViews(serverState.house.house_type_id, roomWidth, roomDepth, activeFloor)
    : [];
  const [pinnedRoom, setPinnedRoom] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setActiveFloor(0);
    setPinnedRoom(undefined);
  }, [serverState?.house?.id]);
  const followedRoom =
    roomViews.find((room) => roomViewContains(room, movement.position[0], movement.position[2]))
      ?.id ??
    roomViews[0]?.id ??
    null;
  const roomView = pinnedRoom === undefined ? followedRoom : pinnedRoom;
  const [walkingTask, setWalkingTask] = useState<string | null>(null);
  const interactionVersion = useRef(0);
  const interactionLock = useRef(false);
  const [startingTask, setStartingTask] = useState(false);
  const [collectingPackage, setCollectingPackage] = useState(false);
  const [cancellingTask, setCancellingTask] = useState(false);
  const autoCompleting = useRef<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const floorPlacements = scenePlacements.filter((item) => (item.floor ?? 0) === activeFloor);
  const obstacles = roomObstacles(
    serverState?.house?.house_type_id ?? "shared-room",
    roomWidth,
    roomDepth,
    placements.filter((item) => (item.floor ?? 0) === activeFloor),
    slots,
    activeFloor,
  );
  const stairs = houseStairs(serverState?.house?.house_type_id ?? "", roomWidth, roomDepth);
  /** Walk to the stairs, climb them, then switch to the other floor at the far end. */
  const climbStairs = async (): Promise<boolean> => {
    if (!stairs || editing || taskBusy || isOffline || !isInsideHome || interactionLock.current)
      return false;
    interactionLock.current = true;
    setClimbingStairs(true);
    setSelectedPlacement(null);
    setPinnedRoom(null);
    setActivityError("");
    try {
      const arrived = await runHouseStairTransition({
        stairs,
        fromFloor: activeFloor,
        approach: (point) => walkTo(point),
        walk: movement.walk,
        setFloor: setActiveFloor,
        place: movement.place,
      });
      if (arrived) setPinnedRoom(undefined);
      return arrived;
    } finally {
      interactionLock.current = false;
      setClimbingStairs(false);
    }
  };
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorInteracting, setDoorInteracting] = useState(false);
  const [doorSequence, setDoorSequence] = useState(false);
  const doorSequenceLock = useRef(false);
  const [doorFacing, setDoorFacing] = useState("north");
  const outside = useOutsideTransition();
  const enteringRan = useRef(false);
  /** Walk to the door, open it, confirm the move with the server, then go to the neighbourhood. */
  const goOutside = async () => {
    if (
      editing ||
      taskBusy ||
      isOffline ||
      !isInsideHome ||
      !serverState?.house ||
      doorSequenceLock.current
    )
      return;
    doorSequenceLock.current = true;
    setActivityError("");
    const [doorX, doorY, doorZ] = houseDoorThreshold(
      serverState.house.house_type_id,
      roomWidth,
      roomDepth,
    );
    try {
      if (activeFloor === 1 && !(await climbStairs())) return;
      setDoorSequence(true);
      if (!(await walkTo([doorX, doorY, doorZ], false, 0))) return;
      setDoorFacing("north");
      setDoorInteracting(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
      setDoorOpen(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, DOOR_SWING_MS));
      setDoorInteracting(false);
      // The threshold and short exterior leg are reserved for the entrance animation.
      if (
        !(await movement.walk([
          [doorX, doorY, doorZ],
          [doorX, doorY, -roomDepth / 2 - 0.45],
        ]))
      )
        return;
      beginTransition("leaving", "Confirming your move", 3);
      await homePresence.mutateAsync("leave_player_home");
      completeTransitionStep("Loading the neighbourhood");
      await navigate({ to: "/neighborhood" });
    } catch {
      movement.place([doorX, doorY, doorZ]);
      endTransition();
    } finally {
      setDoorOpen(false);
      setDoorInteracting(false);
      setDoorSequence(false);
      doorSequenceLock.current = false;
    }
  };
  /** Arriving from the neighbourhood: the door opens and the character walks in. */
  useEffect(() => {
    if (outside.kind !== "entering" || !isInsideHome || !serverState?.house || enteringRan.current)
      return;
    enteringRan.current = true;
    doorSequenceLock.current = true;
    setDoorSequence(true);
    const [doorX, doorY, doorZ] = houseDoorThreshold(
      serverState.house.house_type_id,
      roomWidth,
      roomDepth,
    );
    const start: RoomPoint = [0, 0.06, roomDepth * 0.18];
    setActiveFloor(0);
    setPinnedRoom(null);
    setDoorFacing("south");
    setDoorInteracting(true);
    completeTransitionStep("Opening the door");
    const exterior: RoomPoint = [doorX, doorY, -roomDepth / 2 - 0.45];
    movement.place(exterior);
    setDoorOpen(true);
    void (async () => {
      try {
        await new Promise<void>((resolve) => window.setTimeout(resolve, DOOR_SWING_MS));
        setDoorInteracting(false);
        completeTransitionStep("Walking in");
        const path = findRoomPath(
          [doorX, doorY, doorZ],
          start,
          roomWidth,
          roomDepth,
          roomObstacles(
            serverState.house!.house_type_id,
            roomWidth,
            roomDepth,
            placements.filter((item) => (item.floor ?? 0) === 0),
            slots,
            0,
          ),
        );
        if (path) {
          const arrived = await movement.walk([exterior, [doorX, doorY, doorZ], ...path]);
          if (!arrived) movement.place([doorX, doorY, doorZ]);
        } else {
          movement.place([doorX, doorY, doorZ]);
          toast.error("The entrance is blocked. Rearrange your furniture to clear the way.");
        }
      } finally {
        setDoorOpen(false);
        setDoorInteracting(false);
        setDoorSequence(false);
        doorSequenceLock.current = false;
        endTransition();
        enteringRan.current = false;
      }
    })();
    // The room is ready once its house data is loaded; the sequence runs once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outside.kind, serverState?.house?.id, isInsideHome]);
  /** A trip started from inside: finish the walk and door sequence before requesting server travel. */
  const leaveForTrip = async (departure: HomeDeparture) => {
    if (
      editing ||
      taskBusy ||
      isOffline ||
      !serverState?.house ||
      !isInsideHome ||
      !gameTime.ready ||
      gameTime.busy ||
      doorSequenceLock.current
    )
      return;
    setActivityError("");
    if (activeFloor === 1 && !(await climbStairs())) return;
    doorSequenceLock.current = true;
    setDoorSequence(true);
    try {
      const [doorX, doorY, doorZ] = houseDoorThreshold(
        serverState.house.house_type_id,
        roomWidth,
        roomDepth,
      );
      let transitionStarted = false;
      try {
        const departed = await runHomeDepartureAfterWalk(
          () => walkTo([doorX, doorY, doorZ], false, 0),
          async () => {
            setDoorFacing("north");
            setDoorInteracting(true);
            await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
            setDoorOpen(true);
            await new Promise<void>((resolve) => window.setTimeout(resolve, DOOR_SWING_MS));
            setDoorInteracting(false);
            if (
              !(await movement.walk([
                [doorX, doorY, doorZ],
                [doorX, doorY, -roomDepth / 2 - 0.45],
              ]))
            )
              throw new Error("Departure was interrupted.");
            beginTransition("leaving", "Heading out for your trip", 3);
            transitionStarted = true;
            await rpc.travelToLocation(departure);
            queryClient.setQueryData(q.character().queryKey, (previous) =>
              previous
                ? {
                    ...previous,
                    current_location_id: departure.locationId,
                    inside_home_property_id: null,
                  }
                : previous,
            );
          },
        );
        if (!departed) return;
      } catch (error) {
        setDoorOpen(false);
        if (transitionStarted) endTransition();
        setActivityError(error instanceof Error ? error.message : "Travel could not be completed.");
        return;
      }
      try {
        completeTransitionStep("Travelling");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: q.character().queryKey }),
          queryClient.invalidateQueries({ queryKey: q.locations().queryKey }),
          queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        ]);
        completeTransitionStep("Loading your destination");
        const saved = await queryClient.fetchQuery(q.character());
        const locations = await queryClient.fetchQuery(q.locations());
        const destination = locations?.find((location) => location.id === departure.locationId);
        if (saved?.current_location_id !== departure.locationId || !destination?.slug)
          throw new Error("Destination is not ready.");
        await navigate({ to: "/location/$slug", params: { slug: destination.slug } });
        endTransition();
      } catch {
        endTransition();
        setActivityError(
          "Travel completed, but the destination could not be opened. Open the city map to continue; do not pay for the trip again.",
        );
      }
    } finally {
      setDoorOpen(false);
      setDoorInteracting(false);
      setDoorSequence(false);
      doorSequenceLock.current = false;
    }
  };
  const walkTo = (point: RoomPoint, interact = false, floor: 0 | 1 = activeFloor) => {
    const path = findRoomPath(
      movement.positionRef.current,
      point,
      roomWidth,
      roomDepth,
      floor === activeFloor
        ? obstacles
        : roomObstacles(
            houseTypeId ?? "shared-room",
            roomWidth,
            roomDepth,
            placements.filter((item) => (item.floor ?? 0) === floor),
            slots,
            floor,
          ),
      interact,
    );
    if (!path) {
      setActivityError("There is no clear path. Move furniture to leave a walkway.");
      return Promise.resolve(false);
    }
    return movement.walk(path);
  };
  useEffect(() => {
    const stop = () => {
      if (document.hidden || !navigator.onLine) {
        interactionVersion.current++;
        setWalkingTask(null);
      }
    };
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("offline", stop);
    return () => {
      // This ref is a cancellation generation, not a DOM ref to capture at setup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      interactionVersion.current++;
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("offline", stop);
    };
  }, []);
  const inventory = serverState?.inventory ?? [];
  const outfit = serverState?.outfit ?? EMPTY_OUTFIT;
  const appearance = (
    character?.appearance && typeof character.appearance === "object" ? character.appearance : {}
  ) as Appearance;
  const isOffline = !online;
  const drawerQuery = useQuery({
    queryKey: ["house-drawer", character?.id ?? "anonymous"],
    queryFn: fetchDrawerState,
    enabled: !!character?.id,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const drawerMutation = useMutation({
    mutationFn: ({
      action,
      body,
    }: {
      action: "store" | "retrieve" | "equip";
      body: Record<string, string>;
    }) => drawerAction(action, body),
    onSuccess: (result) => {
      setDrawerError(null);
      if (character?.id) {
        queryClient.setQueryData(["house-drawer", character.id], result.drawer);
        const nextState = normalizeHouseState(result.house);
        if (nextState) {
          updateHouseStateStore(queryClient, character.id, { state: nextState, source: "server" });
        }
      }
      void queryClient.invalidateQueries({ queryKey: q.equipment().queryKey });
    },
    onError: (error: Error) => setDrawerError(error.message),
  });
  const lightQuery = useQuery({
    queryKey: ["house-light", character?.id ?? "anonymous"],
    queryFn: fetchHouseLight,
    enabled: !!character?.id,
  });
  const lightOn = lightQuery.data ?? true;
  const wallsQuery = useQuery({
    queryKey: ["house-walls", character?.id ?? "anonymous"],
    queryFn: fetchHouseWalls,
    enabled: !!character?.id,
  });
  const wallsSetting = wallsQuery.data ?? null;
  const wallsMutation = useMutation({
    mutationFn: (closed: boolean) => setHouseWalls(closed),
    onMutate: async (closed: boolean) => {
      const key = ["house-walls", character?.id ?? "anonymous"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean | null>(key);
      queryClient.setQueryData(key, closed);
      return { previous };
    },
    onError: (error: Error, _closed, context) => {
      queryClient.setQueryData(["house-walls", character?.id ?? "anonymous"], context?.previous);
      toast.error(error.message);
    },
  });
  const rearrange = useMutation({
    mutationFn: async () => {
      const response = await authorizedFetch("/api/house/rearrange", { method: "POST" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result)) {
        const code = isRecord(result) && isRecord(result["error"]) ? result["error"]["code"] : null;
        throw new Error(
          code === "NO_CLEAR_LAYOUT"
            ? "There isn't enough room for every item. Store a few items, then rearrange again."
            : code === "LAYOUT_CHANGED"
              ? "Your layout changed in another window. Try again."
              : "Your room could not be rearranged. Try again.",
        );
      }
      const state = normalizeHouseState(result["state"]);
      if (!state) throw new Error("The server did not confirm the new layout.");
      return state;
    },
    onSuccess: (state) => {
      if (character?.id)
        updateHouseStateStore(queryClient, character.id, { state, source: "server" });
      if (state.house) {
        const entry =
          activeFloor === 1 && stairs
            ? ([stairs.top[0], 0.06, stairs.top[1]] as RoomPoint)
            : houseDoorThreshold(state.house.house_type_id, roomWidth, roomDepth);
        const nextObstacles = roomObstacles(
          state.house.house_type_id,
          roomWidth,
          roomDepth,
          state.placements.filter((p) => (p.floor ?? 0) === activeFloor),
          slots,
          activeFloor,
        );
        const clear = findRoomPath(
          entry,
          movement.positionRef.current,
          roomWidth,
          roomDepth,
          nextObstacles,
          true,
        );
        if (clear?.length) movement.place(clear[clear.length - 1]!);
      }
      setSelectedPlacement(null);
      setPinnedRoom(null);
      setActivityError("");
      toast.success("Furniture rearranged. Walking paths are clear.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const lightMutation = useMutation({
    mutationFn: (on: boolean) => setHouseLight(on),
    onMutate: async (on: boolean) => {
      const key = ["house-light", character?.id ?? "anonymous"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, on);
      return { previous };
    },
    onError: (error: Error, _on, context) => {
      queryClient.setQueryData(["house-light", character?.id ?? "anonymous"], context?.previous);
      toast.error(error.message);
    },
  });
  const wornItemIds = new Set(
    Object.values(outfit).filter((itemId): itemId is string => typeof itemId === "string"),
  );
  const departureRan = useRef(false);
  const deliveryQueryKey = [
    "homeFoodDeliveries",
    character?.id,
    canonicalHome?.playerPropertyId,
  ] as const;
  const deliveries = useQuery({
    queryKey: deliveryQueryKey,
    queryFn: foodDeliveryService.processAtHome,
    enabled: isInsideHome && !isOffline && !!character?.id,
    refetchInterval: isInsideHome && !isOffline ? 4_000 : false,
    refetchOnWindowFocus: true,
  });
  const deliveryResponse = useMutation({
    mutationFn: ({ orderId, choice }: { orderId: string; choice: "inside" | "outside" }) =>
      foodDeliveryService.respond(orderId, choice),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: deliveryQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["phoneService", "food_delivery_history"] }),
      ]);
      toast.success("The courier is handing over your order.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const packageCollection = useMutation({
    mutationFn: foodDeliveryService.collect,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: deliveryQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["phoneService", "food_delivery_history"] }),
      ]);
      toast.success("Food package collected.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
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
  const activeSleep =
    gameTime.simulation.currentAction?.actionId === "sleep"
      ? gameTime.simulation.currentAction
      : null;

  const wakeUp = async () => {
    if (!activeSleep || isOffline || !gameTime.ready || gameTime.busy) return;

    setActivityError("");
    const error = await gameTime.complete(activeSleep.requestId, "sleep");

    if (error) {
      setActivityError(error);
      toast.error(error);
      return;
    }

    toast.success("You woke up.");
  };

  const cancelSleep = async () => {
    if (!activeSleep || isOffline || !gameTime.ready || gameTime.busy) return;

    setActivityError("");
    const error = await gameTime.interrupt(activeSleep.requestId);

    if (error) {
      setActivityError(error);
      toast.error(error);
      return;
    }

    toast.success("Sleep cancelled.");
  };

  const requestAction = (args: Parameters<typeof actionMutation.mutate>[0]) => {
    if (isOffline || actionMutation.isPending) return;
    actionMutation.mutate(args);
  };
  const requestRotate = (placement: HousePlacement, rotation: number) => {
    if (isOffline || actionMutation.isPending || !editing || activeSleep) return;
    actionMutation.mutate({ action: "rotate", fromSlot: placement.slot, rotation });
  };
  const requestMoveToPosition = (placement: HousePlacement, x: number, y: number) => {
    if (isOffline || actionMutation.isPending || !editing || activeSleep) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setPreviewMove({ placementId: placement.id, x, y });
    actionMutation.mutate({
      action: "move",
      fromSlot: placement.slot,
      x,
      y,
    });
  };
  // Placement mode: pick up an item, move it on the grid, then Place or Cancel.
  const draftPlacement = draftMove
    ? (scenePlacements.find((item) => item.id === draftMove.placementId) ?? null)
    : null;
  const draftOccupied = draftMove
    ? isHouseGridCellOccupied(draftMove.x, draftMove.y, scenePlacements, draftMove.placementId)
    : false;
  const guide =
    draftPlacement && draftMove
      ? guideFor(
          draftPlacement.slot_type,
          draftPlacement.art_key,
          houseTypeId ?? undefined,
          activeFloor,
        )
      : null;
  const arrangementNotes =
    draftPlacement && draftMove
      ? arrangementWarnings(
          draftPlacement.slot_type,
          draftPlacement.art_key,
          draftMove.x,
          draftMove.y,
          houseDoorPercentX(houseTypeId ?? ""),
          houseTypeId ?? undefined,
          activeFloor,
        )
      : [];
  const startMove = (placement: HousePlacement) => {
    if (isOffline || actionMutation.isPending || !editing || activeSleep) return;
    const start = draftStartFor(placement, slots);
    if (!start) return;
    setDraftMove({ placementId: placement.id, ...start });
  };
  useEffect(() => {
    if (!pendingPlace) return;
    const placed = scenePlacements.find(
      (item) =>
        item.item_id === pendingPlace.itemId &&
        !pendingPlace.knownIds.includes(item.id) &&
        item.slot.startsWith("free:"),
    );
    if (!placed) return;
    setDraftMove({ placementId: placed.id, x: placed.x ?? 50, y: placed.y ?? 50 });
    setPendingPlace(null);
  }, [pendingPlace, scenePlacements]);
  const cancelMove = () => setDraftMove(null);
  const placeMove = () => {
    if (!draftMove || !draftPlacement || draftOccupied) return;
    requestMoveToPosition(draftPlacement, draftMove.x, draftMove.y);
    setDraftMove(null);
    setSelectedPlacement(null);
  };
  const turnDraft = () => {
    if (draftPlacement) {
      requestRotate(draftPlacement, ((draftPlacement.rotation_deg ?? 0) + 45) % 360);
    }
  };
  const nudgeDraft = (dx: number, dy: number) =>
    setDraftMove((current) => {
      if (!current) return current;
      // Wall art slides along the back wall only.
      if (isWallArtKind(draftPlacement?.art_key)) {
        const [wallX, wallY] = snapToBackWall(current.x + dx * HOUSE_GRID_STEP);
        return { ...current, x: wallX, y: wallY };
      }
      const [x, y] = snapToHouseGrid(
        current.x + dx * HOUSE_GRID_STEP,
        current.y + dy * HOUSE_GRID_STEP,
      );
      return { ...current, x, y };
    });
  useEffect(() => {
    if (!draftMove) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "ArrowLeft") nudgeDraft(-1, 0);
      else if (event.key === "ArrowRight") nudgeDraft(1, 0);
      else if (event.key === "ArrowUp") nudgeDraft(0, -1);
      else if (event.key === "ArrowDown") nudgeDraft(0, 1);
      else if (event.key === "r" || event.key === "R") turnDraft();
      else if (event.key === "Enter") placeMove();
      else if (event.key === "Escape") cancelMove();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The handlers read the current draft through these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMove, draftPlacement, draftOccupied]);

  const interactWithPlacement = async (placement: HousePlacement, choice?: LifeActionId) => {
    const action = choice ?? homeFurnitureAction(placement.item_id);
    if (
      !action ||
      !homeFurnitureActions(placement.item_id).includes(action) ||
      interactionLock.current ||
      isOffline ||
      !gameTime.ready ||
      gameTime.busy ||
      editing
    )
      return false;
    if (!isInsideHome) {
      setActivityError("Enter your home before using its accessories.");
      return false;
    }
    if (gameTime.simulation.currentAction) {
      setActivityError("Finish or cancel your current activity first.");
      return false;
    }
    if (gameTime.homeTaskTiming === null) {
      setActivityError("The home tasks database update is required before using accessories.");
      return false;
    }
    interactionLock.current = true;
    const version = ++interactionVersion.current;
    setUsingPlacementId(placement.id);
    setActivityError("");
    setSelectedPlacement(null);
    setWalkingTask(ACTION_CATALOG[action].name);
    try {
      const arrived = await walkTo(placementPoint(placement, slots, roomWidth, roomDepth), true);
      if (!arrived || version !== interactionVersion.current) return false;
      setStartingTask(true);
      setWalkingTask(null);
      const error = await gameTime.start(action, crypto.randomUUID());
      if (error) throw new Error(error);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "That activity could not be started.";
      setActivityError(message);
      toast.error(message);
      return false;
    } finally {
      interactionLock.current = false;
      setStartingTask(false);
      setWalkingTask(null);
      setUsingPlacementId(null);
    }
  };
  const collectPackage = async (orderId: string) => {
    if (activeFloor !== 0) {
      setActivityError("Go downstairs to collect your delivery.");
      return;
    }
    if (
      interactionLock.current ||
      gameTime.simulation.currentAction ||
      packageCollection.isPending ||
      isOffline ||
      !isInsideHome ||
      editing
    )
      return;
    const waiting = (deliveries.data ?? [])
      .filter((d) => d.deliveryState === "package_waiting")
      .slice(0, 4);
    const index = waiting.findIndex((d) => d.id === orderId);
    if (index < 0) return;
    interactionLock.current = true;
    const version = ++interactionVersion.current;
    setWalkingTask("Collect food package");
    setSelectedPlacement(null);
    setActivityError("");
    try {
      if (
        (await walkTo(
          packagePoint(
            index,
            roomWidth,
            roomDepth,
            houseTypeId ?? "shared-room",
            waiting[index]?.deliveryChoice === "inside",
          ),
          true,
        )) &&
        version === interactionVersion.current
      ) {
        setCollectingPackage(true);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
        if (version !== interactionVersion.current) return;
        setCollectingPackage(false);
        setStartingTask(true);
        await packageCollection.mutateAsync(orderId);
      }
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Collection failed.");
    } finally {
      interactionLock.current = false;
      setWalkingTask(null);
      setStartingTask(false);
      setCollectingPackage(false);
    }
  };
  const timedActivity = gameTime.simulation.currentAction;
  const timedActionId = timedActivity?.actionId;
  const timedRequestId = timedActivity?.requestId;
  const taskTiming = gameTime.homeTaskTiming;
  const taskBusy =
    doorSequence ||
    climbingStairs ||
    !!timedActivity ||
    !!walkingTask ||
    startingTask ||
    cancellingTask;
  /** A map trip started from inside the house runs here, once, when the house is ready. */
  useEffect(() => {
    if (departureRan.current) return;
    const departure = takeDepartureFromHomeWhenReady({
      houseAvailable: !!serverState?.house,
      isInsideHome,
      editing,
      busy: taskBusy || !gameTime.ready || gameTime.busy,
      offline: isOffline,
    });
    if (!departure) return;
    departureRan.current = true;
    void leaveForTrip(departure);
    // The trip runs once per arrival in the house; the handler reads current room state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverState?.house?.id,
    isInsideHome,
    editing,
    taskBusy,
    gameTime.ready,
    gameTime.busy,
    isOffline,
  ]);
  useEffect(() => {
    if (!timedActionId) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [timedRequestId, timedActionId]);
  useEffect(() => {
    if (
      !timedActivity ||
      timedActivity.actionId === "sleep" ||
      !taskTiming ||
      taskTiming.duration <= 0 ||
      taskTiming.elapsed < taskTiming.duration ||
      isOffline ||
      !gameTime.ready ||
      gameTime.busy ||
      gameTime.simulation.paused ||
      cancellingTask ||
      document.hidden ||
      autoCompleting.current === timedActivity.requestId
    )
      return;
    autoCompleting.current = timedActivity.requestId;
    void gameTime.complete(timedActivity.requestId, timedActivity.actionId).then((error) => {
      if (error) {
        setActivityError(error);
        autoCompleting.current = null;
      } else toast.success(ACTION_CATALOG[timedActivity.actionId].outcome);
    });
  }, [timedActivity, taskTiming, isOffline, gameTime, cancellingTask]);
  const cancelTask = async () => {
    if (startingTask || gameTime.busy || cancellingTask) return;
    interactionVersion.current++;
    movement.cancel();
    setWalkingTask(null);
    setCollectingPackage(false);
    if (!timedActivity) return;
    setCancellingTask(true);
    try {
      const error = await gameTime.interrupt(timedActivity.requestId);
      if (error) setActivityError(error);
    } finally {
      setCancellingTask(false);
    }
  };
  const liveSleepElapsed = (() => {
    const base = gameTime.sleepElapsedSeconds ?? 0;
    const running = !isOffline && gameTime.ready && !gameTime.simulation.paused && !document.hidden;
    return Math.min(
      SLEEP_FULL_REST_SECONDS,
      base + (running ? Math.max(0, clockNow - gameTime.simulation.lastUpdatedAt) / 1000 : 0),
    );
  })();
  const sleepProgress = Math.min(
    100,
    Math.round((liveSleepElapsed / SLEEP_FULL_REST_SECONDS) * 100),
  );
  const sleepRemaining = Math.max(0, Math.ceil(SLEEP_FULL_REST_SECONDS - liveSleepElapsed));
  const displayedElapsed = taskTiming
    ? Math.min(
        taskTiming.duration,
        taskTiming.elapsed +
          (!isOffline && gameTime.ready && !gameTime.simulation.paused && !document.hidden
            ? Math.max(0, clockNow - gameTime.simulation.lastUpdatedAt) / 1000
            : 0),
      )
    : 0;
  /** A timed task with a time left shows its pill, which also cancels it on tap. */
  const timedPillShown = !activeSleep && !!timedActivity && !!taskTiming;
  const timedRemaining = taskTiming
    ? Math.max(0, Math.ceil(taskTiming.duration - displayedElapsed))
    : 0;
  const timedPercent = taskTiming
    ? Math.min(100, Math.round((displayedElapsed / Math.max(1, taskTiming.duration)) * 100))
    : 0;

  const selectedAction = selectedPlacement ? homeFurnitureAction(selectedPlacement.item_id) : null;
  const avatarEquipment = (["head", "top", "bottom", "shoes", "accessory"] as const).flatMap(
    (slot) => (outfit[slot] ? [{ slot }] : []),
  );
  const currentActivity = gameTime.simulation.currentAction;
  const activityFurniture = currentActivity
    ? ACTION_CATALOG[currentActivity.actionId].requiredFurniture
    : undefined;
  const activePlacement = floorPlacements.find((p) => p.art_key === activityFurniture);
  const furnitureAngle = ((activePlacement?.rotation_deg ?? 0) * Math.PI) / 180;
  const furnitureFacing = (["south", "west", "north", "east"] as const)[
    Math.round((activePlacement?.rotation_deg ?? 0) / 90) % 4
  ]!;
  const taskPoint = activePlacement
    ? placementPoint(activePlacement, slots, roomWidth, roomDepth)
    : null;
  const seated =
    !!currentActivity &&
    ["toilet", "relax_sofa", "study_computer", "browse_computer"].includes(
      currentActivity.actionId,
    );
  const performingPosition: RoomPoint =
    taskPoint && currentActivity?.animation === "sleeping"
      ? [taskPoint[0], 0.45, taskPoint[2]]
      : taskPoint && seated
        ? [
            taskPoint[0] - Math.sin(furnitureAngle) * 0.25,
            0.28,
            taskPoint[2] + Math.cos(furnitureAngle) * 0.25,
          ]
        : movement.position;
  const taskFacing =
    taskPoint && currentActivity?.animation === "sleeping"
      ? furnitureFacing
      : taskPoint && !seated
        ? Math.abs(taskPoint[0] - movement.position[0]) >
          Math.abs(taskPoint[2] - movement.position[2])
          ? taskPoint[0] > movement.position[0]
            ? "east"
            : "west"
          : taskPoint[2] > movement.position[2]
            ? "south"
            : "north"
        : furnitureFacing;
  const taskPose = collectingPackage
    ? ("collect" as const)
    : currentActivity
      ? seated
        ? ("sit" as const)
        : currentActivity.animation === "showering"
          ? ("wash" as const)
          : currentActivity.animation === "cooking"
            ? ("cook" as const)
            : undefined
      : undefined;
  if (characterLoading || (stateQuery.isLoading && !snapshot))
    return (
      <div className="house-page">
        <HouseSceneSkeleton />
      </div>
    );

  if (stateQuery.isError && !snapshot)
    return (
      <div className="house-page house-page-error">
        <section className="house-error-card" role="alert">
          <p>{houseLoadMessage(stateQuery.error)}</p>
          <button type="button" onClick={() => void stateQuery.refetch()}>
            Try again
          </button>
        </section>
      </div>
    );

  if (!serverState?.house && canonicalHomeQuery.isLoading)
    return (
      <div className="house-page">
        <HouseSceneSkeleton />
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
  const layoutConflicts =
    house.house_type_id === "bungalow" || house.house_type_id === "duplex"
      ? placementsOverlappingWalls(
          house.house_type_id,
          roomWidth,
          roomDepth,
          placements.filter((item) => (item.floor ?? 0) === activeFloor),
          slots,
          activeFloor,
        )
      : [];
  return (
    <div className={`house-page house-page-fill${editing ? " is-editing" : ""}`}>
      <div className="house-toolbar">
        <div className="house-scene-controls" role="group" aria-label="Home controls">
          {!editing && canonicalHome && (
            <button
              type="button"
              className="house-scene-exit"
              disabled={isOffline || homePresence.isPending || taskBusy}
              aria-busy={homePresence.isPending}
              onClick={() =>
                isInsideHome ? void goOutside() : homePresence.mutate("enter_player_home")
              }
            >
              {homePresence.isPending ? (
                <LoaderCircle
                  size={16}
                  className="house-scene-control-spinner"
                  aria-hidden="true"
                />
              ) : (
                <DoorOpen size={16} aria-hidden="true" />
              )}
              <span>
                {homePresence.isPending
                  ? "Updating location..."
                  : isInsideHome
                    ? activeSleep
                      ? "Wake up first"
                      : "Go outside"
                    : "Travel home"}
              </span>
            </button>
          )}
          <button
            className="house-edit-button house-edit-toggle"
            type="button"
            aria-label={editing ? "Close shop" : "Shop"}
            aria-pressed={editing}
            disabled={taskBusy}
            onClick={() => {
              movement.cancel();
              setPinnedRoom(null);
              setEditing((value) => !value);
              setSelectedPlacement(null);
            }}
          >
            {editing ? "Done" : "Shop"}
          </button>
        </div>
        {!editing && (
          <button
            type="button"
            className="house-icon-button house-light-switch"
            aria-pressed={lightOn}
            aria-label={lightOn ? "Turn the room light off" : "Turn the room light on"}
            title={lightOn ? "Light on" : "Light off"}
            disabled={isOffline || !character?.id || lightMutation.isPending}
            onClick={() => lightMutation.mutate(!lightOn)}
          >
            {lightOn ? (
              <Lightbulb size={20} aria-hidden="true" />
            ) : (
              <LightbulbOff size={20} aria-hidden="true" />
            )}
          </button>
        )}
        {!editing && (
          <button
            type="button"
            className="house-icon-button house-walls-switch"
            aria-label="Rearrange home"
            title="Rearrange furniture and clear walking paths"
            disabled={
              isOffline ||
              taskBusy ||
              movement.walking ||
              homePresence.isPending ||
              outside.kind !== null ||
              rearrange.isPending
            }
            aria-busy={rearrange.isPending}
            onClick={() => rearrange.mutate()}
          >
            <RefreshCcwDot
              size={20}
              aria-hidden="true"
              className={rearrange.isPending ? "animate-spin" : undefined}
            />
          </button>
        )}
        {editing && (
          <label className="house-walls-option">
            <input
              type="checkbox"
              checked={wallsSetting ?? houseWallsDefaultClosed(house.house_type_id)}
              disabled={isOffline || wallsMutation.isPending}
              onChange={(event) => wallsMutation.mutate(event.target.checked)}
            />
            Full walls
          </label>
        )}
        {!editing && roomViews.length > 0 && (
          <div className="house-room-views" role="group" aria-label="Room view">
            {roomViews.length > 4 ? (
              <select
                aria-label="View room"
                value={roomView ?? "whole"}
                onChange={(event) =>
                  setPinnedRoom(event.target.value === "whole" ? null : event.target.value)
                }
              >
                <option value="whole">{WHOLE_HOME_LABEL}</option>
                {roomViews.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                {roomViews.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    aria-pressed={roomView === room.id}
                    className={roomView === room.id ? "is-active" : undefined}
                    onClick={() => setPinnedRoom(room.id)}
                  >
                    {room.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={roomView === null}
                  className={roomView === null ? "is-active" : undefined}
                  onClick={() => setPinnedRoom(null)}
                >
                  {WHOLE_HOME_LABEL}
                </button>
              </>
            )}
            {layoutConflicts.length > 0 && (
              <button
                type="button"
                disabled={taskBusy || isOffline}
                title="Some saved furniture overlaps the new walls. Reposition these items in Arrange."
                aria-label={`Reposition ${layoutConflicts.length} items overlapping walls`}
                onClick={() => {
                  movement.cancel();
                  setPinnedRoom(null);
                  setEditing(true);
                  setSelectedPlacement(layoutConflicts[0] ?? null);
                }}
              >
                Arrange ({layoutConflicts.length})
              </button>
            )}
          </div>
        )}
        {!editing && stairs && (
          <button
            type="button"
            className="house-floor-label"
            disabled={taskBusy || isOffline}
            onClick={() => void climbStairs()}
          >
            {activeFloor === 0 ? "Go upstairs ↑" : "Go downstairs ↓"}
          </button>
        )}
      </div>
      <section
        className={`house-room-card${house.status === "overdue" ? " room-overdue" : ""}${activeSleep ? " is-sleeping" : ""}`}
        aria-label={`${house.house_type.label} room`}
      >
        <HouseRoomRenderer
          roomView={roomView}
          guideZone={guide?.zoneBounds ?? null}
          inputBlocked={
            taskBusy ||
            rearrange.isPending ||
            outside.kind !== null ||
            (!editing && (!isInsideHome || (!!selectedPlacement && !!selectedAction)))
          }
          houseTypeId={house.house_type_id}
          lightOn={lightOn}
          wallsClosed={editing ? wallsSetting : false}
          accessoryBand={canonicalHome?.accessoryBand ?? "basic"}
          showCharacter={isInsideHome}
          characterName={character?.name ?? "Your character"}
          appearance={appearance}
          gender={character?.gender ?? "nonbinary"}
          equipment={avatarEquipment}
          actorSpawnKey={outside.kind === "entering" && doorOpen ? "arrival" : "resident"}
          actorPosition={performingPosition}
          actorFacing={
            doorInteracting ? doorFacing : currentActivity ? taskFacing : movement.facing
          }
          {...(taskPose ? { taskPose } : {})}
          doorOpen={doorOpen}
          onWalk={(point) => {
            if (!editing && !taskBusy && isInsideHome && !isOffline) {
              setActivityError("");
              void walkTo(point);
            }
          }}
          onCollectPackage={(id) => void collectPackage(id)}
          animationState={
            doorInteracting
              ? "interact"
              : movement.walking
                ? "walk"
                : currentActivity
                  ? avatarAnimationForActivity(currentActivity.animation)
                  : "idle"
          }
          activityRequestId={currentActivity?.requestId ?? null}
          activityLabel={currentActivity ? ACTION_CATALOG[currentActivity.actionId].name : null}
          slots={slots}
          placements={floorPlacements}
          activeFloor={activeFloor}
          {...(stairs ? { onUseStairs: () => void climbStairs() } : {})}
          foodDeliveries={activeFloor === 0 ? (deliveries.data ?? []) : []}
          movingPlacement={null}
          draftMove={draftMove}
          onDraftMove={(x, y) =>
            setDraftMove((current) => (current ? { ...current, x, y } : current))
          }
          editMode={editing}
          moveEnabled={editing && !isOffline && !actionMutation.isPending && !taskBusy}
          onMove={() => {}}
          onMovePosition={requestMoveToPosition}
          onSelectPlacement={(placement) => {
            if (taskBusy) return;
            if (!editing && placement.art_key === DRAWER_ART_KEY) {
              setSelectedPlacement(null);
              setDrawerError(null);
              setDrawerOpen(true);
              return;
            }
            if (!editing) {
              setSelectedPlacement((current) => (current?.id === placement.id ? null : placement));
              return;
            }
            setSelectedPlacement(placement);
          }}
          onSelectSlot={() => undefined}
        />

        {!editing &&
          (isOffline ||
            !gameTime.ready ||
            activityError ||
            (gameTime.sleepElapsedSeconds === null &&
              !activeSleep &&
              placements.some(
                (placement) => homeFurnitureAction(placement.item_id) === "sleep",
              ))) && (
            <div className="house-scene-notices">
              {activityError && <p role="alert">{activityError}</p>}
              {isOffline ? (
                <p role="status">Reconnect to use your accessories.</p>
              ) : !gameTime.ready ? (
                <p role="status">Connecting character needs...</p>
              ) : gameTime.sleepElapsedSeconds === null &&
                !activeSleep &&
                placements.some(
                  (placement) => homeFurnitureAction(placement.item_id) === "sleep",
                ) ? (
                <p role="status">The home sleep update is needed before the bed can be used.</p>
              ) : null}
            </div>
          )}
        {isInsideHome && (
          <HomeFoodDeliveryPanel
            deliveries={deliveries.data ?? []}
            error={deliveries.isError}
            responsePending={deliveryResponse.isPending}
            collectionPending={packageCollection.isPending}
            onRetry={() => void deliveries.refetch()}
            onRespond={(orderId, choice) => deliveryResponse.mutate({ orderId, choice })}
            onCollect={(orderId) => void collectPackage(orderId)}
          />
        )}
        {activeSleep && (
          <button
            type="button"
            className="house-task-status house-task-status-action"
            aria-label={`Asleep, ${sleepRemaining} seconds left. Tap to cancel sleep.`}
            disabled={isOffline || !gameTime.ready || gameTime.busy}
            onClick={() => void cancelSleep()}
          >
            <ProgressRing percent={sleepProgress} label={`${sleepRemaining}s`} />
            <div className="house-task-status-copy">
              <strong>Asleep</strong>
              <span>{sleepRemaining}s left · tap to cancel</span>
            </div>
          </button>
        )}
        {timedPillShown && (
          <button
            type="button"
            className="house-task-status house-task-status-action"
            aria-label={`${ACTION_CATALOG[timedActivity.actionId].name}, ${timedRemaining} seconds left. Tap to cancel.`}
            disabled={startingTask || gameTime.busy || cancellingTask}
            onClick={() => void cancelTask()}
          >
            <ProgressRing percent={timedPercent} label={`${timedRemaining}s`} />
            <div className="house-task-status-copy">
              <strong>{ACTION_CATALOG[timedActivity.actionId].name}</strong>
              <span>{timedRemaining}s left · tap to cancel</span>
            </div>
          </button>
        )}
        {(activeSleep ||
          (!timedPillShown &&
            (movement.walking || walkingTask || startingTask || timedActivity))) && (
          <div className="house-task-actions" role="group" aria-label="Task controls">
            {activeSleep ? (
              <>
                <button
                  type="button"
                  className="house-task-wake"
                  disabled={isOffline || !gameTime.ready || gameTime.busy}
                  onClick={() => void wakeUp()}
                >
                  <Sunrise size={16} aria-hidden="true" />
                  Wake up
                </button>
              </>
            ) : (
              // Walking or a task without a pill: the Cancel button is the only way to stop it.
              <button
                type="button"
                className="house-task-cancel"
                disabled={startingTask || gameTime.busy || cancellingTask}
                onClick={() => void cancelTask()}
              >
                {cancellingTask ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
        )}
      </section>
      {!editing && drawerOpen && (
        <DrawerSheet
          drawer={drawerQuery.data ?? null}
          storable={storableRows(inventory, wornItemIds)}
          offline={isOffline}
          pending={drawerMutation.isPending}
          error={drawerError}
          onStore={(inventoryId) =>
            drawerMutation.mutate({ action: "store", body: { inventoryId } })
          }
          onRetrieve={(drawerId) =>
            drawerMutation.mutate({ action: "retrieve", body: { drawerId } })
          }
          onEquip={(drawerId) => drawerMutation.mutate({ action: "equip", body: { drawerId } })}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      {!editing && !taskBusy && selectedPlacement && selectedAction && (
        <HomeAccessoryPanel
          key={selectedPlacement.id}
          placement={selectedPlacement}
          disabledReason={
            isOffline
              ? "Reconnect to use this accessory."
              : !isInsideHome
                ? "Enter your home to use this accessory."
                : !gameTime.ready
                  ? "Connecting your character?"
                  : gameTime.busy
                    ? "Finish your current activity first."
                    : null
          }
          pending={!!usingPlacementId}
          error={activityError}
          onClose={() => setSelectedPlacement(null)}
          onUse={(action) => interactWithPlacement(selectedPlacement, action)}
        />
      )}

      {editing && (
        <HouseCatalogue
          open={catalogueOpen}
          offline={isOffline}
          pending={actionMutation.isPending}
          cash={wallet?.balance ?? null}
          inventory={inventory}
          catalog={catalogQuery.data ?? []}
          placements={scenePlacements}
          onOpen={() => setCatalogueOpen(true)}
          onClose={() => setCatalogueOpen(false)}
          onBuy={(itemId) => requestAction({ action: "buy", itemId })}
          onPlaceOwned={(itemId) => {
            const artKey = inventory.find((entry) => entry.item_id === itemId)?.art_key;
            const cell = isWallArtKind(artKey)
              ? firstFreeBackWallCell(floorPlacements)
              : firstFreeHouseGridCell(floorPlacements);
            if (!cell) {
              toast.error("There is no free spot in your home.");
              return;
            }
            setPendingPlace({ itemId, knownIds: scenePlacements.map((item) => item.id) });
            requestAction({ action: "place", itemId, x: cell.x, y: cell.y, floor: activeFloor });
          }}
        />
      )}
      {editing && selectedPlacement && !draftMove && (
        <HouseEditSheets
          offline={isOffline}
          pending={actionMutation.isPending}
          selectedPlacement={selectedPlacement}
          singleRoom={singleRoom}
          onDeselect={() => setSelectedPlacement(null)}
          onRotate={requestRotate}
          onRemove={(placement) => requestAction({ action: "remove", slot: placement.slot })}
          onStartMove={startMove}
        />
      )}
      {editing && draftPlacement && (
        <HousePlacementBar
          itemName={draftPlacement.item_id.replaceAll("-", " ")}
          occupied={draftOccupied}
          disabled={isOffline || actionMutation.isPending}
          onRotate={turnDraft}
          onCancel={cancelMove}
          onPlace={placeMove}
          guideHint={guide?.hint}
          warnings={arrangementNotes}
        />
      )}
    </div>
  );
}

/** Circular progress with the seconds left shown in the middle. */
function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <span
      className="house-ring"
      role="img"
      aria-label={`${Math.round(value)}% done, ${label} left`}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle className="house-ring-track" cx="16" cy="16" r={radius} />
        <circle
          className="house-ring-value"
          cx="16"
          cy="16"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="house-ring-label">{label}</span>
    </span>
  );
}
