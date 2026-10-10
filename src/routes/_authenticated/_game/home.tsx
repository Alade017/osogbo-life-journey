import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeInterior } from "@/components/game/HomeInterior";
import { LifeSimulationPanel } from "@/components/game/LifeSimulationPanel";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { q, rpc } from "@/lib/game";
import { type HousingSave } from "@/lib/housing-service";
import type { Json } from "@/integrations/supabase/types";
import {
  housingSaveFromCloud,
  readLocalHousingSave,
  writeLocalHousingSave,
} from "@/lib/save-storage";
import { LoadingState } from "@/components/game/ui";
import { pageMeta } from "@/lib/seo";
import { useLiveClock } from "@/hooks/use-live-clock";
import { toast } from "sonner";
import { useWorldClock } from "@/hooks/use-world-clock";
import { isPowerOutageAt } from "@/lib/world-simulation";
import { parseHousingSave } from "@/lib/housing-service";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_game/home")({
  validateSearch: (search: Record<string, unknown>) => ({
    visit: typeof search["visit"] === "string" ? search["visit"] : undefined,
  }),
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

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
  const { data: character } = useQuery(q.character());
  const homeQuery = useQuery({ ...q.homeSave(), enabled: !!character });
  const visitPolicyQuery = useQuery({ ...q.homeVisitPolicy(), enabled: !!character });
  const queryClient = useQueryClient();
  const accessMutation = useMutation({
    mutationFn: rpc.setHomeVisitAccess,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: q.homeVisitPolicy().queryKey });
      toast.success("Home visit settings saved.");
    },
    onError: (error) => toast.error(error.message),
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
        toast.error("Could not load the latest cloud home save.");
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
            {now ? dashboardGreeting(now.getHours()) : "Welcome home"}, {character.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Your home</h1>
        </div>
      </div>
      <LifeSimulationPanel />
      {homeQuery.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section
            className="game-panel flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            aria-live="polite"
          >
            <span>
              {syncStatus === "saving"
                ? "Saving home to your account…"
                : syncStatus === "offline"
                  ? "Offline · device backup saved; cloud sync will retry when connected."
                  : syncStatus === "conflict"
                    ? "A newer home save exists on another device."
                    : syncStatus === "unavailable"
                      ? "Cloud save unavailable · your validated device backup is kept."
                      : `Home saved to this device${cloudSave ? " and your account" : ""}.`}
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
          <section className="game-panel flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div>
              <strong>Friends visiting your home</strong>
              <p className="text-muted-foreground">
                Friends can browse your saved layout. Your character needs and position stay
                private.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  visitPolicyQuery.data !== undefined &&
                  !!(visitPolicyQuery.data as { allow_friend_visits?: boolean }).allow_friend_visits
                }
                disabled={
                  !cloudSave ||
                  accessMutation.isPending ||
                  visitPolicyQuery.isLoading ||
                  visitPolicyQuery.isError
                }
                onChange={(event) => accessMutation.mutate(event.target.checked)}
              />
              Allow friend visits
            </label>
          </section>
          <HomeInterior
            key={`${character.id}:${reloadToken}`}
            saveKey={storageKey}
            {...(localIsNewer && localSave
              ? { initialSave: localSave.payload }
              : cloudSave
                ? { initialSave: cloudSave.payload }
                : {})}
            onSave={scheduleSave}
            powerAvailable={world.data ? !isPowerOutageAt(world.data) : true}
          />
        </>
      )}
    </div>
  );
}
