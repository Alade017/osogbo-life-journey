import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  OsunMallStreet3D,
  createStreetSim,
  startStreetWalk,
  type StreetSim,
} from "@/components/3d/OsunMallStreet3D";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import {
  OKADA_DESTINATIONS,
  OKADA_HOME,
  rideProgress,
  type OkadaRideStatus,
} from "@/game/okada-destinations";
import { canWalkOnStreet, findStreetPath } from "@/game/osun-mall-street-layout";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";

type RideRow = {
  id: string;
  destination: string;
  fare_minor: number;
  status: OkadaRideStatus;
  created_at: string;
};

/** How often the rides list is refreshed; the server moves rides along when asked. */
const RIDE_REFRESH_MS = 5000;

/**
 * The street outside the Osun Mall. Walking and the scene are local; rides are server-authoritative:
 * the fare is charged, the rider is found and the ride finishes on the server.
 */
export function OsunMallStreet({
  onEnterMall,
  accent,
}: {
  onEnterMall: () => void;
  accent: string;
}) {
  const sim = useRef<StreetSim>(createStreetSim());
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [riderOpen, setRiderOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());

  const fareQuery = useQuery({
    queryKey: ["okada", "fare"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("town_service_prices")
        .select("amount_minor")
        .eq("service", "okada_ride")
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data?.amount_minor ?? null;
    },
  });

  const ridesQuery = useQuery({
    queryKey: ["okada", "rides"],
    refetchInterval: RIDE_REFRESH_MS,
    queryFn: async (): Promise<RideRow[]> => {
      // Let the server move due rides along before reading them.
      const { error: syncError } = await supabase.rpc("okada_ride_sync");
      if (syncError) throw syncError;
      const { data, error } = await supabase
        .from("okada_ride_requests")
        .select("id,destination,fare_minor,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as RideRow[];
    },
  });

  const fare = fareQuery.data ?? null;
  const rides = ridesQuery.data ?? [];
  const assignedRideId = rides.find((ride) => ride.status === "assigned")?.id ?? null;
  const [riderTarget, setRiderTarget] = useState<WalkPoint | null>(null);
  useEffect(() => {
    // A found rider comes to where the visitor is standing, and goes back to the stand afterwards.
    setRiderTarget(assignedRideId ? [sim.current.player.pos[0], sim.current.player.pos[1]] : null);
  }, [assignedRideId]);

  const order = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_okada_ride", {
        p_destination: destination,
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDestination("");
      toast.success("Ride requested. Looking for a rider.");
      void client.invalidateQueries({ queryKey: ["okada"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase.rpc("okada_ride_cancel", { p_ride: rideId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ride cancelled. The fare has been refunded.");
      void client.invalidateQueries({ queryKey: ["okada"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onWalk = (point: WalkPoint) => {
    if (!canWalkOnStreet(point)) {
      setMessage("You can't walk there.");
      return;
    }
    const path = findStreetPath(sim.current.player.pos, point);
    if (!path) {
      setMessage("No clear route there.");
      return;
    }
    setMessage(null);
    startStreetWalk(sim, path);
  };

  const canOrder =
    !!destination && fare !== null && !!wallet && !order.isPending && wallet.balance >= fare;
  const playerAppearance = (character?.appearance as Appearance | undefined) ?? {};

  return (
    <section className="relative" aria-label="Osun Mall street">
      <div className="relative h-[calc(100dvh-7rem)] min-h-[24rem] overflow-hidden bg-muted">
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 16, 9], fov: 40 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0.6)}
          aria-label="Street outside the Osun Mall. Tap the ground to walk, the door to go in, or the rider to order a ride."
        >
          <OsunMallStreet3D
            sim={sim}
            playerAppearance={playerAppearance}
            playerGender={character?.gender ?? "nonbinary"}
            onWalk={onWalk}
            onEnterMall={onEnterMall}
            onRider={() => setRiderOpen(true)}
            riderTarget={riderTarget}
          />
        </Canvas>

        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-3 py-1 text-xs font-semibold">
          Outside the Osun Mall · Tap the door to go back in
        </div>

        <div className="absolute inset-x-3 bottom-3 flex flex-col items-center gap-2">
          {message && (
            <p
              role="status"
              className="pointer-events-none rounded-md bg-background/90 px-3 py-1 text-sm"
            >
              {message}
            </p>
          )}
          <button
            type="button"
            onClick={() => setRiderOpen((open) => !open)}
            className="rounded-lg border-2 px-4 py-2 text-sm font-bold"
            style={{ borderColor: accent, background: "var(--background, #fff)" }}
            aria-expanded={riderOpen}
          >
            Okada rides
          </button>
        </div>

        {riderOpen && (
          <div
            role="dialog"
            aria-label="Okada rides"
            className="absolute inset-x-3 top-12 max-h-[80%] overflow-y-auto rounded-lg border-2 border-edge bg-background/95 p-3 text-sm shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Okada rides</h2>
              <button type="button" className="font-semibold" onClick={() => setRiderOpen(false)}>
                Close
              </button>
            </div>

            {fare === null ? (
              <p className="mt-2 text-muted-foreground">Okada rides are unavailable right now.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p>
                  Fare <strong>{formatNaira(fare)}</strong>
                  {wallet && <> · Cash {formatNaira(wallet.balance)}</>}
                </p>
                <label className="block">
                  <span className="font-semibold">Destination</span>
                  <select
                    className="mt-1 block w-full rounded-md border-2 border-edge bg-background px-2 py-1"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                  >
                    <option value="">Choose a destination</option>
                    {OKADA_DESTINATIONS.map((place) => (
                      <option key={place} value={place}>
                        {place === OKADA_HOME ? "Home" : place}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!canOrder}
                  onClick={() => order.mutate()}
                  className="w-full rounded-lg border-2 border-edge px-3 py-2 font-bold disabled:opacity-50"
                >
                  {order.isPending
                    ? "Requesting…"
                    : wallet && fare !== null && wallet.balance < fare
                      ? "Insufficient cash"
                      : "Order ride"}
                </button>
              </div>
            )}

            <h3 className="mt-4 font-bold">Your rides</h3>
            {rides.length === 0 ? (
              <p className="text-muted-foreground">No rides yet.</p>
            ) : (
              <ul className="mt-1 space-y-2">
                {rides.map((ride) => {
                  const progress = rideProgress(
                    ride.status,
                    Date.parse(ride.created_at),
                    Date.now(),
                  );
                  return (
                    <li key={ride.id} className="rounded-md border border-edge p-2">
                      <div className="flex items-center justify-between gap-2">
                        <strong>
                          {ride.destination === OKADA_HOME ? "Home" : ride.destination}
                        </strong>
                        <span className="text-xs">{formatNaira(ride.fare_minor)}</span>
                      </div>
                      <p className="text-muted-foreground">{progress.label}</p>
                      {progress.canCancel && (
                        <button
                          type="button"
                          disabled={cancel.isPending}
                          onClick={() => cancel.mutate(ride.id)}
                          className="mt-1 font-semibold underline"
                        >
                          Cancel ride
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
