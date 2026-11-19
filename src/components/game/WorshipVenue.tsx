import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorshipInterior3D } from "@/components/3d/WorshipInterior3D";
import { Button } from "@/components/ui/button";
import type { Appearance } from "@/game/avatar-appearance";
import { getWorshipLayout } from "@/game/worship-layouts";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";

/** How long a prayer takes in the game. The bonus is paid once a day per place. */
export const PRAYER_SECONDS = 30;

type Phase = "idle" | "praying" | "sending";

/** A prayer hall: the visitor kneels for a while, then the server pays the daily prayer bonus. */
export function WorshipVenue({ slug, locationName }: { slug: string; locationName: string }) {
  const layout = getWorshipLayout(slug);
  const client = useQueryClient();
  const { data: character } = useQuery(q.character());
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(PRAYER_SECONDS);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "praying") return undefined;
    const started = Date.now();
    setSecondsLeft(PRAYER_SECONDS);
    const timer = window.setInterval(() => {
      const left = Math.max(0, PRAYER_SECONDS - Math.floor((Date.now() - started) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        setPhase("sending");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "sending") return undefined;
    let cancelled = false;
    supabase
      .rpc("complete_worship_prayer", {
        p_place_slug: slug,
        p_request_id: crypto.randomUUID(),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMessage(error.message);
          toast.error(error.message);
        } else {
          const bonus = (data as { bonus: number }).bonus;
          const text = `Prayer complete. ${formatNaira(bonus)} prayer bonus received.`;
          setMessage(text);
          toast.success(text);
          void client.invalidateQueries({ queryKey: q.wallet().queryKey });
          void client.invalidateQueries({ queryKey: q.transactions().queryKey });
        }
        setPhase("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, slug, client]);

  if (!layout)
    return <p className="text-sm text-muted-foreground">This place has no prayer hall.</p>;

  const praying = phase !== "idle";
  const playerAppearance = (character?.appearance as Appearance | undefined) ?? {};
  const label =
    phase === "idle" ? "Pray" : phase === "praying" ? `Praying… ${secondsLeft}s` : "Sending…";

  return (
    <section aria-label={`${locationName} prayer hall`} className="relative">
      <div className="relative h-[calc(100dvh-7rem)] min-h-[24rem] overflow-hidden bg-muted">
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 17, layout.hall.depth / 2 + 9], fov: 42 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, -1)}
          aria-label={`${locationName} prayer hall. Pray to receive the prayer bonus.`}
        >
          <WorshipInterior3D
            layout={layout}
            praying={praying}
            playerAppearance={playerAppearance}
            playerGender={character?.gender ?? "nonbinary"}
          />
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-3 py-1 text-xs font-semibold">
          {locationName}
        </div>
        <div className="absolute bottom-3 right-3 flex max-w-[60%] flex-col items-end gap-2">
          {message && (
            <p
              role="status"
              className="pointer-events-none rounded-md bg-background/90 px-3 py-1 text-sm"
            >
              {message}
            </p>
          )}
          <Button
            variant="plain"
            onClick={() => {
              setMessage(null);
              setPhase("praying");
            }}
            disabled={phase !== "idle"}
          >
            {label}
          </Button>
        </div>
      </div>
    </section>
  );
}
