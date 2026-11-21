import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOptionalGameTime } from "@/components/game/GameTimeProvider";
import { WorshipInterior3D } from "@/components/3d/WorshipInterior3D";
import { Button } from "@/components/ui/button";
import type { Appearance } from "@/game/avatar-appearance";
import { gameTimeFromCharacter } from "@/lib/game-time";
import { getWorshipLayout } from "@/game/worship-layouts";
import {
  isPrayerDue,
  prayerWindowLabel,
  prayersFor,
  type WorshipPrayer,
} from "@/game/worship-schedule";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";

/** How long a prayer takes in the game. The bonus is paid once per prayer per game day. */
export const PRAYER_SECONDS = 30;

type Phase = "idle" | "praying" | "sending";

/**
 * A prayer hall. Each prayer is held in its own window of game time; when one is due the visitor
 * kneels for a while, then the server pays the prayer bonus.
 */
export function WorshipVenue({ slug, locationName }: { slug: string; locationName: string }) {
  const layout = getWorshipLayout(slug);
  const prayers = prayersFor(slug);
  const client = useQueryClient();
  const { data: character } = useQuery(q.character());
  const liveClock = useOptionalGameTime();
  const [phase, setPhase] = useState<Phase>("idle");
  const [activePrayer, setActivePrayer] = useState<WorshipPrayer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PRAYER_SECONDS);
  const [message, setMessage] = useState<string | null>(null);

  // The live game clock when it is on screen; otherwise the clock saved on the character.
  const now =
    liveClock?.simulation.gameTime ?? (character ? gameTimeFromCharacter(character) : null);
  const minuteOfDay = now ? now.hour * 60 + now.minute : null;
  const weekday = now?.weekday ?? null;

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
    if (phase !== "sending" || !activePrayer) return undefined;
    let cancelled = false;
    supabase
      .rpc("complete_worship_prayer", {
        p_place_slug: slug,
        p_prayer: activePrayer.id,
        p_request_id: crypto.randomUUID(),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMessage(error.message);
          toast.error(error.message);
        } else {
          const bonus = (data as { bonus: number }).bonus;
          const text = `${activePrayer.label} prayer complete. ${formatNaira(bonus)} prayer bonus received.`;
          setMessage(text);
          toast.success(text);
          void client.invalidateQueries({ queryKey: q.wallet().queryKey });
          void client.invalidateQueries({ queryKey: q.transactions().queryKey });
        }
        setActivePrayer(null);
        setPhase("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, activePrayer, slug, client]);

  if (!layout)
    return <p className="text-sm text-muted-foreground">This place has no prayer hall.</p>;

  const praying = phase !== "idle";
  const playerAppearance = (character?.appearance as Appearance | undefined) ?? {};

  const startPrayer = (prayer: WorshipPrayer) => {
    setMessage(null);
    setActivePrayer(prayer);
    setPhase("praying");
  };

  return (
    <section aria-label={`${locationName} prayer hall`} className="relative">
      <div className="relative h-[calc(100dvh-7rem)] min-h-[24rem] overflow-hidden bg-muted">
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 17, layout.hall.depth / 2 + 9], fov: 42 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, -1)}
          aria-label={`${locationName} prayer hall. Pray when a prayer is due.`}
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
          <ul className="flex flex-col items-end gap-2" aria-label="Prayers">
            {prayers.map((prayer) => {
              const due =
                minuteOfDay !== null &&
                weekday !== null &&
                isPrayerDue(prayer, weekday, minuteOfDay);
              const active = activePrayer?.id === prayer.id && praying;
              const label = active
                ? phase === "praying"
                  ? `Praying… ${secondsLeft}s`
                  : "Sending…"
                : due
                  ? "Pray"
                  : "Not due";
              return (
                <li
                  key={prayer.id}
                  className="flex items-center gap-2 rounded-md bg-background/90 px-2 py-1"
                >
                  <span className="text-xs font-semibold">
                    {prayer.label} · {prayerWindowLabel(prayer)}
                  </span>
                  <Button
                    variant="plain"
                    disabled={!due || praying}
                    onClick={() => startPrayer(prayer)}
                  >
                    {label}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
