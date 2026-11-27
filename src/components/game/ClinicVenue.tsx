import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { parseSavedAppearance } from "@/game/character-animation";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldSceneReady } from "@/components/3d/WorldSceneReady";
import { TierOneClinicScene } from "@/components/3d/TierOneClinicScene";
import { VenueVisitor } from "@/components/3d/VenueVisitor";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { useClinicWalkthrough } from "@/hooks/use-clinic-walkthrough";
import { CLINIC_ROOMS } from "@/game/tier-one-clinic";
import { CLINIC_ROOM_APPROACH, CLINIC_SPAWN } from "@/game/clinic-navigation";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import type { ClinicVisit, ClinicVisitStatus } from "@/lib/clinic-visit";
import { ClinicVisitPanel } from "./ClinicVisitPanel";
import { VenueSceneBoundary } from "./VenueSceneBoundary";
import { WorldLoadingIndicator } from "./WorldLoadingIndicator";

export function ClinicVenue({
  slug,
  locationName,
  immersive = false,
}: {
  slug: string;
  locationName: string;
  immersive?: boolean | undefined;
}) {
  const walk = useClinicWalkthrough(slug);
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const playerEquipment = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const appearance = useMemo(() => parseSavedAppearance(character?.appearance), [character?.appearance]);
  const venue = getLocationVenueDesign(slug, locationName);
  const heading = useId();
  const [exterior, setExterior] = useState(false);
  const [room, setRoom] = useState("reception");
  const [fixture, setFixture] = useState(venue.fixtures[0]?.id ?? "");
  const [visit, setVisit] = useState<ClinicVisit | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const unavailable = useCallback(() => setStatus("fallback"), []);
  const ready = useCallback(
    () => setStatus((status) => (status === "loading" ? "ready" : status)),
    [],
  );
  const cancel = walk.cancel;
  useEffect(() => {
    if (exterior) cancel();
  }, [exterior, cancel]);
  useEffect(() => {
    if (walk.room) setRoom(walk.room);
  }, [walk.room]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setStatus((value) => (value === "loading" ? "fallback" : value)),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, []);
  const staff =
    visit?.status === "examination"
      ? visit.assignedStaff
      : visit?.staff?.onDuty
        ? visit.staff
        : null;
  const onStage = (stage: ClinicVisitStatus) => {
    if (exterior) return;
    const target =
      stage === "waiting"
        ? CLINIC_ROOM_APPROACH["waiting"]
        : stage === "examination"
          ? CLINIC_ROOM_APPROACH["exam"]
          : ["discharged", "cancelled"].includes(stage)
            ? CLINIC_SPAWN
            : null;
    if (target) walk.walkTo(target);
  };
  return (
    <section
      className={immersive ? "destination-venue-root" : "game-panel space-y-3 p-3 md:p-5"}
      aria-labelledby={heading}
    >
      <header>
        <p className="text-sm text-muted-foreground">{locationName}</p>
        <h2 id={heading} className="text-xl font-bold">
          {exterior ? "Clinic grounds" : "Clinic interior"}
        </h2>
      </header>
      <div data-venue-toolbar role="group" aria-label="Clinic view" className="flex gap-2">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={exterior === value}
            onClick={() => setExterior(value)}
            className="rounded-lg border border-edge bg-card px-3 py-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {value ? "Clinic grounds" : "Inside clinic"}
          </button>
        ))}
      </div>
      <div
        data-venue-viewport
        className="relative h-[55svh] min-h-72 overflow-hidden rounded-lg border border-edge bg-muted"
      >
        {status !== "fallback" && (
          <VenueSceneBoundary resetKey={slug} onError={unavailable}>
            <WorldCanvas
              onSceneError={unavailable}
              shadows="percentage"
              frameloop="demand"
              dpr={[1, 1.25]}
              gl={{ antialias: false, powerPreference: "low-power" }}
              fallback={<p className="p-4">WebGL is unavailable. Use the clinic controls below.</p>}
              aria-label="Interactive 3D clinic"
            >
              <WorldCamera
                width={exterior ? 34 : 24}
                depth={exterior ? 44 : 22}
                stage
                target={[0, 1.2, exterior ? 5 : 0]}
                zoom={1.65}
              />
              <WorldLighting size={44} />
              <TierOneClinicScene
                exterior={exterior}
                selectedRoom={room}
                onRoomSelect={setRoom}
                onWalkTo={walk.walkTo}
                fixtures={venue.fixtures}
                selected={fixture}
                onSelect={setFixture}
              />
              {!exterior && (
                {character && (
                  <WorldCharacter
                    name={character.name}
                    gender={character.gender}
                    appearance={appearance}
                    equipment={playerEquipment}
                    position={walk.position}
                    facing={walk.facing}
                    animation={walk.walking ? "walk" : "idle"}
                  />
                )}
              )}
              {!exterior && staff && (
                <VenueVisitor
                  position={[-7.5, 0.06, -6]}
                  facing="south"
                  uniformColor={WORLD_PALETTE.linen}
                />
              )}
              <WorldSceneReady onReady={ready} />
            </WorldCanvas>
          </VenueSceneBoundary>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <WorldLoadingIndicator
              title="Opening the clinic"
              detail="Preparing the grounds and rooms…"
            />
          </div>
        )}
        {status === "fallback" && (
          <p role="note" className="p-4">
            The 3D scene is unavailable on this device. The clinic controls remain available below.
          </p>
        )}
      </div>
      <details data-venue-controls open={!immersive}>
        <summary>Care & rooms</summary>
        <div>
          {!exterior && (
            <>
              <details>
                <summary className="cursor-pointer rounded-lg border border-edge p-3 text-sm font-semibold">
                  Rooms
                </summary>
                <div role="group" aria-label="Clinic rooms" className="mt-2 flex flex-wrap gap-2">
                  {CLINIC_ROOMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={room === item.id}
                      disabled={!CLINIC_ROOM_APPROACH[item.id]}
                      onClick={() => {
                        const target = CLINIC_ROOM_APPROACH[item.id];
                        if (target) {
                          setRoom(item.id);
                          walk.walkTo(target);
                        }
                      }}
                      className="rounded-lg border border-edge bg-card px-3 py-3 text-sm disabled:opacity-50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {item.name}
                      {!CLINIC_ROOM_APPROACH[item.id] ? " · Staff only" : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => walk.walkTo(CLINIC_SPAWN)}
                    className="rounded-lg border border-edge px-3 py-3 text-sm"
                  >
                    Return to entrance
                  </button>
                </div>
              </details>
              <p role="status" className="text-sm text-muted-foreground">
                {walk.message}
              </p>
              <p className="text-sm">
                {venue.fixtures.find((item) => item.id === fixture)?.detail}
              </p>
            </>
          )}
          <ClinicVisitPanel onStage={onStage} onVisit={setVisit} />
        </div>
      </details>
    </section>
  );
}
