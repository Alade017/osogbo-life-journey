import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { House, Pencil, WifiOff } from "lucide-react";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";
import {
  HouseScene as HouseRoomScene,
  type HouseInventoryItem,
  type HouseOutfit,
  type HousePlacement,
  type HouseSlot,
} from "@/components/game/housing/HouseRoomScene";
import { EmptyState, LoadingState } from "@/components/game/ui";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import housingData from "@/data/housing.json";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
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

function HousePage() {
  const queryClient = useQueryClient();
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [editing, setEditing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<HouseSlot | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<HousePlacement | null>(null);
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
      setSelectedSlot(null);
      setSelectedPlacement(null);
    },
    onError: (error: Error) => {
      const message = `Your change wasn’t saved. ${error.message.replaceAll("_", " ").toLowerCase()}.`;
      setApiError(message);
      toast.error(message);
    },
  });
  const cancelTenancy = useMutation({
    mutationFn: async () => {
      if (!playerId) throw new Error("Sign in again to manage your tenancy.");
      const { data, error } = await supabase.rpc("cancel_player_house", { p_user_id: playerId });
      if (error) throw new Error(error.message);
      if (!data || typeof data !== "object" || Array.isArray(data) || data["ok"] !== true)
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
      ]);
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
  const { data: listingsData } = useQuery(q.propertyListings());
  const { data: wallet } = useQuery(q.wallet());
  const acquire = useGameAction(rpc.acquireProperty, {
    onSuccess: () => {
      toast.success("Property secured. Your wallet and housing record are updated.");
      refreshHouseState();
    },
  });
  const listings = (Array.isArray(listingsData) ? listingsData : []) as PropertyListing[];

  const requestAction = (args: Parameters<typeof actionMutation.mutate>[0]) => {
    if (isOffline || actionMutation.isPending) return;
    actionMutation.mutate(args);
  };
  const openHousingFlow = () =>
    window.dispatchEvent(new CustomEvent("osogbo-open-housing", { detail: { source: "profile" } }));

  if (characterLoading || (stateQuery.isLoading && !snapshot))
    return (
      <div className="house-page">
        <div className="house-skeleton" aria-label="Loading your room">
          <div />
          <div />
          <div />
        </div>
        <LoadingState />
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
          <Link to="/home" search={{ visit: undefined }} className="house-header-link">
            Back to home
          </Link>
        </header>
        <section className="house-empty-card">
          <div className="house-empty-art">
            <House size={44} strokeWidth={1.5} />
          </div>
          <div>
            <h2>You don’t have a place yet</h2>
            <p>Choose a home to get your own room and space for furniture.</p>
            <button className="house-primary-button" type="button" onClick={openHousingFlow}>
              Find a place
            </button>
          </div>
        </section>
        <PropertyListings
          listings={listings}
          walletBalance={wallet?.balance ?? 0}
          playerLevel={character?.level ?? 1}
          acquire={acquire}
        />
      </div>
    );

  const house = serverState.house;
  return (
    <div className="house-page">
      <header className="house-page-header">
        <div>
          <p className="house-eyebrow">Your home</p>
          <h1>{house.house_type.label}</h1>
          <p className="house-subtitle">
            {house.house_type.bedrooms} bedroom{house.house_type.bedrooms === 1 ? "" : "s"} · Rent{" "}
            {formatNaira(house.house_type.weekly_rent_minor)} a week
          </p>
        </div>
        <div className="house-header-actions">
          <Link to="/home" search={{ visit: undefined }} className="house-header-link">
            Home
          </Link>
          <button
            className="house-edit-button"
            type="button"
            aria-pressed={editing}
            onClick={() => {
              setEditing((value) => !value);
              setSelectedPlacement(null);
              setSelectedSlot(null);
            }}
          >
            <Pencil size={16} /> {editing ? "Done" : "Edit room"}
          </button>
        </div>
      </header>
      {isOffline && (
        <div className="house-status-banner" role="status">
          <WifiOff size={17} /> Offline. Showing your last saved home.
        </div>
      )}
      {apiError && (
        <div className="house-error-banner" role="alert">
          {apiError}
        </div>
      )}
      {house.status === "overdue" && (
        <div className="house-rent-banner">
          <span>
            <strong>Rent is overdue.</strong> Pay by Sunday to keep your home
          </span>
          <Link to="/wallet" className="house-pay-button">
            Pay
          </Link>
        </div>
      )}
      <section
        className={`house-room-card${house.status === "overdue" ? " room-overdue" : ""}`}
        aria-label={`${house.house_type.label} room`}
      >
        <HouseRoomScene
          house={{
            house_type_id: house.house_type_id,
            label: house.house_type.label,
            asset_key: house.house_type.asset_key,
            status: house.status,
          }}
          slots={slots}
          placements={placements}
          outfit={outfit}
          inventory={inventory}
          appearance={appearance}
          gender={character?.gender ?? "nonbinary"}
          editMode={editing}
          walkableArea={
            roomLayout?.walkable_area ?? { x: 52, y: 78, min_x: 8, max_x: 92, min_y: 30, max_y: 86 }
          }
          onSelectPlacement={setSelectedPlacement}
          onSelectSlot={setSelectedSlot}
        />
        <div className="house-room-caption">
          <span>
            {editing
              ? "Choose an item or an open slot to edit your room."
              : "Tap the room to walk around."}
          </span>
          <span>
            {placements.length} placed item{placements.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>
      {editing && (
        <HouseEditSheets
          open
          offline={isOffline}
          pending={actionMutation.isPending}
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
      <section className="house-inventory-summary">
        <div className="house-summary-heading">
          <h2>Your things</h2>
          <button type="button" className="house-text-button" onClick={() => setEditing(true)}>
            Edit room and outfit
          </button>
        </div>
        <div className="house-summary-grid">
          <div>
            <strong>{inventory.filter((item) => item.category === "furniture").length}</strong>
            <span>Furniture owned</span>
          </div>
          <div>
            <Avatar
              appearance={appearance}
              gender={character?.gender ?? "nonbinary"}
              size={42}
              equipment={Object.entries(outfit)
                .filter(([, item]) => !!item)
                .map(([slot]) => ({ slot }))}
            />
            <span>Current outfit</span>
          </div>
        </div>
        {inventory.length === 0 && (
          <p className="house-empty-copy">Your home is empty. Visit the shop to get furniture.</p>
        )}
        {(house.status === "active" || house.status === "overdue") && (
          <div className="house-tenancy-actions">
            <p>
              Ending your tenancy gives no rent or deposit refund. Your furniture stays owned and
              returns to your inventory.
            </p>
            <button
              type="button"
              className="house-secondary-button"
              disabled={cancelTenancy.isPending || isOffline}
              onClick={() => {
                if (window.confirm("End this tenancy now? Rent and deposit are not refunded."))
                  cancelTenancy.mutate();
              }}
            >
              {cancelTenancy.isPending ? "Ending tenancy…" : "Cancel rent"}
            </button>
          </div>
        )}
      </section>
      <PropertyListings
        listings={listings}
        walletBalance={wallet?.balance ?? 0}
        playerLevel={character?.level ?? 1}
        acquire={acquire}
      />
    </div>
  );
}

type PropertyAcquire = {
  isPending: boolean;
  mutate: (args: { propertyId: string; tenure: "owned" | "rented" }) => void;
};
function PropertyListings({
  listings,
  walletBalance,
  playerLevel,
  acquire,
}: {
  listings: PropertyListing[];
  walletBalance: number;
  playerLevel: number;
  acquire: PropertyAcquire;
}) {
  return (
    <details className="house-property-listings">
      <summary>Browse property listings</summary>
      {listings.length ? (
        <div className="house-property-grid">
          {listings.map((property) => (
            <article key={property.id} className="house-property-card">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {property.property_type.replaceAll("_", " ")}
                </p>
                <h3>{property.name}</h3>
                <p>{property.description}</p>
              </div>
              {property.rent_price !== null && (
                <p>
                  Rent {formatNaira(property.rent_price)} every {property.rent_period_days} days
                </p>
              )}
              {property.purchase_price !== null && (
                <p>Purchase {formatNaira(property.purchase_price)}</p>
              )}
              {property.is_current ? (
                <span>Current property</span>
              ) : (
                <div className="flex gap-2">
                  {property.rent_price !== null && (
                    <button
                      disabled={
                        acquire.isPending ||
                        walletBalance < property.rent_price ||
                        playerLevel < property.level_required
                      }
                      onClick={() => acquire.mutate({ propertyId: property.id, tenure: "rented" })}
                    >
                      Rent
                    </button>
                  )}
                  {property.purchase_price !== null && (
                    <button
                      disabled={
                        acquire.isPending ||
                        walletBalance < property.purchase_price ||
                        playerLevel < property.level_required
                      }
                      onClick={() => acquire.mutate({ propertyId: property.id, tenure: "owned" })}
                    >
                      Buy
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No listings available" body="Check back later for homes in the city." />
      )}
    </details>
  );
}

type PropertyListing = {
  id: string;
  name: string;
  description: string;
  property_type: string;
  purchase_price: number | null;
  rent_price: number | null;
  rent_period_days: number;
  level_required: number;
  active_tenure: string | null;
  is_current: boolean;
};
