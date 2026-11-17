import { toast } from "sonner";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { q, rpc, type Character } from "@/lib/game";
import { clearPendingDepartureFromHome, requestDepartureFromHome } from "@/lib/home-departure";
import { hasConfirmedHomeDeparture } from "@/lib/home-departure-query";
import type { TravelMode } from "@/lib/transport-service";
import {
  initialMapTravelState,
  mapTravelBusy,
  mapTravelError,
  reduceMapTravelState,
  type MapTravelTab,
} from "./map-travel-state";

type Player = Pick<Character, "id" | "user_id" | "inside_home_property_id">;
/** Owns one destination flow. A confirmed trip can only retry synchronisation, never payment. */
export function useMapTravelController<T extends { id: string }>({
  character,
  queryClient,
  navigate,
}: {
  character: Player | null | undefined;
  queryClient: QueryClient;
  navigate: (
    options: { to: "/house" } | { to: "/location/$slug"; params: { slug: string } },
  ) => Promise<unknown>;
}) {
  const [state, dispatch] = useReducer(reduceMapTravelState<T>, initialMapTravelState<T>());
  const mounted = useRef(false);
  const generation = useRef(0);
  const actor = useRef<string | null>(null);
  const inFlight = useRef<object | null>(null);
  const confirmed = useRef<string | null>(null);
  const characterId = character?.id;
  const accountId = character?.user_id;
  useEffect(() => {
    const lifecycle = generation;
    mounted.current = true;
    return () => {
      mounted.current = false;
      lifecycle.current++;
    };
  }, []);
  useEffect(() => {
    const key = characterId && accountId ? `${accountId}:${characterId}` : null;
    if (actor.current !== null && actor.current !== key) {
      generation.current++;
      inFlight.current = null;
      confirmed.current = null;
      dispatch({ type: "reset" });
    }
    actor.current = key;
  }, [characterId, accountId]);
  const select = useCallback((landmark: T, tab: MapTravelTab = "travel") => {
    if (inFlight.current || confirmed.current) return;
    dispatch({ type: "select", landmark, tab });
  }, []);
  const close = useCallback(() => {
    if (!inFlight.current && !confirmed.current) dispatch({ type: "close" });
  }, []);
  const setTab = useCallback((tab: MapTravelTab) => dispatch({ type: "tab", tab }), []);
  const selectMode = useCallback((mode: TravelMode) => dispatch({ type: "mode", mode }), []);

  async function syncArrival(destinationId: string, version: number) {
    const current = () => mounted.current && generation.current === version;
    try {
      const saved = await queryClient.fetchQuery(q.character());
      if (!current()) return;
      if (saved?.current_location_id !== destinationId) {
        dispatch({
          type: "fail",
          message:
            "Travel is confirmed, but the saved destination has not refreshed yet. Retry loading; your trip will not be charged again.",
        });
        return;
      }
      const locations = await queryClient.fetchQuery(q.locations());
      if (!current()) return;
      const destination = locations?.find((location) => location.id === destinationId);
      if (!destination?.slug) throw new Error("Saved destination is unavailable.");
      await navigate({ to: "/location/$slug", params: { slug: destination.slug } });
      toast.success("Arrived at your destination", { id: `map-arrival-${destinationId}` });
      if (current()) dispatch({ type: "arrived" });
    } catch {
      if (current())
        dispatch({
          type: "fail",
          message:
            "Travel is confirmed, but your destination could not be loaded. Retry loading; your trip will not be charged again.",
        });
    }
  }
  async function confirm(destinationId: string, mode: TravelMode) {
    if (inFlight.current || confirmed.current || !state.landmark) return;
    if (!character?.id || !character.user_id) {
      dispatch({
        type: "fail",
        message: "Your player details are still loading. Please try again shortly.",
      });
      return;
    }
    const token = {};
    inFlight.current = token;
    const version = generation.current;
    const current = () => mounted.current && generation.current === version;
    dispatch({ type: "start" });
    try {
      let departing = false;
      try {
        if (character.inside_home_property_id)
          departing = await hasConfirmedHomeDeparture(queryClient, character);
      } catch {
        if (current())
          dispatch({
            type: "fail",
            message: "Your home status could not be checked. Try again; travel has not started.",
          });
        return;
      }
      if (!current()) return;
      if (departing) {
        dispatch({ type: "start", departing: true });
        const departure = requestDepartureFromHome({ locationId: destinationId, mode });
        try {
          await navigate({ to: "/house" });
        } catch {
          clearPendingDepartureFromHome(departure);
          if (current())
            dispatch({
              type: "fail",
              message:
                "Your home exit could not be opened. Please try again; travel has not started.",
            });
        }
        return;
      }
      try {
        await rpc.travelToLocation({ locationId: destinationId, mode });
      } catch (error) {
        if (current()) dispatch({ type: "fail", message: mapTravelError(error) });
        return;
      }
      if (!current()) return;
      confirmed.current = destinationId;
      dispatch({ type: "confirmed", destinationId });
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["character"], refetchType: "none" }),
          queryClient.invalidateQueries({ queryKey: ["locations"], refetchType: "none" }),
          queryClient.invalidateQueries({ queryKey: ["wallet"] }),
          queryClient.invalidateQueries({ queryKey: ["worldClock"] }),
          queryClient.invalidateQueries({ queryKey: ["visits"] }),
        ]);
        if (!current()) return;
        window.dispatchEvent(new Event("osogbo:server-state-changed"));
        await syncArrival(destinationId, version);
      } catch {
        if (current())
          dispatch({
            type: "fail",
            message:
              "Your trip is confirmed. Some game data could not refresh. Retry destination loading; you will not be charged again.",
          });
      }
    } finally {
      if (inFlight.current === token) inFlight.current = null;
    }
  }
  async function retryArrival() {
    const destinationId = confirmed.current;
    if (!destinationId || inFlight.current) return;
    const token = {};
    inFlight.current = token;
    dispatch({ type: "sync" });
    try {
      await syncArrival(destinationId, generation.current);
    } finally {
      if (inFlight.current === token) inFlight.current = null;
    }
  }
  return {
    state,
    select,
    close,
    setTab,
    selectMode,
    confirm,
    retryArrival,
    busy: mapTravelBusy(state.phase),
    arrivalConfirmed: !!state.confirmedDestinationId,
    canDismiss: !mapTravelBusy(state.phase) && !state.confirmedDestinationId,
  };
}
