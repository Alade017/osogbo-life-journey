import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeInterior } from "@/components/game/HomeInterior";
import { LayeredHomeScene } from "@/components/game/housing/LayeredHomeScene";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { q, rpc } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { type HousingSave } from "@/lib/housing-service";
import type { Json } from "@/integrations/supabase/types";
import {
  housingSaveFromCloud,
  readLocalHousingSave,
  writeLocalHousingSave,
} from "@/lib/save-storage";
import { LoadingState } from "@/components/game/ui";
import { HomeSceneSkeleton } from "@/components/game/loading-skeletons";
import { pageMeta } from "@/lib/seo";
import { useLiveClock } from "@/hooks/use-live-clock";
import { useWorldClock } from "@/hooks/use-world-clock";
import { osogboHour } from "@/lib/osogbo-weather";
import { isPowerOutageAt } from "@/lib/world-simulation";
import { toast } from "sonner";
import { parseHousingSave } from "@/lib/housing-service";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useGameTime } from "@/components/game/GameTimeProvider";
import type { LifeActionId } from "@/lib/life-simulation";
import { homeSceneFromAuthoritativeState, type HomeScenePayload } from "@/lib/home-scene-state";
import { DashboardFeatureStrip } from "@/components/game/DashboardFeatureStrip";

export const Route = createFileRoute("/_authenticated/_game/home")({
  validateSearch: (search: Record<string, unknown>) => ({
    visit: typeof search["visit"] === "string" ? search["visit"] : undefined,
  }),
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function authorizedHomeFetch(path: string) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(path, {
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
  return { response, body: await response.json().catch(() => null) };
}
async function loadHomeScene(): Promise<HomeScenePayload> {
  let primaryCode = "HOUSE_SERVICE_UNAVAILABLE";
  try {
    const { response, body } = await authorizedHomeFetch("/api/house/state");
    const state = homeSceneFromAuthoritativeState(body);
    if (response.ok && state) return state;
    if (isRecord(body) && isRecord(body["error"]) && typeof body["error"]["code"] === "string")
      primaryCode = body["error"]["code"];
  } catch {
    // Older deployments can still provide the compatible housing endpoint below.
  }
  try {
    const { response, body } = await authorizedHomeFetch("/api/housing/home");
    if (
      response.ok &&
      isRecord(body) &&
      Array.isArray(body["home_items"]) &&
      (body["home"] === null || isRecord(body["home"]))
    )
      return body as HomeScenePayload;
  } catch {
    // The player-facing error below includes the actionable setup case.
  }
  if (primaryCode === "HOUSE_SETUP_REQUIRED")
    throw new Error("Your home needs the latest database update before it can load.");
  throw new Error("Home could not be loaded. Check your connection and try again.");
}

function CityHome() {
  const { visit } = Route.useSearch();
  if (visit) return <FriendHomeVisit characterId={visit} />;
  return <MyCityHome />;
}

function FriendHomeVisit({ characterId }: { characterId: string }) {
  const navigate = useNavigate();
  const visitQuery = useQuery(q.friendHomeVisit(characterId));
  const data =
    visitQuery.data && typeof visitQuery.data === "object" && !Array.isArray(visitQuery.data)
      ? (visitQuery.data as { player_name?: unknown; payload?: unknown })
      : null;
  const payload = parseHousingSave(data?.payload);
  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">Friend visit</p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Saved home layout
          </h1>
        </div>
        <Link className="text-primary underline" to="/social" search={{ playerId: undefined }}>
          Back to friends
        </Link>
      </div>
      <DashboardFeatureStrip />
      {visitQuery.isLoading ? (
        <LoadingState />
      ) : visitQuery.isError || !payload ? (
        <section className="game-panel p-5" role="status">
          <p>This home is private, unavailable, or no longer shared with you.</p>
        </section>
      ) : (
        <>
          <p className="game-panel p-3 text-sm">
            Saved layout visit · read-only. The owner is not shown as present; this is not a live
            multiplayer room.
          </p>
          <HomeInterior
            key={`${characterId}:${JSON.stringify(payload)}`}
            initialSave={payload}
            readOnly
            visitorName={typeof data?.player_name === "string" ? data.player_name : "your friend"}
            onLeave={() => void navigate({ to: "/social", search: { playerId: undefined } })}
          />
        </>
      )}
    </div>
  );
}

function MyCityHome() {
  const now = useLiveClock();
  const world = useWorldClock();
  const {
    simulation,
    ready: simulationReady,
    busy: simulationBusy,
    start,
    complete,
  } = useGameTime();
  const { data: character } = useQuery(q.character());
  const { data: equippedItems } = useQuery({ ...q.equipment(), enabled: !!character });
  const roomEquipment = useMemo(
    () => normalizeEquippedItems(equippedItems).map(({ slot }) => ({ slot })),
    [equippedItems],
  );
  const housingHomeQuery = useQuery({
    queryKey: ["housingHome"],
    enabled: !!character,
    queryFn: loadHomeScene,
    retry: 1,
  });
  const homeQuery = useQuery({ ...q.homeSave(), enabled: !!character });
  const queryClient = useQueryClient();
  const homeItemRequestKeys = useRef(new Map<string, string>());
  useEffect(() => {
    if (!character?.id) return;
    const channel = supabase
      .channel(`home-items-${character.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "home_items",
          filter: `character_id=eq.${character.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["housingHome"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [character?.id, queryClient]);
  useEffect(() => {
    if (!character?.id) return;
    const channel = supabase
      .channel(`player-equipment-home-${character.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_equipment",
          filter: `character_id=eq.${character.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: q.equipment().queryKey }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [character?.id, queryClient]);
  const homeItemMutation = useMutation({
    mutationFn: async (args: {
      action: "place" | "remove" | "equip" | "unequip";
      itemId: string;
      slotId?: string;
      requestKey: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/home/${args.action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": args.requestKey,
          ...(sessionData.session
            ? { Authorization: `Bearer ${sessionData.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ item_id: args.itemId, slot_id: args.slotId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.code ?? "Home update failed.");
      return body as {
        home_items: {
          id: string;
          item_id: string;
          slot_type: string;
          slot_id: string | null;
          x: number;
          y: number;
          z: number;
          placed: boolean;
          equipped: boolean;
        }[];
      };
    },
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["housingHome"] });
      const previous = queryClient.getQueryData<typeof housingHomeQuery.data>(["housingHome"]);
      queryClient.setQueryData(["housingHome"], (current: typeof housingHomeQuery.data) =>
        current
          ? {
              ...current,
              home_items: current.home_items.map((item) =>
                item.item_id === args.itemId
                  ? {
                      ...item,
                      placed:
                        args.action === "place"
                          ? true
                          : args.action === "remove"
                            ? false
                            : item.placed,
                      equipped:
                        args.action === "equip"
                          ? true
                          : args.action === "unequip"
                            ? false
                            : item.equipped,
                      slot_id:
                        args.action === "place"
                          ? (args.slotId ?? item.slot_id)
                          : args.action === "remove"
                            ? null
                            : item.slot_id,
                    }
                  : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(["housingHome"], context.previous);
      toast.error(
        `That home change was not saved: ${error.message.replaceAll("_", " ").toLowerCase()}.`,
      );
    },
    onSuccess: (result, args) => {
      homeItemRequestKeys.current.delete(`${args.action}:${args.itemId}:${args.slotId ?? ""}`);
      queryClient.setQueryData(["housingHome"], (current: typeof housingHomeQuery.data) =>
        current ? { ...current, home_items: result.home_items } : current,
      );
    },
  });
  const [syncStatus, setSyncStatus] = useState<
    "saved" | "saving" | "offline" | "conflict" | "unavailable"
  >("saved");
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const revision = useRef(0);
  const latestLocalSave = useRef<HousingSave | null>(null);
  const pendingSave = useRef<HousingSave | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const hasConflict = useRef(false);

  const cloudSave = housingSaveFromCloud(homeQuery.data);
  const cloudRevision = cloudSave?.revision;
  const cloudRecord =
    homeQuery.data && typeof homeQuery.data === "object" && !Array.isArray(homeQuery.data)
      ? (homeQuery.data as { revision?: number })
      : null;
  const invalidCloudSave =
    homeQuery.data !== undefined && !cloudSave && cloudRecord?.revision !== 0;
  const storageKey = character ? `osogbo-life-housing-character-${character.id}-v1` : "";
  const localSave = readLocalHousingSave(storageKey);
  const localIsNewer =
    !!localSave &&
    (!cloudSave ||
      (!!localSave.savedAt &&
        !!cloudSave.savedAt &&
        Date.parse(localSave.savedAt) > Date.parse(cloudSave.savedAt)));
  const refetchHomeSave = homeQuery.refetch;

  useEffect(() => {
    if (cloudRevision !== undefined) revision.current = cloudRevision;
  }, [cloudRevision]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (homeQuery.isError || invalidCloudSave) setSyncStatus("unavailable");
    else if (!isOnline) setSyncStatus("offline");
    else if (!hasConflict.current && !saveInFlight.current && !pendingSave.current)
      setSyncStatus("saved");
  }, [homeQuery.isError, invalidCloudSave, isOnline]);

  // Retry a failed read on an actual reconnection, not on every error transition.
  const previouslyOnline = useRef(isOnline);
  useEffect(() => {
    const reconnected = isOnline && !previouslyOnline.current;
    previouslyOnline.current = isOnline;
    if (reconnected && homeQuery.isError) void refetchHomeSave();
  }, [homeQuery.isError, isOnline, refetchHomeSave]);

  const saveToCloud = useCallback(async () => {
    if (saveInFlight.current || !pendingSave.current) return;
    const payload = pendingSave.current;
    pendingSave.current = null;
    if (!payload) return;
    saveInFlight.current = true;
    setSyncStatus(isOnline ? "saving" : "offline");
    try {
      const result = await rpc.saveMyHome(payload as unknown as Json, revision.current);
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("The cloud returned an invalid save response.");
      const response = result as {
        ok?: boolean;
        conflict?: boolean;
        revision?: number;
        payload?: unknown;
        saved_at?: unknown;
      };
      if (response.conflict) {
        hasConflict.current = true;
        setSyncStatus("conflict");
        if (Number.isSafeInteger(response.revision)) revision.current = response.revision!;
        void refetchHomeSave();
      } else if (!response.ok || !Number.isSafeInteger(response.revision)) {
        throw new Error("The cloud did not confirm the home save.");
      } else {
        revision.current = response.revision!;
        hasConflict.current = false;
        queryClient.setQueryData(q.homeSave().queryKey, {
          payload: response.payload,
          revision: response.revision,
          saved_at: response.saved_at ?? new Date().toISOString(),
        } as unknown as Json);
        setSyncStatus("saved");
      }
    } catch (error) {
      setSyncStatus(navigator.onLine ? "unavailable" : "offline");
      if (navigator.onLine)
        toast.error(`Cloud save failed. Your device backup is kept. ${(error as Error).message}`);
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current && !hasConflict.current) {
        saveTimer.current = window.setTimeout(() => void saveToCloud(), 450);
      }
    }
  }, [isOnline, queryClient, refetchHomeSave]);

  const scheduleSave = useCallback(
    (save: HousingSave) => {
      latestLocalSave.current = save;
      pendingSave.current = save;
      if (hasConflict.current) {
        setSyncStatus("conflict");
        return;
      }
      setSyncStatus(isOnline ? "saving" : "offline");
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void saveToCloud(), 700);
    },
    [isOnline, saveToCloud],
  );

  const purchaseUpgrade = useCallback(
    async ({ roomId, upgradeId }: { roomId: string; upgradeId: string }) => {
      const result = await rpc.purchaseHomeUpgrade({
        roomId,
        upgradeId,
        expectedRevision: revision.current,
        requestId: crypto.randomUUID(),
      });
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("The server returned an invalid upgrade response.");
      const response = result as {
        ok?: boolean;
        conflict?: boolean;
        payload?: unknown;
        revision?: number;
        saved_at?: unknown;
      };
      if (response.conflict) {
        await refetchHomeSave();
        throw new Error(
          "Your home changed on another device. The latest save has been loaded; try again.",
        );
      }
      const updated = parseHousingSave(response.payload);
      if (!response.ok || !updated || !Number.isSafeInteger(response.revision))
        throw new Error("The server did not confirm the upgrade purchase.");
      revision.current = response.revision!;
      queryClient.setQueryData(q.homeSave().queryKey, {
        payload: response.payload,
        revision: response.revision,
        saved_at: response.saved_at ?? new Date().toISOString(),
      } as unknown as Json);
      await queryClient.invalidateQueries({ queryKey: q.wallet().queryKey });
      setSyncStatus("saved");
      return updated;
    },
    [queryClient, refetchHomeSave],
  );

  const purchaseFurniture = useCallback(
    async ({ itemId }: { itemId: string }) => {
      if (!cloudSave || syncStatus !== "saved")
        throw new Error("Wait for your home to finish saving before buying furniture.");
      const result = await rpc.purchaseHomeFurniture({
        itemId,
        expectedRevision: revision.current,
        requestId: crypto.randomUUID(),
      });
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("The server returned an invalid furniture purchase response.");
      const response = result as {
        ok?: boolean;
        conflict?: boolean;
        payload?: unknown;
        revision?: number;
        saved_at?: unknown;
      };
      if (response.conflict) {
        await refetchHomeSave();
        throw new Error(
          "Your home changed on another device. The latest save has been loaded; try again.",
        );
      }
      const updated = parseHousingSave(response.payload);
      if (!response.ok || !updated || !Number.isSafeInteger(response.revision))
        throw new Error("The server did not confirm the furniture purchase.");
      revision.current = response.revision!;
      queryClient.setQueryData(q.homeSave().queryKey, {
        payload: response.payload,
        revision: response.revision,
        saved_at: response.saved_at ?? new Date().toISOString(),
      } as unknown as Json);
      await queryClient.invalidateQueries({ queryKey: q.wallet().queryKey });
      setSyncStatus("saved");
      return updated;
    },
    [cloudSave, queryClient, refetchHomeSave, syncStatus],
  );

  const performFurnitureAction = useCallback(
    async (action: LifeActionId) => {
      if (!cloudSave || syncStatus !== "saved")
        return "Save your home layout to the cloud before using its furniture.";
      if (!simulationReady || simulationBusy)
        return "Your personal simulation is syncing. Try again in a moment.";
      if (simulation.locationType !== "home") return "Travel home before using furniture.";
      const requestId = `home-${crypto.randomUUID()}`;
      const startError = await start(action, requestId);
      if (startError) return startError;
      return complete(requestId);
    },
    [
      cloudSave,
      syncStatus,
      simulationReady,
      simulationBusy,
      simulation.locationType,
      start,
      complete,
    ],
  );

  const synchronizedLocalKey = useRef("");
  useEffect(() => {
    if (!character || homeQuery.isLoading || homeQuery.isError || !localSave || !localIsNewer)
      return;
    const key = `${character.id}:${localSave.savedAt ?? "legacy"}:${cloudSave?.revision ?? 0}`;
    if (synchronizedLocalKey.current === key) return;
    synchronizedLocalKey.current = key;
    scheduleSave(localSave.payload);
  }, [
    character,
    cloudSave?.revision,
    homeQuery.isError,
    homeQuery.isLoading,
    localIsNewer,
    localSave,
    scheduleSave,
  ]);

  const resolveConflict = useCallback(
    async (keepThisDevice: boolean) => {
      const { data, error } = await refetchHomeSave();
      if (error) {
        if (keepThisDevice && latestLocalSave.current) {
          hasConflict.current = false;
          pendingSave.current = latestLocalSave.current;
          setSyncStatus("saving");
          await saveToCloud();
          return;
        }
        toast.error("The latest cloud home save is unavailable. Your device copy is still saved.");
        return;
      }
      const latest = housingSaveFromCloud(data);
      revision.current = latest?.revision ?? 0;
      if (keepThisDevice && latestLocalSave.current) {
        hasConflict.current = false;
        pendingSave.current = latestLocalSave.current;
        setSyncStatus("saving");
        await saveToCloud();
      } else {
        hasConflict.current = false;
        latestLocalSave.current = latest?.payload ?? null;
        pendingSave.current = null;
        if (latest) {
          writeLocalHousingSave(
            storageKey,
            latest.payload,
            latest.savedAt ? new Date(latest.savedAt) : new Date(),
          );
        }
        setReloadToken((value) => value + 1);
        setSyncStatus("saved");
      }
    },
    [refetchHomeSave, saveToCloud, storageKey],
  );

  const retryCloudSave = useCallback(() => {
    if (!latestLocalSave.current) return;
    hasConflict.current = false;
    pendingSave.current = latestLocalSave.current;
    setSyncStatus("saving");
    void saveToCloud();
  }, [saveToCloud]);

  useEffect(() => {
    if (
      !isOnline ||
      !latestLocalSave.current ||
      syncStatus !== "offline" ||
      saveInFlight.current ||
      hasConflict.current
    )
      return;
    pendingSave.current = latestLocalSave.current;
    saveTimer.current = window.setTimeout(() => void saveToCloud(), 700);
  }, [isOnline, saveToCloud, syncStatus]);

  if (!character) return null;

  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">
            {now ? dashboardGreeting(osogboHour(now)) : "Welcome home"}, {character.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Your home</h1>
        </div>
      </div>
      {((character as typeof character & { onboarding_step?: string })?.onboarding_step ===
        "housing" ||
        housingHomeQuery.data?.home === null) && (
        <button
          type="button"
          className="game-panel flex w-full items-center justify-between gap-3 p-4 text-left"
          onClick={() => window.dispatchEvent(new Event("osogbo-open-housing"))}
        >
          <span>
            <strong>Find a place</strong>
            <span className="mt-1 block text-sm text-muted-foreground">
              Choose a home to settle into Osogbo.
            </span>
          </span>
          <span aria-hidden="true" className="text-primary">
            ›
          </span>
        </button>
      )}
      {homeQuery.isLoading ? (
        <HomeSceneSkeleton />
      ) : (
        <>
          {housingHomeQuery.isLoading ? (
            <HomeSceneSkeleton />
          ) : housingHomeQuery.isError ? (
            <section className="game-panel p-5" role="alert">
              <h2 className="font-display text-lg font-bold">Your home could not load</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {housingHomeQuery.error instanceof Error
                  ? housingHomeQuery.error.message
                  : "Check your connection and try again."}
              </p>
              <button
                type="button"
                className="mt-3 min-h-11 rounded-full bg-primary px-4 text-primary-foreground"
                onClick={() => void housingHomeQuery.refetch()}
              >
                Retry loading home
              </button>
            </section>
          ) : housingHomeQuery.data?.home ? (
            <LayeredHomeScene
              house={{
                label: housingHomeQuery.data.home.house_types.label,
                asset_key: housingHomeQuery.data.home.house_types.asset_key,
                slots: housingHomeQuery.data.home.house_types.slots,
              }}
              items={housingHomeQuery.data.home_items}
              appearance={(character.appearance ?? {}) as Record<string, unknown>}
              gender={character.gender}
              equipment={[
                ...(equippedItems ?? []).map((item) => ({ slot: item.slot })),
                ...housingHomeQuery.data.home_items
                  .filter((item) => item.equipped)
                  .map((item) => ({ slot: item.slot_type === "hat" ? "head" : item.slot_type })),
              ]}
              onAction={(action, itemId, slot) => {
                const slotId = slot?.id;
                const keyId = `${action}:${itemId}:${slotId ?? ""}`;
                const requestKey = homeItemRequestKeys.current.get(keyId) ?? crypto.randomUUID();
                homeItemRequestKeys.current.set(keyId, requestKey);
                homeItemMutation.mutate({
                  action,
                  itemId,
                  requestKey,
                  ...(slotId ? { slotId } : {}),
                });
              }}
            />
          ) : (
            <section className="game-panel p-5" role="status">
              <h2 className="font-display text-lg font-bold">You do not have a home yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your home is empty. Visit the shop to get furniture. Choose a place to live to set
                up your home.
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary underline"
                onClick={() => window.dispatchEvent(new Event("osogbo-open-housing"))}
              >
                Choose a home
              </button>
            </section>
          )}
          {syncStatus !== "saved" && syncStatus !== "saving" && (
            <section
              className="game-panel flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              aria-live="polite"
            >
              <span>
                {syncStatus === "offline"
                  ? "Offline · device backup saved; cloud sync will retry when connected."
                  : syncStatus === "conflict"
                    ? "A newer home save exists on another device."
                    : "Cloud save unavailable · your validated device backup is kept."}
              </span>
              {syncStatus === "conflict" && (
                <div className="flex gap-2">
                  <button
                    className="text-primary underline"
                    onClick={() => void resolveConflict(false)}
                  >
                    Load cloud copy
                  </button>
                  <button
                    className="text-primary underline"
                    onClick={() => void resolveConflict(true)}
                  >
                    Keep this device's copy
                  </button>
                </div>
              )}
              {syncStatus === "unavailable" && latestLocalSave.current && (
                <button className="text-primary underline" onClick={retryCloudSave}>
                  Retry cloud sync
                </button>
              )}
            </section>
          )}
          {housingHomeQuery.data?.home && (
            <details className="game-panel p-3">
              <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                Home activities and furniture
              </summary>
              <HomeInterior
                key={`${character.id}:${reloadToken}`}
                saveKey={storageKey}
                {...(localIsNewer && localSave
                  ? { initialSave: localSave.payload }
                  : cloudSave
                    ? { initialSave: cloudSave.payload }
                    : {})}
                onSave={scheduleSave}
                appearance={character.appearance as never}
                gender={character.gender}
                equipment={roomEquipment}
                onPurchaseUpgrade={purchaseUpgrade}
                onFurnitureAction={performFurnitureAction}
                authoritativeNeeds={simulation.needs}
                {...(cloudSave && syncStatus === "saved"
                  ? { onPurchaseFurniture: purchaseFurniture }
                  : {})}
                powerAvailable={world.data ? !isPowerOutageAt(world.data) : true}
              />
            </details>
          )}
        </>
      )}
    </div>
  );
}
